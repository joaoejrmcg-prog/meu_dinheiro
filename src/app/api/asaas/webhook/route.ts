import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    // 🔒 CRITICAL SECURITY: Validate webhook token
    const incomingToken = req.headers.get('asaas-access-token');
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

    if (!expectedToken) {
        console.error('[WEBHOOK SECURITY] ASAAS_WEBHOOK_TOKEN not configured!');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!incomingToken || incomingToken !== expectedToken) {
        console.error('[WEBHOOK SECURITY] Unauthorized webhook attempt detected!', {
            hasToken: !!incomingToken,
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
            timestamp: new Date().toISOString()
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WEBHOOK SECURITY] Token validated successfully ✓');

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    try {
        const body = await req.json();
        const { event, payment } = body;

        console.log(`Received Asaas Webhook: ${event}`, payment?.id);

        if (!payment || !payment.subscription) {
            // Not a subscription payment or invalid payload
            return NextResponse.json({ received: true });
        }

        const subscriptionId = payment.subscription;
        console.log(`Processing Webhook for Subscription ID: ${subscriptionId}`);

        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {

            // CHECK FOR PRO-RATA UPGRADE
            if (payment.externalReference && payment.externalReference.startsWith('UPGRADE|')) {
                console.log('[WEBHOOK] Pro-rata upgrade payment confirmed:', payment.externalReference);
                const parts = payment.externalReference.split('|');
                const userId = parts[1];
                const newPlan = parts[2];

                if (userId && newPlan) {
                    // 1. Get current subscription
                    const { data: currentSub } = await supabaseAdmin
                        .from('subscriptions')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (currentSub && currentSub.asaas_subscription_id) {
                        // 2. Update Asaas Subscription Value
                        const { updateAsaasSubscription } = await import('@/lib/asaas');
                        const { PLAN_LIGHT, PLAN_PRO, PLAN_LIGHT_PRICE, PLAN_PRO_PRICE } = await import('@/app/utils/plans');

                        const PLANS = { [PLAN_LIGHT]: PLAN_LIGHT_PRICE, [PLAN_PRO]: PLAN_PRO_PRICE };
                        const newValue = PLANS[newPlan as keyof typeof PLANS];

                        if (newValue) {
                            await updateAsaasSubscription(currentSub.asaas_subscription_id, {
                                value: newValue,
                                description: `Assinatura Plano ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}`,
                                updatePendingPayments: true
                            });
                            console.log('[WEBHOOK] Asaas subscription updated to new plan value.');
                        }

                        // 3. Update DB
                        const { error: updateError } = await supabaseAdmin
                            .from('subscriptions')
                            .update({
                                plan: newPlan,
                                status: 'active'
                            })
                            .eq('user_id', userId);

                        if (updateError) console.error('Failed to update DB for upgrade:', updateError);
                        else console.log('[WEBHOOK] DB updated to new plan.');

                        return NextResponse.json({ received: true, message: 'Upgrade processed' });
                    }
                }
            }

            if (!payment.subscription) {
                // Not a subscription payment (and not a handled upgrade)
                return NextResponse.json({ received: true });
            }

            // 1. Fetch current subscription to determine base date
            const { data: currentSub, error: fetchError } = await supabaseAdmin
                .from('subscriptions')
                .select('current_period_end, status, user_id, plan')
                .eq('asaas_subscription_id', subscriptionId)
                .single();

            if (fetchError || !currentSub) {
                console.error(`Subscription not found in DB for Asaas ID: ${subscriptionId}`);
                return NextResponse.json({ received: true, warning: 'Subscription not found' });
            }

            // Determine plan based on payment value
            const { PLAN_LIGHT, PLAN_PRO, PLAN_LIGHT_PRICE, PLAN_PRO_PRICE, getPlanPrice } = await import('@/app/utils/plans');

            let planName = undefined;
            if (payment.value) {
                if (payment.value === PLAN_LIGHT_PRICE) planName = PLAN_LIGHT;
                else if (payment.value === PLAN_PRO_PRICE) planName = PLAN_PRO;
            }

            // 2. Calculate new period end
            // Logic: New End = MAX(Current End, Now) + 1 Month
            const now = new Date();
            const currentEnd = currentSub.current_period_end ? new Date(currentSub.current_period_end) : new Date(0);

            // If subscription is expired (end < now), start from now. If active (end > now), start from end.
            let baseDate = currentEnd > now ? currentEnd : now;
            let extraDays = 0;

            // FIX: If Plan Changed (Upgrade/Downgrade via manual payment), calculate CREDIT EXTENSION.
            // Instead of just resetting to NOW, we convert unused days of the old plan into extra days of the new plan.
            if (planName && currentSub.plan && planName !== currentSub.plan) {
                console.log(`[WEBHOOK] Plan change detected (${currentSub.plan} -> ${planName}). Calculating credit extension...`);

                // 1. Calculate unused days of old plan
                const oldPlanPrice = getPlanPrice(currentSub.plan);
                const newPlanPrice = getPlanPrice(planName);

                if (oldPlanPrice > 0 && newPlanPrice > 0 && currentEnd > now) {
                    const diffTime = currentEnd.getTime() - now.getTime();
                    const unusedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // 2. Calculate unused value (Credit)
                    const oldDailyRate = oldPlanPrice / 30;
                    const credit = unusedDays * oldDailyRate;

                    // 3. Convert credit to days of new plan
                    const newDailyRate = newPlanPrice / 30;
                    extraDays = Math.floor(credit / newDailyRate);

                    console.log(`[WEBHOOK] Credit Extension: Unused Days: ${unusedDays} (${currentSub.plan}). Credit: R$ ${credit.toFixed(2)}. New Daily Rate: R$ ${newDailyRate.toFixed(2)}. Extra Days: ${extraDays}`);
                }

                // Reset base date to NOW for the new cycle, but we will add extraDays later
                baseDate = now;
            }

            const newPeriodEnd = new Date(baseDate);
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1); // Add standard 1 month
            newPeriodEnd.setDate(newPeriodEnd.getDate() + extraDays); // Add credit extension days

            console.log(`[WEBHOOK] Final Period End: ${newPeriodEnd.toISOString()} (Base: ${baseDate.toISOString()} + 1 Month + ${extraDays} Extra Days)`);

            // 3. Update subscription
            const updateData: any = {
                status: 'active',
                current_period_end: newPeriodEnd.toISOString()
            };

            if (planName) {
                updateData.plan = planName;
                console.log(`[WEBHOOK] Updating plan to ${planName} based on payment value ${payment.value}`);
            }

            const { error } = await supabaseAdmin
                .from('subscriptions')
                .update(updateData)
                .eq('asaas_subscription_id', subscriptionId);

            if (error) {
                console.error('Error updating subscription:', error);
                return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
            }
            console.log('Subscription updated successfully.');

            // 4. Process Referral Reward (Fire and Forget)
            try {
                let userIdForReferral = currentSub?.user_id;

                if (userIdForReferral) {
                    const { processReferralRewardAdmin } = await import('@/app/lib/referral-service');
                    await processReferralRewardAdmin(supabaseAdmin, userIdForReferral);
                } else {
                    console.warn('[WEBHOOK] Could not find user_id for referral processing.');
                }
            } catch (referralError) {
                console.error('[WEBHOOK] Error processing referral reward:', referralError);
            }

            // 5. Create success notification for user
            if (currentSub?.user_id) {
                const valueFormatted = payment.value ? `R$ ${payment.value.toFixed(2).replace('.', ',')}` : '';
                await supabaseAdmin
                    .from('notifications')
                    .insert({
                        user_id: currentSub.user_id,
                        title: '✅ Pagamento Confirmado',
                        message: `Seu pagamento ${valueFormatted} foi processado com sucesso. Obrigado!`,
                        type: 'success'
                    });
                console.log(`[WEBHOOK] Payment success notification created for user ${currentSub.user_id}`);
            }

        } else if (event === 'PAYMENT_CREATED') {
            // New payment/charge created
            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id')
                .eq('asaas_subscription_id', subscriptionId)
                .single();

            if (sub?.user_id) {
                const valueFormatted = payment.value ? `R$ ${payment.value.toFixed(2).replace('.', ',')}` : '';
                const dueDate = payment.dueDate ? new Date(payment.dueDate).toLocaleDateString('pt-BR') : '';
                await supabaseAdmin
                    .from('notifications')
                    .insert({
                        user_id: sub.user_id,
                        title: '📄 Nova Cobrança Gerada',
                        message: `Uma nova cobrança de ${valueFormatted} foi gerada com vencimento em ${dueDate}.`,
                        type: 'info'
                    });
                console.log(`[WEBHOOK] Payment created notification for user ${sub.user_id}`);
            }

        } else if (event === 'PAYMENT_OVERDUE') {
            // Get user_id from subscription
            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id')
                .eq('asaas_subscription_id', subscriptionId)
                .single();

            // Update subscription status
            await supabaseAdmin
                .from('subscriptions')
                .update({ status: 'overdue' })
                .eq('asaas_subscription_id', subscriptionId);

            // Create notification for user
            if (sub?.user_id) {
                await supabaseAdmin
                    .from('notifications')
                    .insert({
                        user_id: sub.user_id,
                        title: '⚠️ Falha no Pagamento',
                        message: 'Não conseguimos processar o pagamento do seu cartão. Atualize seus dados de pagamento para evitar bloqueio.',
                        type: 'error'
                    });
                console.log(`[WEBHOOK] Payment failure notification created for user ${sub.user_id}`);
            }
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            stack: error.stack
        }, { status: 500 });
    }
}
