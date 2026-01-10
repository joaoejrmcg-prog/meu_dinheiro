'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Reserve } from '../types';

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

// ============ RESERVES / GOALS ============

export async function getReserves(): Promise<Reserve[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('reserves')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching reserves:", error);
        return [];
    }
    return data || [];
}

export async function createReserve(params: {
    name: string;
    target_amount?: number;
    current_amount?: number;
    color?: string;
    deadline?: string;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase
        .from('reserves')
        .insert({
            user_id: user.id,
            name: params.name,
            target_amount: params.target_amount || null,
            current_amount: params.current_amount || 0,
            color: params.color || '#22c55e',
            deadline: params.deadline || null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateReserve(id: string, params: {
    name?: string;
    target_amount?: number;
    current_amount?: number;
    color?: string;
    deadline?: string;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('reserves')
        .update(params)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function deleteReserve(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from('reserves')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function addToReserve(id: string, amount: number) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get current amount
    const { data: reserve } = await supabase
        .from('reserves')
        .select('current_amount')
        .eq('id', id)
        .single();

    if (!reserve) throw new Error("Reserve not found");

    const newAmount = (reserve.current_amount || 0) + amount;

    const { error } = await supabase
        .from('reserves')
        .update({ current_amount: newAmount })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true, newAmount };
}
