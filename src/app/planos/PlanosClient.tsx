"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import PlanCard from "../components/PlanCard";
import { createBrowserClient } from '@supabase/ssr';
import { plansData } from "../utils/plans";
import CpfInputModal from "../components/CpfInputModal";

interface PlanosClientProps {
    currentPlan: string;
}

export default function PlanosClient({ currentPlan }: PlanosClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCpfModal, setShowCpfModal] = useState(false);
    const [pendingBillingType, setPendingBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD' | null>(null);
    const router = useRouter();



    const handleInitiateCheckout = (planName: string) => {
        setSelectedPlan(planName);
        setShowPaymentModal(true);
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

            if (selectedPlan) {
                // Create new subscription
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

            // Check if CPF is required
            if (!response.ok && data.code === 'CPF_REQUIRED') {
                console.log('[CPF] CPF required, opening modal...');
                setPendingBillingType(billingType);
                setShowCpfModal(true);
                setIsLoading(false);
                // NÃO limpar selectedPlan aqui, pois precisaremos dele após o CPF
                return;
            }

            if (response.ok && data.success) {
                if (data.paymentUrl) {
                    // Redirect to success page with payment URL
                    window.location.href = data.paymentUrl;
                } else {
                    // Seamless upgrade (no payment URL needed)
                    alert(data.message || 'Plano atualizado com sucesso!');
                    router.refresh();
                    router.push('/perfil'); // Redirect back to profile
                }
                setSelectedPlan(null); // Limpar apenas no sucesso final
            } else {
                console.error('Payment error:', data);
                alert('Erro ao processar pagamento: ' + (data.error || JSON.stringify(data.details) || 'Erro desconhecido'));
                setSelectedPlan(null); // Limpar no erro
            }

        } catch (error) {
            console.error('Request error:', error);
            alert('Erro ao processar solicitação. Tente novamente.');
            setSelectedPlan(null); // Limpar no erro
        } finally {
            setIsLoading(false);
            // NÃO limpar selectedPlan aqui no finally
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
        <div className="min-h-screen bg-neutral-950 p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/perfil" className="text-neutral-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-100">Minha Assinatura</h1>
                        <p className="text-sm text-neutral-400 mt-1">Gerencie seu plano e faturas</p>
                    </div>
                </div>



                <div className="mb-6">
                    <h2 className="text-xl font-bold text-neutral-100">Mudar de Plano</h2>
                    <p className="text-sm text-neutral-400 mt-1">Escolha um novo plano para fazer upgrade</p>
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <p className="text-neutral-200">Gerando link de pagamento...</p>
                        </div>
                    </div>
                )}

                {/* Payment Method Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 w-full max-w-md">
                            <h2 className="text-xl font-bold text-white mb-4">Como deseja pagar?</h2>
                            <p className="text-neutral-400 mb-6">Escolha a forma de pagamento para o plano <strong>{selectedPlan}</strong>.</p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleConfirmPayment('PIX')}
                                    className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors group"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">💠</span>
                                            <div className="text-left">
                                                <span className="font-medium text-white block">Pix</span>
                                                <span className="text-xs text-neutral-500">Pagamento mensal avulso</span>
                                            </div>
                                        </div>
                                        <span className="text-neutral-500 group-hover:text-white">→</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleConfirmPayment('BOLETO')}
                                    className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors group"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">📄</span>
                                            <div className="text-left">
                                                <span className="font-medium text-white block">Boleto Bancário</span>
                                                <span className="text-xs text-neutral-500">Pagamento mensal avulso</span>
                                            </div>
                                        </div>
                                        <span className="text-neutral-500 group-hover:text-white">→</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleConfirmPayment('CREDIT_CARD')}
                                    className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors group"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">💳</span>
                                            <div className="text-left">
                                                <span className="font-medium text-white block">Cartão de Crédito</span>
                                                <span className="text-xs text-neutral-500">Assinatura recorrente</span>
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

                {/* Grid de Planos */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {plansData.map((plan) => (
                        <PlanCard
                            key={plan.id}
                            name={plan.name}
                            price={plan.price}
                            features={plan.features}
                            isCurrentPlan={currentPlan.toLowerCase() === plan.id}
                            isMostPopular={plan.isMostPopular}
                            onSelect={() => handleInitiateCheckout(plan.id)}
                        />
                    ))}
                </div>

                {/* CPF Input Modal */}
                <CpfInputModal
                    isOpen={showCpfModal}
                    onClose={() => setShowCpfModal(false)}
                    onSuccess={handleCpfSuccess}
                />
            </div>
        </div>
    );
}
