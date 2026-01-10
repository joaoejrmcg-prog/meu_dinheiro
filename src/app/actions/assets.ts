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
        .select('id')
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

    // Update existing wallet - set BOTH balance and initial_balance
    const { error: updateError } = await supabase
        .from('accounts')
        .update({ balance, initial_balance: balance })
        .eq('id', wallet.id);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    return { success: true };
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
