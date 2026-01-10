'use client';

import { useEffect, useState } from 'react';
import { sendSupportMessage, getUserMessages } from '../actions/support';
import { HelpCircle, Mail, MessageSquare, ChevronDown, ChevronUp, Send, Clock, CheckCircle2 } from 'lucide-react';

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
        <div className="max-w-6xl mx-auto space-y-12 pb-12">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
                    <HelpCircle className="text-blue-500" />
                    Central de Ajuda
                </h1>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: FAQ & Contact */}
                <div className="lg:col-span-2 space-y-8">
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
