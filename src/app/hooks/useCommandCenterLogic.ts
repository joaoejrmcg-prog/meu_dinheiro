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
    | 'L3_INTRO' | 'L3_DA_INTRO' | 'L3_DA_EXAMPLE'
    | 'L3_INSTALLMENT_INTRO' | 'L3_INSTALLMENT_EXAMPLE'
    | 'L3_CARD_INTRO' | 'L3_CARD_ASK' | 'L3_CARD_NAME' | 'L3_CARD_CUSTOM' | 'L3_CARD_DATES'
    | 'L3_CARD_CREATED' | 'L3_CARD_OTHER' | 'L3_CARD_DISTINCTION' | 'L3_CARD_TIPS' | 'L3_CARD_PDF' | 'L3_DONE'
    // Level 4 tutorial (Planejamento)
    | 'L4_INTRO' | 'L4_GOALS_EXPLAIN' | 'L4_LOANS_EXPLAIN' | 'L4_FORECAST_EXPLAIN' | 'L4_SIMULATION_TASK' | 'L4_DONE';

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
    const [l3CardName, setL3CardName] = useState<string>(''); // Store card name for L3 tutorial

    // Slot-filling state to maintain context between conversation turns
    const [pendingSlots, setPendingSlots] = useState<{
        intent?: string;
        description?: string;
        amount?: number;
        date?: string;
        dueDate?: string;
        type?: 'income' | 'expense';
        category?: string;
        payment_method?: string;  // 'bank' for PIX/Débito
        account_name?: string;    // Specific account if provided
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
                content: "Muito bem! 🚀\n\nVamos expandir seu controle financeiro em **3 passos rápidos**:\n\n1️⃣ **Contas e Bancos**\n2️⃣ **Transferências**\n3️⃣ **Planejamento Futuro** (Contas fixas e agendamentos)\n\nVamos lá?",
                buttonLabel: 'Continuar',
                buttonValue: 'L2_CONTINUE_INTRO'
            },
            'START_L3': {
                step: 'L3_INTRO',
                content: "Excelente progresso! 💳\n\nAgora vamos dominar o **Crédito e Automação**:\n\n1️⃣ **Débito Automático** — Contas que o banco paga sozinho\n2️⃣ **Compras Parceladas** — Crediário e carnês\n3️⃣ **Cartão de Crédito** — Cadastrar seus cartões\n\nPronto para o próximo desafio?",
                buttonLabel: 'Continuar',
                buttonValue: 'L3_CONTINUE_INTRO'
            },
            'START_L4': {
                step: 'L4_INTRO',
                content: "Uau! Você chegou ao topo! 🏆\nBem-vindo ao **Nível 4: Estrategista**.\n\nAté agora, você aprendeu a controlar o passado e o presente.\nA partir de hoje, você vai desenhar o seu **futuro**.",
                buttonLabel: 'Como assim?',
                buttonValue: 'L4_CONTINUE_INTRO'
            }
        };

        if (!tutorialAction) return;

        const intro = levelIntros[tutorialAction];
        if (intro) {
            console.log(`Context action ${tutorialAction} received!`);
            setTutorialStep(intro.step);
            // Use single setMessages call to avoid flicker (don't call setMessages([]) first!)
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
                        isTyping: true,
                        buttons: [{ label: 'Continuar', value: 'L1_CONTINUE_GREETING', variant: 'primary' }]
                    }];
                });
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

        // Listen for tips modal closed event to show final congratulations
        const handleTipsModalClosed = () => {
            setTutorialStep('IDLE');
            setMessages(prev => [...prev, {
                id: 'l1-done-' + Date.now(),
                role: 'assistant',
                content: "🎉 Parabéns! Estamos prontos pra começar!\n\nAgora você pode me dizer sempre que gastar ou receber dinheiro:\n• \"Gastei 50 no mercado\"\n• \"Recebi 1000 do salário\"\n• \"Como estou esse mês?\"",
                type: 'success',
                isTyping: true
            }]);
        };
        window.addEventListener('tipsModalClosed', handleTipsModalClosed);

        return () => {
            isMounted = false;
            window.removeEventListener('terms-accepted', handleTermsAccepted);
            window.removeEventListener('tipsModalClosed', handleTipsModalClosed);
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
        // Use setMessages directly (like L2 does) to avoid flicker from addMessage + setMessages combo
        setMessages([{
            id: 'tutorial-greeting-' + Date.now(),
            role: 'assistant',
            content: 'Oi 😊\nSou seu agente financeiro.\nVamos começar só com o básico: ver quanto entra e quanto sai.\nDepois eu te mostro outras coisas.',
            buttons: [{ label: 'Continuar', value: 'L1_CONTINUE_GREETING', variant: 'primary' }]
        }]);
    }, []);

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
        // Level 1: Greeting -> Ask Balance
        if (userInput === 'L1_CONTINUE_GREETING') {
            setTutorialStep('ASK_BALANCE');
            addMessage('assistant',
                "Me diga: quanto dinheiro você tem disponível pra usar e pagar suas contas?\n\n💡 Se não tiver certeza, chuta! Podemos corrigir depois.",
                'text',
                { isTyping: true, skipRefund: true }
            );
            return true;
        }

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

            // Use setMessages directly (like L2 does) with a Continue button
            setMessages(prev => [...prev, {
                id: 'l1-balance-set-' + Date.now(),
                role: 'assistant',
                content: `Perfeito! Vou considerar que você tem ${formatted} disponíveis agora.\n\nSe precisar corrigir, diga: "Corrija meu saldo inicial pra R$ X"\n\nAgora, sempre que você gastar ou receber dinheiro, é só me avisar.`,
                buttons: [{ label: 'Continuar', value: 'L1_FINISH', variant: 'primary' }]
            }]);

            return true; // Handled
        }

        // L1 Finish - Show tips offer message
        if (userInput === 'L1_FINISH') {
            // Update user level to 1
            await updateUserLevel(1 as UserLevel);
            setUserLevel(1);

            // Dispatch event to update Sidebar
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 1 } }));
            }

            // Show tips offer message (intermediate step before final congratulations)
            setMessages(prev => [...prev, {
                id: 'l1-tips-offer-' + Date.now(),
                role: 'assistant',
                content: "💡 Esse app tem várias funções avançadas, mas você não precisa usar tudo.\nSe o que você quer é só controlar o que entra e sai no dia a dia, esse nível é ideal. Simples, direto e eficiente.\n\n📊 Quer ver seus lançamentos? Abra no menu a tela **Financeiro**.",
                buttons: [
                    { label: 'Não cometa erros de lançamento', value: 'L1_SHOW_TIPS', variant: 'secondary' },
                    { label: 'Continuar', value: 'L1_START', variant: 'primary' }
                ]
            }]);
            // Keep tutorialStep as COMPLETE so handlers still work
            return true;
        }

        // ===== LEVEL 2 TUTORIAL =====

        // L2 Intro -> Bank Ask
        if (userInput === 'L2_CONTINUE_INTRO') {
            setTutorialStep('L2_BANK_ASK');
            setMessages(prev => [...prev, {
                id: 'l2-bank-ask',
                role: 'assistant',
                content: "🏦 **1. Contas e Bancos**\n\nUma conta é simplesmente onde o dinheiro está.\n\nO dinheiro no bolso ou em casa chamamos de **Carteira**. O dinheiro no banco é outra conta, como **Nubank** ou **Itaú**.\n\nAgora você pode ter dinheiro em vários lugares.\n\nVocê tem conta em algum banco?",
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

            // Create or get the bank account
            const { getOrCreateBankAccount, setDefaultAccount } = await import('../actions/assets');
            const newAccount = await getOrCreateBankAccount(bankName);
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

            // Create or get the bank account
            const { getOrCreateBankAccount, setDefaultAccount } = await import('../actions/assets');
            const newAccount = await getOrCreateBankAccount(bankName);
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
                content: "📅 **3. Planejamento Futuro**\n\nAlgumas contas se repetem todo mês, como aluguel ou salário.\nIsso são contas recorrentes.\n\nVocê pode dizer coisas como:\n\"Pago aluguel de 1500 todo dia 10\"\nou\n\"Recebo salário todo mês no dia 5\".\n\nEu vou lembrar você quando estiver perto de acontecer!",
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
                content: "🎉 Parabéns! Agora você já pode:\n• Usar vários bancos\n• Mover dinheiro entre eles\n• Criar contas que se repetem\n• Agendar pagamentos para o futuro\n\nContinue usando no seu ritmo!",
                type: 'success'
            }]);
            return true;
        }

        // ===== LEVEL 3 TUTORIAL =====

        // L3 Intro -> Débito Automático
        if (userInput === 'L3_CONTINUE_INTRO') {
            setTutorialStep('L3_DA_INTRO');
            setMessages(prev => [...prev, {
                id: 'l3-da-intro',
                role: 'assistant',
                content: "🏦 **1. Débito Automático**\n\nAlgumas contas você nem precisa lembrar de pagar — você instruiu o banco a fazer isso sozinho por você.\n\nExemplos: conta de luz, água, condomínio, IPTU...\n\nSe o banco debita automaticamente, aqui também deve acontecer igual.\nAssim seu saldo fica sempre atualizado sem você fazer nada.",
                buttons: [
                    { label: 'Entendi', value: 'L3_DA_EXAMPLE', variant: 'primary' },
                    { label: 'Pular tutorial', value: 'L3_SKIP_TUTORIAL', variant: 'secondary' }
                ]
            }]);
            return true;
        }

        // Skip L3 Tutorial
        if (userInput === 'L3_SKIP_TUTORIAL') {
            // Mark tutorial as skipped (not completed)
            const { setTutorialCompleted } = await import('../actions/profile');
            await setTutorialCompleted(false);

            // Dispatch event to update UI
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tutorialCompletedUpdate', { detail: { completed: false } }));
            }

            // Update user level to 3
            await updateUserLevel(3 as UserLevel);
            setUserLevel(3);

            // Dispatch event to update Sidebar
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 3 } }));
            }

            setTutorialStep('IDLE');
            setMessages(prev => [...prev, {
                id: 'l3-skipped',
                role: 'assistant',
                content: "Ok! Tutorial pulado. 👍\n\nVocê agora está no **Nível 3** e pode usar todas as funcionalidades de crédito.\n\nSe quiser refazer o tutorial depois, é só clicar no botão **Refazer tutorial** lá embaixo.",
                type: 'success'
            }]);
            return true;
        }

        // DA Example
        if (userInput === 'L3_DA_EXAMPLE') {
            setTutorialStep('L3_DA_EXAMPLE');
            setMessages(prev => [...prev, {
                id: 'l3-da-example',
                role: 'assistant',
                content: "Para cadastrar um débito automático, me diga:\n• \"Conta de luz de 150 reais todo dia 10, débito automático\"\n• \"Condomínio de 800 reais, débito automático no Itaú\"\n\nEu registro e, quando chegar o dia, o valor sai sozinho da conta.",
                buttons: [{ label: 'Continuar', value: 'L3_GO_INSTALLMENT', variant: 'primary' }]
            }]);
            return true;
        }

        // Go to Installments (Crediário)
        if (userInput === 'L3_GO_INSTALLMENT') {
            setTutorialStep('L3_INSTALLMENT_INTRO');
            setMessages(prev => [...prev, {
                id: 'l3-installment-intro',
                role: 'assistant',
                content: "🏪 **2. Compras Parceladas (Crediário)**\n\nSabe aquela loja que vende em 10x no boleto ou no carnê?\nIsso é diferente de cartão de crédito — são parcelas fixas que você paga todo mês.\n\nExemplo: Comprei uma TV de R$ 2.000 em 10x de R$ 200.",
                buttons: [{ label: 'Entendi', value: 'L3_INSTALLMENT_EXAMPLE', variant: 'primary' }]
            }]);
            return true;
        }

        // Installment Example
        if (userInput === 'L3_INSTALLMENT_EXAMPLE') {
            setTutorialStep('L3_INSTALLMENT_EXAMPLE');
            setMessages(prev => [...prev, {
                id: 'l3-installment-example',
                role: 'assistant',
                content: "Para lançar uma compra parcelada, me diga:\n• \"Comprei TV de 2500 em 10x no carnê das Casas Bahia\"\n• \"Parcelei geladeira em 12x de 150 reais\"\n• \"Comprei um sapato por 180 reais, dei entrada de 80, e o restante em 2 vezes. A primeira vence 10/02\"\n\nEu crio todas as parcelas automaticamente no seu calendário e te lembro quando chegar a hora.",
                buttons: [{ label: 'Continuar', value: 'L3_GO_CARD', variant: 'primary' }]
            }]);
            return true;
        }

        // Go to Credit Card - simplified intro
        if (userInput === 'L3_GO_CARD') {
            setTutorialStep('L3_CARD_INTRO');
            setMessages(prev => [...prev, {
                id: 'l3-card-intro',
                role: 'assistant',
                content: "💳 **3. Cartão de Crédito**\nVocê usa cartão de crédito?",
                buttons: [
                    { label: 'Sim', value: 'L3_CARD_YES', variant: 'primary' },
                    { label: 'Não, pular', value: 'L3_CARD_SKIP', variant: 'secondary' }
                ]
            }]);
            return true;
        }

        // User skips credit card
        if (userInput === 'L3_CARD_SKIP') {
            setTutorialStep('L3_DONE');
            // Update user level to 3
            await updateUserLevel(3 as UserLevel);
            setUserLevel(3);

            // Dispatch event to update Sidebar
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 3 } }));
            }

            setMessages(prev => [...prev, {
                id: 'l3-done-no-card',
                role: 'assistant',
                content: "🎉 Parabéns! Nível 3 completo!\n\nAgora você pode:\n• Cadastrar débitos automáticos\n• Lançar compras parceladas\n\nQuando quiser usar cartão de crédito, é só criar um na tela **Contas e Cartões**.\n\nContinue no seu ritmo!",
                type: 'success'
            }]);
            return true;
        }

        // User has credit card -> ask which one
        if (userInput === 'L3_CARD_YES') {
            setTutorialStep('L3_CARD_NAME');
            setMessages(prev => [...prev, {
                id: 'l3-card-name',
                role: 'assistant',
                content: "Qual cartão você mais usa?",
                buttons: [
                    { label: 'Nubank', value: 'L3_CARD_Nubank', variant: 'bank' },
                    { label: 'Itaú', value: 'L3_CARD_Itaú', variant: 'bank' },
                    { label: 'Inter', value: 'L3_CARD_Inter', variant: 'bank' },
                    { label: 'C6 Bank', value: 'L3_CARD_C6 Bank', variant: 'bank' },
                    { label: 'Outro', value: 'L3_CARD_OTHER', variant: 'secondary' }
                ]
            }]);
            return true;
        }

        // User chose card via button
        if (userInput.startsWith('L3_CARD_') && tutorialStep === 'L3_CARD_NAME') {
            const cardName = userInput.replace('L3_CARD_', '');

            if (cardName === 'OTHER') {
                setTutorialStep('L3_CARD_CUSTOM');
                setMessages(prev => [...prev, {
                    id: 'l3-card-other',
                    role: 'assistant',
                    content: "Me diz o nome do seu cartão:",
                }]);
                return true;
            }

            setL3CardName(cardName);
            setTutorialStep('L3_CARD_DATES');
            setMessages(prev => [...prev, {
                id: 'l3-card-dates',
                role: 'assistant',
                content: `Ótimo! Agora preciso saber informações importantes do seu ${cardName}:\n\nMe diga 3 coisas:\nQual o dia que a fatura **fecha**\nQual o dia que o cartão **vence**\nQual o **limite** do seu cartão\n\n💡 Exemplo: "Fecha dia 15, vence dia 22 com limite de 8000"`,
            }]);
            return true;
        }

        // User typed card name directly
        if (tutorialStep === 'L3_CARD_NAME' && !userInput.startsWith('L3_')) {
            const cardName = userInput.trim();

            if (cardName.length < 2) {
                setMessages(prev => [...prev, {
                    id: 'l3-card-invalid',
                    role: 'assistant',
                    content: "Hmm, não entendi. Use os botões ou digite o nome do seu cartão (ex: Santander, Bradesco...):",
                }]);
                return true;
            }

            setL3CardName(cardName);
            setTutorialStep('L3_CARD_DATES');
            setMessages(prev => [...prev, {
                id: 'l3-card-dates',
                role: 'assistant',
                content: `Ótimo! Agora preciso saber informações importantes do seu ${cardName}:\n\nMe diga 3 coisas:\nQual o dia que a fatura **fecha**\nQual o dia que o cartão **vence**\nQual o **limite** do seu cartão\n\n💡 Exemplo: "Fecha dia 15, vence dia 22 com limite de 8000"`,
            }]);
            return true;
        }

        // User typed custom card name (after clicking "Outro")
        if (tutorialStep === 'L3_CARD_CUSTOM') {
            const cardName = userInput.trim();

            if (cardName.length < 2) {
                setMessages(prev => [...prev, {
                    id: 'l3-card-invalid',
                    role: 'assistant',
                    content: "Hmm, não entendi. Me diz o nome do seu cartão (ex: Santander, Bradesco, Banco do Brasil...):",
                }]);
                return true;
            }

            setL3CardName(cardName);
            setTutorialStep('L3_CARD_DATES');
            setMessages(prev => [...prev, {
                id: 'l3-card-dates',
                role: 'assistant',
                content: `Ótimo! Agora preciso saber informações importantes do seu ${cardName}:\n\nMe diga 3 coisas:\nQual o dia que a fatura **fecha**\nQual o dia que o cartão **vence**\nQual o **limite** do seu cartão\n\n💡 Exemplo: "Fecha dia 15, vence dia 22 com limite de 8000"`,
            }]);
            return true;
        }

        // User provides card dates + limit (slot-filling)
        if (tutorialStep === 'L3_CARD_DATES') {
            // Parse dates and limit from user input
            const datePattern = /(\d{1,2})/g;
            const matches = userInput.match(datePattern);

            if (!matches || matches.length < 2) {
                setMessages(prev => [...prev, {
                    id: 'l3-dates-invalid',
                    role: 'assistant',
                    content: "Não consegui entender as informações. Me diz no formato:\n\"Fecha dia X, vence dia Y com limite de Z\"\n\nPor exemplo: \"Fecha dia 15, vence dia 22 com limite de 8000\"",
                }]);
                return true;
            }

            const closingDay = parseInt(matches[0]);
            const dueDay = parseInt(matches[1]);
            const limitAmount = matches.length >= 3 ? parseInt(matches[2]) : undefined;

            if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
                setMessages(prev => [...prev, {
                    id: 'l3-dates-invalid-range',
                    role: 'assistant',
                    content: "Os dias precisam ser entre 1 e 31. Tenta de novo:\n\"Fecha dia X, vence dia Y com limite de Z\"",
                }]);
                return true;
            }

            // Create the credit card
            const { createCreditCard } = await import('../actions/assets');
            try {
                await createCreditCard({
                    name: l3CardName,
                    closing_day: closingDay,
                    due_day: dueDay,
                    limit_amount: limitAmount
                });

                const limitText = limitAmount ? `, com limite de ${limitAmount.toLocaleString('pt-BR')}` : '';
                setTutorialStep('L3_CARD_CREATED');
                setMessages(prev => [...prev, {
                    id: 'l3-card-created',
                    role: 'assistant',
                    content: `✅ Criei o cartão **${l3CardName}**!\n(Fecha dia ${closingDay}, vence dia ${dueDay}${limitText})\n\nEsse será seu **cartão principal**.\nQuando você disser "gastei 50 no crédito", vou usar esse cartão.\nSe você fizer uma assinatura mensal diga:\n"Assinei Netflix por 39,90"\n"Vou pagar 49,90 todo mês pelo Spotify no cartão"\ne eu lanço uma cobrança recorrente no cartão pra você.`,
                    buttons: [{ label: 'Continuar', value: 'L3_GO_CARD_OTHER', variant: 'primary' }]
                }]);
            } catch (error) {
                console.error('Error creating credit card:', error);
                setMessages(prev => [...prev, {
                    id: 'l3-card-error',
                    role: 'assistant',
                    content: "Ops, tive um problema ao criar o cartão. Mas não se preocupe, você pode criar depois na tela Contas e Cartões.",
                    buttons: [{ label: 'Continuar', value: 'L3_GO_CARD_OTHER', variant: 'primary' }]
                }]);
            }
            return true;
        }

        // Explain about other cards
        if (userInput === 'L3_GO_CARD_OTHER') {
            setTutorialStep('L3_CARD_OTHER');
            setMessages(prev => [...prev, {
                id: 'l3-card-other-explain',
                role: 'assistant',
                content: "Se tiver outro cartão, você pode criar a qualquer momento dizendo:\n\"Agora tenho um novo cartão Nubank\"\nE eu cadastro pra você.\nMas ele não será seu cartão principal. Então, se quiser lançar nele, é só especificar:\n\"Gastei 100 no crédito do Nubank\"\nEm vez de lançar no cartão principal eu lanço nele.",
                buttons: [{ label: 'Entendi', value: 'L3_GO_DISTINCTION', variant: 'primary' }]
            }]);
            return true;
        }

        // Distinction between account and card
        if (userInput === 'L3_GO_DISTINCTION') {
            setTutorialStep('L3_CARD_DISTINCTION');
            setMessages(prev => [...prev, {
                id: 'l3-card-distinction',
                role: 'assistant',
                content: "💡 **Dica importante!**\n\nSe você tem conta corrente e cartão no mesmo banco (ex: Itaú), pra eu lançar no cartão de crédito, precisa dizer \"no crédito\" ou \"no cartão\" ou \"no cartão de crédito\" pra eu saber a diferença:\n\n• \"Paguei 50 no Itaú\" → sai da **conta** Itaú\n• \"Paguei 50 no crédito do Itaú\" → vai pro **cartão** Itaú",
                buttons: [{ label: 'Entendi', value: 'L3_GO_TIPS', variant: 'primary' }]
            }]);
            return true;
        }

        // Card tips - future uses
        if (userInput === 'L3_GO_TIPS') {
            setTutorialStep('L3_CARD_TIPS');
            setMessages(prev => [...prev, {
                id: 'l3-card-tips',
                role: 'assistant',
                content: "Veja como estas informações podem te ajudar no futuro:\n**1** – Você pode me perguntar **quanto está sua fatura do mês** e eu te respondo.\n**2** – Você pode me perguntar: **Qual o melhor cartão pra eu usar hoje?**\n**3** – Você pode me mandar o **PDF da sua fatura** e eu vejo se estão cobrando coisas indevidas que você não lançou.",
                buttons: [{ label: 'Entendi', value: 'L3_GO_PDF', variant: 'primary' }]
            }]);
            return true;
        }

        // PDF upload instruction
        if (userInput === 'L3_GO_PDF') {
            setTutorialStep('L3_CARD_PDF');
            setMessages(prev => [...prev, {
                id: 'l3-card-pdf',
                role: 'assistant',
                content: "📄 Você pode me mandar o PDF da sua fatura e eu vejo se estão cobrando coisas indevidas que você não lançou.\n\nMe diga: **\"Quero mandar um PDF da minha fatura\"** e eu abro o explorador pra você.",
                buttons: [{ label: 'Entendi', value: 'L3_FINISH', variant: 'primary' }]
            }]);
            return true;
        }

        // Finish L3 Tutorial
        if (userInput === 'L3_FINISH') {
            // Mark tutorial as completed
            const { setTutorialCompleted } = await import('../actions/profile');
            await setTutorialCompleted(true);

            // Dispatch event to update UI
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tutorialCompletedUpdate', { detail: { completed: true } }));
            }

            // Update user level to 3
            await updateUserLevel(3 as UserLevel);
            setUserLevel(3);

            // Dispatch event to update Sidebar
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 3 } }));
            }

            setTutorialStep('IDLE');
            setMessages(prev => [...prev, {
                id: 'l3-done',
                role: 'assistant',
                content: "🎉 Parabéns! Nível 3 completo!\n\nAgora você pode:\n• Cadastrar débitos automáticos\n• Lançar compras parceladas\n• Usar cartão de crédito com controle total\n\nContinue usando no seu ritmo!",
                type: 'success'
            }]);
            return true;
        }

        // ===== LEVEL 4 TUTORIAL =====

        // L4 Intro -> Goals Explain
        if (userInput === 'L4_CONTINUE_INTRO') {
            setTutorialStep('L4_GOALS_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l4-goals-explain',
                role: 'assistant',
                content: "Sabe aquele dinheiro que sobra? Agora você pode dar um **rumo** pra ele.\n\nNão importa se está na Poupança, em Ações ou embaixo do colchão.\nAqui você cria **Metas** para 'carimbar' esse dinheiro.\n\nAssim você sabe que R$ 2.000 são para 'Viagem' e R$ 3.000 para 'Reserva', sem misturar as coisas.\n\n**Exemplos:**\n• \"Criar meta de Viagem para o Japão valor 15 mil\"\n• \"Guardar 200 reais na reserva de emergência\"\n• \"Quanto falta pro meu Carro Novo?\"",
                buttons: [{ label: 'Legal!', value: 'L4_GO_LOANS', variant: 'primary' }]
            }]);
            return true;
        }

        // Goals -> Loans Explain
        if (userInput === 'L4_GO_LOANS') {
            setTutorialStep('L4_LOANS_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l4-loans-explain',
                role: 'assistant',
                content: "Também liberei o controle de **Empréstimos**.\n\n**Como funciona:**\nQuando você diz 'Peguei 1000 emprestado', eu coloco R$ 1000 na sua conta (porque o dinheiro entrou) e anoto que você deve isso.\nQuando diz 'Emprestei 500', eu tiro da sua conta e anoto que devem pra você.\n\n**Exemplos:**\n• \"Peguei 1000 com minha mãe pra pagar quando der\" (Sem data)\n• \"Emprestei 50 pro João pra receber dia 10\" (Data fixa)\n• \"Peguei 5000 no banco pra pagar em 10x de 600\" (Parcelado)",
                buttons: [{ label: 'Entendi', value: 'L4_GO_FORECAST', variant: 'primary' }]
            }]);
            return true;
        }

        // Loans -> Forecast Explain
        if (userInput === 'L4_GO_FORECAST') {
            setTutorialStep('L4_FORECAST_EXPLAIN');
            setMessages(prev => [...prev, {
                id: 'l4-forecast-explain',
                role: 'assistant',
                content: "E por fim, a **Previsão**.\n\nCom base no que você gasta e recebe, eu projeto como estará sua conta nos próximos 6 meses.\nAssim você sabe se vai sobrar dinheiro pro Natal ou se precisa economizar agora.\n\n**Exemplo:**\n• \"Como vai estar meu saldo em dezembro?\"",
                buttons: [{ label: 'Quero testar', value: 'L4_GO_SIMULATION', variant: 'primary' }]
            }]);
            return true;
        }

        // Forecast -> Simulation Task
        if (userInput === 'L4_GO_SIMULATION') {
            setTutorialStep('L4_SIMULATION_TASK');
            setMessages(prev => [...prev, {
                id: 'l4-simulation-task',
                role: 'assistant',
                content: "Pra começar, que tal uma simulação rápida?\n\nO poder dos juros compostos e da constância é mágico.\n\nExperimente me perguntar algo como:\n• **\"E se eu economizar 300 reais por mês?\"**\n• \"Quanto junta se eu guardar 50 por semana?\"\n• \"E se eu cortar 100 reais de lanche?\"",
                isTyping: true
            }]);
            return true;
        }

        // User sends simulation query -> Complete L4
        if (tutorialStep === 'L4_SIMULATION_TASK') {
            // Parse amount from user input (e.g., "300 reais por mês")
            const amountMatch = userInput.match(/(\d+(?:[.,]\d+)?)/);
            const monthlyAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 300;

            // Calculate compound interest (poupança ~0.5% a.m.)
            const monthlyRate = 0.005; // 0.5% ao mês (taxa conservadora de poupança)
            const months = 12;

            // Fórmula de juros compostos para aportes mensais:
            // FV = P × [(1 + r)^n - 1] / r
            const futureValue = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
            const totalDeposited = monthlyAmount * months;
            const interestEarned = futureValue - totalDeposited;

            // Format values
            const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Show simulation result first (without question)
            setMessages(prev => [...prev, {
                id: 'l4-simulation-result-' + Date.now(),
                role: 'assistant',
                content: `🔮 **Simulação com Juros Compostos:**\n\nSe você guardar **R$ ${formatCurrency(monthlyAmount)}** todo mês na poupança:\n\n💰 Em 1 ano você terá aproximadamente **R$ ${formatCurrency(futureValue)}**\n📈 Sendo R$ ${formatCurrency(totalDeposited)} de depósitos + R$ ${formatCurrency(interestEarned)} de rendimentos`,
                isTyping: true
            }]);

            // Mark tutorial as completed
            const { setTutorialCompleted } = await import('../actions/profile');
            await setTutorialCompleted(true);

            // Dispatch event to update UI
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tutorialCompletedUpdate', { detail: { completed: true } }));
            }

            // Update user level to 4
            await updateUserLevel(4 as UserLevel);
            setUserLevel(4);

            // Dispatch event to update Sidebar
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('userLevelUpdate', { detail: { level: 4 } }));
            }

            setTutorialStep('L4_DONE');

            // Show congratulations after simulation typewriter completes (longer delay)
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: 'l4-done-' + Date.now(),
                    role: 'assistant',
                    content: "🎉 Parabéns! Agora você tem todas as ferramentas.\n\n1. **Carteira e Contas** para o dia a dia.\n2. **Cartões** para o crédito.\n3. **Planejamento** para o futuro.\n\nVocê é oficialmente um **Estrategista Financeiro**. O mundo é seu! 🚀\n\n💡 *Dica: Você pode rever as instruções a qualquer momento no menu **Ajuda**.*",
                    type: 'success',
                    isTyping: true
                }]);
            }, 8000); // 8 seconds to allow simulation typewriter to complete

            return true; // We handled it locally, don't let AI process
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
                            content: "Muito bem! 🚀\n\nVamos expandir seu controle financeiro em **3 passos rápidos**:\n\n1️⃣ **Contas e Bancos**\n2️⃣ **Transferências**\n3️⃣ **Planejamento Futuro** (Contas fixas e agendamentos)\n\nVamos lá?",
                            buttonLabel: 'Continuar',
                            buttonValue: 'L2_CONTINUE_INTRO'
                        },
                        3: {
                            content: "Excelente progresso! 💳\n\nAgora vamos dominar o **Crédito e Automação**:\n\n1️⃣ **Débito Automático** — Contas que o banco paga sozinho\n2️⃣ **Compras Parceladas** — Crediário e carnês\n3️⃣ **Cartão de Crédito** — Cadastrar seus cartões\n\nPronto para o próximo desafio?",
                            buttonLabel: 'Continuar',
                            buttonValue: 'L3_CONTINUE_INTRO'
                        },
                        4: {
                            content: "Uau! Você chegou ao topo! 🏆\nBem-vindo ao **Nível 4: Estrategista**.\n\nAté agora, você aprendeu a controlar o passado e o presente.\nA partir de hoje, você vai desenhar o seu **futuro**.",
                            buttonLabel: 'Como assim?',
                            buttonValue: 'L4_CONTINUE_INTRO'
                        }
                    };

                    const intro = intros[requestedLevel];
                    // Clear screen before starting tutorial
                    setMessages([{
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
            'começar de novo', 'comecar de novo', 'reiniciar',
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

        // Check for navigation commands
        const navigationMap: Record<string, { keywords: string[], route: string, screenName: string, minLevel: number }> = {
            financeiro: {
                keywords: ['abrir financeiro', 'abre financeiro', 'abra financeiro', 'abre a tela financeiro', 'abra a tela financeiro', 'ir para financeiro', 'vai pro financeiro', 'mostrar financeiro', 'mostra financeiro', 'tela financeiro', 'tela de financeiro', 'ver financeiro'],
                route: '/financial',
                screenName: 'Financeiro',
                minLevel: 1
            },
            relatorios: {
                keywords: ['abrir relatório', 'abre relatório', 'abra relatório', 'abrir relatorios', 'abre relatorios', 'tela de relatórios', 'abre a tela relatório', 'abre a tela relatorios', 'ver relatórios', 'ver relatorios'],
                route: '/reports',
                screenName: 'Relatórios',
                minLevel: 1
            },
            calendario: {
                keywords: ['abrir calendário', 'abre calendário', 'abra calendário', 'abrir calendario', 'abre calendario', 'abrir agenda', 'abre agenda', 'abre a tela calendário', 'abre a tela calendario', 'abre a tela agenda', 'ver calendário', 'ver calendario', 'ver agenda', 'tela calendario', 'tela calendário'],
                route: '/calendar',
                screenName: 'Calendário',
                minLevel: 2
            },
            contas: {
                keywords: ['abrir contas', 'abre contas', 'abre a tela contas', 'abrir cartões', 'abre cartões', 'abre a tela cartões', 'contas e cartões', 'ver contas', 'ver cartões'],
                route: '/assets',
                screenName: 'Contas e Cartões',
                minLevel: 2
            },
            planejamento: {
                keywords: ['abrir planejamento', 'abre planejamento', 'abre a tela planejamento', 'ver planejamento', 'tela planejamento'],
                route: '/planning',
                screenName: 'Planejamento',
                minLevel: 4
            },
            perfil: {
                keywords: ['abrir perfil', 'abre perfil', 'abra perfil', 'meu perfil', 'abre a tela perfil', 'ver perfil'],
                route: '/profile',
                screenName: 'Perfil',
                minLevel: 0
            },
            dashboard: {
                keywords: ['abrir visão geral', 'abre visão geral', 'abre dashboard', 'abrir dashboard', 'ver visão geral', 'abre a tela visão geral'],
                route: '/dashboard',
                screenName: 'Visão Geral',
                minLevel: 1
            }
        };

        for (const [, config] of Object.entries(navigationMap)) {
            const isNavigationCommand = config.keywords.some(keyword => lowerInput.includes(keyword));
            if (isNavigationCommand) {
                // Check if user has the required level
                if (userLevel < config.minLevel) {
                    addMessage('assistant',
                        `🔒 A tela **${config.screenName}** faz parte de um nível mais avançado.\n\nPor enquanto, continue praticando com as funções básicas no seu ritmo. Quando se sentir confortável e quiser explorar mais, o botão **"Ir para Nível ${config.minLevel}"** estará lá embaixo te esperando. Sem pressa! 😊`,
                        'text',
                        { skipRefund: true }
                    );
                    return;
                }

                addMessage('assistant', `📍 Abrindo a tela **${config.screenName}**...`, 'success');
                setTimeout(() => {
                    router.push(config.route);
                }, 500);
                return;
            }
        }

        // ==========================================
        // L1 Tutorial Button Handlers (work even after tutorialStep is IDLE)
        // ==========================================
        if (userInput === 'L1_SHOW_TIPS') {
            // Dispatch event to open tips modal
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('showTipsModal'));
            }
            return;
        }

        if (userInput === 'L1_START') {
            // Show final congratulations message
            setTutorialStep('IDLE');
            setMessages(prev => [...prev, {
                id: 'l1-done-' + Date.now(),
                role: 'assistant',
                content: "🎉 Parabéns! Estamos prontos pra começar!\n\nAgora você pode me dizer sempre que gastar ou receber dinheiro:\n• \"Gastei 50 no mercado\"\n• \"Recebi 1000 do salário\"\n• \"Como estou esse mês?\"",
                type: 'success'
            }]);
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

            // If in L3 tutorial but not handled, still block AI and show help message
            if (tutorialStep.startsWith('L3_') && tutorialStep !== 'L3_CARD_DATES' && tutorialStep !== 'L3_CARD_NAME' && tutorialStep !== 'L3_CARD_CUSTOM') {
                addMessage('assistant', '👆 Use os botões acima para continuar o tutorial.', 'text', { skipRefund: true });
                return;
            }

            // If in L4 tutorial but not handled (except simulation step which expects free input)
            if (tutorialStep.startsWith('L4_') && tutorialStep !== 'L4_SIMULATION_TASK') {
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
        // SLOT-FILLING: User providing bank name after we asked
        // ==========================================
        if (!isJustNumber && pendingSlots && pendingSlots.payment_method === 'bank' && pendingSlots.amount && !pendingSlots.account_name) {
            // User is providing bank name
            const bankName = userInput.trim();
            const { getAccountByName } = await import('../actions/assets');
            const account = await getAccountByName(bankName);

            if (account) {
                // Bank found - complete the transaction
                const { createMovement } = await import('../actions/finance-core');
                const { getCategoryByName } = await import('../actions/categories');

                let categoryId = undefined;
                if (pendingSlots.category) {
                    const category = await getCategoryByName(pendingSlots.category);
                    if (category) {
                        categoryId = category.id;
                    }
                }

                const result = await createMovement({
                    description: pendingSlots.description || '',
                    amount: pendingSlots.amount,
                    type: pendingSlots.type || 'expense',
                    date: pendingSlots.date || new Date().toISOString().split('T')[0],
                    dueDate: pendingSlots.dueDate,
                    isPaid: pendingSlots.dueDate ? false : true,
                    categoryId: categoryId,
                    accountId: account.id,
                });

                if (result.success) {
                    const amountFormatted = pendingSlots.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const typeLabel = pendingSlots.type === 'income' ? 'Receita' : 'Despesa';
                    const categoryLabel = pendingSlots.category ? ` em ${pendingSlots.category}` : '';

                    addMessage('assistant',
                        `✅ Anotado! ${typeLabel} de ${amountFormatted} com ${pendingSlots.description}${categoryLabel}, no ${account.name}.`,
                        'success'
                    );
                    setPendingSlots(null);

                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('transactionUpdated'));
                    }
                    return;
                } else {
                    addMessage('assistant', `❌ Erro ao registrar: ${result.error}`, 'error');
                    setPendingSlots(null);
                    return;
                }
            } else {
                // Bank not found - ask again
                addMessage('assistant',
                    `❓ Não encontrei a conta "${bankName}". Qual conta você quer usar?\n\n💡 Se quiser criar uma nova conta, cancela e me diz: "Criar conta no ${bankName}"`,
                    'text'
                );
                return;
            }
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

                // Check if this is a PIX/Débito payment with default account = Carteira
                if (completedSlots.payment_method === 'bank' && !completedSlots.account_name) {
                    const { getDefaultAccount } = await import('../actions/assets');
                    const defaultAccount = await getDefaultAccount();

                    if (defaultAccount?.type === 'wallet') {
                        // Need to ask which bank account
                        setPendingSlots(completedSlots);
                        addMessage('assistant', '💳 O débito sai de qual conta bancária?', 'text');
                        return;
                    }
                }

                // All required slots filled (description + amount) -> execute directly
                try {
                    const { createMovement } = await import('../actions/finance-core');
                    const { getCategoryByName } = await import('../actions/categories');
                    const { getDefaultAccount, getAccountByName } = await import('../actions/assets');

                    // Lookup category ID if we have a category name
                    let categoryId = undefined;
                    if (completedSlots.category) {
                        const category = await getCategoryByName(completedSlots.category);
                        if (category) {
                            categoryId = category.id;
                        }
                    }

                    // Determine account ID
                    let accountId = undefined;
                    if (completedSlots.account_name) {
                        const account = await getAccountByName(completedSlots.account_name);
                        if (account) {
                            accountId = account.id;
                        }
                    } else if (completedSlots.payment_method === 'bank') {
                        // Use default bank account
                        const defaultAccount = await getDefaultAccount();
                        if (defaultAccount && defaultAccount.type !== 'wallet') {
                            accountId = defaultAccount.id;
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
                        accountId: accountId,
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
                // Check if backend already processed successfully (message starts with ✅)
                if (response.message.startsWith('✅')) {
                    addMessage('assistant', response.message, 'success');
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('transactionUpdated'));
                    }
                    return;
                }

                // Backend didn't find/process it - use frontend logic for multiple matches
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
                    payment_method: response.data.payment_method,  // Save PIX/Débito info
                    account_name: response.data.account_name,      // Save specific account
                };
                setPendingSlots(partialSlots);
                console.log('📝 Saved pending slots:', partialSlots);
            } else if (response.message.includes('✅')) {
                // Success - clear pending slots
                setPendingSlots(null);
                setPendingReconciliation(null);

                // Check if user hit milestone (10 actions)
                if (response.hitMilestone) {
                    // Dispatch celebration event
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('celebrateLevelUp'));
                    }

                    // Add milestone message after the success message
                    setTimeout(() => {
                        const nextLevel = userLevel + 1;
                        setMessages(prev => [...prev, {
                            id: 'milestone-' + Date.now(),
                            role: 'assistant',
                            content: `🎉 **Parabéns!** Você completou 10 ações neste nível!\n\nSe estiver se sentindo confortável, o botão **"Ir para Nível ${nextLevel}"** está lá embaixo esperando você. Novas funcionalidades te aguardam! 🚀`,
                            type: 'success'
                        }]);
                    }, 1500);
                }
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

