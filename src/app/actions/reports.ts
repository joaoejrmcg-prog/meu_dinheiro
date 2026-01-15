'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

interface MonthReport {
    // Real income/expense (Rules of Gold applied)
    realIncome: number;
    realExpense: number;
    realBalance: number;

    // Cash flow (all movements)
    cashIn: number;
    cashOut: number;
    cashFlow: number;

    // Breakdown
    loansReceived: number;
    loansPaid: number;
    reservesAdded: number;
    reservesUsed: number;
    reimbursements: number;

    // Counts
    totalMovements: number;

    // Balances
    previousBalance: number; // Saldo acumulado até o início do mês
    currentBalance: number;  // previousBalance + cashFlow

    // Data
    movements: any[];
}

export async function getMonthReport(month: number, year: number): Promise<MonthReport> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    const defaultReport: MonthReport = {
        realIncome: 0, realExpense: 0, realBalance: 0,
        cashIn: 0, cashOut: 0, cashFlow: 0,
        loansReceived: 0, loansPaid: 0,
        reservesAdded: 0, reservesUsed: 0,
        reimbursements: 0, totalMovements: 0,
        previousBalance: 0, currentBalance: 0,
        movements: []
    };

    if (!user) return defaultReport;

    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // 1. Get Accounts Initial Balances (set once when account was created)
    const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('user_id', user.id);

    if (accountsError) {
        console.error('Error fetching accounts:', accountsError);
    }

    const initialBalanceSum = accounts?.reduce((sum, acc) => sum + (Number(acc.initial_balance) || 0), 0) || 0;

    // 2. Get Sum of all movements BEFORE this month (income - expense)
    // This gives us the accumulated balance from past months
    const { data: pastMovements } = await supabase
        .from('movements')
        .select('amount, type')
        .eq('user_id', user.id)
        .lt('date', startDate);

    let pastMovementsSum = 0;
    pastMovements?.forEach((m: any) => {
        const amount = Number(m.amount) || 0;
        if (m.type === 'income') pastMovementsSum += amount;
        if (m.type === 'expense') pastMovementsSum -= amount;
    });

    // Previous Balance = Initial Balance (carry-over) + Past Movements
    // Note: initial_balance is NOT counted as income, it's a "phantom" carry-over
    const previousBalance = initialBalanceSum + pastMovementsSum;

    console.log('--- DEBUG REPORT (ROBUST) ---');
    console.log('Initial Balance Sum:', initialBalanceSum);
    console.log('Past Movements Sum:', pastMovementsSum);
    console.log('Calculated Previous Balance:', previousBalance);
    console.log('--------------------');

    // 3. Get Movements for the specific month (with categories)
    const { data: movements } = await supabase
        .from('movements')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

    if (!movements) return defaultReport;

    let realIncome = 0, realExpense = 0;
    let cashIn = 0, cashOut = 0;
    let loansReceived = 0, loansPaid = 0;
    let reservesAdded = 0, reservesUsed = 0;
    let reimbursements = 0;

    movements.forEach((m: any) => {
        const amount = Number(m.amount) || 0;

        // Cash flow (ONLY paid movements affect actual cash)
        if (m.is_paid !== false) { // Default to true if undefined
            if (m.type === 'income') cashIn += amount;
            if (m.type === 'expense') cashOut += amount;
        }

        // Loans
        if (m.is_loan) {
            if (m.type === 'income') loansReceived += amount;
            if (m.type === 'expense') loansPaid += amount;
        }

        // Reserves
        if (m.is_reserve) {
            if (m.type === 'expense' || m.type === 'transfer') reservesAdded += amount;
            if (m.type === 'income') reservesUsed += amount;
        }

        // Reimbursements
        if (m.is_reimbursement) {
            reimbursements += amount;
        }

        // Real income/expense (excluding loans, reserves, reimbursements, ONLY paid)
        if (!m.is_loan && !m.is_reserve && !m.is_reimbursement && m.is_paid !== false) {
            if (m.type === 'income') realIncome += amount;
            if (m.type === 'expense') realExpense += amount;
        }
    });

    return {
        realIncome,
        realExpense,
        realBalance: realIncome - realExpense,
        cashIn,
        cashOut,
        cashFlow: cashIn - cashOut,
        loansReceived,
        loansPaid,
        reservesAdded,
        reservesUsed,
        reimbursements,
        totalMovements: movements.length,
        previousBalance,
        currentBalance: previousBalance + (cashIn - cashOut),
        movements: movements.map(m => ({
            ...m,
            category: m.categories?.name || m.category // Map category name
        }))
    };
}

export async function getYearSummary(year: number) {
    const months = [];
    for (let m = 1; m <= 12; m++) {
        const report = await getMonthReport(m, year);
        months.push({
            month: m,
            ...report
        });
    }
    return months;
}

