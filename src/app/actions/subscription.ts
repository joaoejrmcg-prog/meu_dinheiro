"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function checkWritePermission() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {
                    }
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, message: "Usuário não autenticado" };

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', user.id)
        .single();

    const plan = subscription?.plan || 'trial';
    const status = subscription?.status || 'trial';

    if (plan === 'vip') return { allowed: true };

    if (subscription?.current_period_end) {
        const now = new Date();
        const expiry = new Date(subscription.current_period_end);

        if (now > expiry) {
            const diffTime = Math.abs(now.getTime() - expiry.getTime());
            const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysOverdue > 7) {
                return {
                    allowed: false,
                    message: `Bloqueio total. Fatura vencida há ${daysOverdue} dias. Regularize para voltar a cadastrar.`
                };
            }
        }
    }

    if (status === 'canceled') {
        return { allowed: false, message: "Assinatura cancelada." };
    }

    return { allowed: true };
}
