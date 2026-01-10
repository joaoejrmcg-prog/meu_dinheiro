'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Category } from '../types';

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

export async function getCategories(): Promise<Category[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching categories:", error);
        return [];
    }
    return data || [];
}

export async function createCategory(params: { name: string; icon?: string }) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase
        .from('categories')
        .insert({
            user_id: user.id,
            name: params.name,
            icon: params.icon || '📁',
            is_default: false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteCategory(id: string) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Don't allow deleting default categories
    const { data: category } = await supabase
        .from('categories')
        .select('is_default')
        .eq('id', id)
        .single();

    if (category?.is_default) {
        throw new Error("Cannot delete default category");
    }

    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
}

export async function getCategoryByName(name: string): Promise<Category | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try exact match first (case-insensitive)
    const { data } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .ilike('name', name)
        .limit(1)
        .single();

    if (data) return data;

    // Try partial match
    const { data: partial } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .ilike('name', `%${name}%`)
        .limit(1)
        .single();

    return partial || null;
}

