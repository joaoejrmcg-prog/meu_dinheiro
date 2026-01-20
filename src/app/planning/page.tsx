"use client";

import { useState, useEffect } from "react";
import { Target, Plus, Trash2, PiggyBank, TrendingUp, TrendingDown, Sparkles, Calendar, RefreshCw, AlertCircle, ArrowRight, Banknote, X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getReserves, createReserve, deleteReserve, addToReserve } from "../actions/planning";
import { getRecurrences, getMonthSummary, getBalanceProjection, MonthProjection } from "../actions/financial";
import { getLoans, createLoan, deleteLoan, registerLoanPayment } from "../actions/loans";
import { Reserve, Recurrence, Loan } from "../types";
import { cn } from "../lib/utils";

type Tab = 'goals' | 'commitments' | 'forecast' | 'loans';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const COLORS = [
    { name: 'Verde', value: '#22c55e' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Roxo', value: '#a855f7' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Laranja', value: '#f97316' },
    { name: 'Amarelo', value: '#eab308' },
];

export default function PlanningPage() {
    const [activeTab, setActiveTab] = useState<Tab>('goals');
    const [reserves, setReserves] = useState<Reserve[]>([]);
    const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [reservesData, recurrencesData, loansData] = await Promise.all([
            getReserves(),
            getRecurrences(),
            getLoans()
        ]);
        setReserves(reservesData);
        setRecurrences(recurrencesData);
        setLoans(loansData);
        setLoading(false);
    };

    const totalSaved = reserves.reduce((sum, r) => sum + (r.current_amount || 0), 0);
    const totalCommitments = recurrences.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Planejamento</h1>
                    <p className="text-neutral-500 text-sm">Metas, compromissos e previsão</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                        <p className="text-xs text-neutral-400">Guardado</p>
                        <p className="text-lg font-bold text-green-400">
                            R$ {totalSaved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                        <p className="text-xs text-neutral-400">Fixos/Mês</p>
                        <p className="text-lg font-bold text-red-400">
                            R$ {totalCommitments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
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
                    <Link href="/?tip=planejamento" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Quero economizar 500 reais por mês"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                    <Link href="/?tip=planejamento" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Planejar viagem para Disney em dezembro"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                    <Link href="/?tip=planejamento" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Reduzir gastos com ifood"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                    <Link href="/?tip=planejamento" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Meta de reserva de emergência"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-neutral-900 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('goals')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'goals'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <Target className="w-4 h-4" />
                    <span className="hidden md:inline">Metas e Reserva</span>
                    <span className="md:hidden">Metas</span>
                </button>
                <button
                    onClick={() => setActiveTab('commitments')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'commitments'
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <Calendar className="w-4 h-4" />
                    Fixos
                </button>
                <button
                    onClick={() => setActiveTab('forecast')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'forecast'
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <TrendingUp className="w-4 h-4" />
                    Previsão
                </button>
                <button
                    onClick={() => setActiveTab('loans')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all",
                        activeTab === 'loans'
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    <Banknote className="w-4 h-4" />
                    Empréstimos
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : activeTab === 'goals' ? (
                <GoalsTab reserves={reserves} onRefresh={loadData} />
            ) : activeTab === 'commitments' ? (
                <CommitmentsTab recurrences={recurrences.filter(r => r.type === 'expense')} />
            ) : activeTab === 'forecast' ? (
                <ForecastTab recurrences={recurrences} />
            ) : (
                <LoansTab loans={loans} onRefresh={loadData} />
            )}


        </div>
    );
}

// ============ GOALS TAB ============
function GoalsTab({ reserves, onRefresh }: { reserves: Reserve[]; onRefresh: () => void }) {
    const [showForm, setShowForm] = useState(false);

    return (
        <div className="space-y-4">
            <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-green-500/50 hover:text-green-400 transition-all"
            >
                <Plus className="w-5 h-5" />
                Criar Nova Meta
            </button>

            {showForm && (
                <ReserveForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); onRefresh(); }} />
            )}

            {reserves.length === 0 && !showForm ? (
                <div className="text-center py-12 text-neutral-500">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma meta criada</p>
                    <p className="text-sm mt-1">Crie metas como "Viagem", "IPVA", "Reserva de Emergência"</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {reserves.map((reserve) => (
                        <ReserveCard key={reserve.id} reserve={reserve} onRefresh={onRefresh} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============ COMMITMENTS TAB ============
function CommitmentsTab({ recurrences }: { recurrences: Recurrence[] }) {
    if (recurrences.length === 0) {
        return (
            <div className="text-center py-12 text-neutral-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum compromisso fixo</p>
                <p className="text-sm mt-1">Cadastre em Financeiro &gt; Recorrentes</p>
            </div>
        );
    }

    const totalMonth = recurrences.reduce((sum, r) => sum + r.amount, 0);

    return (
        <div className="space-y-4">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <p className="text-sm text-neutral-400">Total de Compromissos Fixos</p>
                <p className="text-2xl font-bold text-orange-400">
                    R$ {totalMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
                </p>
            </div>

            <div className="space-y-3">
                {recurrences.map((rec) => (
                    <div key={rec.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                            <RefreshCw className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-white">{rec.description}</p>
                            <p className="text-xs text-neutral-500">
                                {rec.frequency === 'monthly' ? 'Mensal' : rec.frequency === 'weekly' ? 'Semanal' : 'Anual'}
                                {' • '}Próximo: {new Date(rec.next_due_date).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                        <p className="font-semibold text-red-400">
                            R$ {rec.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============ FORECAST TAB ============
function ForecastTab({ recurrences }: { recurrences: Recurrence[] }) {
    const [projection, setProjection] = useState<{
        currentBalance: number;
        monthlyAverages: { income: number; expense: number; surplus: number };
        projections: MonthProjection[];
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjection();
    }, []);

    const loadProjection = async () => {
        setLoading(true);
        const data = await getBalanceProjection(6);
        setProjection(data);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!projection) return null;

    const { currentBalance, monthlyAverages, projections } = projection;
    const maxBalance = Math.max(...projections.map(p => Math.abs(p.projectedBalance)), Math.abs(currentBalance));
    const hasNegativeMonth = projections.some(p => p.projectedBalance < 0);

    return (
        <div className="space-y-4">
            {/* Current Balance */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-sm text-neutral-400 mb-1">Saldo Atual (todas as contas)</p>
                <p className={cn("text-2xl font-bold", currentBalance >= 0 ? "text-blue-400" : "text-red-400")}>
                    R$ {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
            </div>

            {/* Monthly Averages */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-neutral-500">Média Receita</p>
                    <p className="text-sm font-bold text-green-400">
                        R$ {monthlyAverages.income.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-neutral-500">Média Despesa</p>
                    <p className="text-sm font-bold text-red-400">
                        R$ {monthlyAverages.expense.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-neutral-500">Sobra/mês</p>
                    <p className={cn("text-sm font-bold", monthlyAverages.surplus >= 0 ? "text-blue-400" : "text-red-400")}>
                        R$ {monthlyAverages.surplus.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* Projection Chart */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <h4 className="font-medium text-neutral-300 mb-4">Projeção para os próximos 6 meses</h4>
                <div className="space-y-3">
                    {projections.map((p, idx) => {
                        const barWidth = maxBalance > 0 ? (Math.abs(p.projectedBalance) / maxBalance) * 100 : 0;
                        const isNegative = p.projectedBalance < 0;

                        return (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-neutral-400">{p.month}</span>
                                    <span className={isNegative ? "text-red-400 font-medium" : "text-blue-400"}>
                                        R$ {p.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            isNegative ? "bg-red-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-neutral-600">
                                    <span>+{p.expectedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                                    <span>-{p.expectedExpense.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                                    <span className={p.netChange >= 0 ? "text-green-500" : "text-red-500"}>
                                        {p.netChange >= 0 ? "+" : ""}{p.netChange.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Alert */}
            {hasNegativeMonth && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                        <p className="font-medium text-red-400">Atenção</p>
                        <p className="text-sm text-neutral-400">
                            Sua projeção indica saldo negativo em alguns meses. Considere reduzir despesas ou aumentar receitas.
                        </p>
                    </div>
                </div>
            )}

            {/* Summary */}
            {projections.length > 0 && projections[projections.length - 1].projectedBalance > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <p className="text-sm text-neutral-400">Em 6 meses você terá aproximadamente:</p>
                    <p className="text-xl font-bold text-green-400">
                        R$ {projections[projections.length - 1].projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            )}
        </div>
    );
}

// ============ RESERVE FORM ============
function ReserveForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({ name: '', target_amount: '', current_amount: '', color: '#22c55e', deadline: '' });
    const [saving, setSaving] = useState(false);

    // Calculate monthly savings needed
    const calculateMonthlySavings = () => {
        const target = parseFloat(formData.target_amount) || 0;
        const current = parseFloat(formData.current_amount) || 0;
        const remaining = target - current;

        if (!formData.deadline || remaining <= 0) return null;

        const deadlineDate = new Date(formData.deadline);
        const today = new Date();
        const monthsLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)));

        return remaining / monthsLeft;
    };

    const monthlySavings = calculateMonthlySavings();

    const handleCreate = async () => {
        if (!formData.name) return;
        setSaving(true);
        try {
            await createReserve({
                name: formData.name,
                target_amount: parseFloat(formData.target_amount) || undefined,
                current_amount: parseFloat(formData.current_amount) || 0,
                color: formData.color,
                deadline: formData.deadline || undefined
            });
            onSuccess();
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
            <input type="text" placeholder="Nome da meta (ex: Viagem, IPVA)" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
            />
            <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Meta (R$)" value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                />
                <input type="number" placeholder="Já guardei (R$)" value={formData.current_amount}
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                />
            </div>
            <div>
                <label className="text-xs text-neutral-400 mb-1 block">Prazo (opcional)</label>
                <input type="date" value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500"
                />
            </div>

            {/* Monthly savings calculation */}
            {monthlySavings !== null && monthlySavings > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                    <p className="text-sm text-neutral-400">Para atingir sua meta:</p>
                    <p className="text-lg font-bold text-green-400">
                        Guardar R$ {monthlySavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
                    </p>
                </div>
            )}

            <div className="flex gap-2">
                {COLORS.map((c) => (
                    <button key={c.value} onClick={() => setFormData({ ...formData, color: c.value })}
                        className={cn("w-8 h-8 rounded-full border-2 transition-all", formData.color === c.value ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100")}
                        style={{ backgroundColor: c.value }} title={c.name}
                    />
                ))}
            </div>
            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700">Cancelar</button>
                <button onClick={handleCreate} disabled={saving || !formData.name}
                    className="flex-1 py-2.5 rounded-lg bg-green-500 text-black font-semibold hover:bg-green-400 disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Criar Meta'}
                </button>
            </div>
        </div>
    );
}

// ============ RESERVE CARD ============
function ReserveCard({ reserve, onRefresh }: { reserve: Reserve; onRefresh: () => void }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [addAmount, setAddAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [saving, setSaving] = useState(false);

    const progress = reserve.target_amount ? Math.min(100, ((reserve.current_amount || 0) / reserve.target_amount) * 100) : 0;

    // Calculate monthly savings needed
    const calculateMonthlySavings = () => {
        if (!reserve.target_amount || !reserve.deadline) return null;
        const remaining = reserve.target_amount - (reserve.current_amount || 0);
        if (remaining <= 0) return null;

        const deadlineDate = new Date(reserve.deadline);
        const today = new Date();
        const monthsLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)));

        return { monthly: remaining / monthsLeft, monthsLeft, remaining };
    };

    const savingsInfo = calculateMonthlySavings();
    const isOverdue = reserve.deadline && new Date(reserve.deadline) < new Date() && progress < 100;

    const handleAdd = async () => {
        if (!addAmount) return;
        setSaving(true);
        try {
            await addToReserve(reserve.id, parseFloat(addAmount));
            setShowAddModal(false);
            setAddAmount('');
            onRefresh();
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const handleWithdraw = async () => {
        if (!withdrawAmount) return;
        const amount = parseFloat(withdrawAmount);
        if (amount > reserve.current_amount) {
            alert('Saldo insuficiente na meta.');
            return;
        }
        setSaving(true);
        try {
            await addToReserve(reserve.id, -amount);
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            onRefresh();
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('Excluir esta meta?')) return;
        await deleteReserve(reserve.id);
        onRefresh();
    };

    return (
        <div className={cn(
            "border rounded-xl p-4 space-y-4",
            isOverdue ? "bg-red-500/5 border-red-500/20" : "bg-neutral-900 border-neutral-800"
        )}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${reserve.color}20`, borderColor: `${reserve.color}40`, borderWidth: 1 }}>
                        <PiggyBank className="w-5 h-5" style={{ color: reserve.color }} />
                    </div>
                    <div>
                        <p className="font-medium text-white">{reserve.name}</p>
                        <div className="text-xs text-neutral-500 flex items-center gap-2">
                            {reserve.target_amount && (
                                <span>Meta: R$ {reserve.target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            )}
                            {reserve.deadline && (
                                <span className={isOverdue ? "text-red-400" : ""}>
                                    • {isOverdue ? "Vencido" : `Até ${new Date(reserve.deadline).toLocaleDateString('pt-BR')}`}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={handleDelete} className="p-2 text-neutral-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {reserve.target_amount && (
                <div className="space-y-2">
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: reserve.color, width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                        <span style={{ color: reserve.color }}>{progress.toFixed(0)}%</span>
                        <span className="text-neutral-500">
                            R$ {(reserve.current_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {reserve.target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            )}

            {/* Monthly savings info */}
            {savingsInfo && !isOverdue && (
                <div className="bg-neutral-800/50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-neutral-400">Guardar </span>
                    <span className="font-medium text-green-400">R$ {savingsInfo.monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                    <span className="text-neutral-400"> ({savingsInfo.monthsLeft} meses)</span>
                </div>
            )}

            {!reserve.target_amount && (
                <p className="text-lg font-bold" style={{ color: reserve.color }}>
                    R$ {(reserve.current_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
            )}

            {/* Action Buttons */}
            {!showAddModal && !showWithdrawModal ? (
                <div className="flex gap-2">
                    <button onClick={() => setShowAddModal(true)}
                        className="flex-1 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-sm hover:border-green-500/50 hover:text-green-400 transition-all flex items-center justify-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Adicionar
                    </button>
                    {reserve.current_amount > 0 && (
                        <button onClick={() => setShowWithdrawModal(true)}
                            className="flex-1 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-sm hover:border-orange-500/50 hover:text-orange-400 transition-all flex items-center justify-center gap-2">
                            <TrendingDown className="w-4 h-4" /> Resgatar
                        </button>
                    )}
                </div>
            ) : showAddModal ? (
                <div className="flex gap-2">
                    <input type="number" placeholder="Valor" value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" autoFocus />
                    <button onClick={() => setShowAddModal(false)} className="px-3 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-sm">✕</button>
                    <button onClick={handleAdd} disabled={saving || !addAmount}
                        className="px-4 py-2 rounded-lg bg-green-500 text-black font-semibold text-sm disabled:opacity-50">{saving ? '...' : '+'}</button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <input type="number" placeholder="Valor" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" autoFocus />
                    <button onClick={() => setShowWithdrawModal(false)} className="px-3 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-sm">✕</button>
                    <button onClick={handleWithdraw} disabled={saving || !withdrawAmount}
                        className="px-4 py-2 rounded-lg bg-orange-500 text-black font-semibold text-sm disabled:opacity-50">{saving ? '...' : '-'}</button>
                </div>
            )}
        </div>
    );
}

// ============ LOANS TAB ============
function LoansTab({ loans, onRefresh }: { loans: Loan[]; onRefresh: () => void }) {
    const [showForm, setShowForm] = useState(false);

    const activeLoans = loans.filter(l => l.remaining_amount > 0);
    const paidLoans = loans.filter(l => l.remaining_amount === 0);

    const totalOwed = loans.filter(l => l.type === 'taken' && l.remaining_amount > 0)
        .reduce((sum, l) => sum + l.remaining_amount, 0);
    const totalToReceive = loans.filter(l => l.type === 'given' && l.remaining_amount > 0)
        .reduce((sum, l) => sum + l.remaining_amount, 0);

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <ArrowDownLeft className="w-3 h-3" /> Devo
                    </p>
                    <p className="text-lg font-bold text-red-400">
                        R$ {totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" /> A receber
                    </p>
                    <p className="text-lg font-bold text-green-400">
                        R$ {totalToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-yellow-500/50 hover:text-yellow-400 transition-all"
            >
                <Plus className="w-5 h-5" />
                Registrar Empréstimo
            </button>

            {showForm && (
                <LoanForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); onRefresh(); }} />
            )}

            {activeLoans.length === 0 && !showForm ? (
                <div className="text-center py-12 text-neutral-500">
                    <Banknote className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum empréstimo ativo</p>
                    <p className="text-sm mt-1">Registre dinheiro que você pegou ou emprestou</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeLoans.map((loan) => (
                        <LoanCard key={loan.id} loan={loan} onRefresh={onRefresh} />
                    ))}
                </div>
            )}

            {paidLoans.length > 0 && (
                <div className="pt-4">
                    <h4 className="text-sm font-medium text-neutral-500 mb-3">Quitados</h4>
                    <div className="space-y-2 opacity-60">
                        {paidLoans.map((loan) => (
                            <LoanCard key={loan.id} loan={loan} onRefresh={onRefresh} isPaid />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============ LOAN FORM ============
function LoanForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        description: '',
        total_amount: '',
        type: 'taken' as 'taken' | 'given',
        due_date: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!formData.description || !formData.total_amount) {
            setError('Preencha descrição e valor');
            return;
        }
        setSaving(true);
        setError('');

        const result = await createLoan({
            description: formData.description,
            total_amount: parseFloat(formData.total_amount),
            type: formData.type,
            due_date: formData.due_date || undefined
        });

        if (result.success) {
            onSuccess();
        } else {
            setError(result.error || 'Erro ao criar empréstimo');
        }
        setSaving(false);
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Novo Empréstimo</h3>
                <button onClick={onClose} className="text-neutral-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Type Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFormData({ ...formData, type: 'taken' })}
                    className={cn(
                        "flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                        formData.type === 'taken'
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-neutral-800 text-neutral-400"
                    )}
                >
                    <ArrowDownLeft className="w-4 h-4" />
                    Peguei emprestado
                </button>
                <button
                    onClick={() => setFormData({ ...formData, type: 'given' })}
                    className={cn(
                        "flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                        formData.type === 'given'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-neutral-800 text-neutral-400"
                    )}
                >
                    <ArrowUpRight className="w-4 h-4" />
                    Emprestei
                </button>
            </div>

            <input
                type="text"
                placeholder={formData.type === 'taken' ? "De quem pegou? (ex: João, Banco)" : "Para quem emprestou?"}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500"
            />

            <div className="grid grid-cols-2 gap-3">
                <input
                    type="number"
                    placeholder="Valor total"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500"
                />
                <input
                    type="date"
                    placeholder="Vencimento"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500"
                />
            </div>

            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700">
                    Cancelar
                </button>
                <button
                    onClick={handleCreate}
                    disabled={saving || !formData.description || !formData.total_amount}
                    className="flex-1 py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 disabled:opacity-50"
                >
                    {saving ? 'Salvando...' : 'Registrar'}
                </button>
            </div>
        </div>
    );
}

// ============ LOAN CARD ============
function LoanCard({ loan, onRefresh, isPaid }: { loan: Loan; onRefresh: () => void; isPaid?: boolean }) {
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const progress = loan.total_amount > 0
        ? ((loan.total_amount - loan.remaining_amount) / loan.total_amount) * 100
        : 0;

    const handlePayment = async () => {
        if (!paymentAmount) return;
        setSaving(true);
        setError('');

        const result = await registerLoanPayment({
            loanId: loan.id,
            amount: parseFloat(paymentAmount)
        });

        if (result.success) {
            setShowPaymentModal(false);
            setPaymentAmount('');
            onRefresh();
        } else {
            setError(result.error || 'Erro ao registrar pagamento');
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('Excluir este empréstimo?')) return;
        await deleteLoan(loan.id);
        onRefresh();
    };

    const isTaken = loan.type === 'taken';
    const color = isTaken ? 'red' : 'green';
    const Icon = isTaken ? ArrowDownLeft : ArrowUpRight;

    return (
        <div className={cn(
            "border rounded-xl p-4 space-y-3",
            isPaid ? "bg-neutral-900/50 border-neutral-800" : `bg-${color}-500/5 border-${color}-500/10`
        )} style={{ backgroundColor: isPaid ? undefined : `${isTaken ? '#ef4444' : '#22c55e'}08`, borderColor: isPaid ? undefined : `${isTaken ? '#ef4444' : '#22c55e'}15` }}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        isTaken ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                    )}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-medium text-white">{loan.description}</p>
                        <p className="text-xs text-neutral-500">
                            {isTaken ? 'Peguei emprestado' : 'Emprestei'}
                            {loan.due_date && ` • Vence: ${new Date(loan.due_date).toLocaleDateString('pt-BR')}`}
                        </p>
                    </div>
                </div>
                <button onClick={handleDelete} className="p-2 text-neutral-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Progress */}
            <div className="space-y-2">
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500", isTaken ? "bg-red-500" : "bg-green-500")}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs">
                    <span className={isTaken ? "text-red-400" : "text-green-400"}>
                        {progress.toFixed(0)}% {isTaken ? 'pago' : 'recebido'}
                    </span>
                    <span className="text-neutral-500">
                        R$ {loan.remaining_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} restante
                    </span>
                </div>
            </div>

            {/* Payment Button */}
            {!isPaid && (
                !showPaymentModal ? (
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className={cn(
                            "w-full py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-2",
                            isTaken
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                        )}
                    >
                        {isTaken ? 'Registrar Pagamento' : 'Registrar Recebimento'}
                    </button>
                ) : (
                    <div className="space-y-2">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">
                                {error}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Valor"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                                autoFocus
                            />
                            <button
                                onClick={() => { setShowPaymentModal(false); setError(''); }}
                                className="px-3 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-sm"
                            >
                                ✕
                            </button>
                            <button
                                onClick={handlePayment}
                                disabled={saving || !paymentAmount}
                                className={cn(
                                    "px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50",
                                    isTaken ? "bg-red-500 text-white" : "bg-green-500 text-black"
                                )}
                            >
                                {saving ? '...' : '✓'}
                            </button>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
