"use client";

import { useEffect, useState } from 'react';
import { getSubscriptionDetails } from '../actions/profile';
import { AlertTriangle, Calendar, Clock, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type SubscriptionDetails = {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    daysRemaining: number | null;
    isLifetime: boolean;
    isActive: boolean;
} | null;

export default function SubscriptionStatus() {
    const [subscription, setSubscription] = useState<SubscriptionDetails>(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchSubscription = async () => {
            try {
                const data = await getSubscriptionDetails();
                setSubscription(data);
            } catch (error) {
                console.error("Failed to fetch subscription details", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubscription();
    }, []);

    const handleConfirmPayment = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => {
        if (!subscription) return;

        setProcessingPayment(true);
        setShowPaymentModal(false);

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            // Create new subscription/renewal for current plan
            const response = await fetch('/api/asaas/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    plan: subscription.plan.toLowerCase(),
                    billingType: billingType
                })
            });

            const data = await response.json();

            if (response.ok && data.success && data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                console.error('Payment error:', data);
                alert('Erro ao processar pagamento: ' + (data.error || JSON.stringify(data.details) || 'Erro desconhecido'));
            }

        } catch (error) {
            console.error('Request error:', error);
            alert('Erro ao processar solicitação. Tente novamente.');
        } finally {
            setProcessingPayment(false);
        }
    };

    if (loading || !subscription) return null;

    // Não mostrar nada para VIP/Vitalício
    if (subscription.isLifetime) return null;

    const { daysRemaining, currentPeriodEnd, status, plan } = subscription;
    const endDate = new Date(currentPeriodEnd).toLocaleDateString('pt-BR');
    const isCanceled = status === 'canceled';
    const isOverdue = status === 'overdue';
    const isExpired = daysRemaining !== null && daysRemaining <= 0;
    const isTrial = plan === 'trial';
    const isNearExpiration = daysRemaining !== null && daysRemaining > 0 && (
        (isTrial && daysRemaining <= 3) || (!isTrial && daysRemaining <= 5)
    );

    // Modal de Pagamento
    const PaymentModal = () => (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">Renovar Assinatura</h2>
                <p className="text-neutral-400 mb-6">Escolha a forma de pagamento.</p>

                <div className="space-y-3">
                    <button onClick={() => handleConfirmPayment('PIX')} className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-3"><span className="text-2xl">💠</span><span className="font-medium text-white">Pix</span></div>
                        <span className="text-neutral-500 group-hover:text-white">→</span>
                    </button>
                    <button onClick={() => handleConfirmPayment('BOLETO')} className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-3"><span className="text-2xl">📄</span><span className="font-medium text-white">Boleto Bancário</span></div>
                        <span className="text-neutral-500 group-hover:text-white">→</span>
                    </button>
                    <button onClick={() => handleConfirmPayment('CREDIT_CARD')} className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-3"><span className="text-2xl">💳</span><span className="font-medium text-white">Cartão de Crédito</span></div>
                        <span className="text-neutral-500 group-hover:text-white">→</span>
                    </button>
                </div>

                <button onClick={() => setShowPaymentModal(false)} className="mt-6 w-full py-2 text-neutral-400 hover:text-white transition-colors">Cancelar</button>
            </div>
        </div>
    );

    // Loading Overlay
    const LoadingOverlay = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-neutral-200">Processando...</p>
            </div>
        </div>
    );

    // Se cancelado, mostra apenas a data de acesso final
    if (isCanceled) {
        return (
            <div className="w-full max-w-xl mx-auto mb-4 px-4">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>Seu acesso vai até {endDate}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Se pagamento falhou (overdue), mostra alerta específico
    if (isOverdue) {
        return (
            <>
                <div className="w-full max-w-xl mx-auto mb-4 px-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-500/20 text-red-400 p-2 rounded-full">
                                <AlertTriangle size={18} />
                            </div>
                            <div>
                                <p className="text-red-200 font-medium text-sm">Falha no Pagamento</p>
                                <p className="text-red-300/80 text-xs mt-0.5">Não conseguimos cobrar seu cartão. Atualize seus dados.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                            Atualizar
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
                {showPaymentModal && <PaymentModal />}
                {processingPayment && <LoadingOverlay />}
            </>
        );
    }


    // Se expirado ou próximo do vencimento
    if (isExpired || isNearExpiration) {
        // Mensagem e Ação baseada no plano
        let messageTitle = "";
        let messageBody = "";

        if (isExpired) {
            messageTitle = isTrial ? "Seu período de testes acabou" : "Seu plano venceu";
            messageBody = isTrial
                ? "Assine um plano para continuar."
                : "Renove para continuar usando a IA.";
        } else {
            // Near Expiration
            const daysText = daysRemaining === 1 ? "dia" : "dias";
            messageTitle = isTrial
                ? `Teste acaba em ${daysRemaining} ${daysText}`
                : `Plano vence em ${daysRemaining} ${daysText}`;

            messageBody = isTrial
                ? "Escolha um plano para manter os benefícios."
                : "Renove agora para não perder o acesso.";
        }

        const ActionButton = isTrial ? (
            <Link
                href="/planos"
                className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
                Ver planos
                <ChevronRight size={14} />
            </Link>
        ) : (
            <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
            >
                Pagar
                <ChevronRight size={14} />
            </button>
        );

        const alertColor = isExpired ? "red" : "amber";
        const bgColor = isExpired ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20";
        const iconColor = isExpired ? "text-red-400 bg-red-500/20" : "text-amber-400 bg-amber-500/20";
        const titleColor = isExpired ? "text-red-200" : "text-amber-200";
        const bodyColor = isExpired ? "text-red-300/80" : "text-amber-300/80";

        return (
            <>
                <div className="w-full max-w-xl mx-auto mb-4 px-4">
                    <div className={`${bgColor} border rounded-lg p-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className={`${iconColor} p-2 rounded-full`}>
                                {isExpired ? <AlertTriangle size={18} /> : <Clock size={18} />}
                            </div>
                            <div>
                                <p className={`${titleColor} font-medium text-sm`}>{messageTitle}</p>
                                <p className={`${bodyColor} text-xs mt-0.5`}>{messageBody}</p>
                            </div>
                        </div>
                        {ActionButton}
                    </div>
                </div>
                {showPaymentModal && <PaymentModal />}
                {processingPayment && <LoadingOverlay />}
            </>
        );
    }

    // Padrão: Não mostrar nada se estiver tudo ok para economizar espaço
    return null;
}
