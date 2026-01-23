'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { MovementType, LoanType } from '../types';
import { incrementActionCount } from './profile';

async function getSupabase() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );
}

interface CreateMovementParams {
    description: string;
    amount: number;
    type: MovementType;
    date: string;
    accountId?: string;
    cardId?: string;
    categoryId?: string;

    // Scheduling
    dueDate?: string;  // When the payment is due (for future payments)
    isPaid?: boolean;  // Whether it's already paid (default: true for immediate, false for future)

    // Flags
    // Flags
    isLoan?: boolean;
    loanId?: string; // If linking to existing loan
    loanDescription?: string; // If creating new loan
    loanTotal?: number; // If creating new loan
    loanType?: LoanType;
    skipLoanUpdate?: boolean; // NEW: Skip updating loan balance (useful for initial movement)

    isReserve?: boolean;
    reserveId?: string;

    isReimbursement?: boolean;
}

export async function createMovement(params: CreateMovementParams) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    const {
        description, amount, type, date, accountId, cardId, categoryId,
        dueDate, isPaid,
        isLoan, loanId, loanDescription, loanTotal, loanType, skipLoanUpdate,
        isReserve, reserveId,
        isReimbursement
    } = params;

    // Determine if this is a pending payment (will be paid later)
    const finalIsPaidCheck = isPaid !== undefined ? isPaid : (dueDate ? false : true);
    const isPendingPayment = finalIsPaidCheck === false;

    // 0. Auto-assign default account if none specified (and no card)
    // SKIP for pending payments - they don't affect balance until paid
    let finalAccountId = accountId;
    let accountName: string | null = null;
    if (!finalAccountId && !cardId && (type === 'income' || type === 'expense') && !isPendingPayment) {
        const { getDefaultAccount, getOrCreateWallet } = await import('./assets');
        let defaultAccount = await getDefaultAccount();

        // If no default account exists, create/get the wallet
        if (!defaultAccount) {
            console.log('createMovement: No default account found, creating wallet...');
            defaultAccount = await getOrCreateWallet();
        }

        if (defaultAccount) {
            finalAccountId = defaultAccount.id;
            accountName = defaultAccount.name;
        } else {
            // This should never happen, but log if it does
            console.error('createMovement: CRITICAL - Could not get or create default account!');
        }
    }

    // 1. Validate "Rules of Gold" constraints
    if (isLoan && !loanId && !loanDescription) {
        throw new Error("Para empréstimos, informe o ID ou a descrição do novo empréstimo.");
    }
    if (isReserve && !reserveId) {
        throw new Error("Para reservas, informe o ID da reserva.");
    }

    try {
        // Start Transaction Logic (Supabase doesn't support multi-statement transactions via API easily, 
        // so we do best-effort sequence. In a real PG function this would be atomic.)

        let finalLoanId = loanId;

        // A. Handle Loan Creation/Update
        if (isLoan && !skipLoanUpdate) {
            if (!finalLoanId && loanDescription && loanTotal && loanType) {
                // Create new Loan
                const { data: newLoan, error: loanError } = await supabase
                    .from('loans')
                    .insert({
                        user_id: user.id,
                        description: loanDescription,
                        total_amount: loanTotal,
                        remaining_amount: loanTotal, // Initial state
                        type: loanType
                    })
                    .select()
                    .single();

                if (loanError) throw loanError;
                finalLoanId = newLoan.id;
            } else if (finalLoanId) {
                // Update existing Loan (Payment or New borrowing)
                // If type is 'expense' and loanType is 'taken', we are paying it back -> reduce remaining
                // If type is 'income' and loanType is 'given', they are paying us back -> reduce remaining

                // Fetch loan to know its type
                const { data: loan } = await supabase.from('loans').select('*').eq('id', finalLoanId).single();

                if (loan) {
                    let newRemaining = loan.remaining_amount;

                    if (loan.type === 'taken') {
                        if (type === 'expense') newRemaining -= amount; // Paying debt
                        if (type === 'income') newRemaining += amount; // Borrowing more
                    } else { // given
                        if (type === 'income') newRemaining -= amount; // Receiving payment
                        if (type === 'expense') newRemaining += amount; // Lending more
                    }

                    await supabase.from('loans').update({ remaining_amount: newRemaining }).eq('id', finalLoanId);
                }
            }
        }

        // B. Handle Reserve Update
        if (isReserve && reserveId) {
            const { data: reserve } = await supabase.from('reserves').select('*').eq('id', reserveId).single();
            if (reserve) {
                let newAmount = reserve.current_amount;
                // If transferring TO reserve (expense from account perspective), increase reserve
                if (type === 'transfer' || type === 'expense') {
                    newAmount += amount;
                }
                // If transferring FROM reserve (income to account), decrease reserve
                else if (type === 'income') {
                    newAmount -= amount;
                }

                await supabase.from('reserves').update({ current_amount: newAmount }).eq('id', reserveId);
            }
        }

        // C. Handle Account Balance Update
        // SKIP for pending payments - they don't affect balance until marked as paid
        if (finalAccountId && !isPendingPayment) {
            const { data: account } = await supabase.from('accounts').select('*').eq('id', finalAccountId).single();
            if (account) {
                // Capture account name if not already set
                if (!accountName) {
                    accountName = account.name;
                }
                let newBalance = account.balance;
                if (type === 'income') newBalance += amount;
                if (type === 'expense') newBalance -= amount;
                // Transfers depend on direction, usually handled by 2 movements or sign. 
                // For simplicity here: 
                // If isReserve=true and type='expense' (or transfer), we deducted from account to put in reserve.
                // If isReserve=true and type='income', we took from reserve to put in account.
                if (type === 'transfer') {
                    // Assuming 'transfer' here implies OUT of the account if it's the source
                    newBalance -= amount;
                }

                await supabase.from('accounts').update({ balance: newBalance }).eq('id', finalAccountId);
            }
        }

        // D. Create Movement Record
        // Smart default: is_paid = true if no dueDate, otherwise false (pending payment)
        const finalIsPaid = isPendingPayment ? false : true;

        const { data: movement, error: moveError } = await supabase
            .from('movements')
            .insert({
                user_id: user.id,
                description,
                amount,
                date,
                due_date: dueDate || null,
                is_paid: finalIsPaid,
                type,
                account_id: finalAccountId,
                card_id: cardId,
                category_id: categoryId,
                is_loan: isLoan || false,
                loan_id: finalLoanId,
                is_reserve: isReserve || false,
                reserve_id: reserveId,
                is_reimbursement: isReimbursement || false
            })
            .select()
            .single();

        if (moveError) throw moveError;

        // Increment action count for level progression
        let hitMilestone = false;
        try {
            const actionResult = await incrementActionCount();
            hitMilestone = actionResult.hitMilestone;
        } catch (e) {
            console.error('Error incrementing action count:', e);
            // Don't fail the movement creation if this fails
        }

        return { success: true, data: movement, hitMilestone, accountName };

    } catch (error: any) {
        console.error("Error creating movement:", error);
        return { success: false, error: error.message };
    }
}

