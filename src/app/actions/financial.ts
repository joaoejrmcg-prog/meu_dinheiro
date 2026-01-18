'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Movement, Recurrence } from '../types';

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

// ============ MOVEMENTS ============

interface GetMovementsParams {
    month?: number;
    year?: number;
    type?: 'income' | 'expense' | 'transfer';
}

export async function getMovements(params?: GetMovementsParams): Promise<Movement[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
        .from('movements')
        .select(`
            *,
            accounts:account_id (name)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    // Filter by month/year
    if (params?.month && params?.year) {
        const startDate = new Date(params.year, params.month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(params.year, params.month, 0).toISOString().split('T')[0];
        query = query.gte('date', startDate).lte('date', endDate);
    }

    // Filter by type
    if (params?.type) {
        query = query.eq('type', params.type);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching movements:", error);
        return [];
    }

    // Map the joined data to include account_name
    return (data || []).map((m: any) => ({
        ...m,
        account_name: m.accounts?.name || null
    }));
}

export async function getLastMovement(): Promise<Movement | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) return null;
    return data;
}

/**
 * Returns account statement with previous balance, entries, and exits for the current month
 */
export async function getAccountStatement(accountId: string, month?: number, year?: number): Promise<{
    previousBalance: number;
    entries: Movement[];
    exits: Movement[];
    totalEntries: number;
    totalExits: number;
    currentBalance: number;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { previousBalance: 0, entries: [], exits: [], totalEntries: 0, totalExits: 0, currentBalance: 0 };

    // Default to current month
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    // Current month date range
    const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    // Previous month for balance calculation
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevEndDate = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

    // Get account initial balance
    const { data: account } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', accountId)
        .single();

    const initialBalance = Number(account?.initial_balance) || 0;

    // Get all movements for this account up to end of previous month (for previous balance)
    const { data: prevMovements } = await supabase
        .from('movements')
        .select('amount, type, description')
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .eq('is_paid', true)
        .lte('date', prevEndDate);

    // Calculate previous balance from initial + movements
    let previousBalance = initialBalance;
    (prevMovements || []).forEach((m: { amount: number; type: string; description?: string }) => {
        if (m.type === 'income') {
            previousBalance += m.amount;
        } else if (m.type === 'expense') {
            previousBalance -= m.amount;
        } else if (m.type === 'transfer') {
            // Handle transfers: ← = incoming (add), → = outgoing (subtract)
            if (m.description?.includes('←')) {
                previousBalance += m.amount;
            } else if (m.description?.includes('→')) {
                previousBalance -= m.amount;
            }
        }
    });

    // Get current month movements
    const { data: currentMovements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

    const entries = (currentMovements || []).filter((m: Movement) =>
        m.type === 'income' || (m.type === 'transfer' && m.description?.includes('←'))
    );
    const exits = (currentMovements || []).filter((m: Movement) =>
        m.type === 'expense' || (m.type === 'transfer' && m.description?.includes('→'))
    );

    const totalEntries = entries.reduce((sum: number, m: Movement) => sum + m.amount, 0);
    const totalExits = exits.reduce((sum: number, m: Movement) => sum + m.amount, 0);

    // Current balance = previous + entries - exits (only paid movements)
    const paidEntries = entries.filter((m: Movement) => m.is_paid).reduce((sum: number, m: Movement) => sum + m.amount, 0);
    const paidExits = exits.filter((m: Movement) => m.is_paid).reduce((sum: number, m: Movement) => sum + m.amount, 0);
    const currentBalance = previousBalance + paidEntries - paidExits;

    return {
        previousBalance,
        entries,
        exits,
        totalEntries,
        totalExits,
        currentBalance
    };
}

export async function deleteMovement(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('movements')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function updateMovement(id: string, params: {
    description?: string;
    amount?: number;
    date?: string;
    due_date?: string;
    is_paid?: boolean;
    account_id?: string;
    category_id?: string;
    card_id?: string;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('movements')
        .update(params)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function createMovementManual(params: {
    description: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
    due_date?: string;
    is_paid?: boolean;
    account_id?: string;
    category_id?: string;
    card_id?: string;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    let accountId = params.account_id;

    // If no account AND no card specified, get default wallet
    if (!accountId && !params.card_id) {
        const { data: wallet } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'wallet')
            .single();
        accountId = wallet?.id;
    }

    const { data, error } = await supabase
        .from('movements')
        .insert({
            user_id: user.id,
            description: params.description,
            amount: params.amount,
            type: params.type,
            date: params.date,
            due_date: params.due_date || null,
            is_paid: params.is_paid ?? true,
            account_id: accountId || null,
            category_id: params.category_id || null,
            card_id: params.card_id || null,
            is_loan: false,
            is_reserve: false,
            is_reimbursement: false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============ TRANSFERS ============

export async function createTransfer(params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    date?: string;
    allowNegative?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { fromAccountId, toAccountId, amount, description, date } = params;
    const transferDate = date || new Date().toISOString().split('T')[0];
    const transferDesc = description || 'Transferência entre contas';

    if (fromAccountId === toAccountId) {
        return { success: false, error: 'Conta de origem e destino não podem ser iguais.' };
    }

    if (amount <= 0) {
        return { success: false, error: 'O valor deve ser maior que zero.' };
    }

    try {
        // 0. Recalculate source account balance to ensure it's up-to-date
        const { recalculateAccountBalance } = await import('./assets');
        await recalculateAccountBalance(fromAccountId);

        // 1. Get account names for better descriptions
        const { data: fromAccount } = await supabase
            .from('accounts')
            .select('id, name, balance')
            .eq('id', fromAccountId)
            .eq('user_id', user.id)
            .single();

        const { data: toAccount } = await supabase
            .from('accounts')
            .select('id, name, balance')
            .eq('id', toAccountId)
            .eq('user_id', user.id)
            .single();

        if (!fromAccount || !toAccount) {
            return { success: false, error: 'Conta de origem ou destino não encontrada.' };
        }

        // 2. Check if source has enough balance (skip if allowNegative)
        if (fromAccount.balance < amount && !params.allowNegative) {
            return { success: false, error: `Saldo insuficiente. Disponível: R$ ${fromAccount.balance.toFixed(2)}` };
        }

        // 3. Create OUT movement (from source account)
        const { error: outError } = await supabase
            .from('movements')
            .insert({
                user_id: user.id,
                description: `${transferDesc} → ${toAccount.name}`,
                amount: amount,
                type: 'transfer',
                date: transferDate,
                account_id: fromAccountId,
                is_paid: true,
                is_loan: false,
                is_reserve: false,
                is_reimbursement: false
            });

        if (outError) throw outError;

        // 4. Create IN movement (to destination account)
        const { error: inError } = await supabase
            .from('movements')
            .insert({
                user_id: user.id,
                description: `${transferDesc} ← ${fromAccount.name}`,
                amount: amount,
                type: 'transfer',
                date: transferDate,
                account_id: toAccountId,
                is_paid: true,
                is_loan: false,
                is_reserve: false,
                is_reimbursement: false
            });

        if (inError) throw inError;

        // 5. Update source account balance (decrease)
        const { error: fromBalanceError } = await supabase
            .from('accounts')
            .update({ balance: fromAccount.balance - amount })
            .eq('id', fromAccountId);

        if (fromBalanceError) throw fromBalanceError;

        // 6. Update destination account balance (increase)
        const { error: toBalanceError } = await supabase
            .from('accounts')
            .update({ balance: toAccount.balance + amount })
            .eq('id', toAccountId);

        if (toBalanceError) throw toBalanceError;

        return { success: true };

    } catch (error: any) {
        console.error("Error creating transfer:", error);
        return { success: false, error: error.message };
    }
}

// ============ RECURRENCES ============

export async function getRecurrences(): Promise<Recurrence[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('recurrences')
        .select('*, accounts(name)')
        .eq('user_id', user.id)
        .order('next_due_date', { ascending: true });

    if (error) {
        console.error("Error fetching recurrences:", error);
        return [];
    }

    // Map to include account_name from the join
    return (data || []).map(rec => ({
        ...rec,
        account_name: rec.accounts?.name
    }));
}

export async function createRecurrence(params: {
    description: string;
    amount: number;
    type: 'income' | 'expense';
    frequency: 'monthly' | 'weekly' | 'yearly';
    next_due_date: string;
    account_id?: string;
    category_id?: string;
    card_id?: string;
    is_auto_debit?: boolean;
    variable_amount?: boolean;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase
        .from('recurrences')
        .insert({
            user_id: user.id,
            ...params,
            active: true
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteRecurrence(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('recurrences')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function updateRecurrence(id: string, params: {
    description?: string;
    amount?: number;
    type?: 'income' | 'expense';
    frequency?: 'monthly' | 'weekly' | 'yearly';
    next_due_date?: string;
    account_id?: string;
    category_id?: string;
    card_id?: string;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('recurrences')
        .update(params)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

/**
 * Find a recurrence by description (partial match, case-insensitive)
 */
export async function findRecurrenceByDescription(searchTerm: string): Promise<{
    success: boolean;
    recurrence?: any;
    error?: string;
    multipleMatches?: any[];
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    const { data: recurrences, error } = await supabase
        .from('recurrences')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

    if (error) return { success: false, error: error.message };
    if (!recurrences || recurrences.length === 0) {
        return { success: false, error: "Você não tem nenhuma conta recorrente cadastrada." };
    }

    // Search for matching recurrences (case-insensitive, partial match)
    const searchLower = searchTerm.toLowerCase();
    const matches = recurrences.filter(rec =>
        rec.description.toLowerCase().includes(searchLower)
    );

    if (matches.length === 0) {
        return { success: false, error: `Não encontrei nenhuma recorrência com "${searchTerm}".` };
    }

    if (matches.length === 1) {
        return { success: true, recurrence: matches[0] };
    }

    // Multiple matches - return them for user to choose
    return {
        success: false,
        error: `Encontrei ${matches.length} recorrências com "${searchTerm}". Seja mais específico.`,
        multipleMatches: matches
    };
}

/**
 * Mark an existing recurrence as auto-debit
 * @returns Error if recurrence is on Carteira (wallet)
 */
export async function setAutoDebit(recurrenceId: string, isAutoDebit: boolean): Promise<{
    success: boolean;
    error?: string;
    recurrence?: any;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    // Get recurrence first
    const { data: recurrence, error: fetchError } = await supabase
        .from('recurrences')
        .select('*')
        .eq('id', recurrenceId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !recurrence) {
        return { success: false, error: "Recorrência não encontrada." };
    }

    // Check if account is wallet - DA doesn't make sense there
    if (recurrence.account_id) {
        const { data: account } = await supabase
            .from('accounts')
            .select('type, name')
            .eq('id', recurrence.account_id)
            .single();

        if (account?.type === 'wallet') {
            return {
                success: false,
                error: `Débito automático não funciona na Carteira. Primeiro, associe "${recurrence.description}" a uma conta bancária.`
            };
        }
    }

    // Update recurrence
    const { data: updated, error: updateError } = await supabase
        .from('recurrences')
        .update({ is_auto_debit: isAutoDebit })
        .eq('id', recurrenceId)
        .select()
        .single();

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    return { success: true, recurrence: updated };
}

/**
 * Find recurrence by description and check if it can be auto-debit
 * Returns additional info about the account (name, isWallet)
 */
export async function findRecurrenceForAutoDebit(searchTerm: string): Promise<{
    success: boolean;
    recurrence?: any;
    accountName?: string;
    isWallet?: boolean;
    error?: string;
    notFound?: boolean;
}> {
    const result = await findRecurrenceByDescription(searchTerm);

    if (!result.success) {
        // Check if it's a "not found" vs other error (case-insensitive)
        const errorLower = result.error?.toLowerCase() || '';
        const notFound = errorLower.includes("não encontrei") || errorLower.includes("não tem nenhuma");
        return {
            success: false,
            error: result.error,
            notFound: notFound
        };
    }

    // Get account details if recurrence has account_id
    if (result.recurrence.account_id) {
        const supabase = await getSupabase();
        const { data: account } = await supabase
            .from('accounts')
            .select('name, type')
            .eq('id', result.recurrence.account_id)
            .single();

        return {
            success: true,
            recurrence: result.recurrence,
            accountName: account?.name,
            isWallet: account?.type === 'wallet'
        };
    }

    // No account linked - need to ask which bank
    return {
        success: true,
        recurrence: result.recurrence,
        isWallet: false,
        accountName: undefined
    };
}

/**
 * Update the amount for a recurrence when bill arrives
 * DOES NOT create movement - just updates the recurrence value
 * Movement is created on due date when payment actually happens
 */
export async function updateRecurrenceAmount(params: {
    recurrenceId: string;
    amount: number;
}): Promise<{
    success: boolean;
    recurrence?: any;
    accountName?: string;
    error?: string;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    // Get recurrence details
    const { data: recurrence, error: recError } = await supabase
        .from('recurrences')
        .select('*')
        .eq('id', params.recurrenceId)
        .eq('user_id', user.id)
        .single();

    if (recError || !recurrence) {
        return { success: false, error: "Recorrência não encontrada." };
    }

    // Get account name for response
    let accountName: string | undefined;
    if (recurrence.account_id) {
        const { data: account } = await supabase
            .from('accounts')
            .select('name')
            .eq('id', recurrence.account_id)
            .single();
        accountName = account?.name;
    }

    // Update only the amount in the recurrence
    const { data: updated, error: updateError } = await supabase
        .from('recurrences')
        .update({ amount: params.amount })
        .eq('id', params.recurrenceId)
        .select()
        .single();

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    console.log('[AUTO-DEBIT] Updated recurrence amount to:', params.amount);

    return { success: true, recurrence: updated, accountName };
}

/**
 * Register a payment for an auto-debit recurrence
 * Creates a movement already marked as paid for the current month
 * (Used when the due date arrives and bank actually debits)
 */
export async function registerAutoDebitPayment(params: {
    recurrenceId: string;
    amount: number;
    date?: string;
}): Promise<{
    success: boolean;
    movement?: any;
    accountName?: string;
    error?: string;
    wasUpdated?: boolean;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    // Get recurrence details
    const { data: recurrence, error: recError } = await supabase
        .from('recurrences')
        .select('*')
        .eq('id', params.recurrenceId)
        .eq('user_id', user.id)
        .single();

    if (recError || !recurrence) {
        return { success: false, error: "Recorrência não encontrada." };
    }

    // Get account name for response
    let accountName: string | undefined;
    if (recurrence.account_id) {
        const { data: account } = await supabase
            .from('accounts')
            .select('name')
            .eq('id', recurrence.account_id)
            .single();
        accountName = account?.name;
    }

    // Use recurrence's due date for this month, not today's date
    // This ensures the payment appears on the correct day in calendar
    const today = new Date();
    const recDueDate = new Date(recurrence.next_due_date);

    // If due date is in current month, use it; otherwise use today
    let paymentDate: string;
    if (recDueDate.getMonth() === today.getMonth() && recDueDate.getFullYear() === today.getFullYear()) {
        paymentDate = recurrence.next_due_date;
    } else if (params.date) {
        paymentDate = params.date;
    } else {
        // Calculate due date for current month
        const dueDay = recDueDate.getDate();
        paymentDate = new Date(today.getFullYear(), today.getMonth(), dueDay).toISOString().split('T')[0];
    }

    console.log('[AUTO-DEBIT] Using payment date:', paymentDate, 'from recurrence due:', recurrence.next_due_date);

    // Calculate month range for duplicate check
    const dateObj = new Date(paymentDate);
    const monthStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).toISOString().split('T')[0];

    console.log('[AUTO-DEBIT] Checking for existing movement:', {
        description: recurrence.description,
        monthStart,
        monthEnd
    });

    // Check if movement already exists for this recurrence this month
    const { data: existingMovements, error: searchError } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .ilike('description', recurrence.description)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .limit(1);

    const existingMovement = existingMovements && existingMovements.length > 0 ? existingMovements[0] : null;
    console.log('[AUTO-DEBIT] Existing movement found:', existingMovement?.id || 'none');

    if (existingMovement) {
        // Update existing movement instead of creating new
        const oldAmount = existingMovement.amount;
        const { data: updated, error: updateError } = await supabase
            .from('movements')
            .update({ amount: params.amount })
            .eq('id', existingMovement.id)
            .select()
            .single();

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Update account balance (adjust for difference)
        if (recurrence.account_id) {
            const { data: account } = await supabase
                .from('accounts')
                .select('balance')
                .eq('id', recurrence.account_id)
                .single();

            if (account) {
                const difference = params.amount - oldAmount;
                const newBalance = recurrence.type === 'expense'
                    ? account.balance - difference
                    : account.balance + difference;

                await supabase
                    .from('accounts')
                    .update({ balance: newBalance })
                    .eq('id', recurrence.account_id);
            }
        }

        console.log('[AUTO-DEBIT] Updated existing movement to:', params.amount);
        return { success: true, movement: updated, accountName, wasUpdated: true };
    }

    // Create new movement for this payment (already paid - auto-debit)
    const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert({
            user_id: user.id,
            description: recurrence.description,
            amount: params.amount,
            type: recurrence.type,
            date: paymentDate,
            due_date: paymentDate,
            is_paid: true, // Auto-debit = already paid by bank
            account_id: recurrence.account_id,
            category_id: recurrence.category_id,
            is_loan: false,
            is_reserve: false,
            is_reimbursement: false
        })
        .select()
        .single();

    if (movError) {
        return { success: false, error: movError.message };
    }

    // Update account balance (subtract for expense, add for income)
    if (recurrence.account_id) {
        const { data: account } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', recurrence.account_id)
            .single();

        if (account) {
            const newBalance = recurrence.type === 'expense'
                ? account.balance - params.amount
                : account.balance + params.amount;

            await supabase
                .from('accounts')
                .update({ balance: newBalance })
                .eq('id', recurrence.account_id);
        }
    }

    // Advance recurrence to next month
    const nextMonth = new Date(recDueDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextDueDateStr = nextMonth.toISOString().split('T')[0];

    await supabase
        .from('recurrences')
        .update({ next_due_date: nextDueDateStr })
        .eq('id', params.recurrenceId);

    console.log('[AUTO-DEBIT] Advanced recurrence to next month:', nextDueDateStr);

    return { success: true, movement, accountName };
}

// ============ SUMMARY ============

export async function getMonthSummary(month: number, year: number, status: 'paid' | 'pending' | 'all' = 'all') {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { income: 0, expense: 0, balance: 0 };

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const startDate = formatDate(new Date(year, month - 1, 1));
    const endDate = formatDate(new Date(year, month, 0));

    let query = supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

    if (status === 'paid') {
        query = query.eq('is_paid', true);
    } else if (status === 'pending') {
        query = query.eq('is_paid', false);
    }

    const { data } = await query;

    if (!data) return { income: 0, expense: 0, balance: 0 };

    let income = 0;
    let expense = 0;

    data.forEach((m: Movement) => {
        // Apply "Rules of Gold"
        if (m.type === 'income' && !m.is_loan && !m.is_reserve) {
            income += m.amount;
        }
        if (m.type === 'expense' && !m.is_loan && !m.is_reserve) {
            expense += m.amount;
        }
    });

    return { income, expense, balance: income - expense };
}

export async function getExpensesByCategory(month: number, year: number, status: 'paid' | 'pending' | 'all' = 'all') {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const startDate = formatDate(new Date(year, month - 1, 1));
    const endDate = formatDate(new Date(year, month, 0));

    // 1. Get expenses
    let query = supabase
        .from('movements')
        .select('amount, category_id, is_paid')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate);

    if (status === 'paid') {
        query = query.eq('is_paid', true);
    } else if (status === 'pending') {
        query = query.eq('is_paid', false);
    }

    const { data: movements, error: movError } = await query;

    if (movError || !movements) {
        console.error("Error fetching movements for chart:", movError);
        return [];
    }

    // 2. Get categories
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .or(`user_id.eq.${user.id},is_default.eq.true`);

    if (catError || !categories) {
        console.error("Error fetching categories for chart:", catError);
        return [];
    }

    // 3. Map categories
    const categoryNameMap = new Map<string, string>();
    categories.forEach((c: any) => categoryNameMap.set(c.id, c.name));

    // 4. Aggregate
    const categoryMap = new Map<string, number>();

    movements.forEach((m: any) => {
        const catName = m.category_id ? categoryNameMap.get(m.category_id) : 'Sem Categoria';
        const name = catName || 'Outros';
        categoryMap.set(name, (categoryMap.get(name) || 0) + m.amount);
    });

    return Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

export async function getCashFlowChartData(month: number, year: number) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Get previous balance (start of month)
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Get current balances from accounts (already reflects all paid movements)
    const { data: accounts } = await supabase
        .from('accounts')
        .select('balance')
        .eq('user_id', user.id);

    // Current total balance across all accounts
    const currentTotalBalance = accounts?.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) || 0;

    // Get paid movements for THIS month to calculate backwards to start of month
    const { data: thisMonthPaidMovements } = await supabase
        .from('movements')
        .select('amount, type, date, is_loan, is_reserve, is_reimbursement')
        .eq('user_id', user.id)
        .eq('is_paid', true)
        .gte('date', startDate)
        .lte('date', endDate);

    // Calculate: startBalance = currentBalance - (all paid REAL movements in this month from day 1 to today)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Sum of all paid movements from start of month until today (inclusive)
    // EXCLUDE loans, reserves, reimbursements to match the chart display
    let monthMovementsUpToToday = 0;
    (thisMonthPaidMovements || []).forEach((m: any) => {
        // Skip special movement types (same logic as chart)
        if (m.is_loan || m.is_reserve || m.is_reimbursement) return;

        if (m.date <= todayStr) {
            if (m.type === 'income') monthMovementsUpToToday += Number(m.amount);
            else if (m.type === 'expense') monthMovementsUpToToday -= Number(m.amount);
            // transfers are ignored - they move money between accounts but don't affect total balance
        }
    });

    // Start of month balance = current balance - movements done this month
    const startBalance = currentTotalBalance - monthMovementsUpToToday;

    console.log('CHART DEBUG:', { currentTotalBalance, monthMovementsUpToToday, startBalance });

    // 2. Get movements for the month
    // A. Realized (Paid) -> Filter by 'date'
    const { data: realizedMovements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', true)
        .gte('date', startDate)
        .lte('date', endDate);

    // B. Pending (Forecast) -> Filter by 'due_date'
    const { data: pendingMovements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

    // 3. Build daily data
    const daysInMonth = new Date(year, month, 0).getDate();
    const chartData: any[] = [];

    const todayDay = today.getDate();
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;

    // For past days: only realized (paid) movements
    let runningRealizedBalance = startBalance;
    let accumulatedRealizedIncome = 0;
    let accumulatedRealizedExpense = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
        const isFutureDay = isCurrentMonth ? day > todayDay :
            (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1));

        // Realized: Paid on this date (normalize date comparison)
        const dayRealizedMoves = (realizedMovements || []).filter((m: any) => {
            const moveDate = m.date?.split('T')[0]; // Handle both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss'
            return moveDate === dateStr;
        });

        let dayRealizedIncome = 0;
        let dayRealizedExpense = 0;

        // Calculate Realized (EXCLUDE loans, reserves, reimbursements, and transfers)
        dayRealizedMoves.forEach((m: any) => {
            // Skip special movement types
            if (m.is_loan || m.is_reserve || m.is_reimbursement) return;

            if (m.type === 'income') dayRealizedIncome += Number(m.amount);
            else if (m.type === 'expense') dayRealizedExpense += Number(m.amount);
            // transfers (type='transfer') are intentionally ignored for income/expense tracking
        });

        runningRealizedBalance += (dayRealizedIncome - dayRealizedExpense);
        accumulatedRealizedIncome += dayRealizedIncome;
        accumulatedRealizedExpense += dayRealizedExpense;

        chartData.push({
            day,
            // Only show realized balance for past/today, null for future
            realizedBalance: !isFutureDay ? runningRealizedBalance : null,
            accumulatedRealizedIncome: !isFutureDay ? accumulatedRealizedIncome : null,
            accumulatedRealizedExpense: !isFutureDay ? accumulatedRealizedExpense : null,
            forecastBalance: null,
            accumulatedForecastIncome: null,
            accumulatedForecastExpense: null,
            isFuture: isFutureDay
        });
    }

    // DEBUG: Check totals
    console.log('CHART REALIZED TOTALS:', { accumulatedRealizedIncome, accumulatedRealizedExpense, runningRealizedBalance });
    console.log('REALIZED MOVEMENTS COUNT:', realizedMovements?.length);

    // 4. Calculate forecast: starts from today's realized balance and adds pending
    const lastRealizedData = [...chartData].reverse().find(d => d.realizedBalance !== null);
    const forecastStartBalance = lastRealizedData?.realizedBalance ?? startBalance;
    const forecastStartIncome = lastRealizedData?.accumulatedRealizedIncome ?? 0;
    const forecastStartExpense = lastRealizedData?.accumulatedRealizedExpense ?? 0;

    let runningForecastBalance = forecastStartBalance;
    let accumulatedForecastIncome = forecastStartIncome;
    let accumulatedForecastExpense = forecastStartExpense;

    for (let i = 0; i < chartData.length; i++) {
        const day = chartData[i].day;
        const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];

        // Only calculate forecast for today and future days
        if (chartData[i].isFuture || (isCurrentMonth && day === todayDay)) {
            // Add pending movements due on this date
            const dayPendingMoves = (pendingMovements || []).filter((m: any) => {
                const targetDate = m.due_date ? m.due_date.split('T')[0] : m.date;
                return targetDate === dateStr;
            });

            let dayForecastIncome = 0;
            let dayForecastExpense = 0;

            // EXCLUDE loans, reserves, reimbursements, and transfers
            dayPendingMoves.forEach((m: any) => {
                if (m.is_loan || m.is_reserve || m.is_reimbursement) return;

                if (m.type === 'income') dayForecastIncome += Number(m.amount);
                else if (m.type === 'expense') dayForecastExpense += Number(m.amount);
            });

            runningForecastBalance += (dayForecastIncome - dayForecastExpense);
            accumulatedForecastIncome += dayForecastIncome;
            accumulatedForecastExpense += dayForecastExpense;

            // Update chart data with forecast
            chartData[i].forecastBalance = runningForecastBalance;
            chartData[i].accumulatedForecastIncome = accumulatedForecastIncome;
            chartData[i].accumulatedForecastExpense = accumulatedForecastExpense;

            // For today, set forecast equal to realized to start the projection
            if (isCurrentMonth && day === todayDay) {
                chartData[i].forecastBalance = chartData[i].realizedBalance;
                chartData[i].accumulatedForecastIncome = chartData[i].accumulatedRealizedIncome;
                chartData[i].accumulatedForecastExpense = chartData[i].accumulatedRealizedExpense;
            }
        }
    }

    return chartData;
}

// ============ CALENDAR ============

export interface CalendarDay {
    date: string; // YYYY-MM-DD
    hasIncome: boolean;
    hasExpense: boolean;
    incomeTotal: number;
    expenseTotal: number;
    movements: Movement[];
}

export async function getCalendarMovements(month: number, year: number): Promise<CalendarDay[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const startDate = formatDate(new Date(year, month - 1, 1));
    const endDate = formatDate(new Date(year, month, 0));
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Get pending movements with due_date
    const { data: movements, error } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .not('due_date', 'is', null)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true });

    if (error) {
        console.error("Error fetching calendar movements:", error);
        return [];
    }

    // 2. Get active recurrences (with account name join)
    const { data: recurrencesRaw } = await supabase
        .from('recurrences')
        .select('*, accounts(name)')
        .eq('user_id', user.id)
        .eq('active', true);

    const recurrences = (recurrencesRaw || []).map(rec => ({
        ...rec,
        account_name: rec.accounts?.name
    }));

    // Group by date
    const dateMap = new Map<string, CalendarDay>();

    // Add movements
    (movements || []).forEach((mov: Movement) => {
        const dateKey = mov.due_date ? mov.due_date.split('T')[0] : mov.date.split('T')[0];

        if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, {
                date: dateKey,
                hasIncome: false,
                hasExpense: false,
                incomeTotal: 0,
                expenseTotal: 0,
                movements: []
            });
        }

        const day = dateMap.get(dateKey)!;
        day.movements.push(mov);

        if (mov.type === 'income') {
            day.hasIncome = true;
            day.incomeTotal += mov.amount;
        } else if (mov.type === 'expense') {
            day.hasExpense = true;
            day.expenseTotal += mov.amount;
        }
    });

    // 3. Add recurrences as virtual movements for this month
    (recurrences || []).forEach((rec: any) => {
        // Parse the next_due_date to get the day (this is the FIRST occurrence date)
        const nextDueDate = new Date(rec.next_due_date + 'T12:00:00');
        const recDay = nextDueDate.getDate();

        // Check if this day exists in the month
        if (recDay <= daysInMonth) {
            // Calculate the target date for this viewing month
            const targetDate = new Date(year, month - 1, recDay, 12, 0, 0);

            // Don't show recurrence in months before its first occurrence
            // (e.g., recurrence created Jan 30 with due_day 5 shouldn't show Jan 5)
            if (targetDate < nextDueDate) {
                return; // Skip - this month is before the recurrence started
            }

            const dateKey = formatDate(new Date(year, month - 1, recDay));

            // Skip if we already have a movement for this recurrence on this day
            // (to avoid duplicates when a movement was already generated)
            const existingDay = dateMap.get(dateKey);
            if (existingDay) {
                const alreadyExists = existingDay.movements.some(
                    m => m.description.toLowerCase() === rec.description.toLowerCase()
                );
                if (alreadyExists) return;
            }

            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, {
                    date: dateKey,
                    hasIncome: false,
                    hasExpense: false,
                    incomeTotal: 0,
                    expenseTotal: 0,
                    movements: []
                });
            }

            const day = dateMap.get(dateKey)!;

            // For auto-debits: only show value in the NEXT due month, not in future months
            // Compare viewing month with the recurrence's next_due_date month
            const nextDueMonth = nextDueDate.getMonth(); // 0-indexed
            const nextDueYear = nextDueDate.getFullYear();
            const isNextDueMonth = (month - 1 === nextDueMonth && year === nextDueYear);

            // Determine display amount based on variable_amount flag:
            // - variable_amount = FALSE (fixed): always show the stored amount
            // - variable_amount = TRUE (variable): show 0 in future months until user informs
            let displayAmount: number;
            if (rec.is_auto_debit && rec.variable_amount && !isNextDueMonth) {
                // Variable amount DA in future month - show 0 until bill arrives
                displayAmount = 0;
            } else {
                // Fixed amount (repeats every month) or current month
                displayAmount = rec.amount || 0;
            }

            // Create a virtual movement from recurrence
            const virtualMovement: any = {
                id: `rec-${rec.id}`,
                description: rec.is_auto_debit ? `⚡ ${rec.description}` : `🔄 ${rec.description}`,
                amount: displayAmount,
                type: rec.type,
                date: dateKey,
                due_date: dateKey,
                is_paid: false,
                is_recurrence: true,
                recurrence_id: rec.id,
                is_auto_debit: rec.is_auto_debit || false,
                account_name: rec.account_name
            };

            day.movements.push(virtualMovement);

            if (rec.type === 'income') {
                day.hasIncome = true;
                day.incomeTotal += displayAmount;
            } else if (rec.type === 'expense') {
                day.hasExpense = true;
                day.expenseTotal += displayAmount;
            }
        }
    });

    return Array.from(dateMap.values());
}

// ============ BALANCE PROJECTION ============

export interface MonthProjection {
    month: string;
    monthNumber: number;
    year: number;
    expectedIncome: number;
    expectedExpense: number;
    netChange: number;
    projectedBalance: number;
}

export async function getBalanceProjection(months: number = 6): Promise<{
    currentBalance: number;
    monthlyAverages: { income: number; expense: number; surplus: number };
    projections: MonthProjection[];
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { currentBalance: 0, monthlyAverages: { income: 0, expense: 0, surplus: 0 }, projections: [] };

    const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // 1. Get current balance from all accounts
    const { data: accounts } = await supabase
        .from('accounts')
        .select('balance')
        .eq('user_id', user.id);

    const currentBalance = accounts?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;

    // 2. Get recurrences for expected income/expense
    const { data: recurrences } = await supabase
        .from('recurrences')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

    const monthlyRecurringIncome = recurrences
        ?.filter(r => r.type === 'income' && r.frequency === 'monthly')
        .reduce((sum, r) => sum + r.amount, 0) || 0;

    const monthlyRecurringExpense = recurrences
        ?.filter(r => r.type === 'expense' && r.frequency === 'monthly')
        .reduce((sum, r) => sum + r.amount, 0) || 0;

    // 3. Calculate average variable expenses from last 3 months
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const formatDate = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const { data: recentMovements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', formatDate(threeMonthsAgo))
        .lt('date', formatDate(now));

    let totalIncome = 0;
    let totalExpense = 0;
    const monthsCounted = 3;

    recentMovements?.forEach((m: Movement) => {
        if (m.type === 'income' && !m.is_loan && !m.is_reserve) {
            totalIncome += m.amount;
        }
        if (m.type === 'expense' && !m.is_loan && !m.is_reserve) {
            totalExpense += m.amount;
        }
    });

    const avgMonthlyIncome = totalIncome / monthsCounted;
    const avgMonthlyExpense = totalExpense / monthsCounted;
    const avgMonthlySurplus = avgMonthlyIncome - avgMonthlyExpense;

    // 4. Project future months
    const projections: MonthProjection[] = [];
    let runningBalance = currentBalance;

    for (let i = 1; i <= months; i++) {
        const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthNum = futureDate.getMonth();
        const yearNum = futureDate.getFullYear();

        // Use recurring + average for estimation
        const expectedIncome = monthlyRecurringIncome > 0 ? monthlyRecurringIncome : avgMonthlyIncome;
        const expectedExpense = monthlyRecurringExpense > 0
            ? monthlyRecurringExpense + (avgMonthlyExpense - monthlyRecurringExpense) * 0.5 // Add half of variable expenses
            : avgMonthlyExpense;

        const netChange = expectedIncome - expectedExpense;
        runningBalance += netChange;

        projections.push({
            month: MONTHS[monthNum],
            monthNumber: monthNum + 1,
            year: yearNum,
            expectedIncome: Math.round(expectedIncome * 100) / 100,
            expectedExpense: Math.round(expectedExpense * 100) / 100,
            netChange: Math.round(netChange * 100) / 100,
            projectedBalance: Math.round(runningBalance * 100) / 100
        });
    }

    return {
        currentBalance: Math.round(currentBalance * 100) / 100,
        monthlyAverages: {
            income: Math.round(avgMonthlyIncome * 100) / 100,
            expense: Math.round(avgMonthlyExpense * 100) / 100,
            surplus: Math.round(avgMonthlySurplus * 100) / 100
        },
        projections
    };
}
// ============ PENDING SUMMARY ============

export async function getPendingSummary(month: number, year: number) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalPayable: 0, totalReceivable: 0, countPayable: 0, countReceivable: 0 };

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const startDate = formatDate(new Date(year, month - 1, 1));
    const endDate = formatDate(new Date(year, month, 0));

    const { data, error } = await supabase
        .from('movements')
        .select('amount, type')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .gte('date', startDate)
        .lte('date', endDate);

    if (error || !data) {
        console.error("Error fetching pending summary:", error);
        return { totalPayable: 0, totalReceivable: 0, countPayable: 0, countReceivable: 0 };
    }

    let totalPayable = 0;
    let totalReceivable = 0;
    let countPayable = 0;
    let countReceivable = 0;

    data.forEach((m: { amount: number, type: string }) => {
        if (m.type === 'expense') {
            totalPayable += m.amount;
            countPayable++;
        } else if (m.type === 'income') {
            totalReceivable += m.amount;
            countReceivable++;
        }
    });

    return { totalPayable, totalReceivable, countPayable, countReceivable };
}
