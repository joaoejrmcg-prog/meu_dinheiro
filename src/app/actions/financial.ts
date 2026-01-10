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
    type?: 'income' | 'expense';
}

export async function getMovements(params?: GetMovementsParams): Promise<Movement[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

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
    return data || [];
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

        // 2. Check if source has enough balance
        if (fromAccount.balance < amount) {
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
        .select('*')
        .eq('user_id', user.id)
        .order('next_due_date', { ascending: true });

    if (error) {
        console.error("Error fetching recurrences:", error);
        return [];
    }
    return data || [];
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

// ============ SUMMARY ============

export async function getMonthSummary(month: number, year: number) {
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

    const { data } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

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

export async function getExpensesByCategory(month: number, year: number) {
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
    const { data: movements, error: movError } = await supabase
        .from('movements')
        .select('amount, category_id')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate);

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

    const { data, error } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', false) // Only pending movements
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) {
        console.error("Error fetching calendar movements:", error);
        return [];
    }

    // Group by date
    const dateMap = new Map<string, CalendarDay>();

    (data || []).forEach((mov: Movement) => {
        const dateKey = mov.date.split('T')[0];

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
