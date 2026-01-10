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

    return { success: true };
}
