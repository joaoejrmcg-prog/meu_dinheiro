'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function acceptTerms() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
}

export async function checkTermsAccepted() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false; // Se não estiver logado, exige aceitar termos após login

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('terms_accepted_at')
        .eq('user_id', user.id)
        .single();

    // Se não encontrou profile ou houve erro, exige aceitar termos
    if (error || !profile) {
        console.log('checkTermsAccepted: No profile found for user, requiring terms acceptance');
        return false;
    }

    return !!profile.terms_accepted_at;
}
