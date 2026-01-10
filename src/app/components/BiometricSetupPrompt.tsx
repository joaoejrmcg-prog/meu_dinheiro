"use client";

import { Fingerprint, X } from "lucide-react";

interface BiometricSetupPromptProps {
    isOpen: boolean;
    isLoading?: boolean;
    onSetup: () => void;
    onSkip: () => void;
}

export default function BiometricSetupPrompt({
    isOpen,
    isLoading = false,
    onSetup,
    onSkip
}: BiometricSetupPromptProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Login Mais Rá pido</h2>
                    <button
                        onClick={onSkip}
                        disabled={isLoading}
                        className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Icon and Description */}
                <div className="flex flex-col items-center mb-6">
                    <div className="relative mb-4">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl"></div>
                        <div className="relative bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-full">
                            <Fingerprint className="w-16 h-16 text-white" strokeWidth={1.5} />
                        </div>
                    </div>

                    <p className="text-neutral-200 text-center font-medium mb-2">
                        Quer usar sua biometria na próxima vez?
                    </p>
                    <p className="text-neutral-400 text-sm text-center leading-relaxed">
                        Entre em <strong className="text-neutral-300">1 segundo</strong> sem digitar senha usando sua impressão digital ou Face ID
                    </p>
                </div>

                {/* Benefits */}
                <div className="bg-neutral-800/50 rounded-xl p-4 mb-6 space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-500">✓</span>
                        <span className="text-neutral-300">Login instantâneo</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-500">✓</span>
                        <span className="text-neutral-300">Mais seguro</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-500">✓</span>
                        <span className="text-neutral-300">Sem senhas para lembrar</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={onSetup}
                        disabled={isLoading}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Configurando...
                            </>
                        ) : (
                            <>
                                <Fingerprint size={20} />
                                Ativar Biometria
                            </>
                        )}
                    </button>

                    <button
                        onClick={onSkip}
                        disabled={isLoading}
                        className="w-full py-3 text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Agora não
                    </button>
                </div>
            </div>
        </div>
    );
}
