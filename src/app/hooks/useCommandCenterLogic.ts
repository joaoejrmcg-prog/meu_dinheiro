import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { processCommand } from "../actions/ai";
import { checkAndIncrementUsage, getDailyUsage, refundUsageAction } from "../actions/usage";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { getUserLevel, updateUserLevel } from "../actions/profile";
import { setWalletInitialBalance } from "../actions/assets";
import type { UserLevel } from "../lib/levels";

export type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'error' | 'success';
    isTyping?: boolean; // For typewriter effect
};

type TutorialStep = 'IDLE' | 'GREETING' | 'ASK_BALANCE' | 'COMPLETE';

export function useCommandCenterLogic() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [usageCount, setUsageCount] = useState(0);
    const [inputType, setInputType] = useState<'text' | 'voice'>('text');
    const [userPlan, setUserPlan] = useState<string>('trial');
    const [tutorialStep, setTutorialStep] = useState<TutorialStep>('IDLE');
    const [userLevel, setUserLevel] = useState<UserLevel>(0);
    const [quickActions, setQuickActions] = useState<string[]>([]);

    const router = useRouter();
    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
    const tutorialStartedRef = useRef(false);

    // Load initial state
    // Load initial state
    useEffect(() => {
        let isMounted = true;
        let timeout1: NodeJS.Timeout;

        const init = async () => {
            const count = await getDailyUsage();
            if (!isMounted) return;
            setUsageCount(count);

            const level = await getUserLevel();
            if (!isMounted) return;
            setUserLevel(level);

            // Only start tutorial if level is 0 AND we haven't started it yet AND there are no messages
            if (level === 0) {
                if (tutorialStartedRef.current) return;
                tutorialStartedRef.current = true;

                setTutorialStep('GREETING');

                // Use functional update to avoid race conditions
                setMessages(prev => {
                    if (prev.length > 0) return prev; // Don't overwrite if already has messages
                    return [{
                        id: 'tutorial-greeting', // Fixed ID to prevent duplicates
                        role: 'assistant',
                        content: 'Oi 😊\nSou seu agente financeiro.\nVamos começar só com o básico: ver quanto entra e quanto sai.\nDepois eu te mostro outras coisas.',
                        isTyping: true
                    }];
                });

                // After greeting, ask for balance
                timeout1 = setTimeout(() => {
                    if (!isMounted) return;
                    setTutorialStep('ASK_BALANCE');
                    setMessages(prev => {
                        // Check if we already have the balance question
                        if (prev.some(m => m.id === 'tutorial-balance')) return prev;

                        return [...prev, {
                            id: 'tutorial-balance', // Fixed ID
                            role: 'assistant',
                            content: 'Me diga: quanto dinheiro você tem disponível pra usar e pagar suas contas?\n\n💡 Se não tiver certeza, chuta! Podemos corrigir depois.',
                            isTyping: true
                        }];
                    });
                }, 5000);
            } else {
                setMessages(prev => {
                    if (prev.length > 0) return prev;
                    return [{
                        id: 'welcome-msg',
                        role: 'assistant',
                        content: 'Olá! Sou seu Assistente Financeiro. Como posso ajudar hoje?'
                    }];
                });
            }
        };

        init();

        return () => {
            isMounted = false;
            clearTimeout(timeout1);
        };
    }, []);

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
            setInputType('voice');
        }
    }, [transcript]);

    useEffect(() => {
        if (!isListening && transcript && !isProcessing) {
            const userInput = transcript;
            const autoSend = async () => {
                setInput("");
                resetTranscript();
                addMessage('user', userInput);
                setIsProcessing(true);
                await processUserInput(userInput);
                setIsProcessing(false);
            };
            autoSend();
        }
    }, [isListening]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: sub } = await supabase
                    .from('subscriptions')
                    .select('plan')
                    .eq('user_id', session.user.id)
                    .single();
                if (sub?.plan) setUserPlan(sub.plan);
            }
        };
        checkUser();
    }, [router]);

    const addMessage = useCallback((
        role: 'user' | 'assistant',
        content: string,
        type: 'text' | 'error' | 'success' = 'text',
        options: { skipRefund?: boolean; isTyping?: boolean } = {}
    ) => {
        const { skipRefund = false, isTyping = false } = options;

        setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            role,
            content,
            type,
            isTyping
        }]);

        if (role === 'assistant' && type !== 'success' && !skipRefund) {
            refundUsageAction().then(() => {
                setUsageCount(prev => Math.max(0, prev - 1));
            });
        }
    }, []);

    const markTypingComplete = useCallback((messageId: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, isTyping: false } : msg
        ));
    }, []);

    // Tutorial flow functions
    const startTutorial = useCallback(() => {
        setTutorialStep('GREETING');
        setMessages([]);  // Clear previous messages
        addMessage('assistant',
            "Oi 😊\nSou seu agente financeiro.\nVamos começar só com o básico: ver quanto entra e quanto sai.\nDepois eu te mostro outras coisas.",
            'text',
            { isTyping: true, skipRefund: true }
        );

        // After greeting, ask for balance
        setTimeout(() => {
            setTutorialStep('ASK_BALANCE');
            addMessage('assistant',
                "Me diga: quanto dinheiro você tem disponível pra usar e pagar suas contas?\n\n💡 Se não tiver certeza, chuta! Podemos corrigir depois.",
                'text',
                { isTyping: true, skipRefund: true }
            );
        }, 5000); // Wait for greeting to finish typing
    }, [addMessage]);

    const skipTutorial = useCallback(async () => {
        await updateUserLevel(1 as UserLevel);
        setUserLevel(1);
        setTutorialStep('IDLE');
        addMessage('assistant',
            "✅ Tutorial pulado! Você já pode começar a usar.\n\nDica: Me diga quando gastar ou receber dinheiro, tipo \"Gastei 30 no almoço\".",
            'success',
            { skipRefund: true }
        );
    }, [addMessage]);

    const processTutorialInput = useCallback(async (userInput: string): Promise<boolean> => {
        if (tutorialStep === 'ASK_BALANCE') {
            // Try to extract a number from the input
            const cleaned = userInput.replace(/[^\d.,]/g, '').replace(',', '.');
            const value = parseFloat(cleaned);

            if (isNaN(value) || value < 0) {
                addMessage('assistant',
                    "Não entendi o valor. Me diga só o número, tipo \"3500\" ou \"R$ 2.000\".",
                    'text',
                    { isTyping: true, skipRefund: true }
                );
                return true; // Handled
            }

            setTutorialStep('COMPLETE');

            // Set wallet initial balance
            await setWalletInitialBalance(value);

            const formatted = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            addMessage('assistant',
                `Perfeito! Vou considerar que você tem ${formatted} disponíveis agora.\n\nSe precisar corrigir, diga: "Corrija meu saldo inicial pra R$ X"\n\nAgora, sempre que você gastar ou receber dinheiro, é só me avisar.`,
                'text',
                { isTyping: true, skipRefund: true }
            );

            // Show final message after a delay
            setTimeout(async () => {
                // Update user level to 1
                await updateUserLevel(1 as UserLevel);
                setUserLevel(1);

                // Dispatch event to update Sidebar
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 1 } }));
                }

                setTutorialStep('IDLE');
                addMessage('assistant',
                    "🎉 Parabéns! Estamos prontos pra começar! Agora você pode me dizer sempre que gastar ou receber dinheiro.\n\nExemplos:\n• \"Gastei 50 no mercado\"\n• \"Recebi 1000 do salário\"\n• \"Como estou esse mês?\"",
                    'success',
                    { isTyping: true, skipRefund: true }
                );
            }, 8000);

            return true; // Handled
        }
        return false; // Not handled
    }, [tutorialStep, addMessage]);

    const processUserInput = useCallback(async (userInput: string) => {
        const lowerInput = userInput.toLowerCase().trim();

        // Check for tutorial commands
        if (lowerInput.includes('fazer o tutorial') || lowerInput.includes('iniciar tutorial')) {
            startTutorial();
            return;
        }

        if (lowerInput.includes('pular tutorial')) {
            await skipTutorial();
            return;
        }

        if (lowerInput.includes('refazer') && lowerInput.includes('tutorial')) {
            // Reset to level 0 and start tutorial
            await updateUserLevel(0 as UserLevel);
            setUserLevel(0);
            startTutorial();
            return;
        }

        // If in tutorial, process tutorial input
        if (tutorialStep !== 'IDLE') {
            const handled = await processTutorialInput(userInput);
            if (handled) return;
        }

        // Normal AI processing
        const usage = await checkAndIncrementUsage();
        setUsageCount(usage.count);
        if (!usage.allowed) {
            addMessage('assistant', `🛑 Limite diário atingido.`, 'error', { skipRefund: true });
            return;
        }

        try {
            const response = await processCommand(userInput, [], inputType, userLevel);
            const msgType = response.message.includes('❌') ? 'error' : (response.message.includes('✅') ? 'success' : 'text');
            addMessage('assistant', response.message, msgType);

            if (response.audio) {
                const audio = new Audio(`data:audio/mp3;base64,${response.audio}`);
                audio.play().catch(e => console.error("Audio play error", e));
            }
        } catch (error: any) {
            console.error(error);
            addMessage('assistant', "Erro ao processar comando.", 'error');
        }
    }, [tutorialStep, inputType, addMessage, startTutorial, skipTutorial, processTutorialInput]);

    return {
        input,
        setInput,
        messages,
        isProcessing,
        usageCount,
        inputType,
        isListening,
        startListening,
        stopListening,
        userPlan,
        isSpeaking: false,
        setInputType,
        tutorialStep,
        userLevel,
        markTypingComplete,
        quickActions,
        handleQuickAction: (action: string) => {
            setQuickActions([]);
            addMessage('user', action);
            setIsProcessing(true);
            processUserInput(action).then(() => setIsProcessing(false));
        },
        handleSubmit: (e: any) => {
            if (e && e.preventDefault) e.preventDefault();
            if (!input.trim()) return;
            setQuickActions([]);
            addMessage('user', input);
            setInput("");
            setIsProcessing(true);
            processUserInput(input).then(() => setIsProcessing(false));
        }
    };
}

