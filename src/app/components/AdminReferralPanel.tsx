"use client";

import { useState } from "react";
import { confirmFirstPayment } from "../actions/referral";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export default function AdminReferralPanel() {
    const [userId, setUserId] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleConfirmPayment = async () => {
        if (!userId.trim()) {
            setResult({ success: false, message: "Por favor, informe o ID do usuário" });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await confirmFirstPayment(userId.trim());
            setResult(response);
        } catch (error) {
            setResult({ success: false, message: "Erro ao processar recompensa" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
                Admin - Confirmar Primeiro Pagamento
            </h2>
            <p className="text-sm text-gray-600 mb-6">
                Use este painel para manualmente confirmar o primeiro pagamento de um usuário e conceder recompensa ao referrer.
            </p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        User ID (UUID)
                    </label>
                    <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                    />
                </div>

                <button
                    onClick={handleConfirmPayment}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processando...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-5 h-5" />
                            Confirmar Pagamento
                        </>
                    )}
                </button>

                {result && (
                    <div
                        className={`p-4 rounded-lg border flex items-start gap-3 ${result.success
                            ? "bg-green-50 border-green-200 text-green-800"
                            : "bg-red-50 border-red-200 text-red-800"
                            }`}
                    >
                        {result.success ? (
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="text-sm">
                            <p className="font-medium mb-1">
                                {result.success ? "✅ Sucesso!" : "❌ Erro"}
                            </p>
                            <p>{result.message}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                    <strong>⚠️ Atenção:</strong> Este painel é temporário para MVP.
                    Em produção, o webhook do Asaas deve disparar automaticamente.
                </p>
            </div>
        </div>
    );
}
