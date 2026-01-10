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

export async function sendSupportMessage(formData: FormData) {
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    const supabase = await getSupabase();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Usuário não autenticado");
    }

    // Insert message
    const { error } = await supabase
        .from('support_messages')
        .insert({
            user_id: user.id,
            user_email: user.email,
            subject,
            message,
            status: 'pending'
        });

    if (error) {
        console.error("Error sending message:", error);
        throw new Error("Erro ao enviar mensagem");
    }

    return { success: true };
}

export async function getUserMessages() {
    try {
        const supabase = await getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching user messages:", error);
        return [];
    }
}