// ============ PENDING MOVEMENTS (Contas a Pagar/Receber) ============

export interface PendingMovement {
    id: string;
    description: string;
    amount: number;
    due_date: string;
    type: 'income' | 'expense';
    category?: string;
}

export interface PendingSummary {
    total: number;
    count: number;
    movements: PendingMovement[];
}

/**
 * Get pending expenses (contas a pagar) for a specific month
 */
export async function getPendingExpenses(month: number, year: number): Promise<PendingSummary> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { total: 0, count: 0, movements: [] };

    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: movements, error } = await supabase
        .from('movements')
        .select('id, description, amount, due_date, type, categories(name)')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('is_paid', false)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error fetching pending expenses:', error);
        return { total: 0, count: 0, movements: [] };
    }

    const mapped = (movements || []).map((m: any) => ({
        id: m.id,
        description: m.description,
        amount: m.amount,
        due_date: m.due_date,
        type: m.type,
        category: m.categories?.name
    }));

    return {
        total: mapped.reduce((sum, m) => sum + m.amount, 0),
        count: mapped.length,
        movements: mapped
    };
}

/**
 * Get pending incomes (contas a receber) for a specific month
 */
export async function getPendingIncomes(month: number, year: number): Promise<PendingSummary> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { total: 0, count: 0, movements: [] };

    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: movements, error } = await supabase
        .from('movements')
        .select('id, description, amount, due_date, type, categories(name)')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('is_paid', false)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error fetching pending incomes:', error);
        return { total: 0, count: 0, movements: [] };
    }

    const mapped = (movements || []).map((m: any) => ({
        id: m.id,
        description: m.description,
        amount: m.amount,
        due_date: m.due_date,
        type: m.type,
        category: m.categories?.name
    }));

    return {
        total: mapped.reduce((sum, m) => sum + m.amount, 0),
        count: mapped.length,
        movements: mapped
    };
}

export interface InvoicePreview {
    cardId: string;
    cardName: string;
    amount: number;
    dueDate: string;
    closingDate: string;
}

export async function getCardInvoicePreviews(month: number, year: number): Promise<InvoicePreview[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Get all credit cards
    const { data: cards, error: cardsError } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id);

    if (cardsError || !cards) {
        console.error("Error fetching cards for invoices:", cardsError);
        return [];
    }

    const previews: InvoicePreview[] = [];

    // 2. For each card, calculate invoice amount
    for (const card of cards) {
        // Determine Due Date
        // If due_day is valid, use it. Otherwise default to 10? No, schema says it's number.
        const dueDay = card.due_day;
        const closingDay = card.closing_day;

        // Calculate specific dates for the requested Month/Year invoice
        const dueDate = new Date(year, month - 1, dueDay);

        let closingDate: Date;
        if (closingDay < dueDay) {
            // Closing is in the same month
            closingDate = new Date(year, month - 1, closingDay);
        } else {
            // Closing is in the previous month
            // Handle January case automatically by Date constructor (0 is Dec, -1 is Nov, etc)
            closingDate = new Date(year, month - 2, closingDay);
        }

        // Previous closing date (start of cycle)
        const prevClosingDate = new Date(closingDate);
        prevClosingDate.setMonth(prevClosingDate.getMonth() - 1);

        // Format for DB query
        // Cycle starts day AFTER previous closing
        const startDate = new Date(prevClosingDate);
        startDate.setDate(startDate.getDate() + 1);

        const startDateStr = startDate.toISOString().split('T')[0];
        const closingDateStr = closingDate.toISOString().split('T')[0];

        // Query expenses for this card in this period
        const { data: movements, error: movError } = await supabase
            .from('movements')
            .select('amount')
            .eq('user_id', user.id)
            .eq('card_id', card.id)
            .eq('type', 'expense') // Only expenses count towards invoice
            .gte('date', startDateStr)
            .lte('date', closingDateStr);

        if (movError) {
            console.error(`Error fetching movements for card ${card.name}:`, movError);
            continue;
        }

        const totalAmount = movements?.reduce((sum, m) => sum + m.amount, 0) || 0;

        previews.push({
            cardId: card.id,
            cardName: card.name,
            amount: totalAmount,
            dueDate: dueDate.toISOString().split('T')[0],
            closingDate: closingDateStr
        });
    }

    return previews;
}

// ============ INVOICE PROJECTION FOR FUTURE MONTHS ============

export interface CardInvoiceProjection {
    cardId: string;
    cardName: string;
    monthlyProjections: Array<{
        month: string;
        monthNumber: number;
        year: number;
        dueDate: string;
        // Breakdown
        registeredAmount: number;    // Lançamentos já feitos
        recurrenceAmount: number;    // Recorrências no cartão
        averageVariableAmount: number; // Média de gastos variáveis
        totalProjected: number;
    }>;
}

