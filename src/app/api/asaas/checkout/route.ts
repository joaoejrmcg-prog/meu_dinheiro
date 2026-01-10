import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas';

const PLANS = {
    'light': { value: 19.90, name: 'Plano Light' },
    'pro': { value: 39.90, name: 'Plano Pro' },
};

export async function POST(req: NextRequest) {
    // Initialize Supabase Admin Client inside handler to avoid build errors if env is missing
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
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
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { plan, billingType, changePaymentMethod } = body;

        if (!plan || !PLANS[plan as keyof typeof PLANS]) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const selectedPlan = PLANS[plan as keyof typeof PLANS];

        // 2. Get User Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // 2.5 Validate CPF is present (required for PIX and Boleto)
        if (!profile.cpf) {
            return NextResponse.json({
                error: 'CPF é obrigatório para criar assinatura',
                code: 'CPF_REQUIRED'
            }, { status: 400 });
        }

        // 3. Create/Get Asaas Customer
        let asaasCustomerId = profile.asaas_customer_id;

        if (!asaasCustomerId) {
            console.log('Creating new Asaas customer...');
            const newCustomer = await createAsaasCustomer({
                name: profile.name || user.email || 'Cliente',
                email: user.email!,
                mobilePhone: profile.whatsapp,
                cpfCnpj: profile.cpf, // CPF validated above
                externalReference: user.id
            });
            asaasCustomerId = newCustomer.id;

            // Update profile with Asaas ID
            await supabaseAdmin
                .from('profiles')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('user_id', user.id);
        } else {
            console.log('Reusing existing Asaas customer:', asaasCustomerId);
        }

        // 5. Update Subscription in DB
        // Check if subscription exists
        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        // HANDLE CHANGE PAYMENT METHOD (Just return URL)
        if (changePaymentMethod && existingSub && existingSub.asaas_subscription_id) {
            const ASAAS_API_URL = process.env.ASAAS_API_URL;
            const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

            // Fetch pending payments to get the invoice URL
            const paymentsResponse = await fetch(`${ASAAS_API_URL}/subscriptions/${existingSub.asaas_subscription_id}/payments?status=PENDING`, {
                headers: { 'access_token': ASAAS_API_KEY! }
            });

            if (paymentsResponse.ok) {
                const paymentsData = await paymentsResponse.json();
                if (paymentsData.data && paymentsData.data.length > 0) {
                    return NextResponse.json({
                        success: true,
                        paymentUrl: paymentsData.data[0].invoiceUrl || paymentsData.data[0].bankSlipUrl
                    });
                }
            }

            return NextResponse.json({ error: 'Nenhuma cobrança pendente para alterar o cartão.' }, { status: 400 });
        }

        // 4. Create or Update Subscription
        const today = new Date();
        const nextDueDate = today.toISOString().split('T')[0];

        let subscription;
        let isUpgrade = false;

        // Check if we can do a seamless upgrade
        // We need to fetch the actual subscription from Asaas to check the billing type
        if (existingSub && existingSub.asaas_subscription_id) {
            const { getAsaasSubscription, updateAsaasSubscription, createAsaasCharge } = await import('@/lib/asaas');
            const asaasSub = await getAsaasSubscription(existingSub.asaas_subscription_id);

            // If it's a CREDIT_CARD subscription and it's active, we can just update the value
            if (asaasSub && asaasSub.billingType === 'CREDIT_CARD' && asaasSub.status === 'ACTIVE' && !changePaymentMethod) {
                console.log('[CHECKOUT] Seamless upgrade/downgrade check for CREDIT_CARD subscription');

                const currentPlanValue = PLANS[existingSub.plan as keyof typeof PLANS]?.value || 0;
                const isDowngrade = selectedPlan.value < currentPlanValue;
                const isRealUpgrade = selectedPlan.value > currentPlanValue;

                if (isRealUpgrade) {
                    // Calculate Pro-Rata Difference
                    const now = new Date();
                    const currentEnd = existingSub.current_period_end ? new Date(existingSub.current_period_end) : new Date();

                    // Calculate remaining days
                    const diffTime = Math.max(0, currentEnd.getTime() - now.getTime());
                    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // Calculate daily rates
                    const currentDailyRate = currentPlanValue / 30;
                    const newDailyRate = selectedPlan.value / 30;

                    // Calculate difference
                    const credit = currentDailyRate * remainingDays;
                    const debit = newDailyRate * remainingDays;
                    const difference = debit - credit;

                    console.log(`[PRO-RATA] Remaining: ${remainingDays} days. Credit: ${credit.toFixed(2)}. Debit: ${debit.toFixed(2)}. Diff: ${difference.toFixed(2)}`);

                    // If difference is significant (e.g. > R$ 1.00), charge it.
                    if (difference > 1.00) {
                        console.log('[PRO-RATA] Charging difference...');

                        // Create one-time charge
                        const charge = await createAsaasCharge({
                            customer: asaasCustomerId,
                            billingType: 'CREDIT_CARD', // Try to use same method
                            value: parseFloat(difference.toFixed(2)),
                            dueDate: now.toISOString().split('T')[0], // Due today
                            description: `Upgrade para ${selectedPlan.name} (Proporcional)`,
                            externalReference: `UPGRADE|${user.id}|${plan}` // Special reference for webhook
                        });

                        return NextResponse.json({
                            success: true,
                            paymentUrl: charge.invoiceUrl || charge.bankSlipUrl,
                            message: `Para concluir o upgrade, pague a diferença de R$ ${difference.toFixed(2)}.`
                        });
                    }
                }

                isUpgrade = true; // Proceed with seamless update (for small diffs or downgrades)

                // Update the subscription in Asaas
                subscription = await updateAsaasSubscription(existingSub.asaas_subscription_id, {
                    value: selectedPlan.value,
                    description: `Assinatura ${selectedPlan.name}`,
                    updatePendingPayments: true
                });

                if (isDowngrade) {
                    console.log('[CHECKOUT] Downgrade detected. Updating Asaas but keeping DB as is until next payment.');
                    return NextResponse.json({
                        success: true,
                        paymentUrl: null,
                        message: 'Plano alterado! A mudança será aplicada no próximo ciclo de pagamento.'
                    });
                }
            }
        }

        if (!isUpgrade) {
            subscription = await createAsaasSubscription({
                customer: asaasCustomerId,
                billingType: billingType || 'UNDEFINED',
                value: selectedPlan.value,
                nextDueDate: nextDueDate,
                cycle: 'MONTHLY',
                description: `Assinatura ${selectedPlan.name}`,
                externalReference: user.id
            });
        }

        if (existingSub) {
            console.log(`[CHECKOUT] Found existing subscription for user ${user.id}:`, existingSub.asaas_subscription_id);
            console.log(`[CHECKOUT] Preserving current_period_end:`, existingSub.current_period_end);

            // If exists, update it. 
            // CRITICAL: If this is a manual upgrade (Pix/Boleto) and the user is currently ACTIVE, 
            // we should NOT set them to 'pending' or change the plan yet. 
            // We should wait for the webhook to confirm the payment.
            // Only update if:
            // 1. It IS a seamless upgrade (isUpgrade = true) -> Update to Active/New Plan immediately
            // 2. The user is NOT active (e.g. canceled, trial, pending) -> Update to Pending/New Plan

            const shouldUpdateDB = isUpgrade || (existingSub.status !== 'active' && existingSub.status !== 'trial');

            if (shouldUpdateDB) {
                console.log('[CHECKOUT] Updating DB subscription status/plan...');

                // CRITICAL FIX: If we created a NEW subscription (ID changed), we MUST cancel the old one
                // to avoid duplicate charges in Asaas (especially for Pending -> Pending retries).
                if (subscription.id !== existingSub.asaas_subscription_id) {
                    console.log('[CHECKOUT] Subscription ID changed (Pending/Upgrade). Cancelling old Asaas subscription:', existingSub.asaas_subscription_id);
                    try {
                        const { cancelAsaasSubscription } = await import('@/lib/asaas');
                        await cancelAsaasSubscription(existingSub.asaas_subscription_id);
                        console.log('[CHECKOUT] Old subscription cancelled successfully.');
                    } catch (cancelError) {
                        console.error('[CHECKOUT] Failed to cancel old subscription:', cancelError);
                    }
                }

                const { error: updateError } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        asaas_subscription_id: subscription.id,
                        plan: plan,
                        status: isUpgrade ? 'active' : 'pending',
                        current_period_end: existingSub.current_period_end
                    })
                    .eq('user_id', user.id);

                if (updateError) {
                    console.error('Failed to update subscription in DB:', updateError);
                    throw new Error('Failed to update subscription record');
                }
            } else {
                console.log('[CHECKOUT] Manual upgrade for active user. NOT updating DB yet. Waiting for webhook.');

                if (subscription.id !== existingSub.asaas_subscription_id) {
                    console.log('[CHECKOUT] Subscription ID changed. Updating ID but keeping status/plan.');

                    // Cancel the OLD subscription in Asaas to prevent double billing
                    if (existingSub.asaas_subscription_id) {
                        console.log('[CHECKOUT] Cancelling old Asaas subscription:', existingSub.asaas_subscription_id);
                        try {
                            const { cancelAsaasSubscription } = await import('@/lib/asaas');
                            await cancelAsaasSubscription(existingSub.asaas_subscription_id);
                            console.log('[CHECKOUT] Old subscription cancelled successfully.');
                        } catch (cancelError) {
                            console.error('[CHECKOUT] Failed to cancel old subscription:', cancelError);
                            // We continue even if cancel fails, but we should log it.
                        }
                    }

                    const { error: updateIdError } = await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            asaas_subscription_id: subscription.id,
                            // Keep existing plan and status
                        })
                        .eq('user_id', user.id);

                    if (updateIdError) console.error('Failed to update sub ID:', updateIdError);
                }
            }
        } else {
            console.log(`[CHECKOUT] No existing subscription found for user ${user.id}. Creating new one.`);
            const { error: insertError } = await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    asaas_subscription_id: subscription.id,
                    plan: plan,
                    status: 'pending',
                });

            if (insertError) {
                console.error('Failed to create subscription in DB:', insertError);
                throw new Error('Failed to create subscription record');
            }
        }

        return NextResponse.json({
            success: true,
            paymentUrl: isUpgrade ? null : (subscription.invoiceUrl || subscription.bankSlipUrl), // No payment URL for seamless upgrade
            message: isUpgrade ? 'Plano atualizado com sucesso!' : undefined
        });

    } catch (error: any) {
        console.error('Checkout Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
