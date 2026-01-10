import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateCPF, cleanCPF } from '@/lib/cpf-validator';

export async function POST(req: NextRequest) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // 1. Authenticate User
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get CPF from request
        const body = await req.json();
        const { cpf } = body;

        if (!cpf) {
            return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 });
        }

        // 3. Clean and validate CPF
        const cleanedCPF = cleanCPF(cpf);

        if (!validateCPF(cleanedCPF)) {
            return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
        }

        // 4. Check if user already has a CPF (immutability)
        const { data: currentProfile } = await supabaseAdmin
            .from('profiles')
            .select('cpf')
            .eq('user_id', user.id)
            .single();

        if (currentProfile?.cpf) {
            return NextResponse.json({
                error: 'CPF já cadastrado e não pode ser alterado'
            }, { status: 400 });
        }

        // 5. Check if CPF is already used by another user
        const { data: existingCPF } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('cpf', cleanedCPF)
            .single();

        if (existingCPF) {
            return NextResponse.json({
                error: 'Este CPF já está cadastrado'
            }, { status: 400 });
        }

        // 6. Save CPF
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ cpf: cleanedCPF })
            .eq('user_id', user.id);

        if (updateError) {
            console.error('Failed to save CPF:', updateError);
            return NextResponse.json({ error: 'Erro ao salvar CPF' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'CPF cadastrado com sucesso'
        });

    } catch (error: any) {
        console.error('CPF API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
