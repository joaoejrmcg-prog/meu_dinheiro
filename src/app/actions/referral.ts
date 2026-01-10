"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Processa recompensa para o referrer quando indicado faz primeiro pagamento
 */
export async function processReferralReward(referredUserId: string) {
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
                        // Server Actions can't set cookies in some contexts
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {
                        // Handle
                    }
                },
            },
        }
    );

    try {
        // 1. Buscar perfil do usuário que pagou
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('referred_by')
            .eq('user_id', referredUserId)
            .single();

        if (profileError || !profile?.referred_by) {
            return { success: false, message: 'Usuário não foi indicado' };
        }

        const referrerId = profile.referred_by;

        // 2. Verificar se já concedeu recompensa
        const { data: existing } = await supabase
            .from('referral_rewards')
            .select('*')
            .eq('referrer_id', referrerId)
            .eq('referred_user_id', referredUserId)
            .single();

        if (existing?.reward_granted) {
            return { success: false, message: 'Recompensa já concedida' };
        }

        // 3. Adicionar 30 dias à assinatura do referrer
        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .select('current_period_end')
            .eq('user_id', referrerId)
            .single();

        if (subError) {
            console.error('Erro ao buscar assinatura:', subError);
            return { success: false, message: 'Erro ao buscar assinatura do referrer' };
        }

        const currentEnd = new Date(subscription?.current_period_end || new Date());
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() + 30);

        const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ current_period_end: newEnd.toISOString() })
            .eq('user_id', referrerId);

        if (updateError) {
            console.error('Erro ao atualizar assinatura:', updateError);
            return { success: false, message: 'Erro ao conceder recompensa' };
        }

        // 4. Marcar recompensa como concedida
        const { error: rewardError } = await supabase
            .from('referral_rewards')
            .upsert({
                referrer_id: referrerId,
                referred_user_id: referredUserId,
                reward_days: 30,
                reward_granted: true,
                payment_confirmed_at: new Date().toISOString()
            }, { onConflict: 'referrer_id,referred_user_id' });

        if (rewardError) {
            console.error('Erro ao registrar recompensa:', rewardError);
            return { success: false, message: 'Erro ao registrar recompensa' };
        }

        return { success: true, message: 'Recompensa de 30 dias concedida!', referrerId };
    } catch (error) {
        console.error('Erro ao processar recompensa:', error);
        return { success: false, message: 'Erro inesperado ao processar recompensa' };
    }
}

/**
 * Retorna estatísticas de indicação do usuário
 */
export async function getReferralStats() {
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
    if (!user) return null;

    // Total indicados
    const { count: totalReferred } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', user.id);

    // Indicados pagantes (recompensas concedidas)
    const { count: paidReferred } = await supabase
        .from('referral_rewards')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user.id)
        .eq('reward_granted', true);

    // Total de dias ganhos
    const { data: rewards } = await supabase
        .from('referral_rewards')
        .select('reward_days')
        .eq('referrer_id', user.id)
        .eq('reward_granted', true);

    const totalDays = rewards?.reduce((sum, r) => sum + r.reward_days, 0) || 0;

    return {
        totalReferred: totalReferred || 0,
        paidReferred: paidReferred || 0,
        earnedDays: totalDays
    };
}

/**
 * Retorna lista detalhada de indicados com status
 */
export async function getReferralDetails() {
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
    if (!user) return [];

    // Buscar indicados com suas assinaturas
    const { data: profiles } = await supabase
        .from('profiles')
        .select(`
            user_id,
            whatsapp,
            created_at
        `)
        .eq('referred_by', user.id);

    if (!profiles) return [];

    // Buscar status de pagamento de cada indicado
    const detailedReferrals = await Promise.all(
        profiles.map(async (profile) => {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('plan, status')
                .eq('user_id', profile.user_id)
                .single();

            const { data: reward } = await supabase
                .from('referral_rewards')
                .select('reward_granted, payment_confirmed_at')
                .eq('referrer_id', user.id)
                .eq('referred_user_id', profile.user_id)
                .single();

            return {
                whatsapp: profile.whatsapp || 'N/A',
                createdAt: profile.created_at,
                plan: subscription?.plan || 'trial',
                status: subscription?.status || 'trial',
                isPaid: reward?.reward_granted || false,
                paidAt: reward?.payment_confirmed_at
            };
        })
    );

    return detailedReferrals;
}

/**
 * Confirma primeiro pagamento e dispara recompensa
 * Esta função deve ser chamada quando o webhook do Asaas confirmar pagamento
 */
export async function confirmFirstPayment(userId: string) {
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

    // Verificar se é o primeiro pagamento
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, plan')
        .eq('user_id', userId)
        .single();

    // Se mudou de trial para pro/light E está ativo, é primeiro pagamento
    if (subscription?.status === 'active' && (subscription?.plan === 'pro' || subscription?.plan === 'light')) {
        const result = await processReferralReward(userId);
        return result;
    }

    return { success: false, message: 'Não é primeiro pagamento ou usuário ainda em trial' };
}
