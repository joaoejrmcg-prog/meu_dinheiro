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
        const { creditCard, creditCardHolderInfo } = body;

        if (!creditCard || !creditCardHolderInfo) {
            return NextResponse.json({ error: 'Missing credit card info' }, { status: 400 });
        }

        // 2. Get Subscription ID
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('asaas_subscription_id')
            .eq('user_id', user.id)
            .single();

        if (!sub || !sub.asaas_subscription_id) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        // 3. Update Subscription in Asaas
        // To update the card, we update the subscription with the new card details
        const response = await fetch(`${ASAAS_API_URL}/subscriptions/${sub.asaas_subscription_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY!
            },
            body: JSON.stringify({
                creditCard,
                creditCardHolderInfo,
                billingType: 'CREDIT_CARD' // Ensure it stays/becomes Credit Card
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Asaas Update Card Error:', errorData);
            return NextResponse.json({ error: 'Failed to update card', details: errorData }, { status: 500 });
        }

        const data = await response.json();

        return NextResponse.json({ success: true, message: 'Cartão atualizado com sucesso!' });

    } catch (error: any) {
        console.error('Update Card API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
