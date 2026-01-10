"use client";

import { useRef, useEffect, useState } from "react";
import { Mic, Send, Loader2, LogOut, Bot, User, MicOff, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { VoiceOrb } from "./VoiceOrb";
import { useCommandCenterLogic } from "../hooks/useCommandCenterLogic";
import { TypewriterText } from "./TypewriterText";
import { getSubscriptionDetails } from "../actions/profile";

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
        quickActions,
        handleQuickAction
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
    useEffect(() => {
        getSubscriptionDetails().then(setSubscription).catch(console.error);
    }, []);

    return (
        <div className="flex flex-col h-full bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl shadow-[var(--primary)]/5">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--card-bg)]/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20">
                        <Sparkles className="w-5 h-5 text-[var(--primary)]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-[var(--foreground)]">Assistente IA</h3>
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_10px_var(--primary)]" />
                            Online
                            <span className="mx-1 text-neutral-700">•</span>
                            {['vip', 'pro'].includes(userPlan.toLowerCase()) ? (
                                <span className="text-[var(--primary)] flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Ilimitado
                                </span>
                            ) : (
                                <span className={usageCount >= 10 ? "text-red-400" : "text-neutral-400"}>
                                    {Math.max(0, 10 - usageCount)} respostas verdes restantes
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                {/* Subscription Info */}
                {subscription && !subscription.isLifetime && (
                    <div className="text-right">
                        <p className="text-[10px] text-neutral-500 font-medium">
                            {subscription.plan === 'trial' ? 'Teste Grátis' : 'Plano Pro'}
                        </p>
                        <p className="text-[10px] text-neutral-600">
                            Vence em {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 transition-all duration-300",
                (isListening || (isProcessing && inputType === 'voice') || isSpeaking) && "pb-[350px]"
            )}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--secondary)]/20 flex items-center justify-center mb-4 border border-[var(--primary)]/20">
                            <Bot className="w-8 h-8 text-[var(--primary)]" />
                        </div>
                        <h4 className="text-lg font-medium text-neutral-300 mb-2">Como posso ajudar?</h4>
                        <p className="text-sm text-neutral-500 max-w-xs">
                            Tente dizer: "Cadastrar cartão Nubank" ou "Gastei 50 reais no almoço".
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
                                "max-w-full md:max-w-[80%] rounded-2xl px-4 py-3 text-base border",
                                msg.role === 'user'
                                    ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20 rounded-tr-none shadow-[0_0_15px_-5px_var(--primary)]"
                                    : cn(
                                        "bg-neutral-900 text-neutral-200 rounded-tl-none border-neutral-800",
                                        msg.type === 'error' && "border-red-500/50 bg-red-500/10 text-red-200",
                                        msg.type === 'success' && "border-[var(--primary)]/50 bg-[var(--primary)]/10 text-[var(--primary)]"
                                    )
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-2 mb-1 opacity-50 text-xs uppercase tracking-wider font-medium">
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
                            ) : (
                                <span className="whitespace-pre-wrap">{msg.content}</span>
                            )}
                        </div>
                    </div>
                ))}

                {/* Quick Action Buttons */}
                {quickActions.length > 0 && !isProcessing && (
                    <div className="flex flex-wrap gap-2 ml-4 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {quickActions.map((action, index) => (
                            <button
                                key={index}
                                onClick={() => handleQuickAction(action)}
                                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm rounded-full border border-neutral-700 hover:border-[var(--primary)] transition-all hover:shadow-[0_0_10px_var(--primary)/20]"
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[var(--card-bg)] border-t border-[var(--border-color)]">
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
                        placeholder={isListening ? "Ouvindo..." : "Digite ou fale um comando..."}
                        className="flex-1 bg-neutral-900/50 border border-neutral-700 text-neutral-200 placeholder:text-neutral-500 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all outline-none resize-none min-h-[56px] max-h-[200px] scrollbar-thin scrollbar-thumb-neutral-600"
                        disabled={isProcessing}
                        rows={1}
                    />

                    <div className="flex items-center gap-2 pb-1">
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={cn(
                                "p-3 rounded-xl transition-all duration-300 border",
                                isListening
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse border-red-500/50"
                                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border-neutral-700"
                            )}
                            title="Usar voz"
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={!input.trim() || isProcessing}
                            className="p-3 bg-[var(--primary)] hover:bg-[var(--primary)]/80 text-black font-bold rounded-xl transition-colors disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 shadow-lg shadow-[var(--primary)]/20 disabled:shadow-none"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-center text-neutral-600 mt-2">
                    Enter para enviar • Shift + Enter para quebrar linha
                </p>
            </div>
            {(isListening || (isProcessing && inputType === 'voice') || isSpeaking) && (
                <VoiceOrb mode={isSpeaking ? 'SPEAKING' : (isProcessing ? 'PROCESSING' : 'LISTENING')} />
            )}
        </div>
    );
}
