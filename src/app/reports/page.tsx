"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart3, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, PiggyBank, Wallet, CreditCard, Sparkles, ArrowRight, Printer, X } from "lucide-react";
import { getMonthReport, getCardInvoicePreviews, InvoicePreview } from "../actions/reports";
import { getUserLevel } from "../actions/profile";
import { getSuggestionsForLevel } from "../lib/suggestions";
import { cn } from "../lib/utils";
import Link from "next/link";

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Report {
    realIncome: number;
    realExpense: number;
    realBalance: number;
    cashIn: number;
    cashOut: number;
    cashFlow: number;
    loansReceived: number;
    loansPaid: number;
    reservesAdded: number;
    reservesUsed: number;
    reimbursements: number;
    totalMovements: number;
    previousBalance: number;
    currentBalance: number;
    movements: any[];
}

export default function ReportsPage() {
    const [report, setReport] = useState<Report | null>(null);
    const [invoices, setInvoices] = useState<InvoicePreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLevel, setUserLevel] = useState(0);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeModal, setActiveModal] = useState<'real' | 'cash' | null>(null);

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    useEffect(() => {
        loadData();
        getUserLevel().then(level => {
            setUserLevel(level);
            setSuggestions(getSuggestionsForLevel(level, 4, 'reports'));
        });
    }, [month, year]);

    const loadData = async () => {
        setLoading(true);
        const [reportData, invoicesData] = await Promise.all([
            getMonthReport(month, year),
            getCardInvoicePreviews(month, year)
        ]);
        setReport(reportData);
        setInvoices(invoicesData);
        setLoading(false);
    };

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(year - 1); }
        else { setMonth(month - 1); }
    };

    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(year + 1); }
        else { setMonth(month + 1); }
    };

    const formatCurrency = (value: number) => {
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };

    const handlePrint = () => {
        window.print();
    };

    return (

        <>
            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 print:hidden">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                            <BarChart3 className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-neutral-100">Relatórios</h1>
                            <p className="text-neutral-500 text-sm">A verdade dos números</p>
                        </div>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 transition-colors print:hidden"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="text-sm font-medium">Imprimir</span>
                    </button>

                    {/* AI Suggestions */}
                    <div className="hidden md:block bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-3 print:hidden min-w-[300px]">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <h3 className="text-xs font-medium text-purple-400">Assistente IA</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {suggestions.slice(0, 2).map((sug, i) => (
                                <Link key={i} href={`/?tip=${encodeURIComponent(sug)}`} className="flex items-center gap-2 px-2 py-1 rounded bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 hover:border-purple-500/20 transition-all group">
                                    <span className="text-[10px] text-neutral-400 group-hover:text-purple-400 truncate">"{sug}"</span>
                                </Link>
                            ))}
                        </div>
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

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : report && (
                    <>
                        {/* Main Cards - Real vs Cash Flow */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Real Balance - The Truth (Visible for everyone now) */}
                            <div
                                onClick={() => setActiveModal('real')}
                                className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6 cursor-pointer hover:border-green-500/40 transition-all"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    <h3 className="font-semibold text-green-400">Resultado Real</h3>
                                </div>
                                <p className="text-sm text-neutral-500 mb-2">
                                    Exclui: empréstimos, reservas, reembolsos
                                </p>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Renda Real</span>
                                        <span className="text-green-400 font-medium">{formatCurrency(report.realIncome)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Despesa Real</span>
                                        <span className="text-red-400 font-medium">{formatCurrency(report.realExpense)}</span>
                                    </div>
                                    <div className="border-t border-green-500/20 pt-3 flex justify-between">
                                        <span className="font-medium text-white">Saldo Real</span>
                                        <span className={cn("font-bold text-xl", report.realBalance >= 0 ? "text-green-400" : "text-red-400")}>
                                            {formatCurrency(report.realBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Cash Flow - What Actually Moved */}
                            <div
                                onClick={() => setActiveModal('cash')}
                                className={cn(
                                    "bg-neutral-900 border border-neutral-800 rounded-2xl p-6 cursor-pointer hover:border-neutral-600 transition-all"
                                )}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <Wallet className="w-5 h-5 text-blue-400" />
                                    <h3 className="font-semibold text-blue-400">Fluxo de Caixa</h3>
                                </div>
                                <p className="text-sm text-neutral-500 mb-2">
                                    Movimentação real das suas contas
                                </p>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Saldo Anterior</span>
                                        <span className="text-neutral-300 font-medium">{formatCurrency(report.previousBalance)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Entradas (+)</span>
                                        <span className="text-green-400 font-medium">{formatCurrency(report.cashIn)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Saídas (-)</span>
                                        <span className="text-red-400 font-medium">{formatCurrency(report.cashOut)}</span>
                                    </div>
                                    <div className="border-t border-neutral-700 pt-3 flex justify-between">
                                        <span className="font-medium text-white">Saldo Final</span>
                                        <span className={cn("font-bold text-xl", report.currentBalance >= 0 ? "text-blue-400" : "text-orange-400")}>
                                            {formatCurrency(report.currentBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Warning if difference is significant (Only Level 2+) */}
                        {userLevel >= 2 && Math.abs(report.realBalance - report.cashFlow) > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-yellow-400">Por que os valores são diferentes?</p>
                                        <p className="text-sm text-neutral-400 mt-1">
                                            O "Resultado Real" mostra sua saúde financeira de verdade.
                                            Empréstimos, reservas e reembolsos movimentam dinheiro, mas não são renda/gasto real.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Breakdown (Only Level 2+) */}
                        {userLevel >= 2 && (
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                                <h3 className="font-semibold text-neutral-200 mb-4">Detalhamento</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Loans */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Empréstimos</h4>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Recebidos</span>
                                            <span className="text-yellow-400">{formatCurrency(report.loansReceived)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Pagos</span>
                                            <span className="text-yellow-400">{formatCurrency(report.loansPaid)}</span>
                                        </div>
                                    </div>

                                    {/* Reserves */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Reservas</h4>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Guardado</span>
                                            <span className="text-blue-400">{formatCurrency(report.reservesAdded)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Usado</span>
                                            <span className="text-blue-400">{formatCurrency(report.reservesUsed)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reimbursements */}
                                {report.reimbursements > 0 && (
                                    <div className="mt-6 pt-4 border-t border-neutral-800">
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Reembolsos Recebidos</span>
                                            <span className="text-purple-400">{formatCurrency(report.reimbursements)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Credit Card Invoices (Only Level 2+) */}
                        {userLevel >= 2 && invoices.length > 0 && (
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <CreditCard className="w-5 h-5 text-purple-400" />
                                    <h3 className="font-semibold text-purple-400">Faturas de Cartão (Estimativa)</h3>
                                </div>
                                <div className="space-y-3">
                                    {invoices.map((inv) => (
                                        <div key={inv.cardId} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-xl border border-neutral-800">
                                            <div>
                                                <p className="font-medium text-white">{inv.cardName}</p>
                                                <p className="text-xs text-neutral-500">
                                                    Vence dia {new Date(inv.dueDate).getDate()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-white">
                                                    {formatCurrency(inv.amount)}
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    Fecha dia {new Date(inv.closingDate).getDate()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="text-center text-neutral-500 text-sm">
                            {report.totalMovements} movimentações neste mês
                        </div>
                    </>
                )}

                {/* MODALS */}
                {activeModal === 'real' && report && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setActiveModal(null)}>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">Detalhamento do Resultado Real</h3>
                                <button onClick={() => setActiveModal(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <p className="text-sm text-neutral-400">
                                Lista de movimentações consideradas no cálculo (exclui empréstimos e reservas).
                            </p>

                            <div className="space-y-2">
                                {(report.movements || [])
                                    .filter(m => !m.is_loan && !m.is_reserve && !m.is_reimbursement)
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((m, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-neutral-800/30 rounded-lg border border-neutral-800">
                                            <div>
                                                <p className="text-white font-medium">{m.description}</p>
                                                <p className="text-xs text-neutral-500">{new Date(m.date).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <span className={m.type === 'income' ? "text-green-400" : "text-red-400"}>
                                                {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeModal === 'cash' && report && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setActiveModal(null)}>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">Detalhamento do Fluxo de Caixa</h3>
                                <button onClick={() => setActiveModal(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <p className="text-sm text-neutral-400">
                                Todas as movimentações que afetaram seu saldo neste mês.
                            </p>

                            <div className="space-y-2">
                                {(report.movements || [])
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((m, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-neutral-800/30 rounded-lg border border-neutral-800">
                                            <div>
                                                <p className="text-white font-medium">{m.description}</p>
                                                <div className="flex gap-2 text-xs text-neutral-500">
                                                    <span>{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                                                    {m.is_loan && <span className="text-yellow-500/80">• Empréstimo</span>}
                                                    {m.is_reserve && <span className="text-blue-500/80">• Reserva</span>}
                                                </div>
                                            </div>
                                            <span className={m.type === 'income' ? "text-green-400" : "text-red-400"}>
                                                {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PRINT VIEW (Hidden on Screen) */}
            {report && (
                <div className="hidden print:block p-8 bg-white text-black">
                    <h1 className="text-2xl font-bold mb-2">Relatório Financeiro - {MONTHS[month - 1]} {year}</h1>
                    <p className="text-sm text-gray-600 mb-8">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="border p-4 rounded">
                            <h3 className="font-bold mb-2">Resultado Real</h3>
                            <div className="flex justify-between mb-1"><span>Renda:</span> <span>{formatCurrency(report.realIncome)}</span></div>
                            <div className="flex justify-between mb-1"><span>Despesa:</span> <span>{formatCurrency(report.realExpense)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Saldo:</span> <span>{formatCurrency(report.realBalance)}</span></div>
                        </div>
                        <div className="border p-4 rounded">
                            <h3 className="font-bold mb-2">Fluxo de Caixa</h3>
                            <div className="flex justify-between mb-1"><span>Saldo Anterior:</span> <span>{formatCurrency(report.previousBalance)}</span></div>
                            <div className="flex justify-between mb-1"><span>Entradas:</span> <span>{formatCurrency(report.cashIn)}</span></div>
                            <div className="flex justify-between mb-1"><span>Saídas:</span> <span>{formatCurrency(report.cashOut)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Saldo Final:</span> <span>{formatCurrency(report.currentBalance)}</span></div>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold mb-4">Detalhamento de Movimentações</h2>
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b-2 border-gray-300">
                                <th className="py-2">Data</th>
                                <th className="py-2">Descrição</th>
                                <th className="py-2">Categoria</th>
                                <th className="py-2">Tipo</th>
                                <th className="py-2 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(report.movements || [])
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .map((m, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2">{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="py-2">
                                            {m.description}
                                            {m.is_loan && <span className="text-xs ml-2 text-gray-500">(Empréstimo)</span>}
                                            {m.is_reserve && <span className="text-xs ml-2 text-gray-500">(Reserva)</span>}
                                        </td>
                                        <td className="py-2 text-gray-600">{m.category || '-'}</td>
                                        <td className="py-2 capitalize">{m.type === 'income' ? 'Receita' : 'Despesa'}</td>
                                        <td className={`py-2 text-right ${m.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                                            {formatCurrency(m.amount)}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