export async function getCardInvoiceProjection(months: number = 6): Promise<CardInvoiceProjection[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // 1. Get all credit cards
    const { data: cards } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id);

    if (!cards || cards.length === 0) return [];

    // 2. Get recurrences on cards
    const { data: recurrences } = await supabase
        .from('recurrences')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .not('card_id', 'is', null);

    // 3. Calculate average spending per card from last 3 months
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const { data: historicalMovements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .not('card_id', 'is', null)
        .gte('date', formatDate(threeMonthsAgo))
        .lt('date', formatDate(now));

    // Calculate average per card
    const cardAverages: Record<string, number> = {};
    cards.forEach(card => {
        const cardMovements = historicalMovements?.filter(m => m.card_id === card.id) || [];
        const total = cardMovements.reduce((sum, m) => sum + m.amount, 0);
        // Subtract recurrences to get variable spending
        const cardRecurrences = recurrences?.filter(r => r.card_id === card.id) || [];
        const recurrenceTotal = cardRecurrences.reduce((sum, r) => sum + r.amount, 0) * 3; // 3 months
        const variableTotal = Math.max(0, total - recurrenceTotal);
        cardAverages[card.id] = variableTotal / 3;
    });

    // 4. Build projections for each card
    const projections: CardInvoiceProjection[] = [];

    for (const card of cards) {
        const monthlyProjections: CardInvoiceProjection['monthlyProjections'] = [];
        const cardRecurrences = recurrences?.filter(r => r.card_id === card.id) || [];
        const recurrenceTotal = cardRecurrences.reduce((sum, r) => sum + r.amount, 0);
        const averageVariable = cardAverages[card.id] || 0;

        for (let i = 1; i <= months; i++) {
            const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthNum = futureDate.getMonth();
            const yearNum = futureDate.getFullYear();

            // Calculate due date for this month
            const dueDay = card.due_day || 10;
            const dueDate = new Date(yearNum, monthNum, dueDay);

            // Get registered amounts for future invoices (parcelas, etc)
            // This would be movements already registered that fall into this invoice cycle
            const closingDay = card.closing_day || 1;
            let closingDate: Date;
            if (closingDay < dueDay) {
                closingDate = new Date(yearNum, monthNum, closingDay);
            } else {
                closingDate = new Date(yearNum, monthNum - 1, closingDay);
            }
            const prevClosingDate = new Date(closingDate);
            prevClosingDate.setMonth(prevClosingDate.getMonth() - 1);
            const startDate = new Date(prevClosingDate);
            startDate.setDate(startDate.getDate() + 1);

            // For future months, check if there are already registered movements (parcelas)
            const { data: futureMovements } = await supabase
                .from('movements')
                .select('amount')
                .eq('user_id', user.id)
                .eq('card_id', card.id)
                .eq('type', 'expense')
                .gte('date', formatDate(startDate))
                .lte('date', formatDate(closingDate));

            const registeredAmount = futureMovements?.reduce((sum, m) => sum + m.amount, 0) || 0;

            const totalProjected = registeredAmount + recurrenceTotal + averageVariable;

            monthlyProjections.push({
                month: MONTHS[monthNum],
                monthNumber: monthNum + 1,
                year: yearNum,
                dueDate: formatDate(dueDate),
                registeredAmount: Math.round(registeredAmount * 100) / 100,
                recurrenceAmount: Math.round(recurrenceTotal * 100) / 100,
                averageVariableAmount: Math.round(averageVariable * 100) / 100,
                totalProjected: Math.round(totalProjected * 100) / 100
            });
        }

        projections.push({
            cardId: card.id,
            cardName: card.name,
            monthlyProjections
        });
    }

    return projections;
}

// Get total projected invoices for all cards for a specific month
export async function getTotalInvoiceProjectionForMonth(monthOffset: number): Promise<{
    month: string;
    year: number;
    totalAmount: number;
    cards: Array<{ name: string; amount: number }>;
}> {
    const projections = await getCardInvoiceProjection(monthOffset);

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const cards: Array<{ name: string; amount: number }> = [];
    let totalAmount = 0;

    projections.forEach(p => {
        const monthData = p.monthlyProjections[monthOffset - 1];
        if (monthData) {
            cards.push({ name: p.cardName, amount: monthData.totalProjected });
            totalAmount += monthData.totalProjected;
        }
    });

    return {
        month: MONTHS[targetDate.getMonth()],
        year: targetDate.getFullYear(),
        totalAmount: Math.round(totalAmount * 100) / 100,
        cards
    };
}
