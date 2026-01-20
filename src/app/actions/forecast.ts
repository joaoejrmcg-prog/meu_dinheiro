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

// ============ TYPES ============

export interface MonthlyForecast {
    month: string;           // "2026-02" format
    monthLabel: string;      // "Fevereiro/2026"
    projectedBalance: number;
    income: number;
    expense: number;
    details: {
        recurrences: { description: string; amount: number; type: string }[];
        pendingMovements: { description: string; amount: number; type: string }[];
        cardInvoices: { cardName: string; amount: number }[];
        loanPayments: { description: string; amount: number; type: string }[];
    };
}

export interface GoalProjection {
    goalId: string;
    goalName: string;
    currentAmount: number;
    targetAmount: number | null;
    deadline: string | null;
    monthsToReach?: number;
    estimatedDate?: string;
    requiredMonthlyContribution?: number;
}

// ============ FORECAST CALCULATION ============

/**
 * Calculate financial forecast for the next N months
 * @param months Number of months to project (default: 6)
 */
export async function calculateForecast(months: number = 6): Promise<MonthlyForecast[]> {
    console.log('[FORECAST] Starting calculateForecast with months:', months);

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('[FORECAST] No user found, returning empty');
        return [];
    }

    const forecasts: MonthlyForecast[] = [];
    const today = new Date();
    console.log('[FORECAST] Today:', today.toISOString());

    // Get current total balance
    const { recalculateBalances } = await import('./assets');
    await recalculateBalances();

    const { data: accounts } = await supabase
        .from('accounts')
        .select('balance, type')
        .eq('user_id', user.id)
        .neq('type', 'savings');

    let runningBalance = accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
    console.log('[FORECAST] Initial balance:', runningBalance, '| Accounts:', accounts?.length);

    // Get all recurrences
    const { data: recurrences } = await supabase
        .from('recurrences')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

    // Get pending movements (future dated, not paid)
    const { data: pendingMovements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .gte('due_date', today.toISOString().split('T')[0]);

    // Get credit card invoices (future)
    const { data: creditCards } = await supabase
        .from('credit_cards')
        .select('id, name, due_day')
        .eq('user_id', user.id);

    // Get active loans with payment plans (movements linked to loans)
    const { data: loanPayments } = await supabase
        .from('movements')
        .select('*, loans(description, type)')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .eq('is_loan', true)
        .gte('due_date', today.toISOString().split('T')[0]);

    // Calculate average for variable recurrences (last 3 months)
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const { data: recentMovements } = await supabase
        .from('movements')
        .select('description, amount')
        .eq('user_id', user.id)
        .eq('is_paid', true)
        .gte('date', threeMonthsAgo.toISOString().split('T')[0]);

    // Build averages map for variable recurrences
    const averagesMap = new Map<string, number>();
    if (recurrences && recentMovements) {
        for (const rec of recurrences) {
            if (rec.amount === 0 || rec.variable_amount) {
                // Find related movements by description (fuzzy match)
                const relatedMovs = recentMovements.filter(m =>
                    m.description.toLowerCase().includes(rec.description.toLowerCase()) ||
                    rec.description.toLowerCase().includes(m.description.toLowerCase())
                );
                if (relatedMovs.length > 0) {
                    const avg = relatedMovs.reduce((sum, m) => sum + m.amount, 0) / relatedMovs.length;
                    averagesMap.set(rec.id, Math.round(avg * 100) / 100);
                }
            }
        }
    }

    // Month names in Portuguese
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // Project each month
    for (let i = 0; i < months; i++) {
        const targetDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();
        const monthKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[targetMonth]}/${targetYear}`;

        let monthIncome = 0;
        let monthExpense = 0;
        const details: MonthlyForecast['details'] = {
            recurrences: [],
            pendingMovements: [],
            cardInvoices: [],
            loanPayments: []
        };

        // 1. Add recurrences for this month
        if (recurrences) {
            for (const rec of recurrences) {
                // Determine amount (fixed or average)
                let amount = rec.amount;
                if (amount === 0 || rec.variable_amount) {
                    amount = averagesMap.get(rec.id) || rec.amount || 0;
                }

                if (amount > 0) {
                    if (rec.type === 'income') {
                        monthIncome += amount;
                    } else {
                        monthExpense += amount;
                    }
                    details.recurrences.push({
                        description: rec.description,
                        amount,
                        type: rec.type
                    });
                }
            }
        }

        // 2. Add pending movements for this month (EXCLUDING loan payments - handled separately)
        if (pendingMovements) {
            for (const mov of pendingMovements) {
                if (!mov.due_date) continue;
                // Skip loan movements - they are handled in section 4
                if (mov.is_loan) continue;

                const dueDate = new Date(mov.due_date);
                if (dueDate.getMonth() === targetMonth && dueDate.getFullYear() === targetYear) {
                    if (mov.type === 'income') {
                        monthIncome += mov.amount;
                    } else if (mov.type === 'expense') {
                        monthExpense += mov.amount;
                    }
                    details.pendingMovements.push({
                        description: mov.description,
                        amount: mov.amount,
                        type: mov.type
                    });
                }
            }
        }

        // 3. Calculate credit card invoices for this month
        // Logic: Find movements charged to cards that will be due in this target month
        if (creditCards && creditCards.length > 0) {
            for (const card of creditCards) {
                // Get card movements that will appear in this month's invoice
                // Invoice due_date logic: if purchase is before closing day, it's in current cycle
                const { data: cardMovements } = await supabase
                    .from('movements')
                    .select('amount')
                    .eq('user_id', user.id)
                    .eq('card_id', card.id)
                    .eq('is_paid', false);

                if (cardMovements) {
                    // Filter movements by due_date in target month
                    const invoiceMovements = cardMovements.filter(m => {
                        // For simplicity, assume all unpaid card movements with future due_date
                        return true; // Will be filtered by due_date in the query
                    });

                    // Calculate invoice total for this month
                    const { data: invoiceData } = await supabase
                        .from('movements')
                        .select('amount')
                        .eq('user_id', user.id)
                        .eq('card_id', card.id)
                        .eq('is_paid', false)
                        .gte('due_date', `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`)
                        .lt('due_date', `${targetYear}-${String(targetMonth + 2).padStart(2, '0')}-01`);

                    const invoiceTotal = invoiceData?.reduce((sum, m) => sum + m.amount, 0) || 0;
                    if (invoiceTotal > 0) {
                        monthExpense += invoiceTotal;
                        details.cardInvoices.push({
                            cardName: card.name,
                            amount: invoiceTotal
                        });
                    }
                }
            }
        }

        // 4. Add loan payments for this month
        if (loanPayments) {
            for (const payment of loanPayments) {
                if (!payment.due_date) continue;
                const dueDate = new Date(payment.due_date);
                if (dueDate.getMonth() === targetMonth && dueDate.getFullYear() === targetYear) {
                    // Loan type determines if it's income or expense
                    const loanInfo = payment.loans as any;
                    const isPayingBack = loanInfo?.type === 'taken'; // I'm paying back = expense

                    if (isPayingBack) {
                        monthExpense += payment.amount;
                    } else {
                        monthIncome += payment.amount;
                    }
                    details.loanPayments.push({
                        description: loanInfo?.description || payment.description,
                        amount: payment.amount,
                        type: isPayingBack ? 'expense' : 'income'
                    });
                }
            }
        }

        // Calculate projected balance
        runningBalance = runningBalance + monthIncome - monthExpense;

        forecasts.push({
            month: monthKey,
            monthLabel,
            projectedBalance: Math.round(runningBalance * 100) / 100,
            income: Math.round(monthIncome * 100) / 100,
            expense: Math.round(monthExpense * 100) / 100,
            details
        });
    }

    console.log('[FORECAST] Returning', forecasts.length, 'forecasts');
    return forecasts;
}

// ============ GOAL PROJECTIONS ============

/**
 * Project when a goal will be reached given monthly contribution
 * @param goalId ID of the goal/reserve
 * @param monthlyContribution Amount to save per month
 */
export async function projectGoalTime(goalId: string, monthlyContribution: number): Promise<GoalProjection | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: goal } = await supabase
        .from('reserves')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', user.id)
        .single();

    if (!goal) return null;

    const currentAmount = goal.current_amount || 0;
    const targetAmount = goal.target_amount;

    let monthsToReach: number | undefined;
    let estimatedDate: string | undefined;

    if (targetAmount && targetAmount > currentAmount && monthlyContribution > 0) {
        const remaining = targetAmount - currentAmount;
        monthsToReach = Math.ceil(remaining / monthlyContribution);

        const estimatedDateObj = new Date();
        estimatedDateObj.setMonth(estimatedDateObj.getMonth() + monthsToReach);

        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        estimatedDate = `${monthNames[estimatedDateObj.getMonth()]}/${estimatedDateObj.getFullYear()}`;
    }

    return {
        goalId: goal.id,
        goalName: goal.name,
        currentAmount,
        targetAmount,
        deadline: goal.deadline,
        monthsToReach,
        estimatedDate
    };
}

/**
 * Calculate required monthly contribution to reach goal by deadline
 * @param goalId ID of the goal/reserve
 */
export async function calculateRequiredContribution(goalId: string): Promise<GoalProjection | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: goal } = await supabase
        .from('reserves')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', user.id)
        .single();

    if (!goal) return null;

    const currentAmount = goal.current_amount || 0;
    const targetAmount = goal.target_amount;
    const deadline = goal.deadline;

    let requiredMonthlyContribution: number | undefined;

    if (targetAmount && targetAmount > currentAmount && deadline) {
        // Parse deadline - can be "2026-12-31" or "dezembro de 2026"
        let deadlineDate: Date | null = null;

        // Try ISO format first
        if (deadline.match(/^\d{4}-\d{2}-\d{2}$/)) {
            deadlineDate = new Date(deadline);
        } else {
            // Try parsing Portuguese month names
            const monthMap: { [key: string]: number } = {
                'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
                'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
            };
            const match = deadline.toLowerCase().match(/(\w+)\s*(de)?\s*(\d{4})/);
            if (match) {
                const month = monthMap[match[1]];
                const year = parseInt(match[3]);
                if (month !== undefined && year) {
                    deadlineDate = new Date(year, month + 1, 0); // Last day of month
                }
            }
        }

        if (deadlineDate) {
            const today = new Date();
            const monthsDiff = (deadlineDate.getFullYear() - today.getFullYear()) * 12
                + (deadlineDate.getMonth() - today.getMonth());

            if (monthsDiff > 0) {
                const remaining = targetAmount - currentAmount;
                requiredMonthlyContribution = Math.ceil(remaining / monthsDiff);
            }
        }
    }

    return {
        goalId: goal.id,
        goalName: goal.name,
        currentAmount,
        targetAmount,
        deadline,
        requiredMonthlyContribution
    };
}

/**
 * Find goal by name (fuzzy match)
 */
export async function findGoalByName(searchTerm: string): Promise<{ id: string; name: string } | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: goals } = await supabase
        .from('reserves')
        .select('id, name')
        .eq('user_id', user.id);

    if (!goals) return null;

    // Fuzzy match
    const goal = goals.find(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        searchTerm.toLowerCase().includes(g.name.toLowerCase())
    );

    return goal || null;
}
