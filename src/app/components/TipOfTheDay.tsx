"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Lightbulb, X } from "lucide-react";
import { TIPS, getTipOfTheDayIndex } from "@/lib/tips";

export default function TipOfTheDay() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);

    useEffect(() => {
        // Define a dica baseada no dia do mês
        setCurrentTipIndex(getTipOfTheDayIndex());
    }, []);

    const handleNextTip = () => {
        setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 text-neutral-400 hover:text-yellow-400 transition-colors relative group"
                title="Dica do Dia"
            >
                <Lightbulb className="w-5 h-5 group-hover:animate-pulse" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200 h-[100dvh] w-screen"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden relative animate-in zoom-in-95 duration-200 m-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header com gradiente */}
                        <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-6 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Lightbulb size={120} />
                            </div>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 z-20 text-white/80 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full p-1"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                    <Lightbulb className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-bold">Dica do Dia #{currentTipIndex + 1}</h3>
                            </div>
                            <p className="text-yellow-50 relative z-10 opacity-90">
                                Um conselho especial para impulsionar seu negócio
                            </p>
                        </div>

                        {/* Conteúdo com rolagem se necessário */}
                        <div className="p-8 text-center overflow-y-auto custom-scrollbar">
                            <p className="text-lg text-neutral-200 font-medium leading-relaxed">
                                "{TIPS[currentTipIndex]}"
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-neutral-950/50 border-t border-neutral-800 flex justify-between items-center">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-sm font-medium text-neutral-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={handleNextTip}
                                className="flex items-center gap-2 text-sm font-medium text-yellow-500 hover:text-yellow-400 transition-colors px-4 py-2 rounded-lg hover:bg-yellow-500/10"
                            >
                                Ver próxima dica
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
