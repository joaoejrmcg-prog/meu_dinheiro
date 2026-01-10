"use client";

import { Fingerprint, X } from "lucide-react";

interface BiometricPromptProps {
    isOpen: boolean;
    isLoading?: boolean;
    onAuthenticate: () => void;
    onCancel: () => void;
}

export default function BiometricPrompt({
    isOpen,
    isLoading = false,
    onAuthenticate,
    onCancel
}: BiometricPromptProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Login Rápido</h2>
                    <button
                        onClick={onCancel}
                        className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Fingerprint Icon */}
                <div className="flex flex-col items-center mb-6">
                    <div className={`relative mb-4 ${isLoading ? 'animate-pulse' : ''}`}>
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-full">
                            <Fingerprint className="w-16 h-16 text-white" strokeWidth={1.5} />
                        </div>
                    </div>

                    <p className="text-neutral-200 text-center font-medium mb-2">
                        {isLoading ? 'Verificando...' : 'Use sua biometria para entrar'}
                    </p>
                    <p className="text-neutral-500 text-sm text-center">
                        Toque no sensor ou use Face ID
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={onAuthenticate}
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Autenticando...
                            </>
                        ) : (
                            <>
                                <Fingerprint size={20} />
                                Usar Biometria
                            </>
                        )}
                    </button>

                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="w-full py-3 text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Usar email e senha
                    </button>
                </div>
            </div>
        </div>
    );
}
