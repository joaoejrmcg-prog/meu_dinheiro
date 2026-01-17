"use client";

import { useRef, useEffect, useState } from "react";
import { Mic, Send, Loader2, LogOut, Bot, User, MicOff, Sparkles, RotateCcw } from "lucide-react";
import { getUserLevel, getActionCount } from "../actions/profile";
import { useDashboard } from "../context/DashboardContext";
import type { UserLevel } from "../lib/levels";
import { cn } from "@/app/lib/utils";
import { VoiceOrb } from "./VoiceOrb";
import { useCommandCenterLogic } from "../hooks/useCommandCenterLogic";
import { TypewriterText } from "./TypewriterText";
import { TutorialMessage } from "./TutorialMessage";
import { getSubscriptionDetails } from "../actions/profile";
import { formatMarkdown } from "../lib/markdown";

export default function CommandCenter() {
    const {
        input,
        setInput,
        messages,
        isProcessing,
        usageCount,
        inputType,
        isSpeaking,
        userPlan,
        isListening,
        startListening,
        stopListening,
        handleSubmit,
        setInputType,
        markTypingComplete,
        markTutorialTypingComplete,
        quickActions,
        handleQuickAction,
        handleTutorialButton
    } = useCommandCenterLogic();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [input]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages]);

    const [subscription, setSubscription] = useState<any>(null);
    const [userLevel, setUserLevel] = useState<UserLevel>(0);
    const [actionCount, setActionCount] = useState(0);
    const { triggerTutorial } = useDashboard();

    useEffect(() => {
        getSubscriptionDetails().then(data => {
            setSubscription(data);
        }).catch(console.error);

        // Load user level and action count
        getUserLevel().then(setUserLevel);
        getActionCount().then(setActionCount);

        // Listen for transaction updates to refresh action count
        const handleTransactionUpdate = () => {
            getActionCount().then(setActionCount);
        };
        window.addEventListener('transactionUpdated', handleTransactionUpdate);
        return () => window.removeEventListener('transactionUpdated', handleTransactionUpdate);
    }, []);

    return (
        <div className="flex flex-col h-full rounded-2xl border overflow-hidden shadow-xl" style={{ background: 'var(--light-card-bg)', borderColor: 'var(--light-border)' }}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ background: 'var(--light-card-bg)', borderColor: 'var(--light-border)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ background: 'rgba(14, 165, 233, 0.1)', borderColor: 'rgba(14, 165, 233, 0.3)' }}>
                        <Sparkles className="w-5 h-5" style={{ color: 'var(--light-primary)' }} />
                    </div>
                    <div>
                        <h3 className="font-semibold" style={{ color: 'var(--light-text-primary)' }}>Assistente IA</h3>
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--light-text-secondary)' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ boxShadow: '0 0 8px #10B981' }} />
                            Online
                            <span className="mx-1 text-neutral-600">•</span>
                            {['vip', 'pro'].includes(userPlan.toLowerCase()) ? (
                                <span className="flex items-center gap-1" style={{ color: 'var(--light-primary)' }}>
                                    <Sparkles className="w-3 h-3" />
                                    Ilimitado
                                </span>
                            ) : (
                                <span style={{ color: usageCount >= 10 ? '#EF4444' : 'var(--light-text-secondary)' }}>
                                    {Math.max(0, 10 - usageCount)} respostas verdes restantes
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Subscription Info - Right Side */}
                <div className="text-right flex flex-col items-end gap-0.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider" style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', color: 'var(--light-primary)' }}>
                        {userPlan || 'FREE'}
                    </span>
                    {subscription?.isLifetime ? (
                        <p className="text-[10px]" style={{ color: 'var(--light-text-muted)' }}>Vitalício ✨</p>
                    ) : subscription?.currentPeriodEnd ? (
                        <p className="text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                            Vence em {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                        </p>
                    ) : null}
                </div>
            </div>

            {/* Chat Area - Tema Claro */}
            <div className={cn(
                "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 transition-all duration-300",
                (isListening || (isProcessing && inputType === 'voice') || isSpeaking) && "pb-[350px]"
            )} style={{ background: 'var(--light-messages-bg)' }}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border" style={{ background: 'rgba(14, 165, 233, 0.1)', borderColor: 'rgba(14, 165, 233, 0.2)' }}>
                            <Bot className="w-8 h-8" style={{ color: 'var(--light-primary)' }} />
                        </div>
                        <h4 className="text-lg font-medium mb-2" style={{ color: 'var(--light-text-primary)' }}>Como posso ajudar?</h4>
                        <p className="text-sm max-w-xs" style={{ color: 'var(--light-text-secondary)' }}>
                            Tente dizer: "Gastei 50 reais no almoço" ou "Qual meu saldo?".
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex w-full",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-base",
                                msg.role === 'user'
                                    ? "bg-sky-500 text-white rounded-br-md shadow-lg ml-auto"
                                    : cn(
                                        "rounded-bl-md border bg-white",
                                        msg.type === 'error' && "border-red-300 !bg-red-50 text-red-700",
                                        msg.type === 'success' && "border-green-300 !bg-green-50 text-green-700",
                                        !msg.type && "border-slate-200 text-slate-800"
                                    )
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-2 mb-1 opacity-60 text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--light-text-muted)' }}>
                                    <Bot className="w-3 h-3" />
                                    IA
                                </div>
                            )}
                            {msg.isTyping ? (
                                <TypewriterText
                                    text={msg.content}
                                    speed={25}
                                    onComplete={() => markTypingComplete(msg.id)}
                                    onType={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                                />
                            ) : msg.buttons && msg.buttons.length > 0 ? (
                                <TutorialMessage
                                    content={msg.content}
                                    buttons={msg.buttons}
                                    onButtonClick={handleTutorialButton}
                                    disabled={isProcessing}
                                    typingComplete={msg.typingComplete}
                                    onTypingComplete={() => markTutorialTypingComplete(msg.id)}
                                    onType={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                                />
                            ) : (
                                formatMarkdown(msg.content)
                            )}
                        </div>
                    </div>
                ))}

                {/* Thinking Indicator */}
                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 rounded-bl-md border" style={{ background: 'var(--light-card-bg)', borderColor: 'var(--light-border)' }}>
                            <div className="flex items-center gap-2 mb-1 opacity-60 text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--light-text-muted)' }}>
                                <Bot className="w-3 h-3" />
                                IA
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full animate-[pulse_1s_ease-in-out_0s_infinite]" style={{ background: 'var(--light-primary)' }} />
                                <span className="w-2 h-2 rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" style={{ background: 'var(--light-primary)' }} />
                                <span className="w-2 h-2 rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" style={{ background: 'var(--light-primary)' }} />
                                <span className="ml-2 text-sm" style={{ color: 'var(--light-text-secondary)' }}>Pensando...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Action Buttons - Tema Claro */}
                {quickActions.length > 0 && !isProcessing && (
                    <div className="flex flex-wrap gap-2 ml-4 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {quickActions.map((action, index) => (
                            <button
                                key={index}
                                onClick={() => handleQuickAction(action)}
                                className="px-4 py-2 text-sm rounded-full border transition-all hover:shadow-md"
                                style={{
                                    background: 'var(--light-card-bg)',
                                    borderColor: 'var(--light-border)',
                                    color: 'var(--light-text-primary)'
                                }}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Destacado */}
            <div className="p-4 border-t" style={{ background: 'var(--light-card-bg)', borderColor: 'var(--light-border)' }}>
                {/* Listening Indicator */}
                {isListening && (
                    <div className="flex items-center justify-center gap-2 mb-3 py-2 bg-red-50 rounded-xl border border-red-200 animate-pulse">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                        <span className="text-red-600 text-sm font-medium">🎤 Ouvindo... Fale agora!</span>
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            setInputType('text');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder="Digite ou fale um comando..."
                        className="flex-1 rounded-xl px-4 py-3 transition-all outline-none resize-none min-h-[56px] max-h-[200px] scrollbar-thin"
                        style={{
                            background: '#FFFFFF',
                            border: '2px solid var(--light-primary)',
                            color: 'var(--light-text-primary)',
                            boxShadow: '0 0 0 4px rgba(14, 165, 233, 0.15), 0 4px 12px rgba(14, 165, 233, 0.1)'
                        }}
                        disabled={isProcessing}
                        rows={1}
                    />

                    <div className="flex items-center gap-2 pb-1">
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={cn(
                                "p-3 rounded-xl transition-all duration-300 border",
                                isListening
                                    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse border-red-400 shadow-lg shadow-red-500/30"
                                    : "hover:bg-slate-100 border-slate-200"
                            )}
                            style={!isListening ? { background: 'var(--light-messages-bg)', color: 'var(--light-text-secondary)' } : {}}
                            title="Usar voz"
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={!input.trim() || isProcessing}
                            className="p-3 rounded-xl transition-colors disabled:opacity-50 disabled:shadow-none"
                            style={{
                                background: !input.trim() || isProcessing ? 'var(--light-messages-bg)' : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                                color: !input.trim() || isProcessing ? 'var(--light-text-muted)' : 'white',
                                boxShadow: !input.trim() || isProcessing ? 'none' : '0 4px 12px rgba(14, 165, 233, 0.4)'
                            }}
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                {/* Hint - escondido no mobile */}
                <p className="hidden md:block text-[10px] text-center mt-2" style={{ color: 'var(--light-text-muted)' }}>
                    Enter para enviar • Shift + Enter para quebrar linha
                </p>

                {/* Botões de Nível - aparecem após tutorial */}
                {userLevel >= 1 && (
                    <div className="flex justify-center gap-2 mt-3">
                        {actionCount < 2 ? (
                            /* Menos de 2 ações: mostrar Refazer Tutorial */
                            <button
                                onClick={() => {
                                    const textarea = document.querySelector('textarea');
                                    if (textarea) {
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                                        if (nativeInputValueSetter) {
                                            nativeInputValueSetter.call(textarea, `Refazer tutorial nível ${userLevel}`);
                                        }
                                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                        textarea.focus();
                                    }
                                }}
                                className="text-xs px-4 py-2 rounded-full border transition-all hover:shadow-md flex items-center gap-1.5"
                                style={{
                                    background: 'var(--light-card-bg)',
                                    borderColor: 'var(--light-border)',
                                    color: 'var(--light-text-secondary)'
                                }}
                            >
                                <RotateCcw className="w-3 h-3" />
                                Refazer tutorial nível {userLevel}
                            </button>
                        ) : userLevel < 4 ? (
                            /* 2+ ações e não está no nível máximo: mostrar Ir para Nível X+1 */
                            <button
                                onClick={() => {
                                    const nextLevel = userLevel + 1;
                                    if (nextLevel >= 3) {
                                        alert('🚧 Em breve!\n\nO Nível 3 está em fase de implantação. Você será notificado quando estiver disponível!\n\nContinue aproveitando as funcionalidades atuais. 😊');
                                        return;
                                    }
                                    triggerTutorial(`START_L${nextLevel}`);
                                }}
                                className="text-xs px-4 py-2 rounded-full border transition-all hover:shadow-md flex items-center gap-1.5"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                    borderColor: 'rgba(14, 165, 233, 0.3)',
                                    color: '#0EA5E9'
                                }}
                            >
                                <Sparkles className="w-3 h-3" />
                                Ir para Nível {userLevel + 1}
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
            {((isProcessing && inputType === 'voice') || isSpeaking) && (
                <VoiceOrb mode={isSpeaking ? 'SPEAKING' : 'PROCESSING'} />
            )}
        </div>
    );
}
