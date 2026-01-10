"use client";

import { useState, useEffect } from "react";
import CommandCenter from "./components/CommandCenter";
import { Sparkles, RotateCcw } from "lucide-react";
import { DashboardProvider } from "./context/DashboardContext";
import SubscriptionStatus from "./components/SubscriptionStatus";
import { getUserLevel } from "./actions/profile";
import type { UserLevel } from "./lib/levels";
import { getSuggestionsForLevel } from "./lib/suggestions";



function HomeContent() {
  const [userLevel, setUserLevel] = useState<UserLevel>(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    getUserLevel().then((level) => {
      setUserLevel(level);
      setSuggestions(getSuggestionsForLevel(level, 3)); // Home usa 3 sugestões
    });
  }, []);

  const handleSuggestionClick = (text: string) => {
    const input = document.querySelector('textarea');
    if (input) {
      // Hack to force React to recognize the value change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, text);
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  const handleRedoTutorial = () => {
    handleSuggestionClick("Quero refazer o tutorial");
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center max-w-4xl mx-auto w-full md:p-4">
      <div className="w-full flex-1 flex flex-col relative overflow-hidden">

        <div className="relative z-10 flex flex-col h-full">
          {/* Header Minimalista */}
          <div className="text-center mb-2 flex-shrink-0">
            <h1 className="text-2xl font-light text-[var(--foreground)] tracking-tight flex flex-col items-center justify-center gap-2">
              <span className="font-semibold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Meu Dinheiro
              </span>
              <span className="text-sm text-neutral-500 flex items-center gap-2">
                Seu Assistente Financeiro
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-[10px] font-medium">
                  <Sparkles className="w-3 h-3" />
                  IA
                </span>
              </span>
            </h1>
          </div>

          {/* Chat Area */}
          <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col">
            <CommandCenter />
          </div>

          {/* Micro-interactions / Suggestions - Grid responsivo */}
          <div className="mt-4 px-2 pb-2">
            {userLevel === 0 ? (
              /* Nível 0: botões discretos - tutorial já começa automático */
              <div className="flex gap-3 justify-center max-w-md mx-auto">
                <button
                  onClick={() => handleSuggestionClick("Quero refazer o tutorial")}
                  className="text-xs px-4 py-2 rounded-lg bg-neutral-800/30 border border-neutral-700/50 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reiniciar Tutorial
                </button>
                <button
                  onClick={() => handleSuggestionClick("Pular tutorial")}
                  className="text-xs px-4 py-2 rounded-lg bg-neutral-800/30 border border-neutral-700/50 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
                >
                  Pular →
                </button>
              </div>
            ) : (
              /* Níveis 1+: grid com sugestões + refazer tutorial */
              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(sug)}
                    className="text-xs px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors truncate"
                    title={sug}
                  >
                    {sug}
                  </button>
                ))}
                {/* Botão Refazer Tutorial */}
                <button
                  onClick={handleRedoTutorial}
                  className="text-xs px-3 py-2 rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-800/40 hover:text-emerald-300 transition-colors flex items-center justify-center gap-1.5"
                  title="Refazer tutorial"
                >
                  <RotateCcw className="w-3 h-3" />
                  Refazer tutorial
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center p-4">
        <p className="text-xs text-zinc-600">
          &copy; 2025 NeoManager.
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))}
            className="ml-2 underline hover:text-[var(--primary)] transition-colors"
          >
            Termos
          </button>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <DashboardProvider>
      <HomeContent />
    </DashboardProvider>
  );
}
