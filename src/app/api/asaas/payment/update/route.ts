import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

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

        const body = await req.json();
        const { paymentId, billingType } = body;

        if (!paymentId || !billingType) {
            return NextResponse.json({ error: 'Missing paymentId or billingType' }, { status: 400 });
        }

        // 2. Update Payment in Asaas
        const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
            method: 'POST', // Asaas uses POST for updates often, or PUT. Let's try POST as per some docs, or PUT. 
            // Actually Asaas API v3 uses POST for updating some resources, but PUT for others. 
            // For /payments/{id}, it's usually POST to update.
            // Let's verify: https://docs.asaas.com/reference/atualizar-cobranca-existente -> POST /payments/{id}
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY!
            },
            body: JSON.stringify({
                billingType: billingType
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to update payment:', errorData);
            return NextResponse.json({ error: 'Failed to update payment', details: errorData }, { status: 500 });
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            paymentUrl: data.invoiceUrl || data.bankSlipUrl
        });

    } catch (error: any) {
        console.error('Update Payment API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
