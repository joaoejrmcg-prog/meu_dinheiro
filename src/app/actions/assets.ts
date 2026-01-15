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

    const { data, error } = await supabase
        .from('credit_cards')
        .insert({
            user_id: user.id,
            name: params.name,
            closing_day: params.closing_day,
            due_day: params.due_day,
            limit_amount: params.limit_amount
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
