'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Account, CreditCard } from '../types';

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

// ============ ACCOUNTS ============

export async function getAccounts(): Promise<Account[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching accounts:", error);
        return [];
    }
    return data || [];
}

export async function createAccount(params: { name: string; type: 'wallet' | 'bank' | 'savings'; balance?: number }) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase
        .from('accounts')
        .insert({
            user_id: user.id,
            name: params.name,
            type: params.type,
            balance: params.balance || 0
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateAccount(id: string, params: { name?: string; type?: string; balance?: number }) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('accounts')
        .update(params)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function deleteAccount(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    return { success: true };
}

export async function getDefaultAccount() {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();

    return data;
}

export async function setDefaultAccount(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase.rpc('set_default_account', { account_id: id });

    if (error) throw error;
    return { success: true };
}

/**
 * Get the user's wallet, or create one if it doesn't exist.
 * This ensures that every user always has at least one account.
 */
export async function getOrCreateWallet(): Promise<Account | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // First try to get existing wallet
    const { data: wallet } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'wallet')
        .limit(1)
        .single();

    if (wallet) return wallet;

    // No wallet found, create one
    console.log('getOrCreateWallet: Creating wallet for user', user.id);
    const { data: newWallet, error: createError } = await supabase
        .from('accounts')
        .insert({
            user_id: user.id,
            name: 'Carteira',
            type: 'wallet',
            balance: 0,
            initial_balance: 0,
            is_default: true
        })
        .select()
        .single();

    if (createError) {
        console.error('getOrCreateWallet: Error creating wallet:', createError);
        return null;
    }

    return newWallet;
}

/**
 * Get an existing bank account by name, or create one if it doesn't exist.
 * Prevents duplicate accounts from being created when user repeats tutorial.
 */
export async function getOrCreateBankAccount(name: string): Promise<Account | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // First try to get existing account with same name (case-insensitive)
    const { data: existingAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', name)
        .limit(1)
        .single();

    if (existingAccount) {
        console.log(`getOrCreateBankAccount: Account "${name}" already exists, returning existing`);
        return existingAccount;
    }

    // No account found, create one
    console.log(`getOrCreateBankAccount: Creating new account "${name}"`);
    const { data: newAccount, error: createError } = await supabase
        .from('accounts')
        .insert({
            user_id: user.id,
            name: name,
            type: 'bank',
            balance: 0,
            initial_balance: 0
        })
        .select()
        .single();

    if (createError) {
        console.error('getOrCreateBankAccount: Error creating account:', createError);
        return null;
    }

    return newAccount;
}

/**
 * Define o saldo inicial da Carteira do usuário
 * Usado no tutorial de onboarding
 * O initial_balance é tratado como "sobra do mês anterior", não como receita
 */
export async function setWalletInitialBalance(balance: number): Promise<{ success: boolean; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // Find the user's wallet
    const { data: wallet, error: findError } = await supabase
        .from('accounts')
        .select('id, balance, initial_balance')
        .eq('user_id', user.id)
        .eq('type', 'wallet')
        .limit(1)
        .single();

    if (findError || !wallet) {
        // Create wallet if it doesn't exist
        const { data: newWallet, error: createError } = await supabase
            .from('accounts')
            .insert({
                user_id: user.id,
                name: 'Carteira',
                type: 'wallet',
                balance: balance,
                initial_balance: balance,
                is_default: true
            })
            .select()
            .single();

        if (createError) {
            return { success: false, error: createError.message };
        }
        return { success: true };
    }

    // Update existing wallet - set initial_balance and adjust current balance
    const currentInitial = wallet.initial_balance || 0;
    const currentBalance = wallet.balance || 0;
    const diff = balance - currentInitial;
    const newBalance = currentBalance + diff;

    const { error: updateError } = await supabase
        .from('accounts')
        .update({
            balance: newBalance,
            initial_balance: balance
        })
        .eq('id', wallet.id);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    return { success: true };
}

// Get account by name (case-insensitive and accent-insensitive)
export async function getAccountByName(name: string): Promise<Account | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Normalize function to remove accents and lowercase
    const normalize = (str: string) => str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const normalizedSearch = normalize(name);

    // Get all user accounts and find match
    const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

    if (!accounts) return null;

    // Find account with matching normalized name
    const match = accounts.find(acc => normalize(acc.name) === normalizedSearch);
    return match || null;
}

// Get account balance by ID
export async function getAccountBalance(accountId: string): Promise<number> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

    return data?.balance || 0;
}

// Get count of user's accounts (used for conditional hints)
export async function getUserAccountCount(): Promise<number> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    return count || 0;
}

