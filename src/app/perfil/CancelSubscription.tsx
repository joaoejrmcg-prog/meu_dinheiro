'use client';

import { useState } from 'react';
import { cancelSubscription } from '../actions/profile';
import { AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CancelSubscription({ currentPeriodEnd }: { currentPeriodEnd?: string | null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCancel = async () => {
        setLoading(true);
        try {
            await cancelSubscription();
            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error('Error canceling subscription:', error);
            alert('Erro ao cancelar assinatura. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const formattedDate = currentPeriodEnd
        ? new Date(currentPeriodEnd).toLocaleDateString('pt-BR')
        : 'o fim do período';

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-sm text-red-500 hover:text-red-400 hover:underline font-medium transition-colors"
            >
                Cancelar Assinatura
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-red-500 font-bold text-lg">
                                <AlertTriangle className="w-6 h-6" />
                                Cancelar Assinatura
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-neutral-500 hover:text-neutral-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-neutral-300 mb-6">
                            Tem certeza que deseja cancelar? <br /><br />
                            <span className="font-medium text-neutral-100">
                                Sua conta continuará ativa até o dia <span className="text-white font-bold">{formattedDate}</span>.
                            </span>
                            <br /><br />
                            Você não receberá nenhum aviso sobre a conta, nem antes de vencer, nem depois de vencido.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 px-4 py-2 bg-neutral-800 text-neutral-300 rounded-xl font-medium hover:bg-neutral-700 transition-colors"
                            >
                                Manter Assinatura
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