export async function getFinancialStatus(userId?: string) {
    // Determine which Supabase client to use based on context
    // If userId is provided (Cron/Admin mode), use Service Role Key
    // Otherwise, use session-based client (User mode)
    const isAdminMode = !!userId;

    let supabase;
    let effectiveUserId: string;

    if (isAdminMode) {
        // Admin mode: Use Service Role Key to bypass RLS (for Cron jobs like Advisor)
        const { createClient } = await import('@supabase/supabase-js');
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        effectiveUserId = userId;
    } else {
        // User mode: Use session-based client
        supabase = await getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        effectiveUserId = user.id;
    }

    // Get current month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // Fetch movements for this month
    const { data: movements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', effectiveUserId)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

    // Recalculate balances (skip in Admin mode to avoid deep refactoring)
    if (!isAdminMode) {
        const { recalculateBalances } = await import('./assets');
        await recalculateBalances();
    }

    // Fetch total balance from all accounts (excluding savings, to match dashboard)
    const { data: accounts } = await supabase
        .from('accounts')
        .select('balance, type')
        .eq('user_id', effectiveUserId)
        .neq('type', 'savings');

    const totalBalance = accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;

    if (!movements) return { realIncome: 0, realExpense: 0, monthlyBalance: 0, previousBalance: totalBalance, totalBalance };

    let realIncome = 0;
    let realExpense = 0;

    movements.forEach(m => {
        // 1. Real Income: Income that is NOT a loan, NOT a reserve withdrawal, NOT reimbursement, NOT initial balance
        if (m.type === 'income' && !m.is_loan && !m.is_reserve && !m.is_reimbursement && !m.is_initial_balance) {
            realIncome += m.amount;
        }

        // 2. Real Expense: Expense that is NOT a loan repayment, NOT a reserve deposit, NOT reimbursement, NOT initial balance
        if (m.type === 'expense' && !m.is_loan && !m.is_reserve && !m.is_reimbursement && !m.is_initial_balance) {
            realExpense += m.amount;
        }
    });

    // Calculate previous balance (saldo anterior = total - income + expense)
    const previousBalance = totalBalance - realIncome + realExpense;

    return {
        previousBalance,     // Saldo anterior (antes deste mês)
        realIncome,
        realExpense,
        monthlyBalance: realIncome - realExpense, // Este mês
        totalBalance // Saldo total em todas as contas
    };
}

export async function deleteLastMovement(): Promise<{ success: boolean; error?: string; deletedDescription?: string; deletedCount?: number }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado" };

    // 1. Find the most recent movement
    const { data: lastMovement, error: fetchError } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !lastMovement) {
        return { success: false, error: "Nenhum lançamento encontrado para excluir." };
    }

    // 2. Check if this is part of an installment group
    let movementsToDelete: any[] = [lastMovement];

    if (lastMovement.installment_group_id) {
        // Smart Undo: Find ALL movements in this installment group
        const { data: groupMovements, error: groupError } = await supabase
            .from('movements')
            .select('*')
            .eq('user_id', user.id)
            .eq('installment_group_id', lastMovement.installment_group_id);

        if (!groupError && groupMovements && groupMovements.length > 0) {
            movementsToDelete = groupMovements;
            console.log(`[SMART_UNDO] Found ${movementsToDelete.length} movements in installment group ${lastMovement.installment_group_id}`);
        }
    }

    // 3. Revert account balances for all paid movements
    for (const mov of movementsToDelete) {
        if (mov.account_id && mov.is_paid) {
            const { data: account } = await supabase
                .from('accounts')
                .select('balance')
                .eq('id', mov.account_id)
                .single();

            if (account) {
                let newBalance = account.balance;
                // Reverse the effect
                if (mov.type === 'income') {
                    newBalance -= mov.amount;
                } else if (mov.type === 'expense') {
                    newBalance += mov.amount;
                }
                await supabase.from('accounts').update({ balance: newBalance }).eq('id', mov.account_id);
            }
        }
    }

    // 4. Delete all movements (single or group)
    const idsToDelete = movementsToDelete.map(m => m.id);
    const { error: deleteError } = await supabase
        .from('movements')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        return { success: false, error: deleteError.message };
    }

    // Build description based on whether it was a single movement or installment group
    const baseDescription = lastMovement.description.replace(/\s*\(\d+\/\d+\)$/, ''); // Remove "(X/Y)" suffix
    const deletedDescription = movementsToDelete.length > 1
        ? `${baseDescription} (${movementsToDelete.length} parcelas)`
        : lastMovement.description;

    return { success: true, deletedDescription, deletedCount: movementsToDelete.length };
}

