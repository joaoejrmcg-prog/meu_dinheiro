"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Zap, CreditCard, FileText, Loader2, Clock } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';
import SubscriptionBadge from "./SubscriptionBadge";
import CancelSubscription from "../perfil/CancelSubscription";
import CpfInputModal from "./CpfInputModal";

import { plansData } from "../utils/plans";

interface SubscriptionManagerProps {
    profile: any;
    subscription: any;
}

export default function SubscriptionManager({ profile, subscription }: SubscriptionManagerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCpfModal, setShowCpfModal] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [pendingBillingType, setPendingBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD' | null>(null);
    const [isUpdateCardMode, setIsUpdateCardMode] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const response = await fetch('/api/asaas/invoices', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setInvoices(data.invoices || []);

                // Check for status sync
                if (data.subscriptionStatus && data.subscriptionStatus !== subscription.status) {
                    console.log('Subscription status changed, refreshing...', data.subscriptionStatus);
                    router.refresh();
                }
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handlePayInvoice = (invoiceId: string, planName: string) => {
        setSelectedInvoiceId(invoiceId);
        setSelectedPlan(planName);
        setShowPaymentModal(true);
    };

    const handleSubscribe = () => {
        router.push('/planos');
    };

    const handleRenew = () => {
        setSelectedInvoiceId(null);
        setSelectedPlan(profile.plan); // Renew current plan
        setShowPaymentModal(true);
    };

    const handleCancelInvoice = async (invoiceId: string) => {
        if (!confirm('Tem certeza que deseja cancelar esta cobrança pendente?')) return;

        setIsLoading(true);
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const response = await fetch('/api/asaas/payment/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ paymentId: invoiceId })
            });

            if (response.ok) {
                // Refresh invoices to update UI
                fetchInvoices();
            } else {
                alert('Erro ao cancelar cobrança.');
            }
        } catch (error) {
            console.error('Error canceling invoice:', error);
            alert('Erro ao cancelar cobrança.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmPayment = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => {
        setIsLoading(true);
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

            let response;

            if (selectedInvoiceId) {
                // Update existing invoice
                response = await fetch('/api/asaas/payment/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        paymentId: selectedInvoiceId,
                        billingType: billingType
                    })
                });
            } else if (billingType === 'CREDIT_CARD' && subscription.billingType === 'CREDIT_CARD') {
                // Update Credit Card: Reuse checkout flow but ask for payment URL
                response = await fetch('/api/asaas/checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        plan: profile.plan, // Same plan
                        billingType: 'CREDIT_CARD',
                        changePaymentMethod: true // Flag to force getting URL
                    })
                });

            } else if (selectedPlan) {
                // Create new subscription (or renewal)
                response = await fetch('/api/asaas/checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        plan: selectedPlan.toLowerCase(),
                        billingType: billingType
                    })
                });
            } else {
                return;
            }

            const data = await response.json();

            console.log('[DEBUG] Response status:', response.ok);
            console.log('[DEBUG] Response data:', data);

            // Check if CPF is required
            if (!response.ok && data.code === 'CPF_REQUIRED') {
                console.log('[CPF] CPF required, opening modal...');
                setPendingBillingType(billingType);
                setShowCpfModal(true);
                setIsLoading(false);
                // NÃO limpar selectedPlan/Invoice aqui
                return;
            }

            if (response.ok && data.success) {
                if (data.paymentUrl) {
                    window.location.href = data.paymentUrl;
                } else {
                    // Seamless upgrade (no payment URL needed)
                    alert(data.message || 'Plano atualizado com sucesso!');
                    fetchInvoices(); // Refresh data
                    router.refresh();
                }

                // Limpar no sucesso
                setSelectedInvoiceId(null);
                setSelectedPlan(null);
            } else {
                console.error('Payment error:', data);
                alert('Erro ao processar pagamento: ' + (data.error || JSON.stringify(data.details) || 'Erro desconhecido'));
                // Limpar no erro
                setSelectedInvoiceId(null);
                setSelectedPlan(null);
            }

        } catch (error) {
            console.error('Request error:', error);
            alert('Erro ao processar solicitação. Tente novamente.');
            // Limpar no erro
            setSelectedInvoiceId(null);
            setSelectedPlan(null);
        } finally {
            setIsLoading(false);
            // NÃO limpar aqui no finally
        }
    };

    const handleCpfSuccess = (cpf: string) => {
        console.log('[CPF] CPF saved successfully:', cpf);
        setShowCpfModal(false);

        // Retry payment with the pending billing type
        if (pendingBillingType) {
            console.log('[CPF] Retrying payment with', pendingBillingType);
            handleConfirmPayment(pendingBillingType);
            setPendingBillingType(null);
        }
    };

    return (
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-200">Assinatura</h2>

                {/* Botão de Assinar se for Trial E não tiver faturas pendentes */}
                {profile.plan === 'trial' && invoices.length === 0 && (
                    <button
                        onClick={handleSubscribe}
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Assinar Agora
                    </button>
                )}

                {/* Botões de Ação */}
                {(profile.plan === 'light' || profile.plan === 'pro') && invoices.length === 0 && (
                    <div className="flex gap-2">
                        {/* Se for Cartão de Crédito, mostra Gerenciar Pagamento */}
                        {subscription.billingType === 'CREDIT_CARD' && (
                            <button
                                onClick={() => {
                                    setSelectedPlan(profile.plan); // Keep plan
                                    setShowPaymentModal(true); // Open modal
                                }}
                                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-medium transition-colors border border-neutral-700"
                            >
                                Gerenciar Pagamento
                            </button>
                        )}

                        {/* Se NÃO for Cartão (Pix/Boleto), mostra Pagar Mensalidade (Renovar) */}
                        {subscription.billingType !== 'CREDIT_CARD' && (
                            <button
                                onClick={handleRenew}
                                disabled={isLoading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Pagar Mensalidade
                            </button>
                        )}
                    </div>
                )}
            </div>

            <SubscriptionBadge plan={profile.plan} status={profile.status} />

            <div className="mt-6 space-y-4">
                {/* Vencimento */}
                <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-xl">
                    <div className="flex items-center gap-3">
                        <Calendar className="text-blue-500" size={20} />
                        <div>
                            <p className="text-sm text-neutral-400">Vencimento</p>
                            <p className="font-semibold text-neutral-200">
                                {subscription.isLifetime
                                    ? '♾️ Vitalício'
                                    : new Date(subscription.currentPeriodEnd!).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>
                    {!subscription.isLifetime && subscription.daysRemaining !== null && (
                        <div className="text-right">
                            <p className="text-2xl font-bold text-blue-500">{subscription.daysRemaining}</p>
                            <p className="text-xs text-neutral-400">dias restantes</p>
                        </div>
                    )}
                </div>

                {/* Limite IA */}
                <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl">
                    <Zap className="text-yellow-500" size={20} />
                    <div>
                        <p className="text-sm text-neutral-400">Uso da IA</p>
                        <p className="font-semibold text-neutral-200">{subscription.aiLimit}</p>
                    </div>
                </div>
            </div>

            {/* Faturas Pendentes */}
            {invoices.length > 0 && (
                <div className="mt-6 border-t border-neutral-800 pt-6">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
                        <FileText size={18} />
                        Faturas Pendentes
                    </h3>
                    <div className="space-y-3">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-white font-medium">{invoice.description}</p>
                                    <p className="text-sm text-neutral-400">
                                        Vence em: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                    <span className="text-white font-bold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.value)}
                                    </span>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                                            <Clock size={14} className="text-yellow-500" />
                                            <span className="text-yellow-500 text-xs font-medium">Aguardando Pagamento</span>
                                        </div>
                                        <button
                                            onClick={() => handlePayInvoice(invoice.id, profile.plan)}
                                            className="text-xs text-neutral-500 hover:text-neutral-300 underline decoration-neutral-700 underline-offset-2 transition-colors"
                                        >
                                            Perdi o código de pagamento
                                        </button>
                                        <button
                                            onClick={() => handleCancelInvoice(invoice.id)}
                                            className="text-[10px] text-red-500 hover:text-red-400 transition-colors mt-1"
                                        >
                                            Cancelar cobrança
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cancelamento (apenas se não for trial/vitalício e estiver ativo) */}
            {!subscription.isLifetime && profile.plan !== 'trial' && subscription.isActive && (
                <div className="mt-4 pt-4 border-t border-neutral-800 flex justify-center">
                    <CancelSubscription currentPeriodEnd={subscription.currentPeriodEnd} />
                </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <p className="text-neutral-200">Processando...</p>
                    </div>
                </div>
            )}

            {/* Payment Method Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {selectedInvoiceId
                                ? 'Pagar Fatura'
                                : (subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan
                                    ? 'Gerenciar Assinatura'
                                    : (selectedPlan === profile.plan ? 'Renovar Assinatura' : 'Assinar Plano'))}
                        </h2>

                        {/* Plan Selection if not paying invoice */}
                        {!selectedInvoiceId && (
                            <div className="mb-6 space-y-3">
                                <p className="text-neutral-400 text-sm mb-2">Escolha o plano:</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {plansData.map((plan) => (
                                        <button
                                            key={plan.name}
                                            onClick={() => setSelectedPlan(plan.name.toLowerCase())}
                                            className={`p-3 rounded-lg border text-center transition-all ${selectedPlan === plan.name.toLowerCase()
                                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-750'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">{plan.name}</div>
                                            <div className="text-xs mt-1">{plan.price}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-neutral-400 mb-6">Escolha a forma de pagamento.</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleConfirmPayment('PIX')}
                                disabled={isLoading}
                                className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">💠</span>
                                        <div className="text-left">
                                            <span className="font-medium text-white block">
                                                {subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan ? 'Mudar para Pix' : 'Pix'}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan
                                                    ? 'Cancela a cobrança no cartão'
                                                    : 'Pagamento mensal avulso'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-neutral-500 group-hover:text-white">→</span>
                                </div>
                            </button>

                            <button
                                onClick={() => handleConfirmPayment('BOLETO')}
                                disabled={isLoading}
                                className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📄</span>
                                        <div className="text-left">
                                            <span className="font-medium text-white block">
                                                {subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan ? 'Mudar para Boleto' : 'Boleto Bancário'}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan
                                                    ? 'Cancela a cobrança no cartão'
                                                    : 'Pagamento mensal avulso'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-neutral-500 group-hover:text-white">→</span>
                                </div>
                            </button>

                            <button
                                onClick={() => handleConfirmPayment('CREDIT_CARD')}
                                disabled={isLoading}
                                className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">💳</span>
                                        <div className="text-left">
                                            <span className="font-medium text-white block">
                                                {subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan ? 'Atualizar Cartão' : 'Cartão de Crédito'}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {subscription.billingType === 'CREDIT_CARD' && selectedPlan === profile.plan
                                                    ? 'Trocar cartão da assinatura'
                                                    : 'Assinatura recorrente'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-neutral-500 group-hover:text-white">→</span>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowPaymentModal(false)}
                            className="mt-6 w-full py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* CPF Input Modal */}
            <CpfInputModal
                isOpen={showCpfModal}
                onClose={() => setShowCpfModal(false)}
                onSuccess={handleCpfSuccess}
            />
        </div>
    );
}
