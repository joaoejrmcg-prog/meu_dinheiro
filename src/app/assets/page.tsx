"use client";

import { useState, useEffect } from "react";
import { Wallet, CreditCard, Plus, Trash2, Edit2, Building2, PiggyBank, X, Check, Sparkles, ArrowRight, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { getAccounts, createAccount, deleteAccount, getCreditCards, createCreditCard, deleteCreditCard } from "../actions/assets";
import { createTransfer } from "../actions/financial";
import { Account, CreditCard as CreditCardType } from "../types";
import { cn } from "../lib/utils";

import { getAccountStatement } from "../actions/financial";
import { Movement } from "../types";

type Tab = 'accounts' | 'cards';

import { getUserLevel } from "../actions/profile";
import { UserLevel } from "../lib/levels";
import { Lock } from "lucide-react";

// ... (imports remain the same)

export default function AssetsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('accounts');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<CreditCardType[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLevel, setUserLevel] = useState<UserLevel>(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [accountsData, cardsData, level] = await Promise.all([
            getAccounts(),
            getCreditCards(),
            getUserLevel()
        ]);
        setAccounts(accountsData);
        setCards(cardsData);
        setUserLevel(level);
        setLoading(false);
    };

    const getAccountIcon = (type: string) => {
        switch (type) {
            case 'wallet': return <Wallet className="w-5 h-5" />;
            case 'bank': return <Building2 className="w-5 h-5" />;
            case 'savings': return <PiggyBank className="w-5 h-5" />;
            default: return <Wallet className="w-5 h-5" />;
        }
    };

    const getAccountTypeLabel = (type: string) => {
        switch (type) {
            case 'wallet': return 'Carteira';
            case 'bank': return 'Conta Corrente';
            case 'savings': return 'Poupança';
            default: return type;
        }
    };

    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const isCardsLocked = userLevel < 3;

    const getLevelTips = (level: number) => {
        if (level < 2) {
            return [
                { text: '"Cadastrar conta do Nubank"', link: '/?tip=contas' },
                { text: '"Adicionar saldo na Carteira"', link: '/?tip=saldo' },
                { text: '"Registrar gasto com almoço"', link: '/?tip=gastos' },
                { text: '"Quanto gastei hoje?"', link: '/?tip=resumo' }
            ];
        } else if (level < 3) {
            return [
                { text: '"Transferir 500 para Poupança"', link: '/?tip=transferencia' },
                { text: '"Agendar pagamento de luz"', link: '/?tip=agendamento' },
                { text: '"Criar conta de Investimento"', link: '/?tip=investimento' },
                { text: '"Resumo da semana"', link: '/?tip=resumo' }
            ];
        } else {
            return [
                { text: '"Cadastrar cartão Nubank com limite de 5000"', link: '/?tip=cartao' },
                { text: '"Registrar compra no crédito"', link: '/?tip=compra_credito' },
                { text: '"Ver fatura do cartão"', link: '/?tip=fatura' },
                { text: '"Qual o melhor dia de compra?"', link: '/?tip=melhor_dia' }
            ];
        }
    };

    const tips = getLevelTips(userLevel);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header and AI Quick Actions remain the same */}

            {/* ... (Header code) ... */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Patrimônio</h1>
                    <p className="text-neutral-500 text-sm">Gerencie suas contas e cartões</p>
                </div>
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-400">Saldo Total</p>
                    <p className="text-xl font-bold text-green-400">
                        R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* AI Quick Actions */}
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-green-400">Assistente IA</h3>
                        <p className="text-xs text-neutral-500">Experimente um comando</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tips.map((tip, index) => (
                        <Link key={index} href={tip.link} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                            <span className="text-xs text-neutral-400 group-hover:text-green-400">{tip.text}</span>
                            <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-neutral-900 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'accounts'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <Wallet className="w-4 h-4" />
                    Contas
                </button>
                <button
                    onClick={() => !isCardsLocked && setActiveTab('cards')}
                    disabled={isCardsLocked}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all relative overflow-hidden",
                        activeTab === 'cards'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : isCardsLocked
                                ? "text-neutral-600 cursor-not-allowed opacity-50"
                                : "text-neutral-400 hover:text-neutral-200"
                    )}
                    title={isCardsLocked ? "Disponível no Nível 3 (Crédito)" : "Gerenciar Cartões"}
                >
                    {isCardsLocked ? <Lock className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                    Cartões
                    {isCardsLocked && (
                        <div className="absolute inset-0 bg-neutral-950/10" />
                    )}
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : activeTab === 'accounts' ? (
                <AccountsTab accounts={accounts} onRefresh={loadData} getAccountIcon={getAccountIcon} getAccountTypeLabel={getAccountTypeLabel} />
            ) : (
                <CardsTab cards={cards} onRefresh={loadData} />
            )}
        </div>
    );
}

