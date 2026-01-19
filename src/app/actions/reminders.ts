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

export interface PendingPayment {
    id: string;
    description: string;
    amount: number;
    due_date: string;
    type: 'overdue' | 'tomorrow';
    days_overdue?: number;
}

export interface PendingAutoDebit {
    id: string;
    description: string;
    amount: number;
    next_due_date: string;
    account_name?: string;
    account_id?: string;
    type: 'due_today' | 'missing_value';
}

/**
 * Get payments that need attention:
 * - Due tomorrow (vence amanhã)
 * - Overdue up to 3 days (atrasadas até 3 dias)
 */
export async function getUpcomingPayments(): Promise<PendingPayment[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get movements with due_date between 3 days ago and tomorrow, not paid
    const { data: movements, error } = await supabase
        .from('movements')
        .select('id, description, amount, due_date, type')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .not('due_date', 'is', null)
        .gte('due_date', threeDaysAgo.toISOString().split('T')[0])
        .lte('due_date', tomorrow.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error fetching upcoming payments:', error);
        return [];
    }

    const result: PendingPayment[] = [];

    for (const m of movements || []) {
        const dueDate = new Date(m.due_date + 'T12:00:00');
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const dueDateStr = m.due_date.split('T')[0];

        if (dueDateStr === tomorrowStr) {
            // Due tomorrow
            result.push({
                id: m.id,
                description: m.description,
                amount: m.amount,
                due_date: m.due_date,
                type: 'tomorrow'
            });
        } else if (dueDateStr < todayStr) {
            // Overdue
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            result.push({
                id: m.id,
                description: m.description,
                amount: m.amount,
                due_date: m.due_date,
                type: 'overdue',
                days_overdue: diffDays
            });
        }
    }

    return result;
}

/**
 * Get auto-debit recurrences that need attention:
 * - Due today with value > 0 (confirmar débito)
 * - Due today with value = 0 (precisa informar valor)
 */
export async function getPendingAutoDebits(): Promise<PendingAutoDebit[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get auto-debit recurrences with due date <= today
    const { data: recurrences, error } = await supabase
        .from('recurrences')
        .select('*, accounts(name)')
        .eq('user_id', user.id)
        .eq('is_auto_debit', true)
        .eq('active', true)
        .lte('next_due_date', todayStr);

    if (error) {
        console.error('Error fetching pending auto-debits:', error);
        return [];
    }

    const result: PendingAutoDebit[] = [];

    for (const rec of recurrences || []) {
        if (rec.amount === 0 || rec.amount === null) {
            // Missing value - need to ask user
            result.push({
                id: rec.id,
                description: rec.description,
                amount: 0,
                next_due_date: rec.next_due_date,
                account_name: rec.accounts?.name,
                account_id: rec.account_id,
                type: 'missing_value'
            });
        } else {
            // Has value - ready to confirm
            result.push({
                id: rec.id,
                description: rec.description,
                amount: rec.amount,
                next_due_date: rec.next_due_date,
                account_name: rec.accounts?.name,
                account_id: rec.account_id,
                type: 'due_today'
            });
        }
    }

    return result;
}

/**
 * Confirm an auto-debit payment:
 * - Creates a movement already marked as paid
 * - Updates account balance
 * - Advances recurrence to next month
 */
export async function confirmAutoDebit(recurrenceId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    // Get recurrence with account
    const { data: recurrence, error: recError } = await supabase
        .from('recurrences')
        .select('*')
        .eq('id', recurrenceId)
        .eq('user_id', user.id)
        .single();

    if (recError || !recurrence) {
        return { success: false, error: "Recorrência não encontrada" };
    }

    if (recurrence.amount === 0 || recurrence.amount === null) {
        return { success: false, error: "Informe o valor da conta primeiro" };
    }

    // Create movement with due date as payment date
    const { error: movError } = await supabase
        .from('movements')
        .insert({
            user_id: user.id,
            description: recurrence.description,
            amount: recurrence.amount,
            type: recurrence.type,
            date: recurrence.next_due_date,
            due_date: recurrence.next_due_date,
            is_paid: true,
            account_id: recurrence.account_id,
            category_id: recurrence.category_id,
            is_loan: false,
            is_reserve: false,
            is_reimbursement: false
        });

    if (movError) {
        return { success: false, error: movError.message };
    }

    // Update account balance
    if (recurrence.account_id) {
        const { data: account } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', recurrence.account_id)
            .single();

        if (account) {
            const newBalance = recurrence.type === 'expense'
                ? account.balance - recurrence.amount
                : account.balance + recurrence.amount;

            await supabase
                .from('accounts')
                .update({ balance: newBalance })
                .eq('id', recurrence.account_id);
        }
    }

    // Advance recurrence to next month
    const currentDue = new Date(recurrence.next_due_date);
    const nextDue = new Date(currentDue);
    nextDue.setMonth(nextDue.getMonth() + 1);

    await supabase
        .from('recurrences')
        .update({
            next_due_date: nextDue.toISOString().split('T')[0],
            amount: 0 // Reset amount for next month (variable bills)
        })
        .eq('id', recurrenceId);

    return { success: true };
}

