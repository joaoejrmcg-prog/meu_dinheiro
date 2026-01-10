"use client";

import { useState } from "react";
import { Sparkles, CreditCard, Bell, ArrowRight, Check } from "lucide-react";
import { completeOnboarding } from "../actions/onboarding";
import { useRouter } from "next/navigation";
import { cn } from "../lib/utils";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [answers, setAnswers] = useState({
        useCreditCard: false,
        wantsReminders: true
    });

    const handleFinish = async () => {
        setLoading(true);
        try {
            await completeOnboarding(answers);
            router.push('/');
        } catch (e) {
            console.error(e);
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                        <Sparkles className="w-8 h-8 text-green-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Bem-vindo ao Meu Dinheiro</h1>
                    <p className="text-neutral-500 mt-2">Vamos configurar em menos de 1 minuto</p>
                </div>

                {/* Progress */}
                <div className="flex gap-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={cn(
                                "flex-1 h-1 rounded-full transition-all",
                                s <= step ? "bg-green-500" : "bg-neutral-800"
                            )}
                        />
                    ))}
                </div>

                {/* Step Content */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
                    {step === 1 && (
                        <>
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                                    <CreditCard className="w-6 h-6 text-purple-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Você usa cartão de crédito?</h2>
                                <p className="text-neutral-500 text-sm">Isso nos ajuda a organizar melhor seus gastos</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setAnswers({ ...answers, useCreditCard: true }); setStep(2); }}
                                    className="py-4 rounded-xl border border-neutral-700 text-white hover:border-green-500 hover:bg-green-500/10 transition-all"
                                >
                                    Sim, uso
                                </button>
                                <button
                                    onClick={() => { setAnswers({ ...answers, useCreditCard: false }); setStep(2); }}
                                    className="py-4 rounded-xl border border-neutral-700 text-white hover:border-green-500 hover:bg-green-500/10 transition-all"
                                >
                                    Não uso
                                </button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Bell className="w-6 h-6 text-yellow-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Quer receber lembretes?</h2>
                                <p className="text-neutral-500 text-sm">Avisamos sobre contas próximas do vencimento</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setAnswers({ ...answers, wantsReminders: true }); setStep(3); }}
                                    className="py-4 rounded-xl border border-neutral-700 text-white hover:border-green-500 hover:bg-green-500/10 transition-all"
                                >
                                    Sim, quero
                                </button>
                                <button
                                    onClick={() => { setAnswers({ ...answers, wantsReminders: false }); setStep(3); }}
                                    className="py-4 rounded-xl border border-neutral-700 text-white hover:border-green-500 hover:bg-green-500/10 transition-all"
                                >
                                    Não precisa
                                </button>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-6 h-6 text-green-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Tudo pronto!</h2>
                                <p className="text-neutral-500 text-sm">É só começar a usar. Diga coisas como:</p>
                            </div>
                            <div className="space-y-2">
                                <div className="bg-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300">
                                    💬 "Gastei 50 no almoço"
                                </div>
                                <div className="bg-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300">
                                    💬 "Recebi 3000 de salário"
                                </div>
                                <div className="bg-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300">
                                    💬 "Quanto gastei esse mês?"
                                </div>
                            </div>
                            <button
                                onClick={handleFinish}
                                disabled={loading}
                                className="w-full py-4 rounded-xl bg-green-500 text-black font-semibold hover:bg-green-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Iniciando...' : (
                                    <>
                                        Começar a usar
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>

                {/* Skip */}
                {step < 3 && (
                    <button
                        onClick={() => router.push('/')}
                        className="w-full text-center text-neutral-600 text-sm hover:text-neutral-400 transition-colors"
                    >
                        Pular e configurar depois
                    </button>
                )}
            </div>
        </div>
    );
}
