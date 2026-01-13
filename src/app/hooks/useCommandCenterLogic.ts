import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { processCommand } from "../actions/ai";
import { checkAndIncrementUsage, getDailyUsage, refundUsageAction } from "../actions/usage";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { getUserLevel, updateUserLevel } from "../actions/profile";
import { setWalletInitialBalance } from "../actions/assets";
import { useDashboard } from "../context/DashboardContext";
import type { UserLevel } from "../lib/levels";

export type TutorialButton = {
    label: string;
    value: string;
    variant?: 'primary' | 'secondary' | 'bank';
};

export type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'error' | 'success';
    isTyping?: boolean; // For typewriter effect
    buttons?: TutorialButton[]; // For inline tutorial buttons
    typingComplete?: boolean; // Track if typewriter finished for this message
};

type TutorialStep =
    // Level 0 tutorial
    | 'IDLE' | 'GREETING' | 'ASK_BALANCE' | 'COMPLETE'
    // Level 2 tutorial
    | 'L2_INTRO' | 'L2_BANK_ASK' | 'L2_BANK_CHOOSE' | 'L2_BANK_CUSTOM' | 'L2_BANK_CREATED'
    | 'L2_TRANSFER_EXPLAIN' | 'L2_RECURRENCE_EXPLAIN' | 'L2_SCHEDULE_EXPLAIN' | 'L2_DONE'
    // Level 3 tutorial (Crédito)
    | 'L3_INTRO' | 'L3_CARD_ASK' | 'L3_CARD_CREATED' | 'L3_LOAN_EXPLAIN' | 'L3_DONE'
    // Level 4 tutorial (Planejamento)
    | 'L4_INTRO' | 'L4_GOAL_ASK' | 'L4_GOAL_CREATED' | 'L4_PROJECTION_EXPLAIN' | 'L4_DONE';

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
    const [l2BankName, setL2BankName] = useState<string>(''); // Store bank name for L2 tutorial

    // Slot-filling state to maintain context between conversation turns
    const [pendingSlots, setPendingSlots] = useState<{
        intent?: string;
        description?: string;
        amount?: number;
        date?: string;
        dueDate?: string;
        type?: 'income' | 'expense';
        category?: string;
    } | null>(null);

    // Reconciliation state for multiple match scenarios
    const [pendingReconciliation, setPendingReconciliation] = useState<{
        matches: any[];
        searchTerm: string;
    } | null>(null);

    // Transfer confirmation state for negative balance scenarios
    const [pendingTransfer, setPendingTransfer] = useState<{
        fromAccountId: string;
        toAccountId: string;
        fromAccountName: string;
        toAccountName: string;
        amount: number;
        description?: string;
        date?: string;
    } | null>(null);

    const router = useRouter();
    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
    const tutorialStartedRef = useRef(false);
    const { tutorialAction } = useDashboard();

    // Listen for tutorial triggers from Context
    useEffect(() => {
        // Level intro messages
        const levelIntros: Record<string, { step: TutorialStep; content: string; buttonLabel: string; buttonValue: string }> = {
            'START_L2': {
                step: 'L2_INTRO',
                content: "Muito bem! 🚀\n\nAgora vamos organizar sua vida financeira em **3 passos rápidos**:\n\n1️⃣ **Contas e Bancos**\n2️⃣ **Transferências**\n3️⃣ **Planejamento Futuro** (Contas fixas e agendamentos)\n\nVamos lá?",
                buttonLabel: 'Continuar',
                buttonValue: 'L2_CONTINUE_INTRO'
            },
            'START_L3': {
                step: 'L3_INTRO',
                content: "Excelente progresso! 💳\n\nAgora vamos dominar o **Crédito**:\n\n1️⃣ **Cartões de Crédito** - Cadastrar seus cartões\n2️⃣ **Faturas** - Acompanhar gastos no cartão\n3️⃣ **Empréstimos** - Controlar dívidas\n\nPronto para o próximo desafio?",
                buttonLabel: 'Continuar',
                buttonValue: 'L3_CONTINUE_INTRO'
            },
            'START_L4': {
                step: 'L4_INTRO',
                content: "Você está no topo! 🎯\n\nVamos dominar o **Planejamento**:\n\n1️⃣ **Metas** - Criar objetivos de economia\n2️⃣ **Reservas** - Guardar dinheiro\n3️⃣ **Projeções** - Simular o futuro\n\nPreparado para planejar seu futuro financeiro?",
                buttonLabel: 'Continuar',
                buttonValue: 'L4_CONTINUE_INTRO'
            }
        };

        if (!tutorialAction) return;

        const intro = levelIntros[tutorialAction];
        if (intro) {
            console.log(`Context action ${tutorialAction} received!`);
            setTutorialStep(intro.step);
            setMessages([]);

            setMessages([{
                id: `${tutorialAction.toLowerCase()}-intro`,
                role: 'assistant',
                content: intro.content,
                buttons: [{ label: intro.buttonLabel, value: intro.buttonValue, variant: 'primary' }]
            }]);
        }
    }, [tutorialAction]);

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
                // Check if terms are accepted before starting tutorial
                const termsAccepted = localStorage.getItem('terms_accepted_v1') === 'true';

                if (!termsAccepted) {
                    // Wait for terms to be accepted before starting tutorial
                    console.log('Waiting for terms acceptance before starting tutorial...');
                    return;
                }

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

        // Listen for terms acceptance event to start tutorial
        const handleTermsAccepted = () => {
            console.log('Terms accepted, checking if should start tutorial...');
            // Re-run init to start tutorial if level is 0
            init();
        };
        window.addEventListener('terms-accepted', handleTermsAccepted);

        return () => {
            isMounted = false;
            clearTimeout(timeout1);
            window.removeEventListener('terms-accepted', handleTermsAccepted);
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

    // Mark a tutorial message as typing complete (for TutorialMessage component)
    const markTutorialTypingComplete = useCallback((messageId: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, typingComplete: true } : msg
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

        // ===== LEVEL 2 TUTORIAL =====

        // L2 Intro -> Bank Ask
        if (userInput === 'L2_CONTINUE_INTRO') {
            setTutorialStep('L2_BANK_ASK');
            setMessages(prev => [...prev, {
                id: 'l2-bank-ask',
                role: 'assistant',
                content: "🏦 **1. Contas e Bancos**\n\nUma conta é simplesmente onde o dinheiro está, como Nubank, Itaú ou o dinheiro da carteira.\n\nA carteira continua existindo, mas agora você pode ter dinheiro em vários lugares.\n\nVocê tem conta em algum banco?",
                buttons: [
                    { label: 'Sim', value: 'L2_BANK_YES', variant: 'primary' },
                    { label: 'Não', value: 'L2_BANK_NO', variant: 'secondary' }
                ]
            }]);
            return true;
        }

        // User has no bank account -> skip to transfers
        if (userInput === 'L2_BANK_NO') {
            setTutorialStep('L2_TRANSFER_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l2-no-bank',
                role: 'assistant',
                content: "Sem problema 😊\nPor enquanto vamos continuar só com o dinheiro da carteira.\n\nQuando você abrir uma conta, é só me dizer algo como:\n\"Abri uma conta no Nubank\".",
                buttons: [{ label: 'Continuar', value: 'L2_GO_TRANSFER', variant: 'primary' }]
            }]);
            return true;
        }

        // User has bank account -> ask which one
        if (userInput === 'L2_BANK_YES') {
            setTutorialStep('L2_BANK_CHOOSE');
            setMessages(prev => [...prev, {
                id: 'l2-bank-choose',
                role: 'assistant',
                content: "Qual é o banco que você mais usa?",
                buttons: [
                    { label: 'Nubank', value: 'L2_BANK_Nubank', variant: 'bank' },
                    { label: 'Itaú', value: 'L2_BANK_Itaú', variant: 'bank' },
                    { label: 'Bradesco', value: 'L2_BANK_Bradesco', variant: 'bank' },
                    { label: 'Sicredi', value: 'L2_BANK_Sicredi', variant: 'bank' },
                    { label: 'Outro', value: 'L2_BANK_OTHER', variant: 'secondary' }
                ]
            }]);
            return true;
        }

        // User chose a bank via button
        if (userInput.startsWith('L2_BANK_') && tutorialStep === 'L2_BANK_CHOOSE') {
            const bankName = userInput.replace('L2_BANK_', '');

            if (bankName === 'OTHER') {
                setTutorialStep('L2_BANK_CUSTOM');
                setMessages(prev => [...prev, {
                    id: 'l2-bank-other',
                    role: 'assistant',
                    content: "Me diz o nome do banco que você usa:",
                }]);
                return true;
            }

            // Create the bank account
            const { createAccount, setDefaultAccount } = await import('../actions/assets');
            const newAccount = await createAccount({ name: bankName, type: 'bank', balance: 0 });
            if (newAccount?.id) {
                await setDefaultAccount(newAccount.id);
            }

            setL2BankName(bankName);
            setTutorialStep('L2_BANK_CREATED');
            setMessages(prev => [...prev, {
                id: 'l2-bank-created',
                role: 'assistant',
                content: `Perfeito! Criei a conta ${bankName}.\n\nEssa vai ser sua conta principal.\nSempre que você falar algo como:\n"paguei no Pix" ou "recebi 1000"\nsem dizer o banco, vou usar essa conta.\n\nIsso evita que eu fique te perguntando "qual banco?" toda hora.`,
                buttons: [{ label: 'Continuar', value: 'L2_GO_TRANSFER', variant: 'primary' }]
            }]);
            return true;
        }

        // User typed a bank name directly in L2_BANK_CHOOSE (instead of clicking a button)
        if (tutorialStep === 'L2_BANK_CHOOSE' && !userInput.startsWith('L2_')) {
            const bankName = userInput.trim();

            if (bankName.length < 2) {
                setMessages(prev => [...prev, {
                    id: 'l2-bank-invalid',
                    role: 'assistant',
                    content: "Hmm, não entendi. Use os botões ou digite o nome do seu banco (ex: Caixa, Santander, Inter...):",
                }]);
                return true;
            }

            // Create the bank account directly
            const { createAccount, setDefaultAccount } = await import('../actions/assets');
            const newAccount = await createAccount({ name: bankName, type: 'bank', balance: 0 });
            if (newAccount?.id) {
                await setDefaultAccount(newAccount.id);
            }

            setL2BankName(bankName);
            setTutorialStep('L2_BANK_CREATED');
            setMessages(prev => [...prev, {
                id: 'l2-bank-created',
                role: 'assistant',
                content: `Perfeito! Criei a conta ${bankName}.\n\nEssa vai ser sua conta principal.\nSempre que você falar algo como:\n"paguei no Pix" ou "recebi 1000"\nsem dizer o banco, vou usar essa conta.\n\nIsso evita que eu fique te perguntando "qual banco?" toda hora.`,
                buttons: [{ label: 'Continuar', value: 'L2_GO_TRANSFER', variant: 'primary' }]
            }]);
            return true;
        }

        // User typed custom bank name (after clicking "Outro")
        if (tutorialStep === 'L2_BANK_CUSTOM') {
            const bankName = userInput.trim();

            if (bankName.length < 2) {
                setMessages(prev => [...prev, {
                    id: 'l2-bank-invalid',
                    role: 'assistant',
                    content: "Hmm, não entendi. Me diz o nome do seu banco (ex: Caixa, Santander, Inter...):",
                }]);
                return true;
            }

            // Create the bank account
            const { createAccount, setDefaultAccount } = await import('../actions/assets');
            const newAccount = await createAccount({ name: bankName, type: 'bank', balance: 0 });
            if (newAccount?.id) {
                await setDefaultAccount(newAccount.id);
            }

            setL2BankName(bankName);
            setTutorialStep('L2_BANK_CREATED');
            setMessages(prev => [...prev, {
                id: 'l2-bank-created',
                role: 'assistant',
                content: `Perfeito! Criei a conta ${bankName}.\n\nEssa vai ser sua conta principal.\nSempre que você falar algo como:\n"paguei no Pix" ou "recebi 1000"\nsem dizer o banco, vou usar essa conta.\n\nIsso evita que eu fique te perguntando "qual banco?" toda hora.`,
                buttons: [{ label: 'Continuar', value: 'L2_GO_TRANSFER', variant: 'primary' }]
            }]);
            return true;
        }

        // Security message after first action (bank creation)
        if (userInput === 'L2_GO_TRANSFER') {
            setTutorialStep('L2_TRANSFER_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l2-safety',
                role: 'assistant',
                content: "💡 Se você errar alguma coisa, dá pra corrigir ou apagar depois.\nNada aqui é definitivo.",
                buttons: [{ label: 'Entendi', value: 'L2_SHOW_TRANSFER', variant: 'primary' }]
            }]);
            return true;
        }

        // Transfers explanation
        if (userInput === 'L2_SHOW_TRANSFER') {
            setTutorialStep('L2_RECURRENCE_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l2-transfer',
                role: 'assistant',
                content: "💸 **2. Transferências**\n\nÀs vezes o dinheiro não entra nem sai da sua vida — ele só muda de lugar.\n\nExemplos:\n• \"Transferi 500 do Nubank para o Itaú\"\n• \"Depositei 300 no Itaú\" (Isso tira da sua Carteira e põe no Banco)\n\nO saldo total continua o mesmo, só muda onde o dinheiro está.",
                buttons: [{ label: 'Entendi', value: 'L2_GO_RECURRENCE', variant: 'primary' }]
            }]);
            return true;
        }

        // Recurrences explanation
        if (userInput === 'L2_GO_RECURRENCE') {
            setTutorialStep('L2_SCHEDULE_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l2-recurrence',
                role: 'assistant',
                content: "📅 **3. Planejamento Futuro**\n\nAlgumas contas se repetem todo mês, como aluguel ou salário.\nIsso são contas recorrentes.\n\nVocê pode dizer coisas como:\n\"Pago aluguel de 1500 todo dia 10\"\nou\n\"Recebo salário todo mês\".\n\nEu vou lembrar você quando estiver perto de acontecer!",
                buttons: [{ label: 'Entendi', value: 'L2_GO_SCHEDULE', variant: 'primary' }]
            }]);
            return true;
        }

        // Schedules explanation
        if (userInput === 'L2_GO_SCHEDULE') {
            setTutorialStep('L2_DONE');
            setMessages(prev => [...prev, {
                id: 'l2-schedule',
                role: 'assistant',
                content: "E tem aquelas contas que não se repetem, mas você não quer esquecer.\nTipo um boleto de compra online ou o IPVA.\n\nÉ só pedir para Agendar.\nExemplo: \"Agendar pagamento de 200 reais para dia 20\".\n\nA diferença é que isso fica no seu Calendário, esperando o dia chegar.\nNão sai do seu saldo agora, só quando você confirmar o pagamento.",
                buttons: [{ label: 'Entendi', value: 'L2_FINISH', variant: 'primary' }]
            }]);
            return true;
        }

        // Finish L2 Tutorial
        if (userInput === 'L2_FINISH') {
            // Update user level to 2
            await updateUserLevel(2 as UserLevel);
            setUserLevel(2);

            // Dispatch event to update Sidebar
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 2 } }));
            }

            setTutorialStep('IDLE');
            setMessages(prev => [...prev, {
                id: 'l2-done',
                role: 'assistant',
                content: "🎉 Parabéns! Agora você já pode:\n• Usar vários bancos\n• Mover dinheiro entre eles\n• Criar contas que se repetem\n• Agendar pagamentos para o futuro\n\nContinue usando no seu ritmo.\nQuando quiser lidar com coisas mais avançadas, como cartão de crédito, é só me avisar!",
                type: 'success'
            }]);
            return true;
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
            // Check for specific level
            const levelMatch = lowerInput.match(/nível (\d+)/) || lowerInput.match(/nivel (\d+)/);
            const requestedLevel = levelMatch ? parseInt(levelMatch[1]) : 0;

            if (requestedLevel >= 2) {
                // Trigger specific level tutorial via Context Action simulation
                // We can't use triggerTutorial directly here as we are in a hook, 
                // but we can simulate the effect by setting the step directly.

                const stepMap: Record<number, TutorialStep> = {
                    2: 'L2_INTRO',
                    3: 'L3_INTRO',
                    4: 'L4_INTRO'
                };

                const step = stepMap[requestedLevel];
                if (step) {
                    setTutorialStep(step);

                    // Re-trigger the intro message for that level
                    const intros: Record<number, any> = {
                        2: {
                            content: "Muito bem! 🚀\n\nAgora vamos organizar sua vida financeira em **3 passos rápidos**:\n\n1️⃣ **Contas e Bancos**\n2️⃣ **Transferências**\n3️⃣ **Planejamento Futuro** (Contas fixas e agendamentos)\n\nVamos lá?",
                            buttonLabel: 'Continuar',
                            buttonValue: 'L2_CONTINUE_INTRO'
                        },
                        3: {
                            content: "Excelente progresso! 💳\n\nAgora vamos dominar o **Crédito**:\n\n1️⃣ **Cartões de Crédito** - Cadastrar seus cartões\n2️⃣ **Faturas** - Acompanhar gastos no cartão\n3️⃣ **Empréstimos** - Controlar dívidas\n\nPronto para o próximo desafio?",
                            buttonLabel: 'Continuar',
                            buttonValue: 'L3_CONTINUE_INTRO'
                        },
                        4: {
                            content: "Você está no topo! 🎯\n\nVamos dominar o **Planejamento**:\n\n1️⃣ **Metas** - Criar objetivos de economia\n2️⃣ **Reservas** - Guardar dinheiro\n3️⃣ **Projeções** - Simular o futuro\n\nPreparado para planejar seu futuro financeiro?",
                            buttonLabel: 'Continuar',
                            buttonValue: 'L4_CONTINUE_INTRO'
                        }
                    };

                    const intro = intros[requestedLevel];
                    setMessages(prev => [...prev, {
                        id: `l${requestedLevel}-intro-redo`,
                        role: 'assistant',
                        content: intro.content,
                        buttons: [{ label: intro.buttonLabel, value: intro.buttonValue, variant: 'primary' }]
                    }]);
                    return;
                }
            }

            // Default to Level 0/1 (Basic Tutorial)
            await updateUserLevel(0 as UserLevel);
            setUserLevel(0);
            startTutorial();
            return;
        }

        // Check for cancel/restart commands
        const cancelKeywords = [
            'cancela', 'cancelar', 'deixa pra lá', 'deixa pra la', 'esquece',
            'me enganei', 'começar de novo', 'comecar de novo', 'reiniciar',
            'era isso não', 'era isso nao', 'não era isso', 'nao era isso',
            'parar', 'abortar', 'desiste', 'desistir'
        ];

        // Check for correction attempts (e.g. "Não, foi 60", "Errei")
        const correctionKeywords = [
            'não, foi', 'nao, foi', 'não, era', 'nao, era',
            'errei', 'está errado', 'esta errado', 'tá errado', 'ta errado',
            'corrigir'
        ];

        const isCancelCommand = cancelKeywords.some(keyword => lowerInput.includes(keyword));
        const isCorrectionCommand = correctionKeywords.some(keyword => lowerInput.includes(keyword));

        if (isCancelCommand || isCorrectionCommand) {
            // Clear pending slots
            setPendingSlots(null);

            if (isCorrectionCommand) {
                addMessage('assistant', 'Sem problemas! Vamos começar de novo. Pode falar a informação correta.', 'text');
            } else {
                addMessage('assistant', '👍 Ok, cancelado! O que você quer fazer agora?', 'text');
            }

            setTutorialStep('IDLE');
            return;
        }

        // Check for undo/delete last commands
        const undoKeywords = [
            'apagar ultimo', 'apagar último', 'desfazer', 'desfaz',
            'apaga o ultimo', 'apaga o último', 'cancela o ultimo', 'cancela o último',
            'excluir ultimo', 'excluir último', 'remove o ultimo', 'remove o último'
        ];

        const isUndoCommand = undoKeywords.some(keyword => lowerInput.includes(keyword));

        if (isUndoCommand) {
            const { getLastMovement, deleteMovement } = await import('../actions/financial');
            const lastMov = await getLastMovement();

            if (!lastMov) {
                addMessage('assistant', 'Não encontrei nenhum lançamento recente para apagar.', 'error');
                return;
            }

            // Delete it
            await deleteMovement(lastMov.id);

            // Notify user
            const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastMov.amount);
            addMessage('assistant', `🗑️ Apaguei o último lançamento: ${lastMov.description} (${amountFormatted}).`, 'success');

            // Refresh dashboard
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('transactionUpdated'));
            }
            return;
        }

        // If in tutorial, process tutorial input and BLOCK normal AI
        if (tutorialStep !== 'IDLE') {
            const handled = await processTutorialInput(userInput);
            if (handled) return;

            // If in L2 tutorial but not handled, still block AI and show help message
            if (tutorialStep.startsWith('L2_')) {
                addMessage('assistant', '👆 Use os botões acima para continuar o tutorial.', 'text', { skipRefund: true });
                return;
            }
        }

        // ==========================================
        // RECONCILIATION: Check if user is responding to multiple matches
        // ==========================================
        const isJustNumber = /^\d+([.,]\d+)?$/.test(userInput.trim());
        const numericChoice = parseInt(userInput.trim());

        if (pendingReconciliation && isJustNumber && numericChoice >= 1 && numericChoice <= pendingReconciliation.matches.length) {
            // User chose which pending movement to mark as paid
            const chosenMovement = pendingReconciliation.matches[numericChoice - 1];

            try {
                const { markMovementAsPaid } = await import('../actions/reconcile');
                const result = await markMovementAsPaid(chosenMovement.id);

                if (result.success) {
                    const amountFormatted = chosenMovement.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    addMessage('assistant', `✅ ${chosenMovement.description} de ${amountFormatted} marcado como pago!`, 'success');

                    // Refresh dashboard
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('transactionUpdated'));
                    }
                } else {
                    addMessage('assistant', `❌ Erro ao marcar como pago: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Error marking as paid:', error);
                addMessage('assistant', 'Erro ao processar pagamento.', 'error');
            }

            setPendingReconciliation(null);
            return;
        }

        // ==========================================
        // TRANSFER CONFIRMATION: Check if user is responding to negative balance warning
        // ==========================================
        if (userInput === 'TRANSFER_CONFIRM_YES' && pendingTransfer) {
            try {
                const { createTransfer } = await import('../actions/financial');
                const result = await createTransfer({
                    ...pendingTransfer,
                    allowNegative: true
                });

                if (result.success) {
                    const formattedAmount = pendingTransfer.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    addMessage('assistant', `✅ Transferência de ${formattedAmount} de ${pendingTransfer.fromAccountName} para ${pendingTransfer.toAccountName} realizada!\n\n⚠️ A conta ${pendingTransfer.fromAccountName} está com saldo negativo agora.`, 'success');

                    // Refresh dashboard
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('transactionUpdated'));
                    }
                } else {
                    addMessage('assistant', `❌ Erro: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Error executing transfer:', error);
                addMessage('assistant', 'Erro ao processar transferência.', 'error');
            }

            setPendingTransfer(null);
            return;
        }

        if (userInput === 'TRANSFER_CONFIRM_NO' && pendingTransfer) {
            addMessage('assistant', '👍 Ok, transferência cancelada!', 'text');
            setPendingTransfer(null);
            return;
        }

        // ==========================================
        // SLOT-FILLING LOGIC: Check if we can complete pending slots
        // ==========================================

        if (isJustNumber && pendingSlots && pendingSlots.description) {
            // User sent just a number and we have pending slots with description
            const cleanedValue = userInput.trim().replace(',', '.');
            const amount = parseFloat(cleanedValue);

            if (!isNaN(amount) && amount > 0) {
                // Complete the slots
                const completedSlots = {
                    ...pendingSlots,
                    amount: amount
                };

                // All required slots filled (description + amount) -> execute directly
                try {
                    const { createMovement } = await import('../actions/finance-core');
                    const { getCategoryByName } = await import('../actions/categories');

                    // Lookup category ID if we have a category name
                    let categoryId = undefined;
                    if (completedSlots.category) {
                        const category = await getCategoryByName(completedSlots.category);
                        if (category) {
                            categoryId = category.id;
                        }
                    }

                    const result = await createMovement({
                        description: completedSlots.description || '',
                        amount: completedSlots.amount,
                        type: completedSlots.type || 'expense',
                        date: completedSlots.date || new Date().toISOString().split('T')[0],
                        dueDate: completedSlots.dueDate,
                        isPaid: completedSlots.dueDate ? false : true,
                        categoryId: categoryId,
                    });

                    if (result.success) {
                        // Format the message
                        const amountFormatted = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const typeLabel = completedSlots.type === 'income' ? 'Receita' : 'Despesa';
                        const categoryLabel = completedSlots.category ? ` em ${completedSlots.category}` : '';
                        const dueDateLabel = completedSlots.dueDate
                            ? `, vence em ${new Date(completedSlots.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
                            : '';

                        addMessage('assistant',
                            `✅ Anotado! ${typeLabel} de ${amountFormatted} com ${completedSlots.description}${categoryLabel}${dueDateLabel}.`,
                            'success'
                        );

                        // Clear pending slots after success
                        setPendingSlots(null);

                        // Refresh dashboard
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('transactionUpdated'));
                        }
                        return;
                    } else {
                        addMessage('assistant', `❌ Erro ao registrar: ${result.error}`, 'error');
                        setPendingSlots(null);
                        return;
                    }
                } catch (error: any) {
                    console.error('Slot-filling execution error:', error);
                    addMessage('assistant', 'Erro ao registrar. Tente novamente.', 'error');
                    setPendingSlots(null);
                    return;
                }
            }
        }

        // Normal AI processing
        const usage = await checkAndIncrementUsage();
        setUsageCount(usage.count);
        if (!usage.allowed) {
            addMessage('assistant', `🛑 Limite diário atingido.`, 'error', { skipRefund: true });
            return;
        }

        try {
            // Build history from recent messages for context
            // Only include messages AFTER the last successful registration (✅) to avoid context pollution
            let relevantMessages = [...messages];
            const lastSuccessIndex = relevantMessages.map(m => m.content.includes('✅')).lastIndexOf(true);
            if (lastSuccessIndex !== -1) {
                relevantMessages = relevantMessages.slice(lastSuccessIndex + 1);
            }

            const recentHistory = relevantMessages.slice(-6).map(m =>
                `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`
            );
            const response = await processCommand(userInput, recentHistory, inputType, userLevel);

            // ==========================================
            // HANDLE RECONCILE_PAYMENT INTENT
            // ==========================================
            if (response.intent === 'RECONCILE_PAYMENT' && response.data?.search_term) {
                const { findPendingMatches, markMovementAsPaid } = await import('../actions/reconcile');
                const { createMovement } = await import('../actions/finance-core');

                const searchTerm = response.data.search_term;
                const matches = await findPendingMatches(searchTerm);

                if (matches.length === 1) {
                    // Single match - mark as paid immediately
                    const match = matches[0];
                    const result = await markMovementAsPaid(match.id);

                    if (result.success) {
                        const amountFormatted = match.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        addMessage('assistant', `✅ ${match.description} de ${amountFormatted} marcado como pago!`, 'success');

                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('transactionUpdated'));
                        }
                    } else {
                        addMessage('assistant', `❌ Erro: ${result.error}`, 'error');
                    }
                } else if (matches.length > 1) {
                    // Multiple matches - ask user which one
                    const options = matches.map((m, i) => {
                        const amountFormatted = m.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const dueDate = m.due_date ? new Date(m.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '';
                        return `${i + 1}. ${m.description} - ${amountFormatted}${dueDate ? ` vence ${dueDate}` : ''}`;
                    }).join('\n');

                    addMessage('assistant', `Encontrei ${matches.length} contas de "${searchTerm}" pendentes:\n${options}\n\nQual você pagou? Responda o número.`, 'text');

                    // Save for next turn
                    setPendingReconciliation({ matches, searchTerm });
                } else {
                    // No match - register as new paid expense
                    const amount = response.data.amount || 0;

                    if (amount > 0) {
                        await createMovement({
                            description: searchTerm,
                            amount: amount,
                            type: 'expense',
                            date: new Date().toISOString().split('T')[0],
                            isPaid: true,
                        });

                        const amountFormatted = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        addMessage('assistant', `Não encontrei "${searchTerm}" pendente. Registrei como nova despesa de ${amountFormatted}. Se errei, diga "desfaça".`, 'success');

                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('transactionUpdated'));
                        }
                    } else {
                        addMessage('assistant', `Não encontrei "${searchTerm}" pendente. Qual foi o valor que você pagou?`, 'text');
                        setPendingSlots({ intent: 'REGISTER_MOVEMENT', description: searchTerm, type: 'expense' });
                    }
                }
                return;
            }

            // ==========================================
            // HANDLE TRANSFER_CONFIRM_NEGATIVE INTENT
            // ==========================================
            if (response.intent === 'TRANSFER_CONFIRM_NEGATIVE' && response.data) {
                // Save transfer data for confirmation
                setPendingTransfer({
                    fromAccountId: response.data.fromAccountId,
                    toAccountId: response.data.toAccountId,
                    fromAccountName: response.data.fromAccountName,
                    toAccountName: response.data.toAccountName,
                    amount: response.data.amount,
                    description: response.data.description,
                    date: response.data.date
                });

                // Show message with buttons (no typewriter effect)
                setMessages(prev => [...prev, {
                    id: `transfer-confirm-${Date.now()}`,
                    role: 'assistant',
                    content: response.message,
                    typingComplete: true,
                    buttons: [
                        { label: 'Sim, fazer mesmo assim', value: 'TRANSFER_CONFIRM_YES', variant: 'primary' },
                        { label: 'Não, cancelar', value: 'TRANSFER_CONFIRM_NO', variant: 'secondary' }
                    ]
                }]);
                return;
            }

            // ==========================================
            // CAPTURE PARTIAL SLOTS from AI response
            // ==========================================
            if (response.intent === 'CONFIRMATION_REQUIRED' && response.data) {
                // AI is asking for more info, save the partial slots
                const partialSlots: typeof pendingSlots = {
                    intent: 'REGISTER_MOVEMENT',
                    description: response.data.description,
                    amount: response.data.amount,
                    date: response.data.date,
                    dueDate: response.data.due_date,
                    type: response.data.type,
                    category: response.data.category,
                };
                setPendingSlots(partialSlots);
                console.log('📝 Saved pending slots:', partialSlots);
            } else if (response.message.includes('✅')) {
                // Success - clear pending slots
                setPendingSlots(null);
                setPendingReconciliation(null);
            }

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
    }, [tutorialStep, inputType, addMessage, startTutorial, skipTutorial, processTutorialInput, pendingSlots, pendingTransfer, messages]);

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
        markTutorialTypingComplete,
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
        },
        handleTutorialButton: (value: string) => {
            // Process button click as if user typed the value
            setIsProcessing(true);
            processUserInput(value).then(() => setIsProcessing(false));
        }
    };
}