/**
 * Create a notification for a payment reminder
 */
export async function createPaymentReminder(
    title: string,
    message: string,
    type: 'warning' | 'error' = 'warning'
): Promise<{ success: boolean }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: user.id,
            title,
            message,
            type,
            read: false
        });

    if (error) {
        console.error('Error creating notification:', error);
        return { success: false };
    }

    return { success: true };
}

/**
 * Create notifications for all pending payments (avoids duplicates based on movement_id)
 */
export async function createPaymentNotifications(payments: PendingPayment[]): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || payments.length === 0) return;

    // Get existing notifications to avoid duplicates (check by message containing the movement ID)
    const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('message')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    const existingMessages = new Set(existingNotifications?.map(n => n.message) || []);

    const formatAmount = (amount: number) => {
        return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    for (const payment of payments) {
        const message = payment.type === 'overdue'
            ? `${payment.description} de ${formatAmount(payment.amount)} venceu em ${formatDate(payment.due_date)}`
            : `${payment.description} de ${formatAmount(payment.amount)} vence amanhã`;

        // Skip if already notified in last 24h
        if (existingMessages.has(message)) {
            console.log(`[Reminders] Skipping duplicate notification: "${message}"`);
            continue;
        }

        console.log(`[Reminders] Creating notification: "${message}"`);

        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: user.id,
                title: payment.type === 'overdue' ? '⚠️ Conta atrasada' : '📅 Conta vence amanhã',
                message,
                type: payment.type === 'overdue' ? 'error' : 'warning',
                read: false
            });

        if (error) {
            console.error('[Reminders] Error creating notification:', error);
        }
    }
}

export interface NegativeAccount {
    id: string;
    name: string;
    balance: number;
}

/**
 * Get accounts with negative balance
 */
export async function getNegativeAccounts(): Promise<NegativeAccount[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, name, balance')
        .eq('user_id', user.id)
        .lt('balance', 0);

    if (error) {
        console.error('Error fetching negative accounts:', error);
        return [];
    }

    return (accounts || []).map(a => ({
        id: a.id,
        name: a.name,
        balance: a.balance
    }));
}

/**
 * Create notifications for accounts with negative balance (avoids duplicates)
 */
export async function createNegativeBalanceNotifications(accounts: NegativeAccount[]): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || accounts.length === 0) return;

    // Get existing notifications to avoid duplicates - check by account name (not value)
    const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('message')
        .eq('user_id', user.id)
        .eq('title', '🔴 Conta no vermelho')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Extract account names from existing notifications (e.g. "Sua conta Itaú está negativa...")
    const notifiedAccounts = new Set<string>();
    for (const n of existingNotifications || []) {
        const match = n.message.match(/Sua conta (.+?) está negativa/);
        if (match) notifiedAccounts.add(match[1]);
    }

    const formatAmount = (amount: number) => {
        return Math.abs(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    for (const account of accounts) {
        // Skip if already notified for this account in last 24h (regardless of value)
        if (notifiedAccounts.has(account.name)) {
            console.log(`[Reminders] Skipping duplicate negative balance notification for account: "${account.name}"`);
            continue;
        }

        const message = `Sua conta ${account.name} está negativa em ${formatAmount(account.balance)}`;

        console.log(`[Reminders] Creating negative balance notification: "${message}"`);

        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: user.id,
                title: '🔴 Conta no vermelho',
                message,
                type: 'error',
                read: false
            });

        if (error) {
            console.error('[Reminders] Error creating negative balance notification:', error);
        }
    }
}

/**
 * Create notification for negative balance in real-time (NO 24h duplicate check)
 * Used for immediate feedback after each transaction
 */
export async function createNegativeBalanceNotificationRealtime(accounts: NegativeAccount[]): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || accounts.length === 0) return;

    const formatAmount = (amount: number) => {
        return Math.abs(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    for (const account of accounts) {
        const message = `Sua conta ${account.name} está negativa em ${formatAmount(account.balance)}`;

        console.log(`[Reminders] Creating real-time negative balance notification: "${message}"`);

        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: user.id,
                title: '🔴 Conta no vermelho',
                message,
                type: 'error',
                read: false
            });

        if (error) {
            console.error('[Reminders] Error creating real-time notification:', error);
        }
    }
}
