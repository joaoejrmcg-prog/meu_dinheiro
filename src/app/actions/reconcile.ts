"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Movement } from "../types";

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

/**
 * Search for pending movements that match a search term.
 * Uses fuzzy matching on description field.
 */
export async function findPendingMatches(searchTerm: string): Promise<Movement[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Normalize search term
    const normalizedTerm = searchTerm.toLowerCase().trim();

    // Get all pending movements for this user
    const { data: movements, error } = await supabase
        .from('movements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .order('due_date', { ascending: true });

    if (error || !movements) {
        console.error("Error fetching pending movements:", error);
        return [];
    }

    // Filter movements that match the search term
    const matches = movements.filter((m: Movement) => {
        const desc = m.description.toLowerCase();
        // Check if description contains the search term
        return desc.includes(normalizedTerm) || normalizedTerm.includes(desc);
    });

    return matches;
}

/**
 * Mark a movement as paid.
 */
export async function markMovementAsPaid(movementId: string): Promise<{ success: boolean; movement?: Movement; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Não autorizado" };

    // Update the movement
    const { data, error } = await supabase
        .from('movements')
        .update({ is_paid: true })
        .eq('id', movementId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error("Error marking movement as paid:", error);
        return { success: false, error: error.message };
    }

    // Trigger balance recalculation
    const { recalculateBalances } = await import('./assets');
    await recalculateBalances();

    return { success: true, movement: data };
}
