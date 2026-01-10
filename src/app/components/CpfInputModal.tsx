"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { formatCPF, validateCPF, cleanCPF } from "@/lib/cpf-validator";
import { createBrowserClient } from '@supabase/ssr';

interface CpfInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (cpf: string) => void;
}

export default function CpfInputModal({ isOpen, onClose, onSuccess }: CpfInputModalProps) {
    const [cpf, setCpf] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCpf("");
            setError("");
        }
    }, [isOpen]);

    // Validate CPF on change
    useEffect(() => {
        if (cpf.length === 0) {
            setError("");
            return;
        }

        const cleaned = cleanCPF(cpf);

        // Wait for at least 11 digits
        if (cleaned.length < 11) {
            return;
        }

        // Validate
        if (!validateCPF(cleaned)) {
            setError("CPF inválido");
        } else {
            setError("");
        }
    }, [cpf]);

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const formatted = formatCPF(value);
        setCpf(formatted);
    };

    const handleSubmit = async () => {
        const cleaned = cleanCPF(cpf);

        // Final validation
        if (!validateCPF(cleaned)) {
            setError("CPF inválido");
            return;
        }

        setIsLoading(true);
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError("Sessão expirada");
                return;
            }

            const response = await fetch('/api/user/cpf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ cpf: cleaned })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Erro ao salvar CPF');
                return;
            }

            // Success!
            onSuccess(cleaned);
        } catch (err) {
            console.error('Error saving CPF:', err);
            setError('Erro ao salvar CPF. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const isValid = cpf.length > 0 && !error && cleanCPF(cpf).length === 11;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">
                    CPF Necessário
                </h2>

                <p className="text-neutral-400 text-sm mb-4">
                    Digite seu CPF para continuar
                </p>

                {/* CPF Input */}
                <div className="mb-4">
                    <label className="block text-sm text-neutral-400 mb-2">
                        CPF
                    </label>
                    <input
                        type="text"
                        value={cpf}
                        onChange={handleCpfChange}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className={`w-full p-3 bg-neutral-800 border rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all ${error
                            ? 'border-red-500 focus:ring-red-500/50'
                            : 'border-neutral-700 focus:ring-blue-500/50'
                            }`}
                        disabled={isLoading}
                    />
                    {error && (
                        <p className="text-red-500 text-xs mt-2">
                            {error}
                        </p>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-2.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid || isLoading}
                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Salvando...' : 'Confirmar'}
                    </button>
                </div>

                {/* Subtle warning about immutability - below buttons */}
                <p className="text-neutral-500 text-[11px] text-center mt-4 leading-relaxed">
                    O CPF não poderá ser alterado após a confirmação
                </p>
            </div>
        </div>
    );
}
