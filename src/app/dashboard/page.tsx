"use client";

import { useState, useEffect } from "react";
import { PieChart, TrendingUp, TrendingDown, Wallet, CreditCard, ArrowRight, Sparkles, CalendarClock, ArrowDownCircle, ArrowUpCircle, LineChart as LineChartIcon } from "lucide-react";
import { getMonthSummary, getMovements, getExpensesByCategory, getPendingSummary, getCashFlowChartData } from "../actions/financial";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, LineChart, Legend, ReferenceLine } from "recharts";
import { getAccounts, recalculateBalances } from "../actions/assets";
import { getUserLevel } from "../actions/profile";
import { Movement, Account } from "../types";
import { cn } from "../lib/utils";
import Link from "next/link";
import { InfoButton } from "../components/InfoButton";

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [forecastSummary, setForecastSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
    const [categoryExpenses, setCategoryExpenses] = useState<{ name: string; value: number }[]>([]);
    const [forecastCategoryExpenses, setForecastCategoryExpenses] = useState<{ name: string; value: number }[]>([]);
    const [cashFlowData, setCashFlowData] = useState<any[]>([]);
    const [currentDate, setCurrentDate] = useState<{ month: number, year: number } | null>(null);
    const [userLevel, setUserLevel] = useState(0);
    const [pendingSummary, setPendingSummary] = useState({ totalPayable: 0, totalReceivable: 0, countPayable: 0, countReceivable: 0 });

    useEffect(() => {
        const now = new Date();
        setCurrentDate({
            month: now.getMonth() + 1,
            year: now.getFullYear()
        });
    }, []);

    useEffect(() => {
        if (currentDate) {
            loadData(currentDate.month, currentDate.year);
        }
    }, [currentDate]);

    const loadData = async (month: number, year: number) => {
        setLoading(true);
        // Auto-fix balances if out of sync
        await recalculateBalances();

        const [summaryData, forecastSummaryData, accountsData, movementsData, categoryData, forecastCategoryData, level, pendingData, flowData] = await Promise.all([
            getMonthSummary(month, year, 'paid'),
            getMonthSummary(month, year, 'pending'),
            getAccounts(),
            getMovements({ month, year }),
            getExpensesByCategory(month, year, 'paid'),
            getExpensesByCategory(month, year, 'pending'),
            getUserLevel(),
            getPendingSummary(month, year),
            getCashFlowChartData(month, year)
        ]);

        setSummary(summaryData);
        setForecastSummary(forecastSummaryData);
        setAccounts(accountsData);
        setRecentMovements(movementsData.slice(0, 5));
        setCategoryExpenses(categoryData);
        setForecastCategoryExpenses(forecastCategoryData);
        setUserLevel(level);
        setPendingSummary(pendingData);

        // Process flow data for charts (use data directly from backend which now handles the split)
        const processedFlowData = (flowData || []).map((d: any) => ({
            ...d,
            // Balance - realizedBalance for past, forecastBalance for future
            balanceSolid: d.realizedBalance,
            balanceDotted: d.forecastBalance,

            // Income (Accumulated)
            incomeSolid: d.accumulatedRealizedIncome,
            incomeDotted: d.accumulatedForecastIncome,

            // Expense (Accumulated)
            expenseSolid: d.accumulatedRealizedExpense,
            expenseDotted: d.accumulatedForecastExpense,
        }));

        setCashFlowData(processedFlowData);
        setLoading(false);
    };

    const totalBalance = accounts
        .filter(acc => acc.type !== 'savings')
        .reduce((sum, acc) => sum + (acc.balance || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                    <PieChart className="w-6 h-6 text-green-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-100">Visão Geral</h1>
                    {currentDate && (
                        <p className="text-neutral-500 text-sm">{MONTHS[currentDate.month - 1]} {currentDate.year}</p>
                    )}
                </div>
            </div>

            {/* Main Balance Card */}
            <div className="bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <span className="text-sm text-neutral-400">Saldo em Contas</span>
                        <InfoButton text="Soma dos saldos de todas as suas contas correntes cadastradas. Inclui o que vc tem no bolso e o que sobrou do mês passado." />
                    </div>
                </div>
                <p className={cn("text-4xl font-bold", totalBalance >= 0 ? "text-green-400" : "text-red-400")}>
                    R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
            </div>

            {/* Month Summary */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs text-neutral-500">Receitas</span>
                        <InfoButton text="Total de entradas registradas neste mês vigente." />
                    </div>
                    <p className="text-xl font-bold text-green-400">
                        R$ {summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs text-neutral-500">Despesas</span>
                        <InfoButton text="Total de saídas registradas neste mês vigente." />
                    </div>
                    <p className="text-xl font-bold text-red-400">
                        R$ {summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className={cn(
                    "bg-neutral-900 border rounded-xl p-4",
                    summary.balance >= 0 ? "border-emerald-500/30" : "border-orange-500/30"
                )}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-neutral-500">Saldo Mês</span>
                        <InfoButton text="Diferença entre Receitas e Despesas deste mês." />
                    </div>
                    <p className={cn("text-xl font-bold", summary.balance >= 0 ? "text-emerald-400" : "text-orange-400")}>
                        R$ {summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Pending Summary (Level 2+) */}
            {userLevel >= 2 && (pendingSummary.countPayable > 0 || pendingSummary.countReceivable > 0) && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-orange-400 mb-2">
                            <ArrowDownCircle className="w-4 h-4" />
                            <span className="text-xs text-neutral-500">A Pagar ({pendingSummary.countPayable})</span>
                        </div>
                        <p className="text-lg font-bold text-orange-400">
                            R$ {pendingSummary.totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-blue-400 mb-2">
                            <ArrowUpCircle className="w-4 h-4" />
                            <span className="text-xs text-neutral-500">A Receber ({pendingSummary.countReceivable})</span>
                        </div>
                        <p className="text-lg font-bold text-blue-400">
                            R$ {pendingSummary.totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            )}

            {/* Charts Section (MOVED UP) */}
            <div className="space-y-8">

                {/* 1. REALIZED (Realizado) */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <div className="w-2 h-6 bg-green-500 rounded-full" />
                        Realizado (Pago)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Income vs Expense Bar Chart */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                            <h3 className="font-medium text-neutral-300 mb-4">Balanço Realizado</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">Receitas</span>
                                        <span className="text-green-400">R$ {summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${summary.income > 0 ? Math.min((summary.income / (summary.income + summary.expense)) * 100, 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">Despesas</span>
                                        <span className="text-red-400">R$ {summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full"
                                            style={{ width: `${summary.expense > 0 ? Math.min((summary.expense / (summary.income + summary.expense)) * 100, 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Expenses by Category Donut Chart */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                            <h3 className="font-medium text-neutral-300 mb-4">Gastos por Categoria (Realizado)</h3>
                            {categoryExpenses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-neutral-500 text-sm">
                                    <PieChart className="w-8 h-8 mb-2 opacity-30" />
                                    Sem gastos pagos
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    {/* Simple CSS Donut */}
                                    <div className="relative w-24 h-24 flex-shrink-0">
                                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#262626"
                                                strokeWidth="4"
                                            />
                                            {categoryExpenses.slice(0, 3).map((cat, i) => {
                                                const total = categoryExpenses.reduce((acc, c) => acc + c.value, 0);
                                                const percent = (cat.value / total) * 100;
                                                const offset = categoryExpenses.slice(0, i).reduce((acc, c) => acc + (c.value / total) * 100, 0);
                                                return (
                                                    <path
                                                        key={cat.name}
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        fill="none"
                                                        stroke={i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#eab308'}
                                                        strokeWidth="4"
                                                        strokeDasharray={`${percent}, 100`}
                                                        strokeDashoffset={-offset}
                                                        className="transition-all duration-500"
                                                    />
                                                );
                                            })}
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                                            <span className="text-[10px] text-neutral-500">Total</span>
                                            <span className="text-xs font-bold text-white">
                                                {((categoryExpenses.reduce((acc, c) => acc + c.value, 0) >= 1000)
                                                    ? `${(categoryExpenses.reduce((acc, c) => acc + c.value, 0) / 1000).toFixed(1)}k`
                                                    : categoryExpenses.reduce((acc, c) => acc + c.value, 0).toFixed(0))}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 space-y-2 overflow-y-auto max-h-32 scrollbar-thin scrollbar-thumb-neutral-700">
                                        {categoryExpenses.map((cat, i) => (
                                            <div key={cat.name} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full",
                                                        i === 0 ? "bg-red-500" : i === 1 ? "bg-orange-500" : i === 2 ? "bg-yellow-500" : "bg-neutral-600"
                                                    )} />
                                                    <span className="text-neutral-300 truncate max-w-[80px]">{cat.name}</span>
                                                </div>
                                                <span className="text-neutral-400">R$ {cat.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. FORECAST (Previsão/Pendente) */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-500 rounded-full" />
                        Previsão (Pendente)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Income vs Expense Bar Chart */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                            <h3 className="font-medium text-neutral-300 mb-4">Balanço Pendente</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">A Receber</span>
                                        <span className="text-blue-400">R$ {forecastSummary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${forecastSummary.income > 0 ? Math.min((forecastSummary.income / (forecastSummary.income + forecastSummary.expense)) * 100, 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-neutral-400">A Pagar</span>
                                        <span className="text-orange-400">R$ {forecastSummary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 rounded-full"
                                            style={{ width: `${forecastSummary.expense > 0 ? Math.min((forecastSummary.expense / (forecastSummary.income + forecastSummary.expense)) * 100, 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Expenses by Category Donut Chart */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                            <h3 className="font-medium text-neutral-300 mb-4">Gastos por Categoria (Pendente)</h3>
                            {forecastCategoryExpenses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-neutral-500 text-sm">
                                    <PieChart className="w-8 h-8 mb-2 opacity-30" />
                                    Sem contas a pagar
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    {/* Simple CSS Donut */}
                                    <div className="relative w-24 h-24 flex-shrink-0">
                                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#262626"
                                                strokeWidth="4"
                                            />
                                            {forecastCategoryExpenses.slice(0, 3).map((cat, i) => {
                                                const total = forecastCategoryExpenses.reduce((acc, c) => acc + c.value, 0);
                                                const percent = (cat.value / total) * 100;
                                                const offset = forecastCategoryExpenses.slice(0, i).reduce((acc, c) => acc + (c.value / total) * 100, 0);
                                                return (
                                                    <path
                                                        key={cat.name}
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        fill="none"
                                                        stroke={i === 0 ? '#f97316' : i === 1 ? '#eab308' : '#3b82f6'}
                                                        strokeWidth="4"
                                                        strokeDasharray={`${percent}, 100`}
                                                        strokeDashoffset={-offset}
                                                        className="transition-all duration-500"
                                                    />
                                                );
                                            })}
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                                            <span className="text-[10px] text-neutral-500">Total</span>
                                            <span className="text-xs font-bold text-white">
                                                {((forecastCategoryExpenses.reduce((acc, c) => acc + c.value, 0) >= 1000)
                                                    ? `${(forecastCategoryExpenses.reduce((acc, c) => acc + c.value, 0) / 1000).toFixed(1)}k`
                                                    : forecastCategoryExpenses.reduce((acc, c) => acc + c.value, 0).toFixed(0))}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 space-y-2 overflow-y-auto max-h-32 scrollbar-thin scrollbar-thumb-neutral-700">
                                        {forecastCategoryExpenses.map((cat, i) => (
                                            <div key={cat.name} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full",
                                                        i === 0 ? "bg-orange-500" : i === 1 ? "bg-yellow-500" : i === 2 ? "bg-blue-500" : "bg-neutral-600"
                                                    )} />
                                                    <span className="text-neutral-300 truncate max-w-[80px]">{cat.name}</span>
                                                </div>
                                                <span className="text-neutral-400">R$ {cat.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. CASH FLOW (Fluxo de Caixa) */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <h3 className="font-medium text-neutral-300 mb-4 flex items-center gap-2">
                        <LineChartIcon className="w-4 h-4 text-purple-400" />
                        Fluxo de Caixa (Evolução do Saldo)
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={cashFlowData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis
                                    dataKey="day"
                                    stroke="#666"
                                    tick={{ fill: '#666', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#666"
                                    tick={{ fill: '#666', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e5e5e5' }}
                                    labelStyle={{ color: '#a3a3a3' }}
                                    formatter={(value: any, name: string) => {
                                        if (value === null || value === undefined) return null;
                                        const val = `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                        // Remove "(Real)" and "(Prev)" suffixes for cleaner display
                                        const cleanName = name.replace(' (Real)', '').replace(' (Prev)', '');
                                        return [val, cleanName];
                                    }}
                                    // Filter out null values
                                    filterNull={true}
                                />
                                <ReferenceLine y={0} stroke="#444" />
                                <Legend
                                    formatter={(value) => value.replace(' (Real)', '').replace(' (Prev)', '')}
                                />

                                {/* SALDO (Blue) - Combined line */}
                                <Line type="monotone" dataKey="balanceSolid" stroke="#3b82f6" strokeWidth={3} dot={false} name="Saldo" connectNulls={false} />
                                <Line type="monotone" dataKey="balanceDotted" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" dot={false} name="Saldo (Prev)" legendType="none" connectNulls={false} />

                                {/* RECEITA (Green) */}
                                <Line type="monotone" dataKey="incomeSolid" stroke="#22c55e" strokeWidth={2} dot={false} name="Receita Acumulada" connectNulls={false} />
                                <Line type="monotone" dataKey="incomeDotted" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Receita (Prev)" legendType="none" connectNulls={false} />

                                {/* DESPESA (Red) */}
                                <Line type="monotone" dataKey="expenseSolid" stroke="#ef4444" strokeWidth={2} dot={false} name="Despesa Acumulada" connectNulls={false} />
                                <Line type="monotone" dataKey="expenseDotted" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Despesa (Prev)" legendType="none" connectNulls={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Accounts Quick View (MOVED DOWN) */}
            {accounts.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <h3 className="font-medium text-neutral-300">Suas Contas</h3>
                            <InfoButton text="Lista das suas contas correntes e quanto tem nelas. A conta principal é aquela que a IA usa se você não mencionar outra." />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {accounts
                            .sort((a, b) => (a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1))
                            .map((acc) => (
                                <div key={acc.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                            <Wallet className="w-4 h-4 text-green-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm text-neutral-300 flex items-center">
                                                {acc.name}
                                                {acc.is_default && (
                                                    <span className="ml-2 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                                                        Principal
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={cn("font-medium", acc.balance >= 0 ? "text-green-400" : "text-red-400")}>
                                        R$ {(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Recent Movements */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <h3 className="font-medium text-neutral-300">Movimentações Recentes</h3>
                        <InfoButton text="Últimas transações registradas no sistema." />
                    </div>
                </div>
                {recentMovements.length === 0 ? (
                    <div className="text-center py-6 text-neutral-500">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma movimentação ainda</p>
                        <p className="text-xs mt-1">Use a IA: "Gastei 50 no almoço"</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentMovements.map((mov) => (
                            <div key={mov.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        mov.type === 'expense'
                                            ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                            : "bg-green-500/10 border border-green-500/20 text-green-400"
                                    )}>
                                        {mov.type === 'expense' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm text-neutral-300">{mov.description}</p>
                                        <p className="text-xs text-neutral-600">
                                            {new Date(mov.date).toLocaleDateString('pt-BR')}
                                            {!mov.is_paid && mov.due_date && (
                                                <span className="ml-2 text-orange-400">
                                                    📅 vence {new Date(mov.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </span>
                                            )}
                                            {!mov.is_paid && <span className="ml-2 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px]">Pendente</span>}
                                        </p>
                                    </div>
                                </div>
                                <span className={cn("font-medium text-sm", mov.type === 'expense' ? "text-red-400" : "text-green-400")}>
                                    {mov.type === 'expense' ? '-' : '+'} R$ {mov.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>


        </div>
    );
}
