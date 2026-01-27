"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export default function AdvisorTestButton() {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/advisor/briefing');
            const data = await response.json();

            if (response.ok) {
                alert('Relatório gerado com sucesso! Verifique o sininho de notificações.');
            } else {
                alert('Erro ao gerar relatório: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Error generating briefing:', error);
            alert('Erro ao conectar com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white p-4 rounded-2xl shadow-lg shadow-purple-900/20 transition-all duration-200 flex items-center justify-center gap-3 group"
        >
            {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
                <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
            )}
            <span className="font-semibold">
                {loading ? 'Gerando...' : 'Gerar Relatório Semanal Agora'}
            </span>
        </button>
    );
}
