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

export async function checkOnboardingComplete(): Promise<boolean> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true; // Don't block if not logged in

    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('user_id', user.id)
        .single();

    return profile?.onboarding_complete === true;
}

export async function completeOnboarding(preferences: {
    useCreditCard: boolean;
    wantsReminders: boolean;
}) {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Update profile with preferences
    const { error } = await supabase
        .from('profiles')
        .update({
            onboarding_complete: true,
            preferences: preferences
        })
        .eq('user_id', user.id);

    if (error) {
        // If column doesn't exist, just mark as complete
        console.warn("Onboarding update warning:", error.message);
    }

    // Create default "Reserva" goal for user (if doesn't exist)
    try {
        const { data: existingReserve } = await supabase
            .from('reserves')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', 'Reserva')
            .single();

        if (!existingReserve) {
            await supabase.from('reserves').insert({
                user_id: user.id,
                name: 'Reserva',
                current_amount: 0,
                color: '#22c55e', // Green
                target_amount: null // No target, just a savings bucket
            });
            console.log('[Onboarding] Created default Reserva for user');
        }
    } catch (e) {
        console.log('[Onboarding] Reserva already exists or error:', e);
    }

    return { success: true };
}
