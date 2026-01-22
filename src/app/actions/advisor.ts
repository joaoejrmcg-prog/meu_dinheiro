'use server';

import { createClient } from "@supabase/supabase-js";
import { getFinancialStatus } from "./finance-core";
import { getGeminiModel } from "../lib/gemini";

export async function generateWeeklyBriefing(userId: string) {
    try {
        // 1. Coletar dados financeiros
        const status = await getFinancialStatus(userId);

        // Buscar contas a pagar nos próximos 7 dias
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        // Initialize Admin Client to bypass RLS
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: upcomingBills } = await supabaseAdmin
            .from('movements')
            .select('*')
            .eq('user_id', userId)
            .eq('is_paid', false)
            .gte('due_date', today.toISOString().split('T')[0])
            .lte('due_date', nextWeek.toISOString().split('T')[0]);

        // 2. Preparar contexto para IA
        const context = `
            Saldo Atual: ${JSON.stringify(status)}
            Contas a Pagar (Próximos 7 dias): ${JSON.stringify(upcomingBills)}
            Data Atual: ${today.toLocaleDateString('pt-BR')}
        `;

        // 3. Gerar conteúdo com Gemini
        // 3. Gerar conteúdo com Gemini
        const model = getGeminiModel("gemini-2.5-flash");
        const prompt = `
            Atue como um analista financeiro pessoal SÊNIOR.
            Analise os dados abaixo e gere um "Briefing Semanal" para o usuário.
            
            DADOS:
            ${context}

            DIRETRIZES:
            - Seja direto e profissional, mas acessível.
            - Use bullet points.
            - Use emojis sóbrios (📊, 💰, 📅).
            - Foco em previsibilidade: O que vai acontecer na semana? O saldo cobre?
            - Se o saldo estiver baixo para as contas, dê um alerta claro.
            - Se estiver tudo bem, sugira manter o foco.
            - O output deve ser em MARKDOWN.
            - NÃO coloque título no markdown (o título será campo separado).
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const markdown = response.text();

        // 4. Salvar notificação
        // 4. Salvar notificação (Usando Admin Client)
        const { error: insertError } = await supabaseAdmin.from('advisor_notifications').insert({
            user_id: userId,
            type: 'weekly_briefing',
            title: 'Seu Resumo Financeiro da Semana',
            content_markdown: markdown,
            priority: 'normal'
        });

        if (insertError) {
            console.error('Error saving advisor notification:', insertError);
            return { success: false, error: insertError };
        }

        return { success: true };

    } catch (error) {
        console.error('Error generating weekly briefing:', error);
        return { success: false, error };
    }
}

export async function checkBudgetAlert(userId: string, transaction: any) {
    // Implementação futura para o alerta de 80%
    // IMPORTANTE: Ao implementar, use o supabaseAdmin (Service Role) para inserir a notificação,
    // pois o RLS bloqueia inserts de usuários comuns na tabela advisor_notifications.
    // const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Precisa de lógica de orçamento/metas que ainda vamos refinar
    return { success: true, skipped: true };
}
