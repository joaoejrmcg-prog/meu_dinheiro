'use client';

import { useEffect, useState } from 'react';
import { sendSupportMessage, getUserMessages } from '../actions/support';
import { HelpCircle, Mail, MessageSquare, ChevronDown, ChevronUp, Send, Clock, CheckCircle2, BookOpen, Lightbulb, CreditCard, Landmark, Repeat, Handshake, Target, Copy, Check } from 'lucide-react';

const FEATURE_CATEGORIES = [
    {
        id: 'basics',
        label: 'Registros Básicos',
        icon: BookOpen,
        color: 'text-green-400',
        bg: 'bg-green-500/20',
        description: 'Comandos essenciais para o dia a dia.',
        commands: [
            { text: 'Ganhei 2000 de salário', desc: 'Registra uma entrada de dinheiro. O saldo da sua conta padrão será atualizado automaticamente.' },
            { text: 'Gastei 50 no mercado', desc: 'Registra uma saída. Se não especificar a conta, uso a sua conta padrão.' },
            { text: 'Paguei a conta de luz', desc: 'Identifico que é uma despesa e já registro o pagamento na data de hoje.' },
            { text: 'Cancela o último', desc: 'Errou? Sem problemas. Esse comando desfaz o último registro que você fez.' },
            { text: 'O valor era 60', desc: 'Corrige apenas o valor do último lançamento, mantendo o resto igual.' },
            { text: 'Era no Itaú', desc: 'Muda a conta do último lançamento. Útil se você esqueceu de avisar onde gastou.' }
        ]
    },
    {
        id: 'accounts',
        label: 'Contas & Bancos',
        icon: Landmark,
        color: 'text-blue-400',
        bg: 'bg-blue-500/20',
        description: 'Gerencie suas contas bancárias e saldos.',
        commands: [
            { text: 'Criar conta no Nubank', desc: 'Cria uma nova conta para você controlar o saldo separadamente.' },
            { text: 'Saldo do Itaú é 500', desc: 'Ajuste manual. Útil quando o saldo real do banco não bate com o do app.' },
            { text: 'Transferir 500 para Poupança', desc: 'Move dinheiro de uma conta para outra sem alterar seu patrimônio total.' },
            { text: 'Quanto tenho no total?', desc: 'Soma o saldo de todas as suas contas cadastradas para te dar uma visão geral.' },
            { text: 'Listar minhas contas', desc: 'Mostra todas as contas que você tem cadastradas e seus saldos atuais.' }
        ]
    },
    {
        id: 'cards',
        label: 'Cartão de Crédito',
        icon: CreditCard,
        color: 'text-purple-400',
        bg: 'bg-purple-500/20',
        description: 'Controle total dos seus cartões.',
        commands: [
            { text: 'Criar cartão Nubank fecha dia 10 vence 17', desc: 'Configura um cartão inteligente que sabe calcular vencimentos e melhores datas de compra.' },
            { text: 'Almoço de 50 no Nubank', desc: 'Lança uma compra no crédito. Só vai descontar do seu saldo quando você pagar a fatura.' },
            { text: 'TV de 2000 em 10x no Nubank', desc: 'Parcelamento inteligente. Já cria as 10 parcelas nas faturas futuras automaticamente.' },
            { text: 'Qual a fatura do Nubank?', desc: 'Calcula o total da fatura atual, somando compras à vista e parcelas que caem neste mês.' },
            { text: 'Paguei a fatura do Nubank', desc: 'Fecha a fatura, marca os itens como pagos e desconta o valor total da sua conta.' },
            { text: 'Qual meu limite no Nubank?', desc: 'Mostra quanto você ainda pode gastar, baseado no limite total menos os gastos atuais.' },
            { text: 'Qual melhor cartão pra comprar hoje?', desc: 'Analisa seus cartões e datas de fechamento para sugerir onde você ganha mais prazo.' },
            { text: 'Alterar limite do Nubank para 5000', desc: 'Atualiza o limite do seu cartão para que eu possa calcular o quanto você ainda pode gastar.' },
            { text: 'Mudar vencimento do Itaú para dia 10', desc: 'Corrige a data de vencimento do cartão. Útil se você alterou a data no banco.' },
            { text: 'Corrigir fechamento do cartão XP', desc: 'Ajusta o dia que a fatura fecha, para eu saber exatamente em qual mês as compras vão cair.' }
        ]
    },
    {
        id: 'recurrence',
        label: 'Recorrências',
        icon: Repeat,
        color: 'text-pink-400',
        bg: 'bg-pink-500/20',
        description: 'Contas fixas e assinaturas.',
        commands: [
            { text: 'Todo dia 10 pago 150 de internet', desc: 'Esse comando cria uma conta mensal fixa. Todo dia 10 eu te lembro aqui no app pra você não esquecer.' },
            { text: 'Assinei Spotify de 21,90 no Nubank', desc: 'Esse valor vai somar na sua fatura Nubank todo mês. Você pode cancelar quando quiser.' },
            { text: 'Recebo 5000 todo dia 5', desc: 'Garante que seu salário ou renda extra entre automaticamente no planejamento do mês.' },
            { text: 'A internet é débito automático', desc: 'Avisa que essa conta sai direto do banco. Assim eu já marco como paga no dia certo.' },
            { text: 'Quais são minhas contas fixas?', desc: 'Lista tudo que você cadastrou como recorrente para você revisar seus gastos fixos.' }
        ]
    },
    {
        id: 'loans',
        label: 'Empréstimos',
        icon: Handshake,
        color: 'text-orange-400',
        bg: 'bg-orange-500/20',
        description: 'Controle quem te deve e a quem você deve.',
        commands: [
            { text: 'Peguei 1000 emprestado do João', desc: 'Registra uma dívida. O dinheiro entra na sua conta, mas fica registrado que você deve ao João.' },
            { text: 'Emprestei 500 para Maria', desc: 'Registra que você tem dinheiro a receber. Sai da sua conta, mas cria um crédito com a Maria.' },
            { text: 'Paguei 200 pro João', desc: 'Registra que você devolveu parte do dinheiro. O saldo devedor diminui automaticamente.' },
            { text: 'Maria me pagou 100', desc: 'Registra que você recebeu de volta. O dinheiro entra na conta e a dívida da Maria diminui.' },
            { text: 'Quanto devo pro João?', desc: 'Consulta rápida para saber exatamente quanto ainda falta pagar (ou receber).' }
        ]
    },
    {
        id: 'goals',
        label: 'Metas & Planejamento',
        icon: Target,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/20',
        description: 'Planeje seu futuro financeiro.',
        commands: [
            { text: 'Criar meta Viagem de 5000', desc: 'Define um objetivo financeiro para te ajudar a focar e guardar dinheiro.' },
            { text: 'Guardei 200 pra Viagem', desc: 'Reserva esse valor. Ele continua na sua conta, mas fica "carimbado" para a viagem.' },
            { text: 'Como está a meta Viagem?', desc: 'Mostra uma barra de progresso e quanto falta para atingir seu objetivo.' },
            { text: 'Previsão para o mês que vem', desc: 'Bola de cristal financeira. Projeto seu saldo futuro baseada nas contas fixas e parcelas.' },
            { text: 'E se eu economizar 100 por mês?', desc: 'Simulação. Te mostro quanto você teria no futuro se guardasse esse valor mensalmente.' }
        ]
    }
];