export async function updateLastMovementAccount(newAccountName: string): Promise<{
    success: boolean;
    error?: string;
    oldAccountName?: string;
    newAccountName?: string;
    movementDescription?: string;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado" };

    // 1. Find the most recent movement
    const { data: lastMovement, error: fetchError } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !lastMovement) {
        return { success: false, error: "Nenhum lançamento encontrado para corrigir." };
    }

    // 2. Find the new account by name
    const { getAccountByName } = await import('./assets');
    const newAccount = await getAccountByName(newAccountName);

    if (!newAccount) {
        return { success: false, error: `Conta "${newAccountName}" não encontrada.` };
    }

    // 3. Get old account name for the response
    let oldAccountName = "desconhecida";
    if (lastMovement.account_id) {
        const { data: oldAccount } = await supabase
            .from('accounts')
            .select('name')
            .eq('id', lastMovement.account_id)
            .single();
        if (oldAccount) {
            oldAccountName = oldAccount.name;
        }
    }

    // 4. Revert balance from old account (if applicable and paid)
    if (lastMovement.account_id && lastMovement.is_paid) {
        const { data: oldAcc } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', lastMovement.account_id)
            .single();

        if (oldAcc) {
            let revertedBalance = oldAcc.balance;
            // Reverse the effect on old account
            if (lastMovement.type === 'income') {
                revertedBalance -= lastMovement.amount;
            } else if (lastMovement.type === 'expense') {
                revertedBalance += lastMovement.amount;
            }
            await supabase.from('accounts').update({ balance: revertedBalance }).eq('id', lastMovement.account_id);
        }
    }

    // 5. Apply balance to new account (if paid)
    if (lastMovement.is_paid) {
        const { data: newAcc } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', newAccount.id)
            .single();

        if (newAcc) {
            let newBalance = newAcc.balance;
            if (lastMovement.type === 'income') {
                newBalance += lastMovement.amount;
            } else if (lastMovement.type === 'expense') {
                newBalance -= lastMovement.amount;
            }
            await supabase.from('accounts').update({ balance: newBalance }).eq('id', newAccount.id);
        }
    }

    // 6. Update the movement's account_id
    const { error: updateError } = await supabase
        .from('movements')
        .update({ account_id: newAccount.id })
        .eq('id', lastMovement.id);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    return {
        success: true,
        oldAccountName,
        newAccountName: newAccount.name,
        movementDescription: lastMovement.description
    };
}

