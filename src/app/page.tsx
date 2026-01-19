"use client";

import { useState, useEffect } from "react";
import CommandCenter from "./components/CommandCenter";
import Confetti from "./components/Confetti";
import PaymentReminder from "./components/PaymentReminder";
import { Sparkles, RotateCcw } from "lucide-react";
import { DashboardProvider, useDashboard } from "./context/DashboardContext";
import SubscriptionStatus from "./components/SubscriptionStatus";
import { getUserLevel, getActionCount, incrementLevel } from "./actions/profile";
import type { UserLevel } from "./lib/levels";
import { getSuggestionsForLevel } from "./lib/suggestions";



function HomeContent() {
  const [userLevel, setUserLevel] = useState<UserLevel>(0);
  const [actionCount, setActionCount] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    getUserLevel().then((level) => {
      setUserLevel(level);
      setSuggestions(getSuggestionsForLevel(level, 3)); // Home usa 3 sugestões
    });

    getActionCount().then(setActionCount);

    const handleTransactionUpdate = () => {
      getActionCount().then(setActionCount);
    };

    const handleCelebrate = () => {
      setShowConfetti(true);
    };

    window.addEventListener('transactionUpdated', handleTransactionUpdate);
    window.addEventListener('celebrateLevelUp', handleCelebrate);

    return () => {
      window.removeEventListener('transactionUpdated', handleTransactionUpdate);
      window.removeEventListener('celebrateLevelUp', handleCelebrate);
    };
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
    handleSuggestionClick(`Refazer tutorial nível ${userLevel}`);
  };

  const { triggerTutorial } = useDashboard();

  const handleLevelUp = async () => {
    const nextLevel = userLevel + 1;

    // Nível 3+ ainda está em desenvolvimento
    if (nextLevel >= 3) {
      alert('🚧 Em breve!\n\nO Nível 3 está em fase de implantação. Você será notificado quando estiver disponível!\n\nContinue aproveitando as funcionalidades do Nível 2. 😊');
      return;
    }

    console.log(`Botão Nível ${nextLevel} clicado, disparando ação via Context...`);
    triggerTutorial(`START_L${nextLevel}`);
  };

  return (
    <div className="h-full flex flex-col items-center max-w-4xl mx-auto w-full px-4" style={{ background: 'var(--light-background)' }}>
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />



      <div className="w-full flex-1 flex flex-col relative overflow-hidden min-h-0 pb-2">

        <div className="relative z-10 flex flex-col h-full">

          {/* Payment Reminders - Only show for level 2+ users */}
          {userLevel >= 2 && <PaymentReminder />}

          {/* Chat Area */}
          <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col">
            <CommandCenter />
          </div>

          {/* Botões contextuais removidos - aparecem via chat quando necessário */}

        </div>
      </div>

      {/* Footer */}
      <div className="text-center p-4">
        <p className="text-xs" style={{ color: 'var(--light-text-muted)' }}>
          &copy; 2026 NeoManager.
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))}
            className="ml-2 underline hover:opacity-70 transition-opacity"
            style={{ color: 'var(--light-text-secondary)' }}
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