// ============ ACCOUNTS TAB ============
function AccountsTab({ accounts, onRefresh, getAccountIcon, getAccountTypeLabel }: {
    accounts: Account[];
    onRefresh: () => void;
    getAccountIcon: (type: string) => React.ReactNode;
    getAccountTypeLabel: (type: string) => string;
}) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', type: 'bank' as const, balance: '' });
    const [saving, setSaving] = useState(false);

    // Transfer Modal State
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferData, setTransferData] = useState({ fromId: '', toId: '', amount: '', description: '' });
    const [transferring, setTransferring] = useState(false);
    const [transferError, setTransferError] = useState('');

    // Statement Modal State
    const [showStatementModal, setShowStatementModal] = useState(false);
    const [statementData, setStatementData] = useState<any>(null);
    const [loadingStatement, setLoadingStatement] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

    const handleCreate = async () => {
        if (!formData.name) return;
        setSaving(true);
        try {
            await createAccount({
                name: formData.name,
                type: formData.type,
                balance: parseFloat(formData.balance) || 0
            });
            setShowForm(false);
            setFormData({ name: '', type: 'bank', balance: '' });
            onRefresh();
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta conta?')) return;
        await deleteAccount(id);
        onRefresh();
    };

    const openTransferModal = (fromAccountId: string) => {
        setTransferData({ fromId: fromAccountId, toId: '', amount: '', description: '' });
        setTransferError('');
        setShowTransferModal(true);
    };

    const handleTransfer = async () => {
        if (!transferData.fromId || !transferData.toId || !transferData.amount) return;
        setTransferring(true);
        setTransferError('');

        const result = await createTransfer({
            fromAccountId: transferData.fromId,
            toAccountId: transferData.toId,
            amount: parseFloat(transferData.amount),
            description: transferData.description || undefined
        });

        if (result.success) {
            setShowTransferModal(false);
            setTransferData({ fromId: '', toId: '', amount: '', description: '' });
            onRefresh();
        } else {
            setTransferError(result.error || 'Erro ao transferir');
        }
        setTransferring(false);
    };

    const handleOpenStatement = async (account: Account) => {
        setSelectedAccount(account);
        setShowStatementModal(true);
        setLoadingStatement(true);
        try {
            const data = await getAccountStatement(account.id);
            setStatementData(data);
        } catch (e) {
            console.error(e);
        }
        setLoadingStatement(false);
    };

    const rotaryAccounts = accounts.filter(a => a.type !== 'savings');
    const investmentAccounts = accounts.filter(a => a.type === 'savings');

    return (
        <div className="space-y-6">
            {/* Add Button */}
            <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-green-500/50 hover:text-green-400 transition-all"
            >
                <Plus className="w-5 h-5" />
                Adicionar Conta
            </button>

            {/* Form */}
            {showForm && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
                    <input
                        type="text"
                        placeholder="Nome da conta (ex: Nubank)"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                    />
                    <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                    >
                        <option value="bank">Conta Corrente</option>
                        <option value="wallet">Carteira</option>
                        <option value="savings">Poupança / Investimento</option>
                    </select>
                    <input
                        type="number"
                        placeholder="Saldo atual (opcional)"
                        value={formData.balance}
                        onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowForm(false)}
                            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={saving || !formData.name}
                            className="flex-1 py-2.5 rounded-lg bg-green-500 text-black font-semibold hover:bg-green-400 disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Rotary Accounts */}
            <div>
                <h3 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider">Contas de Movimentação</h3>
                {rotaryAccounts.length === 0 ? (
                    <p className="text-neutral-600 text-sm italic">Nenhuma conta cadastrada.</p>
                ) : (
                    <div className="space-y-3">
                        {rotaryAccounts.map((acc) => (
                            <AccountCard
                                key={acc.id}
                                acc={acc}
                                onDelete={handleDelete}
                                onTransfer={openTransferModal}
                                getIcon={getAccountIcon}
                                getLabel={getAccountTypeLabel}
                                onClick={handleOpenStatement}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Investment Accounts */}
            <div>
                <h3 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <PiggyBank className="w-4 h-4" />
                    Investimentos / Reservas
                </h3>
                {investmentAccounts.length === 0 ? (
                    <p className="text-neutral-600 text-sm italic">Nenhum investimento cadastrado.</p>
                ) : (
                    <div className="space-y-3">
                        {investmentAccounts.map((acc) => (
                            <AccountCard
                                key={acc.id}
                                acc={acc}
                                onDelete={handleDelete}
                                onTransfer={openTransferModal}
                                getIcon={getAccountIcon}
                                getLabel={getAccountTypeLabel}
                                isInvestment
                                onClick={handleOpenStatement}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-full max-w-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <ArrowLeftRight className="w-5 h-5 text-green-400" />
                                Transferir entre Contas
                            </h3>
                            <button onClick={() => setShowTransferModal(false)} className="text-neutral-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {transferError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
                                {transferError}
                            </div>
                        )}

                        <div>
                            <label className="text-xs text-neutral-400 mb-1 block">De (Origem)</label>
                            <select
                                value={transferData.fromId}
                                onChange={(e) => setTransferData({ ...transferData, fromId: e.target.value })}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                            >
                                <option value="">Selecione a conta</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} (R$ {(a.balance || 0).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-neutral-400 mb-1 block">Para (Destino)</label>
                            <select
                                value={transferData.toId}
                                onChange={(e) => setTransferData({ ...transferData, toId: e.target.value })}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                            >
                                <option value="">Selecione a conta</option>
                                {accounts.filter(a => a.id !== transferData.fromId).map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} (R$ {(a.balance || 0).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-neutral-400 mb-1 block">Valor</label>
                            <input
                                type="number"
                                placeholder="0,00"
                                value={transferData.amount}
                                onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-neutral-400 mb-1 block">Descrição (opcional)</label>
                            <input
                                type="text"
                                placeholder="Ex: Transferência para reserva"
                                value={transferData.description}
                                onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowTransferModal(false)}
                                className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleTransfer}
                                disabled={transferring || !transferData.fromId || !transferData.toId || !transferData.amount}
                                className="flex-1 py-2.5 rounded-lg bg-green-500 text-black font-semibold hover:bg-green-400 disabled:opacity-50"
                            >
                                {transferring ? 'Transferindo...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Statement Modal */}
            {showStatementModal && selectedAccount && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-full max-w-lg space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                {getAccountIcon(selectedAccount.type)}
                                Extrato: {selectedAccount.name}
                            </h3>
                            <button onClick={() => setShowStatementModal(false)} className="text-neutral-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {loadingStatement ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : statementData ? (
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50">
                                        <p className="text-xs text-neutral-400">Saldo Anterior</p>
                                        <p className="font-medium text-white">
                                            R$ {statementData.previousBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50">
                                        <p className="text-xs text-neutral-400">Saldo Atual</p>
                                        <p className={cn("font-medium", statementData.currentBalance >= 0 ? "text-green-400" : "text-red-400")}>
                                            R$ {statementData.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                                        <p className="text-xs text-green-400/70">Entradas (Mês)</p>
                                        <p className="font-medium text-green-400">
                                            + R$ {statementData.totalEntries.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                        <p className="text-xs text-red-400/70">Saídas (Mês)</p>
                                        <p className="font-medium text-red-400">
                                            - R$ {statementData.totalExits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                {/* Transactions List */}
                                <div>
                                    <h4 className="text-sm font-medium text-neutral-400 mb-2">Movimentações do Mês</h4>
                                    <div className="space-y-2">
                                        {[...statementData.entries, ...statementData.exits]
                                            .sort((a: Movement, b: Movement) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((mov: Movement) => (
                                                <div key={mov.id} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg border border-neutral-800">
                                                    <div>
                                                        <p className="text-sm text-white font-medium">{mov.description}</p>
                                                        <p className="text-xs text-neutral-500">{new Date(mov.date).toLocaleDateString('pt-BR')}</p>
                                                    </div>
                                                    <span className={cn("text-sm font-medium", mov.type === 'income' ? "text-green-400" : "text-red-400")}>
                                                        {mov.type === 'income' ? '+' : '-'} R$ {mov.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ))}
                                        {statementData.entries.length === 0 && statementData.exits.length === 0 && (
                                            <p className="text-center text-neutral-500 text-sm py-4">Nenhuma movimentação este mês.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-red-400">Erro ao carregar extrato.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function AccountCard({ acc, onDelete, onTransfer, getIcon, getLabel, isInvestment, onClick }: any) {
    return (
        <div
            onClick={() => onClick(acc)}
            className={cn(
                "border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:border-neutral-600",
                isInvestment ? "bg-blue-500/5 border-blue-500/10" : "bg-neutral-900 border-neutral-800"
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                isInvestment ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"
            )}>
                {getIcon(acc.type)}
            </div>
            <div className="flex-1">
                <p className="font-medium text-white flex items-center gap-2">
                    {acc.name}
                    {acc.is_default && <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">(Principal)</span>}
                </p>
                <p className="text-xs text-neutral-500">{getLabel(acc.type)}</p>
            </div>
            <div className="text-right">
                <p className={cn("font-semibold", isInvestment ? "text-blue-400" : (acc.balance >= 0 ? "text-green-400" : "text-red-400"))}>
                    R$ {(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onTransfer(acc.id); }}
                className="p-2 text-neutral-500 hover:text-green-400 transition-colors"
                title="Transferir"
            >
                <ArrowLeftRight className="w-4 h-4" />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(acc.id); }}
                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                title="Excluir"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}



// ============ CARDS TAB ============
function CardsTab({ cards, onRefresh }: { cards: CreditCardType[]; onRefresh: () => void }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', closing_day: '', due_day: '', limit_amount: '' });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!formData.name || !formData.closing_day || !formData.due_day) return;
        setSaving(true);
        try {
            await createCreditCard({
                name: formData.name,
                closing_day: parseInt(formData.closing_day),
                due_day: parseInt(formData.due_day),
                limit_amount: parseFloat(formData.limit_amount) || undefined
            });
            setShowForm(false);
            setFormData({ name: '', closing_day: '', due_day: '', limit_amount: '' });
            onRefresh();
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este cartão?')) return;
        await deleteCreditCard(id);
        onRefresh();
    };

    return (
        <div className="space-y-4">
            {/* Add Button */}
            <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-green-500/50 hover:text-green-400 transition-all"
            >
                <Plus className="w-5 h-5" />
                Adicionar Cartão
            </button>

            {/* Form */}
            {showForm && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
                    <input
                        type="text"
                        placeholder="Nome do cartão (ex: Nubank)"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            placeholder="Dia fechamento"
                            min="1"
                            max="31"
                            value={formData.closing_day}
                            onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                        />
                        <input
                            type="number"
                            placeholder="Dia vencimento"
                            min="1"
                            max="31"
                            value={formData.due_day}
                            onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                        />
                    </div>
                    <input
                        type="number"
                        placeholder="Limite (opcional)"
                        value={formData.limit_amount}
                        onChange={(e) => setFormData({ ...formData, limit_amount: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowForm(false)}
                            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={saving || !formData.name || !formData.closing_day || !formData.due_day}
                            className="flex-1 py-2.5 rounded-lg bg-green-500 text-black font-semibold hover:bg-green-400 disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {cards.length === 0 && !showForm ? (
                <div className="text-center py-12 text-neutral-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum cartão cadastrado</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {cards.map((card) => (
                        <div key={card.id} className="bg-gradient-to-r from-neutral-900 to-neutral-800 border border-neutral-700 rounded-xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-white">{card.name}</p>
                                <p className="text-xs text-neutral-500">
                                    Fecha dia {card.closing_day} • Vence dia {card.due_day}
                                </p>
                            </div>
                            {card.limit_amount && (
                                <div className="text-right">
                                    <p className="text-xs text-neutral-500">Limite</p>
                                    <p className="font-medium text-neutral-300">
                                        R$ {card.limit_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            )}
                            <button
                                onClick={() => handleDelete(card.id)}
                                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
