"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Retorna dados completos do perfil do usuário
 */
export async function getUserProfile() {
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

    // Buscar profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp, referral_code')
        .eq('user_id', user.id)
        .single();

    // Buscar subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', user.id)
        .single();

    return {
        email: user.email,
        whatsapp: profile?.whatsapp,
        referralCode: profile?.referral_code,
        plan: subscription?.plan || 'trial',
        status: subscription?.status || 'trial',
        currentPeriodEnd: subscription?.current_period_end,
    };
}

/**
 * Retorna informações detalhadas da assinatura
 */
export async function getSubscriptionDetails() {
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

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end, asaas_subscription_id')
        .eq('user_id', user.id)
        .single();

    if (!subscription) return null;

    // Calcular dias restantes
    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const diffTime = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Determinar limite de IA
    let aiLimit = 'Ilimitado';
    if (subscription.plan === 'light' || subscription.plan === 'trial') {
        aiLimit = '10 interações/dia';
    }

    // Determinar se é vitalício (VIP)
    const isLifetime = subscription.plan === 'vip' || endDate.getFullYear() >= 2099;

    // Lógica de acesso: Ativo se status for 'active', 'trial' OU 'canceled' com dias restantes
    const isActive = subscription.status === 'active' ||
        subscription.status === 'trial' ||
        (subscription.status === 'canceled' && daysRemaining > 0);

    let billingType = null;
    if (subscription.asaas_subscription_id) {
        try {
            const { getAsaasSubscription } = await import('@/lib/asaas');
            const asaasSub = await getAsaasSubscription(subscription.asaas_subscription_id);
            if (asaasSub) {
                billingType = asaasSub.billingType;
            }
        } catch (e) {
            console.error('Error fetching Asaas subscription details:', e);
        }
    }

    return {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        daysRemaining: isLifetime ? null : daysRemaining,
        aiLimit,
        isLifetime,
        isActive,
        billingType
    };
}

/**
 * Cancela a assinatura do usuário
 */
export async function cancelSubscription() {
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

    // Atualiza status para canceled, mas MANTÉM a data de fim
    const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
}

// ============ USER LEVELS ============

import { UserLevel } from '../lib/levels';

/**
 * Retorna o nível atual do usuário
 */
export async function getUserLevel(): Promise<UserLevel> {
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
    if (!user) return 0;

    const { data: profile } = await supabase
        .from('profiles')
        .select('user_level')
        .eq('user_id', user.id)
        .single();

    return (profile?.user_level ?? 0) as UserLevel;
}

/**
 * Atualiza o nível do usuário
 */
export async function updateUserLevel(newLevel: UserLevel): Promise<{ success: boolean; error?: string }> {
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
    if (!user) return { success: false, error: 'Não autenticado' };

    if (newLevel < 0 || newLevel > 4) {
        return { success: false, error: 'Nível inválido' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            user_level: newLevel,
            level_actions_count: 0  // Reset counter when changing levels
        })
        .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };

    return { success: true };
}

/**
 * Avança o usuário para o próximo nível
 */
export async function incrementLevel(): Promise<{ success: boolean; newLevel?: UserLevel; error?: string }> {
    const currentLevel = await getUserLevel();

    if (currentLevel >= 4) {
        return { success: false, error: 'Já está no nível máximo' };
    }

    const newLevel = (currentLevel + 1) as UserLevel;
    const result = await updateUserLevel(newLevel);

    if (result.success) {
        return { success: true, newLevel };
    }

    return result;
}

/**
 * Retorna o contador de ações do nível atual
 */
export async function getActionCount(): Promise<number> {
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
    if (!user) return 0;

    const { data: profile } = await supabase
        .from('profiles')
        .select('level_actions_count')
        .eq('user_id', user.id)
        .single();

    return profile?.level_actions_count || 0;
}

/**
 * Incrementa o contador de ações do nível
 */
export async function incrementActionCount(): Promise<number> {
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
    if (!user) return 0;

    // 1. Get current count
    const { data: profile } = await supabase
        .from('profiles')
        .select('level_actions_count')
        .eq('user_id', user.id)
        .single();

    const currentCount = profile?.level_actions_count || 0;
    const newCount = currentCount + 1;

    // 2. Update count
    await supabase
        .from('profiles')
        .update({ level_actions_count: newCount })
        .eq('user_id', user.id);

    return newCount;
}
