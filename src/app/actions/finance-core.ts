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
    isLoan?: boolean;
    loanId?: string; // If linking to existing loan
    loanDescription?: string; // If creating new loan
    loanTotal?: number; // If creating new loan
    loanType?: LoanType;

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
        isLoan, loanId, loanDescription, loanTotal, loanType,
        isReserve, reserveId,
        isReimbursement
    } = params;

    // 0. Auto-assign default account if none specified (and no card)
    let finalAccountId = accountId;
    if (!finalAccountId && !cardId && (type === 'income' || type === 'expense')) {
        const { getDefaultAccount, getOrCreateWallet } = await import('./assets');
        let defaultAccount = await getDefaultAccount();

        // If no default account exists, create/get the wallet
        if (!defaultAccount) {
            console.log('createMovement: No default account found, creating wallet...');
            defaultAccount = await getOrCreateWallet();
        }

        if (defaultAccount) {
            finalAccountId = defaultAccount.id;
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
        if (isLoan) {
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
        if (finalAccountId) {
            const { data: account } = await supabase.from('accounts').select('*').eq('id', finalAccountId).single();
            if (account) {
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
        const finalIsPaid = isPaid !== undefined ? isPaid : (dueDate ? false : true);

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
        try {
            await incrementActionCount();
        } catch (e) {
            console.error('Error incrementing action count:', e);
            // Don't fail the movement creation if this fails
        }

        return { success: true, data: movement };

    } catch (error: any) {
        console.error("Error creating movement:", error);
        return { success: false, error: error.message };
    }
}

export async function getFinancialStatus() {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get current month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // Fetch movements
    const { data: movements } = await supabase
        .from('movements')
        .select('*')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

    if (!movements) return { realIncome: 0, realExpense: 0, balance: 0 };

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

    return {
        realIncome,
        realExpense,
        balance: realIncome - realExpense // Net Result
    };
}

export async function deleteLastMovement(): Promise<{ success: boolean; error?: string; deletedDescription?: string }> {
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

    // 2. Revert account balance if applicable
    if (lastMovement.account_id && lastMovement.is_paid) {
        const { data: account } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', lastMovement.account_id)
            .single();

        if (account) {
            let newBalance = account.balance;
            // Reverse the effect
            if (lastMovement.type === 'income') {
                newBalance -= lastMovement.amount;
            } else if (lastMovement.type === 'expense') {
                newBalance += lastMovement.amount;
            }
            await supabase.from('accounts').update({ balance: newBalance }).eq('id', lastMovement.account_id);
        }
    }

    // 3. Delete the movement
    const { error: deleteError } = await supabase
        .from('movements')
        .delete()
        .eq('id', lastMovement.id);

    if (deleteError) {
        return { success: false, error: deleteError.message };
    }

    return { success: true, deletedDescription: lastMovement.description };
}
