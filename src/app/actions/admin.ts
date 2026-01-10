'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'neomercadoia@gmail.com';

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

async function checkAdmin() {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.email !== ADMIN_EMAIL) {
        throw new Error("Unauthorized");
    }
    return supabase;
}

export async function getSupportMessages() {
    try {
        const supabase = await checkAdmin();

        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
}

export async function markAsReplied(id: string, replyText?: string) {
    try {
        const supabase = await checkAdmin();

        const updateData: any = { status: 'replied' };
        if (replyText) {
            updateData.admin_reply = replyText;
            updateData.replied_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('support_messages')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error updating message:", error);
        return { success: false };
    }
}

export async function getPendingCount() {
    try {
        const supabase = await checkAdmin();

        const { count, error } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) throw error;
        return count || 0;
    } catch (error) {
        // Silent fail for non-admins (e.g. sidebar check)
        return 0;
    }
}

export async function getUsers() {
    try {
        const supabase = await checkAdmin();

        // Fetch subscriptions
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('*');

        if (subError) throw subError;

        // Fetch profiles to try to get contact info (whatsapp) since we might not have email access
        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('*');

        if (profError) throw profError;

        // Merge data
        const users = subscriptions.map(sub => {
            const profile = profiles.find(p => p.user_id === sub.user_id);
            return {
                id: sub.user_id,
                plan: sub.plan,
                status: sub.status,
                current_period_end: sub.current_period_end,
                whatsapp: profile?.whatsapp || 'N/A',
                // We might not get email if it's not in profiles, but we'll try
                email: profile?.email || 'Email protegido',
                referral_code: profile?.referral_code || '---'
            };
        });

        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function generateMissingCodes() {
    try {
        const supabase = await checkAdmin();

        // Fetch profiles without referral_code
        const { data: profiles, error: fetchError } = await supabase
            .from('profiles')
            .select('id, user_id')
            .is('referral_code', null);

        if (fetchError) throw fetchError;

        if (!profiles || profiles.length === 0) {
            return { success: true, count: 0, message: "Nenhum código faltando." };
        }

        let updatedCount = 0;

        for (const profile of profiles) {
            // Generate a simple 8-char code
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ referral_code: code })
                .eq('id', profile.id);

            if (!updateError) {
                updatedCount++;
            }
        }

        return { success: true, count: updatedCount, message: `${updatedCount} códigos gerados com sucesso!` };

    } catch (error) {
        console.error("Error generating codes:", error);
        return { success: false, message: "Erro ao gerar códigos." };
    }
}

export async function updateUserPlan(userId: string, newPlan: string) {
    try {
        const supabase = await checkAdmin();

        // Update subscription
        const { error } = await supabase
            .from('subscriptions')
            .update({
                plan: newPlan,
                status: 'active', // Ensure it's active if we're setting to VIP
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error updating plan:", error);
        return { success: false, error };
    }
}
