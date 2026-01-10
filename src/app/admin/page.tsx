'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { getSupportMessages, markAsReplied, getUsers, updateUserPlan, generateMissingCodes } from '../actions/admin';
import { Shield, Mail, CheckCircle, Clock, Search, RefreshCw, Users, CreditCard, Star, LogOut, Wand2 } from 'lucide-react';

const ADMIN_EMAIL = 'neomercadoia@gmail.com';

type Message = {
    id: string;
    user_email: string;
    subject: string;
    message: string;
    status: 'pending' | 'replied';
    created_at: string;
};

type UserData = {
    id: string;
    plan: string;
    status: string;
    current_period_end: string;
    whatsapp: string;
    email: string;
    referral_code: string;
};

export default function AdminPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'support' | 'users'>('support');
    const [filter, setFilter] = useState<'all' | 'pending'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.email !== ADMIN_EMAIL) {
                router.push('/');
                return;
            }
            fetchData();
        };
        checkAuth();
    }, []);

    const [replies, setReplies] = useState<{ [key: string]: string }>({});

    const fetchData = async () => {
        setLoading(true);
        const [msgs, usrs] = await Promise.all([
            getSupportMessages(),
            getUsers()
        ]);
        setMessages(msgs as Message[]);
        setUsers(usrs as UserData[]);
        setLoading(false);
    };

    const handleMarkReplied = async (id: string) => {
        const replyText = replies[id];
        const result = await markAsReplied(id, replyText);

        if (!result.success) {
            alert("Erro ao enviar resposta.");
            return;
        }

        setReplies(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        fetchData(); // Refresh
    };

    const handleReplyChange = (id: string, text: string) => {
        setReplies(prev => ({ ...prev, [id]: text }));
    };

    const handleUpdatePlan = async (userId: string, newPlan: string) => {
        if (!confirm(`Tem certeza que deseja mudar o plano deste usuário para ${newPlan}?`)) return;

        const result = await updateUserPlan(userId, newPlan);
        if (result.success) {
            alert("Plano atualizado com sucesso!");
            fetchData();
        } else {
            alert("Erro ao atualizar plano.");
        }
    };

    const handleGenerateCodes = async () => {
        setLoading(true);
        const result = await generateMissingCodes();
        alert(result.message);
        fetchData();
    };

    const filteredMessages = filter === 'all'
        ? messages
        : messages.filter(m => m.status === 'pending');

    const filteredUsers = users.filter(user => {
        const search = searchTerm.toLowerCase();
        return (
            user.email.toLowerCase().includes(search) ||
            user.id.toLowerCase().includes(search) ||
            user.whatsapp.toLowerCase().includes(search) ||
            user.referral_code.toLowerCase().includes(search)
        );
    });

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-neutral-500">Carregando painel...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
                    <Shield className="text-red-500" />
                    Painel Administrativo
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('support')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'support' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                        <Mail className="w-4 h-4" />
                        Suporte
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                        <Users className="w-4 h-4" />
                        Usuários
                    </button>
                    <button
                        onClick={handleGenerateCodes}
                        title="Gerar códigos faltantes"
                        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors ml-2 text-neutral-400 hover:text-yellow-500"
                    >
                        <Wand2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors ml-2"
                    >
                        <RefreshCw className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-400">Total de Usuários</p>
                    <p className="text-3xl font-bold text-white">{users.length}</p>
                </div>
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-400">Usuários VIP</p>
                    <p className="text-3xl font-bold text-yellow-500">
                        {users.filter(u => u.plan.toLowerCase() === 'vip').length}
                    </p>
                </div>
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-400">Mensagens Pendentes</p>
                    <p className="text-3xl font-bold text-red-500">
                        {messages.filter(m => m.status === 'pending').length}
                    </p>
                </div>
            </div>

            {activeTab === 'support' ? (
                <>
                    {/* Filters */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            Pendentes
                        </button>
                    </div>

                    {/* Messages List */}
                    <div className="space-y-4">
                        {filteredMessages.length === 0 ? (
                            <div className="text-center py-12 text-neutral-500">
                                Nenhuma mensagem encontrada.
                            </div>
                        ) : (
                            filteredMessages.map((msg) => (
                                <div key={msg.id} className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full ${msg.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                                <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                                    {msg.status === 'pending' ? 'Pendente' : 'Respondido'}
                                                </span>
                                                <span className="text-xs text-neutral-600">•</span>
                                                <span className="text-xs text-neutral-500">
                                                    {new Date(msg.created_at).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-neutral-200">{msg.subject}</h3>
                                            <p className="text-sm text-blue-400 font-mono mt-1">{msg.user_email}</p>
                                        </div>
                                        {msg.status === 'pending' && (
                                            <button
                                                onClick={() => handleMarkReplied(msg.id)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Marcar como Respondido
                                            </button>
                                        )}
                                    </div>

                                    <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 text-neutral-300 whitespace-pre-wrap">
                                        {msg.message}
                                    </div>

                                    {msg.status === 'pending' && (
                                        <div className="mt-4 space-y-2">
                                            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sua Resposta (In-App)</label>
                                            <textarea
                                                value={replies[msg.id] || ''}
                                                onChange={(e) => handleReplyChange(msg.id, e.target.value)}
                                                placeholder="Digite sua resposta aqui..."
                                                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-600 min-h-[100px] text-sm"
                                            />
                                            <div className="flex justify-end gap-3">
                                                <a
                                                    href={`mailto:${msg.user_email}?subject=Re: ${msg.subject}`}
                                                    className="text-sm text-neutral-500 hover:text-white flex items-center gap-1 transition-colors px-3 py-1.5"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                    Responder via Email
                                                </a>
                                                <button
                                                    onClick={() => handleMarkReplied(msg.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Enviar Resposta In-App
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {msg.status === 'replied' && (
                                        <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                            <p className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">Sua Resposta</p>
                                            <p className="text-sm text-neutral-300">{(msg as any).admin_reply || 'Marcado como respondido sem texto.'}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Buscar por Código, Email ou WhatsApp..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-200 focus:border-blue-500 outline-none w-full"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-neutral-800">
                        <table className="w-full text-left text-sm text-neutral-400">
                            <thead className="bg-neutral-900 text-neutral-200 uppercase font-medium">
                                <tr>
                                    <th className="px-6 py-4">Código</th>
                                    <th className="px-6 py-4">Email / ID</th>
                                    <th className="px-6 py-4">WhatsApp</th>
                                    <th className="px-6 py-4">Plano Atual</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800 bg-neutral-950">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-neutral-900/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded">
                                                {user.referral_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{user.email}</span>
                                                <span className="text-xs font-mono text-neutral-600 truncate max-w-[100px]">{user.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{user.whatsapp}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${user.plan.toLowerCase() === 'vip'
                                                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                : user.plan === 'pro'
                                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                                }`}>
                                                {user.plan.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-medium ${user.status === 'active' ? 'text-green-500' : 'text-neutral-500'}`}>
                                                {user.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {user.plan.toLowerCase() !== 'vip' && (
                                                <button
                                                    onClick={() => handleUpdatePlan(user.id, 'vip')}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    <Star className="w-3 h-3" />
                                                    Tornar VIP
                                                </button>
                                            )}
                                            {user.plan.toLowerCase() === 'vip' && (
                                                <button
                                                    onClick={() => handleUpdatePlan(user.id, 'trial')}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    <LogOut className="w-3 h-3" />
                                                    Remover VIP
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
