"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, RefreshCw, Plus, Trash2, ChevronLeft, ChevronRight, Calendar, Pencil, X, Sparkles, ArrowRight, ArrowLeftRight } from "lucide-react";
import { getMovements, getRecurrences, getMonthSummary, deleteMovement, createRecurrence, deleteRecurrence, updateRecurrence, createMovementManual, updateMovement, createTransfer } from "../actions/financial";
import { getAccounts, getCreditCards } from "../actions/assets";
import { getCategories } from "../actions/categories";
import { Movement, Recurrence, Account, Category, CreditCard } from "../types";
import { cn } from "../lib/utils";
import { getUserLevel } from "../actions/profile";
import { getSuggestionsForLevel } from "../lib/suggestions";

type Tab = 'expenses' | 'income' | 'transfers' | 'recurring';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function FinancialPage() {
    const [activeTab, setActiveTab] = useState<Tab>('expenses');
    const [movements, setMovements] = useState<Movement[]>([]);
    const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [userLevel, setUserLevelState] = useState(0);

    // Month navigation
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    useEffect(() => {
        loadData();
        getUserLevel().then(level => {
            setUserLevelState(level);
            setSuggestions(getSuggestionsForLevel(level, 4, 'financial'));
        });
    }, [month, year, activeTab]);

    const loadData = async () => {
        setLoading(true);

        // Determine which type to fetch based on active tab
        let typeFilter: 'expense' | 'income' | 'transfer' | undefined;
        if (activeTab === 'expenses') typeFilter = 'expense';
        else if (activeTab === 'income') typeFilter = 'income';
        else if (activeTab === 'transfers') typeFilter = 'transfer';

        const [movementsData, recurrencesData, summaryData, accountsData, categoriesData, creditCardsData] = await Promise.all([
            getMovements({
                month,
                year,
                type: typeFilter
            }),
            getRecurrences(),
            getMonthSummary(month, year, 'paid'), // Only show paid movements in summary
            getAccounts(),
            getCategories(),
            getCreditCards()
        ]);

        setMovements(movementsData);
        setRecurrences(recurrencesData);
        setSummary(summaryData);
        setAccounts(accountsData);
        setCategories(categoriesData);
        setCreditCards(creditCardsData);
        setLoading(false);
    };

    const prevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
    };

    const nextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
    };

    const handleDeleteMovement = async (id: string) => {
        if (!confirm('Excluir esta movimentação?')) return;
        await deleteMovement(id);
        loadData();
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Financeiro</h1>
                    <p className="text-neutral-500 text-sm">Suas movimentações financeiras</p>
                </div>

                {/* Month Navigator */}
                <div className="flex items-center gap-2 bg-neutral-900 rounded-xl p-1">
                    <button onClick={prevMonth} className="p-2 text-neutral-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 py-2 font-medium text-white min-w-[140px] text-center">
                        {MONTHS[month - 1]} {year}
                    </span>
                    <button onClick={nextMonth} className="p-2 text-neutral-400 hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* AI Quick Actions (Dicas de Uso) */}
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
                    {suggestions.map((sug, i) => (
                        <Link key={i} href={`/?tip=${encodeURIComponent(sug)}`} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                            <span className="text-xs text-neutral-400 group-hover:text-green-400">"{sug}"</span>
                            <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-400 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs">Receitas</span>
                    </div>
                    <p className="text-lg font-bold text-green-400">
                        R$ {summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-1">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs">Despesas</span>
                    </div>
                    <p className="text-lg font-bold text-red-400">
                        R$ {summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className={cn(
                    "border rounded-xl p-4",
                    summary.balance >= 0
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-orange-500/10 border-orange-500/20"
                )}>
                    <div className={cn("flex items-center gap-2 mb-1", summary.balance >= 0 ? "text-emerald-400" : "text-orange-400")}>
                        <span className="text-xs">Saldo</span>
                    </div>
                    <p className={cn("text-lg font-bold", summary.balance >= 0 ? "text-emerald-400" : "text-orange-400")}>
                        R$ {summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-neutral-900 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'expenses'
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <TrendingDown className="w-4 h-4" />
                    Gastos
                </button>
                <button
                    onClick={() => setActiveTab('income')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'income'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <TrendingUp className="w-4 h-4" />
                    Receitas
                </button>
                <div className="relative flex-1 group">
                    <button
                        onClick={() => userLevel >= 2 && setActiveTab('transfers')}
                        disabled={userLevel < 2}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                            activeTab === 'transfers'
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : userLevel < 2
                                    ? "text-neutral-600 cursor-not-allowed bg-neutral-800/50"
                                    : "text-neutral-400 hover:text-neutral-200"
                        )}
                    >
                        <ArrowLeftRight className="w-4 h-4" />
                        Transf.
                        {userLevel < 2 && <span className="ml-1 text-[10px] bg-neutral-700 text-neutral-400 px-1.5 py-0.5 rounded">Lvl 2</span>}
                    </button>
                </div>
                <div className="relative flex-1 group">
                    <button
                        onClick={() => userLevel >= 2 && setActiveTab('recurring')}
                        disabled={userLevel < 2}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                            activeTab === 'recurring'
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                : userLevel < 2
                                    ? "text-neutral-600 cursor-not-allowed bg-neutral-800/50"
                                    : "text-neutral-400 hover:text-neutral-200"
                        )}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recorr.
                        {userLevel < 2 && <span className="ml-1 text-[10px] bg-neutral-700 text-neutral-400 px-1.5 py-0.5 rounded">Lvl 2</span>}
                    </button>
                </div>
            </div>

            {/* Dica sobre Edição Manual */}
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 flex items-start gap-3">
                <div className="p-1.5 bg-blue-500/10 rounded-full mt-0.5">
                    <Pencil className="w-3 h-3 text-blue-400" />
                </div>
                <div>
                    <p className="text-base text-blue-200 font-medium">Ajuste Fino</p>
                    <p className="text-sm text-blue-300/80 mt-0.5">
                        Use os botões <span className="inline-flex items-center justify-center w-5 h-5 bg-neutral-800 rounded border border-neutral-700 mx-1"><Plus className="w-3 h-3" /></span>, <span className="inline-flex items-center justify-center w-5 h-5 bg-neutral-800 rounded border border-neutral-700 mx-1"><Pencil className="w-3 h-3" /></span> e <span className="inline-flex items-center justify-center w-5 h-5 bg-neutral-800 rounded border border-neutral-700 mx-1"><Trash2 className="w-3 h-3" /></span> para corrigir ou complementar o que a IA registrou.
                    </p>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : activeTab === 'recurring' ? (
                <RecurringTab
                    recurrences={recurrences}
                    onRefresh={loadData}
                    accounts={accounts}
                    categories={categories}
                    creditCards={creditCards}
                />
            ) : activeTab === 'transfers' ? (
                <TransfersTab
                    movements={movements}
                    onDelete={handleDeleteMovement}
                    onRefresh={loadData}
                    accounts={accounts}
                />
            ) : (
                <MovementsTab
                    movements={movements}
                    type={activeTab as 'expenses' | 'income'}
                    onDelete={handleDeleteMovement}
                    onRefresh={loadData}
                    accounts={accounts}
                    categories={categories}
                    creditCards={creditCards}
                />
            )}
        </div>
    );
}

// ============ MOVEMENTS TAB ============
function MovementsTab({ movements, type, onDelete, onRefresh, accounts, categories, creditCards }: {
    movements: Movement[];
    type: 'expenses' | 'income';
    onDelete: (id: string) => void;
    onRefresh: () => void;
    accounts: Account[];
    categories: Category[];
    creditCards: CreditCard[];
}) {
    const isExpense = type === 'expenses';
    const [showForm, setShowForm] = useState(false);
    const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        is_paid: true,
        account_id: '',
        category_id: '',
        card_id: ''
    });
    const [saving, setSaving] = useState(false);

    const resetForm = () => {
        setFormData({
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            due_date: '',
            is_paid: true,
            account_id: '',
            category_id: '',
            card_id: ''
        });
    };

    const handleCreate = async () => {
        if (!formData.description || !formData.amount) return;
        setSaving(true);
        try {
            await createMovementManual({
                description: formData.description,
                amount: parseFloat(formData.amount),
                type: isExpense ? 'expense' : 'income',
                date: formData.date,
                due_date: formData.due_date || undefined,
                is_paid: formData.is_paid,
                account_id: formData.account_id || undefined,
                category_id: formData.category_id || undefined,
                card_id: formData.card_id || undefined
            });
            setShowForm(false);
            resetForm();
            onRefresh();
        } catch (e) {
            console.error(e);
            alert('Erro ao criar movimentação');
        }
        setSaving(false);
    };

    const handleEdit = (mov: Movement) => {
        setEditingMovement(mov);
        setFormData({
            description: mov.description,
            amount: mov.amount.toString(),
            date: mov.date.split('T')[0],
            due_date: mov.due_date?.split('T')[0] || '',
            is_paid: mov.is_paid,
            account_id: mov.account_id || '',
            category_id: mov.category_id || '',
            card_id: mov.card_id || ''
        });
    };

    const handleUpdate = async () => {
        if (!editingMovement || !formData.description || !formData.amount) return;
        setSaving(true);
        try {
            await updateMovement(editingMovement.id, {
                description: formData.description,
                amount: parseFloat(formData.amount),
                date: formData.date,
                due_date: formData.due_date || undefined,
                is_paid: formData.is_paid,
                account_id: formData.account_id || undefined,
                category_id: formData.category_id || undefined,
                card_id: formData.card_id || undefined
            });
            setEditingMovement(null);
            resetForm();
            onRefresh();
        } catch (e) {
            console.error(e);
            alert('Erro ao atualizar movimentação');
        }
        setSaving(false);
    };

    const colorClass = isExpense ? 'red' : 'green';

    return (
        <div className="space-y-4">
            {/* Add Button */}
            <button
                onClick={() => { setShowForm(true); resetForm(); }}
                className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all",
                    isExpense
                        ? "border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/5"
                        : "border-green-500/30 text-green-400 hover:border-green-500/50 hover:bg-green-500/5"
                )}
            >
                <Plus className="w-5 h-5" />
                Adicionar {isExpense ? 'Despesa' : 'Receita'}
            </button>

            {/* Add/Edit Form */}
            {(showForm || editingMovement) && (
                <div className={cn(
                    "border rounded-xl p-4 space-y-4",
                    isExpense ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"
                )}>
                    <div className="flex items-center justify-between">
                        <h3 className={cn("font-semibold", isExpense ? "text-red-400" : "text-green-400")}>
                            {editingMovement ? 'Editar' : 'Nova'} {isExpense ? 'Despesa' : 'Receita'}
                        </h3>
                        <button
                            onClick={() => { setShowForm(false); setEditingMovement(null); resetForm(); }}
                            className="p-1 text-neutral-400 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Descrição"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className={cn(
                            "w-full bg-neutral-800 border rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none",
                            isExpense ? "border-red-500/30 focus:border-red-500" : "border-green-500/30 focus:border-green-500"
                        )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            placeholder="Valor"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className={cn(
                                "bg-neutral-800 border rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none",
                                isExpense ? "border-red-500/30 focus:border-red-500" : "border-green-500/30 focus:border-green-500"
                            )}
                        />
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className={cn(
                                "bg-neutral-800 border rounded-lg px-4 py-3 text-white focus:outline-none",
                                isExpense ? "border-red-500/30 focus:border-red-500" : "border-green-500/30 focus:border-green-500"
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={formData.card_id ? `card:${formData.card_id}` : formData.account_id ? `account:${formData.account_id}` : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                    setFormData({ ...formData, account_id: '', card_id: '' });
                                } else if (val.startsWith('account:')) {
                                    setFormData({ ...formData, account_id: val.split(':')[1], card_id: '' });
                                } else if (val.startsWith('card:')) {
                                    setFormData({ ...formData, account_id: '', card_id: val.split(':')[1] });
                                }
                            }}
                            className={cn(
                                "bg-neutral-800 border rounded-lg px-4 py-3 text-white focus:outline-none",
                                isExpense ? "border-red-500/30 focus:border-red-500" : "border-green-500/30 focus:border-green-500"
                            )}
                        >
                            <option value="">Selecione Onde</option>
                            <optgroup label="Contas">
                                {accounts.map(acc => (
                                    <option key={acc.id} value={`account:${acc.id}`}>{acc.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Cartões de Crédito">
                                {creditCards.map(card => (
                                    <option key={card.id} value={`card:${card.id}`}>{card.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        <select
                            value={formData.category_id}
                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            className={cn(
                                "bg-neutral-800 border rounded-lg px-4 py-3 text-white focus:outline-none",
                                isExpense ? "border-red-500/30 focus:border-red-500" : "border-green-500/30 focus:border-green-500"
                            )}
                        >
                            <option value="">Selecione a Categoria</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-neutral-300">
                        <input
                            type="checkbox"
                            checked={formData.is_paid}
                            onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked, due_date: e.target.checked ? '' : formData.due_date })}
                            className="w-4 h-4 rounded"
                        />
                        {isExpense ? 'Já foi pago' : 'Já foi recebido'}
                    </label>

                    {/* Due Date - Show only when not paid */}
                    {!formData.is_paid && (
                        <div className="space-y-1">
                            <label className="text-sm text-neutral-400">Data de Vencimento</label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                className={cn(
                                    "w-full bg-neutral-800 border rounded-lg px-4 py-3 text-white focus:outline-none",
                                    isExpense ? "border-orange-500/30 focus:border-orange-500" : "border-blue-500/30 focus:border-blue-500"
                                )}
                            />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowForm(false); setEditingMovement(null); resetForm(); }}
                            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={editingMovement ? handleUpdate : handleCreate}
                            disabled={saving || !formData.description || !formData.amount}
                            className={cn(
                                "flex-1 py-2.5 rounded-lg text-white font-semibold disabled:opacity-50",
                                isExpense ? "bg-red-500 hover:bg-red-400" : "bg-green-500 hover:bg-green-400"
                            )}
                        >
                            {saving ? 'Salvando...' : (editingMovement ? 'Atualizar' : 'Salvar')}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {movements.length === 0 && !showForm && (
                <div className="text-center py-12 text-neutral-500">
                    {isExpense ? <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" /> : <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />}
                    <p>Nenhuma {isExpense ? 'despesa' : 'receita'} neste mês</p>
                    <p className="text-sm mt-1">Use o botão acima ou a IA: "Gastei 50 no almoço"</p>
                </div>
            )}

            {/* Movements List */}
            {movements.length > 0 && (
                <div className="space-y-3">
                    {movements.map((mov) => (
                        <div key={mov.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                isExpense ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-green-500/10 border border-green-500/20 text-green-400"
                            )}>
                                {isExpense ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-white">{mov.description}</p>
                                <p className="text-xs text-neutral-500">
                                    {new Date(mov.date).toLocaleDateString('pt-BR')}
                                    {mov.account_name && (
                                        <span className="ml-2 text-neutral-400">• {mov.account_name}</span>
                                    )}
                                    {!mov.is_paid && mov.due_date && (
                                        <span className="ml-2 text-orange-400">
                                            📅 vence {new Date(mov.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                    )}
                                    {!mov.is_paid && <span className="ml-2 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px]">Pendente</span>}
                                    {mov.is_loan && <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">Empréstimo</span>}
                                    {mov.is_reserve && <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">Reserva</span>}
                                    {mov.card_id && <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">Cartão</span>}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={cn("font-semibold", isExpense ? "text-red-400" : "text-green-400")}>
                                    {isExpense ? '-' : '+'} R$ {mov.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button
                                onClick={() => handleEdit(mov)}
                                disabled={mov.description?.includes('→') || mov.description?.includes('←')}
                                className={cn(
                                    "p-2 transition-colors",
                                    (mov.description?.includes('→') || mov.description?.includes('←'))
                                        ? "text-neutral-700 cursor-not-allowed"
                                        : "text-neutral-500 hover:text-yellow-400"
                                )}
                                title={(mov.description?.includes('→') || mov.description?.includes('←')) ? "Transferências não podem ser editadas" : "Editar"}
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(mov.id)}
                                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                                title="Excluir"
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

// ============ RECURRING TAB ============
function RecurringTab({ recurrences, onRefresh, accounts, categories, creditCards }: {
    recurrences: Recurrence[];
    onRefresh: () => void;
    accounts: Account[];
    categories: Category[];
    creditCards: CreditCard[];
}) {
    const [showForm, setShowForm] = useState(false);
    const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: 'expense' as 'income' | 'expense',
        frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly',
        next_due_date: new Date().toISOString().split('T')[0],
        account_id: '',
        category_id: '',
        card_id: ''
    });
    const [saving, setSaving] = useState(false);

    const resetForm = () => {
        setFormData({
            description: '',
            amount: '',
            type: 'expense',
            frequency: 'monthly',
            next_due_date: new Date().toISOString().split('T')[0],
            account_id: '',
            category_id: '',
            card_id: ''
        });
    };

    const handleCreate = async () => {
        if (!formData.description || !formData.amount) return;
        setSaving(true);
        try {
            await createRecurrence({
                description: formData.description,
                amount: parseFloat(formData.amount),
                type: formData.type,
                frequency: formData.frequency,
                next_due_date: formData.next_due_date,
                account_id: formData.account_id || undefined,
                category_id: formData.category_id || undefined,
                card_id: formData.card_id || undefined
            });
            setShowForm(false);
            resetForm();
            onRefresh();
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    const handleEdit = (rec: Recurrence) => {
        setEditingRecurrence(rec);
        setFormData({
            description: rec.description,
            amount: rec.amount.toString(),
            type: rec.type,
            frequency: rec.frequency,
            next_due_date: rec.next_due_date.split('T')[0],
            account_id: rec.account_id || '',
            category_id: rec.category_id || '',
            card_id: rec.card_id || ''
        });
    };

    const handleUpdate = async () => {
        if (!editingRecurrence || !formData.description || !formData.amount) return;
        setSaving(true);
        try {
            await updateRecurrence(editingRecurrence.id, {
                description: formData.description,
                amount: parseFloat(formData.amount),
                type: formData.type,
                frequency: formData.frequency,
                next_due_date: formData.next_due_date,
                account_id: formData.account_id || undefined,
                category_id: formData.category_id || undefined,
                card_id: formData.card_id || undefined
            });
            setEditingRecurrence(null);
            resetForm();
            onRefresh();
        } catch (e) {
            console.error(e);
            alert('Erro ao atualizar recorrência');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta recorrência?')) return;
        await deleteRecurrence(id);
        onRefresh();
    };

    return (
        <div className="space-y-4">
            {/* Add Button */}
            <button
                onClick={() => { setShowForm(true); setEditingRecurrence(null); resetForm(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-purple-500/50 hover:text-purple-400 transition-all"
            >
                <Plus className="w-5 h-5" />
                Adicionar Recorrente
            </button>

            {/* Form */}
            {(showForm || editingRecurrence) && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
                    <input
                        type="text"
                        placeholder="Descrição (ex: Netflix)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            placeholder="Valor"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500"
                        />
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={formData.frequency}
                            onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="monthly">Mensal</option>
                            <option value="weekly">Semanal</option>
                            <option value="yearly">Anual</option>
                        </select>
                        <div className="relative">
                            <input
                                type="date"
                                value={formData.next_due_date}
                                onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                                disabled={!!formData.card_id}
                                className={cn(
                                    "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500",
                                    formData.card_id && "opacity-60 cursor-not-allowed"
                                )}
                            />
                            {formData.card_id && (
                                <p className="text-xs text-purple-400 mt-1">
                                    📅 Vence todo dia {creditCards.find(c => c.id === formData.card_id)?.due_day}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={formData.card_id ? `card:${formData.card_id}` : formData.account_id ? `account:${formData.account_id}` : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                    setFormData({ ...formData, account_id: '', card_id: '' });
                                } else if (val.startsWith('account:')) {
                                    setFormData({ ...formData, account_id: val.split(':')[1], card_id: '' });
                                } else if (val.startsWith('card:')) {
                                    const cardId = val.split(':')[1];
                                    const selectedCard = creditCards.find(c => c.id === cardId);
                                    if (selectedCard) {
                                        // Calcular próxima data de vencimento baseada no due_day do cartão
                                        const today = new Date();
                                        const dueDay = selectedCard.due_day;
                                        let dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

                                        // Se o dia de vencimento já passou neste mês, usar o próximo mês
                                        if (dueDate <= today) {
                                            dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
                                        }

                                        const formattedDate = dueDate.toISOString().split('T')[0];
                                        setFormData({ ...formData, account_id: '', card_id: cardId, next_due_date: formattedDate });
                                    } else {
                                        setFormData({ ...formData, account_id: '', card_id: cardId });
                                    }
                                }
                            }}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="">Selecione Onde</option>
                            <optgroup label="Contas">
                                {accounts.map(acc => (
                                    <option key={acc.id} value={`account:${acc.id}`}>{acc.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Cartões de Crédito">
                                {creditCards.map(card => (
                                    <option key={card.id} value={`card:${card.id}`}>{card.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        <select
                            value={formData.category_id}
                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="">Selecione a Categoria</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowForm(false); setEditingRecurrence(null); resetForm(); }}
                            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={editingRecurrence ? handleUpdate : handleCreate}
                            disabled={saving || !formData.description || !formData.amount}
                            className="flex-1 py-2.5 rounded-lg bg-purple-500 text-white font-semibold hover:bg-purple-400 disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : (editingRecurrence ? 'Atualizar' : 'Salvar')}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {recurrences.length === 0 && !showForm ? (
                <div className="text-center py-12 text-neutral-500">
                    <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma recorrência cadastrada</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {recurrences.map((rec) => (
                        <div key={rec.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                rec.type === 'expense'
                                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                    : "bg-green-500/10 border border-green-500/20 text-green-400"
                            )}>
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-white">{rec.description}</p>
                                <p className="text-xs text-neutral-500">
                                    {rec.frequency === 'monthly' ? 'Mensal' : rec.frequency === 'weekly' ? 'Semanal' : 'Anual'}
                                    {' • '}Próximo: {new Date(rec.next_due_date).toLocaleDateString('pt-BR')}
                                    {rec.is_auto_debit && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                                            ⚡ DA{rec.account_name ? ` • ${rec.account_name}` : ''}
                                        </span>
                                    )}
                                    {rec.card_id && <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">Cartão</span>}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={cn("font-semibold", rec.type === 'expense' ? "text-red-400" : "text-green-400")}>
                                    {rec.type === 'expense' ? '-' : '+'} R$ {rec.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button
                                onClick={() => handleEdit(rec)}
                                className="p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                                title="Editar"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(rec.id)}
                                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                                title="Excluir"
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

// ============ TRANSFERS TAB ============
function TransfersTab({ movements, onDelete, onRefresh, accounts }: {
    movements: Movement[];
    onDelete: (id: string) => void;
    onRefresh: () => void;
    accounts: Account[];
}) {
    const [showForm, setShowForm] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState<Movement | null>(null);
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        fromAccountId: '',
        toAccountId: '',
        description: ''
    });
    const [saving, setSaving] = useState(false);

    // Filter only OUT transfers (contain →) to avoid duplicates
    const outTransfers = movements.filter(m => m.description?.includes('→'));

    const resetForm = () => {
        setFormData({
            amount: '',
            date: new Date().toISOString().split('T')[0],
            fromAccountId: '',
            toAccountId: '',
            description: ''
        });
    };

    const handleCreate = async () => {
        if (!formData.amount || !formData.fromAccountId || !formData.toAccountId) return;

        if (formData.fromAccountId === formData.toAccountId) {
            alert('A conta de origem e destino devem ser diferentes.');
            return;
        }

        setSaving(true);
        try {
            const result = await createTransfer({
                fromAccountId: formData.fromAccountId,
                toAccountId: formData.toAccountId,
                amount: parseFloat(formData.amount),
                description: formData.description || undefined,
                date: formData.date
            });

            if (result.success) {
                setShowForm(false);
                resetForm();
                onRefresh();
            } else {
                alert(result.error || 'Erro ao criar transferência');
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao criar transferência');
        }
        setSaving(false);
    };

    const handleEdit = (mov: Movement) => {
        setEditingTransfer(mov);
        setFormData({
            ...formData,
            amount: mov.amount.toString(),
            date: mov.date.split('T')[0]
        });
    };

    const handleUpdate = async () => {
        if (!editingTransfer || !formData.amount) return;
        setSaving(true);
        try {
            await updateMovement(editingTransfer.id, {
                amount: parseFloat(formData.amount),
                date: formData.date
            });
            setEditingTransfer(null);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert('Erro ao atualizar transferência');
        }
        setSaving(false);
    };

    return (
        <div className="space-y-4">
            {/* Add Button */}
            <button
                onClick={() => { setShowForm(true); setEditingTransfer(null); resetForm(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-blue-500/50 hover:text-blue-400 transition-all"
            >
                <Plus className="w-5 h-5" />
                Nova Transferência
            </button>

            {/* Create Form */}
            {showForm && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-blue-400">Nova Transferência</h3>
                        <button
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="p-1 text-neutral-400 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-400 ml-1">De (Origem)</label>
                            <select
                                value={formData.fromAccountId}
                                onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
                                className="w-full bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Selecione...</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-400 ml-1">Para (Destino)</label>
                            <select
                                value={formData.toAccountId}
                                onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                className="w-full bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Selecione...</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            placeholder="Valor"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                        />
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <input
                        type="text"
                        placeholder="Descrição (opcional)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={saving || !formData.amount || !formData.fromAccountId || !formData.toAccountId}
                            className="flex-1 py-2.5 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-400 disabled:opacity-50"
                        >
                            {saving ? 'Transferindo...' : 'Confirmar Transferência'}
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Form */}
            {editingTransfer && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-blue-400">Editar Transferência</h3>
                        <button
                            onClick={() => setEditingTransfer(null)}
                            className="p-1 text-neutral-400 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            placeholder="Valor"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                        />
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="bg-neutral-800 border border-blue-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditingTransfer(null)}
                            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={saving || !formData.amount}
                            className="flex-1 py-2.5 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-400 disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : 'Atualizar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {outTransfers.length === 0 && (
                <div className="text-center py-12 text-neutral-500">
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma transferência neste mês</p>
                    <p className="text-sm mt-1">Use a IA: "Transferi 500 da Carteira pro Itaú"</p>
                </div>
            )}

            {/* Transfers List */}
            {outTransfers.length > 0 && (
                <div className="space-y-3">
                    {outTransfers.map((mov) => {
                        // Parse transfer description to get source and destination
                        // Format: "Transferência → Conta Destino" (OUT) registered on source account
                        const parts = mov.description?.split('→') || [];
                        const prefix = parts[0]?.trim() || 'Transferência';
                        const destination = parts[1]?.trim() || 'Destino';
                        const source = mov.account_name || 'Origem';

                        return (
                            <div key={mov.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                    <ArrowLeftRight className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-white">
                                        {source} → {destination}
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        {new Date(mov.date).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-blue-400">
                                        R$ {mov.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleEdit(mov)}
                                    className="p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(mov.id)}
                                    className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
