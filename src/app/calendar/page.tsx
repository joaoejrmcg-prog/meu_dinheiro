"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getCalendarMovements, CalendarDay } from "../actions/financial";
import { Movement } from "../types";
import { cn } from "../lib/utils";

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

    useEffect(() => {
        loadData();
    }, [month, year]);

    const loadData = async () => {
        setLoading(true);
        const data = await getCalendarMovements(month, year);
        setCalendarData(data);
        setLoading(false);
    };

    const prevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
        setSelectedDay(null);
    };

    const nextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
        setSelectedDay(null);
    };

    // Generate calendar grid
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarDays: (number | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }

    // Add the days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    // Create a map for quick lookup
    const dataMap = new Map<string, CalendarDay>();
    calendarData.forEach(d => dataMap.set(d.date, d));

    const getDayKey = (day: number) => {
        const m = String(month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Calendário</h1>
                    <p className="text-neutral-500 text-sm">Contas a pagar e receber</p>
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
                    <Link href="/?tip=calendario" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Minha conta de água vence todo dia 10"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                    <Link href="/?tip=calendario" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Dou 40,00 de donativos todo dia 15"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                    <Link href="/?tip=calendario" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Lembrar de pagar aluguel dia 5"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                    <Link href="/?tip=calendario" className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 border border-green-500/10 hover:border-green-500/20 transition-all group">
                        <span className="text-xs text-neutral-400 group-hover:text-green-400">"Recebo meu salário dia 30"</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-green-400 ml-auto" />
                    </Link>
                </div>
            </div>
            {/* Legend */}
            <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-neutral-400">A Receber</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-neutral-400">A Pagar</span>
                </div>
            </div>

            {/* Calendar Grid */}
            {
                loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 border-b border-neutral-800">
                            {WEEKDAYS.map((day) => (
                                <div key={day} className="p-3 text-center text-xs font-medium text-neutral-500 uppercase">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days */}
                        <div className="grid grid-cols-7">
                            {calendarDays.map((day, index) => {
                                if (day === null) {
                                    return <div key={`empty-${index}`} className="p-2 md:p-3 min-h-[70px] md:min-h-[90px] border-b border-r border-neutral-800 bg-neutral-950/50" />;
                                }

                                const dayKey = getDayKey(day);
                                const dayData = dataMap.get(dayKey);
                                const hasData = !!dayData;

                                return (
                                    <button
                                        key={day}
                                        onClick={() => dayData && setSelectedDay(dayData)}
                                        className={cn(
                                            "p-2 md:p-3 min-h-[70px] md:min-h-[90px] border-b border-r border-neutral-800 text-left transition-colors",
                                            hasData ? "hover:bg-neutral-800 cursor-pointer" : "cursor-default",
                                            isToday(day) && "bg-green-500/5"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-sm font-medium",
                                            isToday(day) ? "text-green-400" : "text-neutral-300"
                                        )}>
                                            {day}
                                        </span>

                                        {dayData && (
                                            <div className="flex gap-1 mt-2">
                                                {dayData.hasIncome && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" title="A Receber" />
                                                )}
                                                {dayData.hasExpense && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" title="A Pagar" />
                                                )}
                                            </div>
                                        )}

                                        {/* Show totals on larger screens */}
                                        {dayData && (
                                            <div className="hidden md:block mt-1 space-y-0.5">
                                                {dayData.hasIncome && (
                                                    <p className="text-[10px] text-green-400 truncate">
                                                        +R$ {dayData.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                                    </p>
                                                )}
                                                {dayData.hasExpense && (
                                                    <p className="text-[10px] text-red-400 truncate">
                                                        -R$ {dayData.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {/* Day Detail Modal */}
            {
                selectedDay && (
                    <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
                )
            }
        </div >
    );
}

// ============ DAY DETAIL MODAL ============
function DayDetailModal({ day, onClose }: { day: CalendarDay; onClose: () => void }) {
    const date = new Date(day.date + 'T12:00:00');
    const formattedDate = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl z-50 max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                    <h3 className="text-lg font-semibold text-white capitalize">{formattedDate}</h3>
                    <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 p-4 border-b border-neutral-800">
                    {day.hasIncome && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-green-400 text-xs mb-1">
                                <TrendingUp className="w-3 h-3" />
                                A Receber
                            </div>
                            <p className="text-green-400 font-bold">
                                R$ {day.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    )}
                    {day.hasExpense && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
                                <TrendingDown className="w-3 h-3" />
                                A Pagar
                            </div>
                            <p className="text-red-400 font-bold">
                                R$ {day.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Movements List */}
                <div className="p-4 overflow-y-auto max-h-[300px] space-y-3">
                    {day.movements.map((mov: Movement) => (
                        <div key={mov.id} className="flex items-center gap-3 bg-neutral-800/50 rounded-lg p-3">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                mov.type === 'income'
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                            )}>
                                {mov.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{mov.description}</p>
                                <p className="text-xs text-neutral-500">
                                    {mov.type === 'income' ? 'A Receber' : 'A Pagar'}
                                </p>
                            </div>
                            <p className={cn(
                                "font-semibold shrink-0",
                                mov.type === 'income' ? "text-green-400" : "text-red-400"
                            )}>
                                R$ {mov.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
