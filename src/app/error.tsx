'use client';

import { useEffect } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Unhandled app error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6 text-center">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Algo deu errado!</h2>

                <p className="text-neutral-400 mb-8 text-sm leading-relaxed">
                    Ocorreu um erro inesperado na aplicação. Nossas máquinas já foram notificadas.
                    <br /><br />
                    <span className="text-xs font-mono bg-neutral-950 p-1 rounded text-red-400/80">
                        {error.message || "Unknown error"}
                    </span>
                </p>

                <div className="space-y-3">
                    <button
                        onClick={reset}
                        className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Tentar novamente
                    </button>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-3 px-4 bg-transparent border border-neutral-800 text-neutral-400 font-medium rounded-xl hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                        Voltar ao início
                    </button>
                </div>
            </div>
        </div>
    );
}
