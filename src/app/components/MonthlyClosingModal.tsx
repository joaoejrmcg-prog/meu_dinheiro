"use client";

import { useState, useEffect } from "react";
import { X, PiggyBank, ArrowRight, Wallet } from "lucide-react";
import { MonthlyClosing, Reserve } from "../types";
import { processMonthlyClosing } from "../actions/financial";
import { getReserves } from "../actions/planning";
import { cn } from "../lib/utils";

interface MonthlyClosingModalProps {
    closing: MonthlyClosing;
    onClose: () => void;
}

export default function MonthlyClosingModal({ closing, onClose }: MonthlyClosingModalProps) {
    const [step, setStep] = useState<'intro' | 'select-reserve'>('intro');
    const [reserves, setReserves] = useState<Reserve[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadReserves();
    }, []);

    const loadReserves = async () => {
        setLoading(true);
        const data = await getReserves();
        setReserves(data);
        setLoading(false);
    };

    const handleAction = async (action: 'saved_to_reserve' | 'kept_in_account' | 'distributed', destinationId?: string) => {
        setProcessing(true);
        try {
            await processMonthlyClosing({
                closingId: closing.id,
                action,
                destinationId
            });
            onClose();
        } catch (error) {
            console.error("Error processing closing:", error);
        }
        setProcessing(false);
    };

    const monthName = new Date(closing.year, closing.month - 1).toLocaleString('pt-BR', { month: 'long' });
    const formattedAmount = closing.surplus_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (step === 'intro') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                    {/* Header with Confetti effect (simulated with gradient) */}
                    <div className="bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-neutral-900 p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
                            <PiggyBank className="w-8 h-8 text-black" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">Parabéns!</h2>
                        <p className="text-neutral-400">Você fechou {monthName} no azul</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-neutral-500 uppercase tracking-wider font-medium mb-1">Sobra do mês</p>
                            <p className="text-4xl font-bold text-green-400">{formattedAmount}</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => setStep('select-reserve')}
                                disabled={processing}
                                className="w-full py-3.5 rounded-xl bg-green-500 text-black font-bold hover:bg-green-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/10"
                            >
                                <PiggyBank className="w-5 h-5" />
                                Guardar na Reserva
                            </button>

                            <button
                                onClick={() => handleAction('kept_in_account')}
                                disabled={processing}
                                className="w-full py-3.5 rounded-xl bg-neutral-800 text-neutral-300 font-medium hover:bg-neutral-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Wallet className="w-5 h-5" />
                                Manter na Conta
                            </button>
                        </div>

                        <p className="text-xs text-center text-neutral-600">
                            O dinheiro continuará na sua conta, mas vamos registrar essa decisão.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Step: Select Reserve
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <h3 className="font-medium text-white">Onde quer guardar?</h3>
                    <button onClick={() => setStep('intro')} className="text-neutral-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                    {loading ? (
                        <div className="text-center py-8 text-neutral-500">Carregando metas...</div>
                    ) : reserves.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500">
                            <p>Nenhuma meta encontrada.</p>
                            <button onClick={() => handleAction('saved_to_reserve')} className="mt-2 text-green-400 hover:underline">
                                Criar "Reserva" automática
                            </button>
                        </div>
                    ) : (
                        reserves.map(reserve => (
                            <button
                                key={reserve.id}
                                onClick={() => handleAction('saved_to_reserve', reserve.id)}
                                disabled={processing}
                                className="w-full p-4 rounded-xl bg-neutral-800/50 border border-neutral-800 hover:border-green-500/50 hover:bg-neutral-800 transition-all flex items-center gap-4 group text-left"
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${reserve.color}20` }}>
                                    <PiggyBank className="w-5 h-5" style={{ color: reserve.color }} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-white group-hover:text-green-400 transition-colors">{reserve.name}</p>
                                    <p className="text-xs text-neutral-500">
                                        Atual: {reserve.current_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-green-400" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