function FeatureGuide() {
    const [activeCategory, setActiveCategory] = useState(FEATURE_CATEGORIES[0]);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Category Tabs */}
            <div className="flex flex-wrap pb-4 gap-3">
                {FEATURE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeCategory.id === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${isActive
                                ? 'bg-neutral-800 border-neutral-700 text-neutral-100 shadow-lg scale-105'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300'
                                }`}
                        >
                            <div className={`p-1 rounded-md ${isActive ? cat.bg : 'bg-neutral-800'}`}>
                                <Icon className={`w-4 h-4 ${isActive ? cat.color : 'text-neutral-500'}`} />
                            </div>
                            <span className="text-sm font-medium">{cat.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Active Content */}
            <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-start gap-4 mb-6">
                    <div className={`p-3 rounded-xl ${activeCategory.bg}`}>
                        <activeCategory.icon className={`w-6 h-6 ${activeCategory.color}`} />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${activeCategory.color}`}>{activeCategory.label}</h3>
                        <p className="text-sm text-neutral-400">{activeCategory.description}</p>
                    </div>
                </div>

                <div className="grid gap-3">
                    {activeCategory.commands.map((cmd, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleCopy(cmd.text)}
                            className="group flex items-center justify-between bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 p-3 rounded-xl transition-all text-left w-full"
                        >
                            <div>
                                <code className="text-sm text-neutral-200 font-medium block mb-1">"{cmd.text}"</code>
                                <span className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">{cmd.desc}</span>
                            </div>
                            <div className="text-neutral-600 group-hover:text-neutral-400 transition-colors">
                                {copiedText === cmd.text ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                    <Copy className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AjudaPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [userMessages, setUserMessages] = useState<any[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(true);

    useEffect(() => {
        fetchUserMessages();
    }, []);

    const fetchUserMessages = async () => {
        setLoadingMessages(true);
        const messages = await getUserMessages();
        // Filter to show only messages from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const filtered = messages.filter((m: any) => new Date(m.created_at) > thirtyDaysAgo);
        setUserMessages(filtered);
        setLoadingMessages(false);
    };

    const faqs = [
        {
            question: "Como funciona o limite de IA?",
            answer: "O limite de interações com a IA depende do seu plano. No plano Light, você tem 10 interações por dia. No plano PRO e VIP, o uso é ilimitado."
        },
        {
            question: "Posso cancelar a qualquer momento?",
            answer: "Sim! Você pode cancelar sua assinatura quando quiser através da página de Perfil. Seu acesso continuará ativo até o fim do período já pago."
        },
        {
            question: "Como funcionam os pagamentos?",
            answer: "Atualmente aceitamos pagamentos via boleto bancário. O boleto é gerado mensalmente e enviado para seu email."
        },
        {
            question: "Meus dados estão seguros?",
            answer: "Absolutamente. Seguimos rigorosamente a LGPD e utilizamos criptografia de ponta para proteger seus dados e os de seus clientes."
        }
    ];

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        setSending(true);

        const formData = new FormData(form);
        await sendSupportMessage(formData);

        setSending(false);
        setSent(true);
        form.reset();
        fetchUserMessages(); // Refresh history

        setTimeout(() => setSent(false), 5000);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-12 px-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
                    <HelpCircle className="text-blue-500" />
                    Central de Ajuda
                </h1>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: FAQ & Contact */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Feature Guide Section */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                            <BookOpen className="w-5 h-5" />
                            Guia de Funcionalidades
                        </h2>

                        <FeatureGuide />
                    </div>

                    {/* FAQ Section */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Perguntas Frequentes
                        </h2>

                        <div className="space-y-3">
                            {faqs.map((faq, index) => (
                                <div key={index} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-neutral-800 transition-colors"
                                    >
                                        <span className="font-medium text-neutral-200">{faq.question}</span>
                                        {openFaq === index ? (
                                            <ChevronUp className="w-4 h-4 text-neutral-500" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-neutral-500" />
                                        )}
                                    </button>
                                    {openFaq === index && (
                                        <div className="px-4 pb-4 text-sm text-neutral-400 animate-in slide-in-from-top-2 duration-200">
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message History Section */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Minhas Mensagens (Últimos 30 dias)
                        </h2>

                        {/* Pending Message Alert */}
                        {!loadingMessages && userMessages.some(m => m.status === 'pending') && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Clock className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-blue-400 mb-1">Solicitação em Análise</h3>
                                    <p className="text-sm text-neutral-300">
                                        Recebemos sua solicitação há {(() => {
                                            const oldestPending = userMessages
                                                .filter(m => m.status === 'pending')
                                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

                                            const diffTime = Math.abs(new Date().getTime() - new Date(oldestPending.created_at).getTime());
                                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                                            return diffDays === 0 ? 'algumas horas' : `${diffDays} dia${diffDays > 1 ? 's' : ''}`;
                                        })()}.
                                        Nossa equipe já está trabalhando para te atender o mais rápido possível. Fique atento, a resposta aparecerá aqui!
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {loadingMessages ? (
                                <div className="text-center py-8 text-neutral-500 text-sm">Carregando histórico...</div>
                            ) : userMessages.length === 0 ? (
                                <div className="bg-neutral-900/50 border border-dashed border-neutral-800 rounded-xl p-8 text-center">
                                    <p className="text-neutral-500 text-sm">Você ainda não enviou nenhuma mensagem.</p>
                                </div>
                            ) : (
                                userMessages.map((msg) => (
                                    <div key={msg.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                                        <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                                            <div>
                                                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{msg.subject}</span>
                                                <p className="text-[10px] text-neutral-600">{new Date(msg.created_at).toLocaleString('pt-BR')}</p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${msg.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'
                                                }`}>
                                                {msg.status === 'pending' ? 'Pendente' : 'Respondido'}
                                            </span>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <p className="text-sm text-neutral-300">{msg.message}</p>

                                            {msg.admin_reply && (
                                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 mt-2">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Resposta do Suporte</span>
                                                        <span className="text-[10px] text-neutral-600 ml-auto">
                                                            {msg.replied_at ? new Date(msg.replied_at).toLocaleString('pt-BR') : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-neutral-200 italic">"{msg.admin_reply}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Contact Form */}
                <div className="space-y-6">
                    <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 h-fit sticky top-8">
                        <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5" />
                            Fale Conosco
                        </h2>

                        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            <p className="text-sm text-neutral-300 mb-2">
                                Suporte via Email:
                            </p>
                            <p className="text-blue-400 font-medium select-all text-sm">
                                neomercadoia@gmail.com
                            </p>
                            <p className="text-[10px] text-neutral-500 mt-2">
                                Você também pode ver as respostas aqui mesmo na Central de Ajuda.
                            </p>
                        </div>

                        {sent ? (
                            <div className="bg-green-500/10 text-green-400 p-4 rounded-xl text-center animate-in fade-in border border-green-500/20">
                                <p className="font-bold">Mensagem enviada!</p>
                                <p className="text-sm">Fique de olho no seu histórico ao lado.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-neutral-400 mb-1">Assunto</label>
                                    <select
                                        name="subject"
                                        required
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    >
                                        <option value="">Selecione um assunto</option>
                                        <option value="duvida">Dúvida sobre o sistema</option>
                                        <option value="tecnico">Problema técnico</option>
                                        <option value="financeiro">Financeiro / Pagamentos</option>
                                        <option value="sugestao">Sugestão de melhoria</option>
                                        <option value="outro">Outro</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-400 mb-1">Mensagem</label>
                                    <textarea
                                        name="message"
                                        required
                                        rows={4}
                                        placeholder="Descreva como podemos ajudar..."
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none"
                                    ></textarea>
                                </div>

                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {sending ? (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Enviar Mensagem
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