// ============ CREDIT CARDS ============

export async function getCreditCards(): Promise<CreditCard[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching cards:", error);
        return [];
    }
    return data || [];
}

export async function createCreditCard(params: { name: string; closing_day: number; due_day: number; limit_amount?: number }) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Normalize name to title case for consistent storage
    const normalizedName = params.name.trim().charAt(0).toUpperCase() + params.name.trim().slice(1).toLowerCase();

    // Check if card with same name (case-insensitive) already exists
    const { data: existing } = await supabase
        .from('credit_cards')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', normalizedName)
        .single();

    if (existing) {
        // Update existing card
        const { data, error } = await supabase
            .from('credit_cards')
            .update({
                name: normalizedName,
                closing_day: params.closing_day,
                due_day: params.due_day,
                limit_amount: params.limit_amount
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Check if user has any default card
    const { data: defaultCard } = await supabase
        .from('credit_cards')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();

    // First card should be default if no default exists
    const shouldBeDefault = !defaultCard;

    // Create new card
    const { data, error } = await supabase
        .from('credit_cards')
        .insert({
            user_id: user.id,
            name: normalizedName,
            closing_day: params.closing_day,
            due_day: params.due_day,
            limit_amount: params.limit_amount,
            is_default: shouldBeDefault
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateCreditCard(id: string, params: { name?: string; closing_day?: number; due_day?: number; limit_amount?: number }) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('credit_cards')
        .update(params)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function deleteCreditCard(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('credit_cards')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    return { success: true };
}

export async function getDefaultCard() {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();

    return data;
}

export async function setDefaultCard(cardId: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // First, remove default from all user's cards
    await supabase
        .from('credit_cards')
        .update({ is_default: false })
        .eq('user_id', user.id);

    // Then set the new default
    const { error } = await supabase
        .from('credit_cards')
        .update({ is_default: true })
        .eq('id', cardId)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

// Get credit card by name (case-insensitive and accent-insensitive)
export async function getCardByName(name: string): Promise<CreditCard | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Normalize function to remove accents and lowercase
    const normalize = (str: string) => str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const normalizedSearch = normalize(name);

    // Get all user cards and find match
    const { data: cards } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id);

    if (!cards) return null;

    // Find card with matching normalized name
    const match = cards.find(card => normalize(card.name) === normalizedSearch);
    return match || null;
}

export async function recalculateBalances() {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    // 1. Get all accounts
    const { data: accounts } = await supabase
        .from('accounts')
        .select('id, initial_balance, balance')
        .eq('user_id', user.id);

    if (!accounts) return { success: true };

    for (const acc of accounts) {
        // 2. Sum movements for this account
        const { data: movements } = await supabase
            .from('movements')
            .select('amount, type, description')
            .eq('account_id', acc.id)
            .eq('is_paid', true);

        let sum = 0;
        movements?.forEach((m: any) => {
            if (m.type === 'income') sum += Number(m.amount);
            if (m.type === 'expense') sum -= Number(m.amount);
            // Handle transfers: ← = incoming (add), → = outgoing (subtract)
            if (m.type === 'transfer') {
                if (m.description?.includes('←')) {
                    sum += Number(m.amount); // Incoming transfer
                } else if (m.description?.includes('→')) {
                    sum -= Number(m.amount); // Outgoing transfer
                }
            }
        });

        // 3. Calculate correct balance
        const initial = Number(acc.initial_balance) || 0;
        const correctBalance = initial + sum;

        // 4. Update if different
        if (Math.abs(correctBalance - (acc.balance || 0)) > 0.01) {
            console.log(`Fixing balance for account ${acc.id}: ${acc.balance} -> ${correctBalance}`);
            await supabase
                .from('accounts')
                .update({ balance: correctBalance })
                .eq('id', acc.id);
        }
    }

    return { success: true };
}

/**
 * Recalculate balance for a specific account
 * Used before transfers to ensure balance is up-to-date
 */
export async function recalculateAccountBalance(accountId: string): Promise<{ success: boolean }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    // Get account
    const { data: acc } = await supabase
        .from('accounts')
        .select('id, initial_balance, balance')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

    if (!acc) return { success: false };

    // Sum movements for this account
    const { data: movements } = await supabase
        .from('movements')
        .select('amount, type, description')
        .eq('account_id', accountId)
        .eq('is_paid', true);

    let sum = 0;
    movements?.forEach((m: any) => {
        if (m.type === 'income') sum += Number(m.amount);
        if (m.type === 'expense') sum -= Number(m.amount);
        // Handle transfers: ← = incoming (add), → = outgoing (subtract)
        if (m.type === 'transfer') {
            if (m.description?.includes('←')) {
                sum += Number(m.amount);
            } else if (m.description?.includes('→')) {
                sum -= Number(m.amount);
            }
        }
    });

    // Calculate correct balance
    const initial = Number(acc.initial_balance) || 0;
    const correctBalance = initial + sum;

    // Update if different
    if (Math.abs(correctBalance - (acc.balance || 0)) > 0.01) {
        console.log(`Recalculating balance for account ${accountId}: ${acc.balance} -> ${correctBalance}`);
        await supabase
            .from('accounts')
            .update({ balance: correctBalance })
            .eq('id', accountId);
    }

    return { success: true };
}

// ============ CREDIT CARD QUERIES (INVOICE & LIMITS) ============

/**
 * Get invoice details for a specific card and month/year
 * Returns total amount, breakdown by purchase, and due date
 */
export async function getInvoiceDetails(
    cardId: string,
    month?: number,
    year?: number
): Promise<{
    total: number;
    dueDate: string;
    purchases: { description: string; amount: number; date: string }[];
    cardName: string;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Default to NEXT invoice if not specified
    // Logic: If today > due_day of current month, show next month's invoice
    const now = new Date();
    let targetMonth = month ?? now.getMonth() + 1;
    let targetYear = year ?? now.getFullYear();

    // Get card info first to know due_day
    const { data: card } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('id', cardId)
        .single();

    if (!card) throw new Error("Cartão não encontrado");

    // If no specific month requested, determine the "current" invoice intelligently
    if (!month) {
        const currentDay = now.getDate();
        // If we're past the due date, user wants the NEXT invoice (next month)
        if (currentDay > card.due_day) {
            targetMonth = targetMonth + 1;
            if (targetMonth > 12) {
                targetMonth = 1;
                targetYear = targetYear + 1;
            }
        }
    }

    // Calculate the invoice period based on closing day
    // Invoice includes purchases from (closing_day of previous month + 1) to (closing_day of current month)
    const closingDay = card.closing_day;
    const dueDay = card.due_day;

    // Start date: previous month's closing day + 1
    const startDate = new Date(targetYear, targetMonth - 2, closingDay + 1);
    // End date: current month's closing day
    const endDate = new Date(targetYear, targetMonth - 1, closingDay);
    // Due date for this invoice
    const dueDateObj = new Date(targetYear, targetMonth - 1, dueDay);

    // Get all movements on this card that are DUE within this invoice period
    // Use due_date (not date) to correctly capture installments by their due month
    const dueStart = new Date(targetYear, targetMonth - 1, 1); // First day of invoice month
    const dueEnd = new Date(targetYear, targetMonth, 0); // Last day of invoice month

    const { data: movements } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .gte('due_date', dueStart.toISOString().split('T')[0])
        .lte('due_date', dueEnd.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

    // Also fetch active RECURRENCES that fall within this invoice period
    // This ensures that future subscriptions (Spotify, Netflix) appear in the invoice projection
    const { data: recurrences } = await supabase
        .from('recurrences')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('active', true)
        .gte('next_due_date', dueStart.toISOString().split('T')[0])
        .lte('next_due_date', dueEnd.toISOString().split('T')[0]);

    const purchases = (movements || []).map(m => ({
        description: m.description,
        amount: Number(m.amount),
        date: m.date
    }));

    // Add recurrences to purchases list
    if (recurrences) {
        recurrences.forEach(rec => {
            purchases.push({
                description: `${rec.description} (Recorrência)`,
                amount: Number(rec.amount),
                date: rec.next_due_date // Use due date as the "date" for the invoice view
            });
        });
    }

    const total = purchases.reduce((sum, p) => sum + p.amount, 0);

    return {
        total,
        dueDate: dueDateObj.toISOString().split('T')[0],
        purchases,
        cardName: card.name
    };
}

/**
 * Get the best card to use today based on invoice closing dates
 * Returns the card with the longest time until payment (furthest due date)
 * 
 * Logic:
 * - If today > closing_day, purchase goes to NEXT month's invoice
 * - The due_date for that invoice is in the month AFTER closing
 */
export async function getBestCardToBuy(): Promise<{
    bestCard: CreditCard | null;
    reason: string;
    allCards: { card: CreditCard; daysUntilDue: number; daysUntilClose: number; nextDueDate: Date }[];
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { bestCard: null, reason: "Usuário não autenticado", allCards: [] };

    const { data: cards } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id);

    if (!cards || cards.length === 0) {
        return { bestCard: null, reason: "Você não tem cartões cadastrados", allCards: [] };
    }

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const cardsWithDays = cards.map(card => {
        // Calculate which invoice a purchase TODAY would go into
        let invoiceMonth: number;
        let invoiceYear: number;

        if (currentDay <= card.closing_day) {
            // Purchase goes to THIS month's closing (due this month or next)
            invoiceMonth = currentMonth;
            invoiceYear = currentYear;
        } else {
            // Purchase goes to NEXT month's closing
            invoiceMonth = currentMonth + 1;
            invoiceYear = currentYear;
            if (invoiceMonth > 11) {
                invoiceMonth = 0;
                invoiceYear++;
            }
        }

        // Due date is in the month AFTER the closing month
        let dueMonth = invoiceMonth + 1;
        let dueYear = invoiceYear;
        if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
        }

        // But wait - if due_day < closing_day, due is in same month as closing
        // Example: closes day 20, due day 5 → due day 5 of NEXT month
        // Example: closes day 10, due day 17 → due day 17 of SAME month as closing
        if (card.due_day > card.closing_day) {
            // Due date is in the same month as closing
            dueMonth = invoiceMonth;
            dueYear = invoiceYear;
        }

        const nextDueDate = new Date(dueYear, dueMonth, card.due_day);

        // Calculate days until due and close
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysUntilDue = Math.round((nextDueDate.getTime() - today.getTime()) / msPerDay);

        // Days until close
        const closeDate = new Date(invoiceYear, invoiceMonth, card.closing_day);
        const daysUntilClose = Math.round((closeDate.getTime() - today.getTime()) / msPerDay);

        return { card, daysUntilDue, daysUntilClose, nextDueDate };
    });

    // Sort by days until due descending (longest time = best card)
    cardsWithDays.sort((a, b) => b.daysUntilDue - a.daysUntilDue);

    const bestCard = cardsWithDays[0]?.card || null;
    const bestDays = cardsWithDays[0]?.daysUntilDue || 0;
    const reason = bestCard
        ? `O **${bestCard.name}** te dá mais prazo: ${bestDays} dias até pagar!`
        : "Nenhum cartão disponível";

    return { bestCard, reason, allCards: cardsWithDays };
}

/**
 * Get available credit limit for all cards
 * Returns (total limit - current invoice amount) for each card
 */
export async function getCardLimits(): Promise<{
    cards: {
        card: CreditCard;
        limitTotal: number;
        currentInvoice: number;
        available: number;
    }[];
    totalLimit: number;
    totalUsed: number;
    totalAvailable: number;
}> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: cards } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id);

    if (!cards || cards.length === 0) {
        return { cards: [], totalLimit: 0, totalUsed: 0, totalAvailable: 0 };
    }

    const now = new Date();
    const results: { card: CreditCard; limitTotal: number; currentInvoice: number; available: number }[] = [];

    for (const card of cards) {
        // Calculate current invoice using due_date logic (same as getInvoiceDetails)
        // Find movements that are due in the current or next month
        const currentDay = now.getDate();
        let targetMonth = now.getMonth() + 1;
        let targetYear = now.getFullYear();

        // If we're past the due date, look at next month's invoice
        if (currentDay > card.due_day) {
            targetMonth = targetMonth + 1;
            if (targetMonth > 12) {
                targetMonth = 1;
                targetYear = targetYear + 1;
            }
        }

        // Get movements due in that month
        const dueStart = new Date(targetYear, targetMonth - 1, 1);
        const dueEnd = new Date(targetYear, targetMonth, 0);

        const { data: movements } = await supabase
            .from('movements')
            .select('amount')
            .eq('user_id', user.id)
            .eq('card_id', card.id)
            .gte('due_date', dueStart.toISOString().split('T')[0])
            .lte('due_date', dueEnd.toISOString().split('T')[0]);

        const currentInvoice = (movements || []).reduce((sum, m) => sum + Number(m.amount), 0);
        const limitTotal = card.limit_amount || 0;
        const available = limitTotal > 0 ? Math.max(0, limitTotal - currentInvoice) : 0;

        results.push({ card, limitTotal, currentInvoice, available });
    }

    // Sort by available descending
    results.sort((a, b) => b.available - a.available);

    const totalLimit = results.reduce((sum, r) => sum + r.limitTotal, 0);
    const totalUsed = results.reduce((sum, r) => sum + r.currentInvoice, 0);
    const totalAvailable = results.reduce((sum, r) => sum + r.available, 0);

    return { cards: results, totalLimit, totalUsed, totalAvailable };
}