// Find pending movement by search term (for reconciling payments)
export async function findPendingMovement(searchTerm: string): Promise<{
    success: boolean;
    movement?: any;
    error?: string;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado" };

    // Search for pending (unpaid) movements matching the search term
    const { data: movements, error } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .ilike('description', `%${searchTerm}%`)
        .order('due_date', { ascending: true }) // Prioritize oldest due dates (pay 1/12 before 12/12)
        .order('created_at', { ascending: true })
        .limit(5);

    // Also log ALL pending movements to debug
    const { data: allPending } = await supabase
        .from('movements')
        .select('description, is_paid, due_date')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .limit(10);

    console.log(`[findPendingMovement] All pending movements:`, allPending?.map(m => m.description));
    console.log(`[findPendingMovement] Searching for "${searchTerm}", found ${movements?.length || 0} results`);

    if (error) {
        console.error('[findPendingMovement] Error:', error);
        return { success: false, error: error.message };
    }

    if (!movements || movements.length === 0) {
        return { success: false, error: `Nenhuma conta pendente encontrada com "${searchTerm}".` };
    }

    return { success: true, movement: movements[0] };
}

// Update pending movement amount and optionally mark as paid
export async function updatePendingMovement(params: {
    movementId: string;
    amount?: number;
    markAsPaid?: boolean;
}): Promise<{
    success: boolean;
    movement?: any;
    accountName?: string;
    error?: string;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado" };

    const { movementId, amount, markAsPaid } = params;

    // Build update object
    const updateData: any = {};
    if (amount !== undefined && amount > 0) {
        updateData.amount = amount;
    }
    if (markAsPaid) {
        updateData.is_paid = true;
    }

    if (Object.keys(updateData).length === 0) {
        return { success: false, error: "Nada para atualizar." };
    }

    // Get the movement first to update account balance if marking as paid
    const { data: movement, error: fetchError } = await supabase
        .from('movements')
        .select('*')
        .eq('id', movementId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !movement) {
        return { success: false, error: "Movimento não encontrado." };
    }

    let accountName: string | undefined;
    let accountIdToUse = movement.account_id;

    // If marking as paid and movement doesn't have an account, assign default account
    if (markAsPaid && !movement.is_paid) {
        if (!accountIdToUse && (movement.type === 'income' || movement.type === 'expense')) {
            // Get default account
            const { getDefaultAccount, getOrCreateWallet } = await import('./assets');
            let defaultAccount = await getDefaultAccount();

            if (!defaultAccount) {
                defaultAccount = await getOrCreateWallet();
            }

            if (defaultAccount) {
                accountIdToUse = defaultAccount.id;
                accountName = defaultAccount.name;
                updateData.account_id = accountIdToUse;
            }
        } else if (accountIdToUse) {
            // Movement already has account, just get the name
            const { data: account } = await supabase
                .from('accounts')
                .select('name')
                .eq('id', accountIdToUse)
                .single();
            if (account) {
                accountName = account.name;
            }
        }

        // Update account balance
        if (accountIdToUse) {
            const finalAmount = amount !== undefined ? amount : movement.amount;

            const { data: account } = await supabase
                .from('accounts')
                .select('balance')
                .eq('id', accountIdToUse)
                .single();

            if (account) {
                let newBalance = account.balance;
                if (movement.type === 'income') {
                    newBalance += finalAmount;
                } else if (movement.type === 'expense') {
                    newBalance -= finalAmount;
                }
                await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountIdToUse);
            }
        }
    }

    // Update the movement
    const { data: updatedMovement, error: updateError } = await supabase
        .from('movements')
        .update(updateData)
        .eq('id', movementId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    return { success: true, movement: updatedMovement, accountName };
}
