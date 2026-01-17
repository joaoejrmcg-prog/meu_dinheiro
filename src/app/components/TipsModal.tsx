'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function TipsModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleOpenEvent = () => {
            setIsOpen(true);
        };

        window.addEventListener('showTipsModal', handleOpenEvent);
        return () => window.removeEventListener('showTipsModal', handleOpenEvent);
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        // Dispatch event to trigger final congratulations message
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tipsModalClosed'));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 bg-amber-50 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Dicas para não errar</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto text-gray-600 text-sm leading-relaxed space-y-5 flex-1">

                    {/* Tip 1 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            Só registre o que você realmente gastou ou recebeu
                        </h3>
                        <p>
                            Se comprou algo no cartão de crédito, é bom que registre a compra.
                            <strong> Mas, quando pagar a fatura, NÃO registre de novo</strong> — senão conta duas vezes!
                        </p>
                        <div className="bg-gray-50 p-3 rounded-lg text-xs">
                            <p className="text-gray-500">
                                <strong>Outra opção:</strong> não lançar nada que você compra no crédito.
                                Afinal não saiu dinheiro do seu bolso ou da sua conta.
                                Você pode registrar quando pagar a fatura. Nesse momento, sim, sai dinheiro da sua conta.
                            </p>
                        </div>
                    </div>

                    {/* Tip 2 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            Se transferiu dinheiro entre contas, não é gasto
                        </h3>
                        <p>
                            Tirou 200 do banco e colocou na carteira? O dinheiro só mudou de lugar, não sumiu.
                        </p>
                        <p className="text-gray-500 text-xs">
                            O mesmo acontece com saques ou depósitos. Não registre.
                        </p>
                    </div>

                    {/* Tip 3 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            Se errou, dá pra corrigir!
                        </h3>
                        <p>
                            Me diga: <strong>&quot;Apaga o último lançamento&quot;</strong> ou <strong>&quot;Corrige o último valor pra R$ X&quot;</strong>
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                    <button
                        onClick={handleClose}
                        className="w-full px-6 py-3 rounded-xl font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-95"
                    >
                        Entendi!
                    </button>
                </div>
            </div>
        </div>
    );
}
