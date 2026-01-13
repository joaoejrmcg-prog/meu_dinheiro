"use client";

import { useState, useEffect } from 'react';
import { Fingerprint, Loader2, Check, X } from 'lucide-react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { supabase } from '../lib/supabase';

export default function BiometricSettings() {
    const { isSupported, isEnrolled, isLoading, registerBiometric } = useBiometricAuth();
    const [isActivating, setIsActivating] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    // Only show this component on client
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    // Don't show if biometrics aren't supported
    if (!isSupported) {
        return null;
    }

    const handleActivate = async () => {
        setIsActivating(true);
        setMessage(null);

        try {
            // Get user email and session
            const { data: { session } } = await supabase.auth.getSession();
            const { data: { user } } = await supabase.auth.getUser();

            if (!session?.refresh_token || !user?.email) {
                setMessage('Erro: Sessão inválida. Faça logout e login novamente.');
                setIsActivating(false);
                return;
            }

            const success = await registerBiometric(user.email, session.refresh_token);

            if (success) {
                // Clear the declined flag
                localStorage.removeItem('biometric_declined');
                setMessage('✅ Biometria ativada!');
            } else {
                setMessage('Não foi possível ativar.');
            }
        } catch (error) {
            console.error('Error activating biometric:', error);
            setMessage('Erro ao ativar biometria.');
        }

        setIsActivating(false);
    };

    const handleDeactivate = () => {
        localStorage.removeItem('biometric_refresh_token');
        localStorage.removeItem('biometric_enrolled');
        localStorage.setItem('biometric_declined', 'true');
        setMessage('Biometria desativada.');
        // Force re-render
        window.location.reload();
    };

    return (
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-4">
            <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                <Fingerprint className="text-green-500" size={20} />
                Biometria
            </h2>

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-neutral-400">
                        {isEnrolled ? 'Ativada' : 'Desativada'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                        {isEnrolled
                            ? 'Você pode entrar usando sua digital ou Face ID.'
                            : 'Ative para entrar mais rápido.'}
                    </p>
                </div>

                {isEnrolled ? (
                    <button
                        onClick={handleDeactivate}
                        className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2"
                    >
                        <X size={16} />
                        Desativar
                    </button>
                ) : (
                    <button
                        onClick={handleActivate}
                        disabled={isActivating}
                        className="px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isActivating ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Check size={16} />
                        )}
                        Ativar
                    </button>
                )}
            </div>

            {message && (
                <p className={`text-xs mt-3 ${message.includes('✅') ? 'text-green-400' : 'text-neutral-400'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}
