"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, Check, Calendar, CreditCard } from "lucide-react";
import {
    getUpcomingPayments,
    createPaymentNotifications,
    getNegativeAccounts,
    createNegativeBalanceNotifications,
    createNegativeBalanceNotificationRealtime,
    getPendingAutoDebits,
    confirmAutoDebit,
    type PendingPayment,
    type PendingAutoDebit
} from "../actions/reminders";
import { supabase } from "../lib/supabase";

export default function PaymentReminder() {
    const [payments, setPayments] = useState<PendingPayment[]>([]);
    const [autoDebits, setAutoDebits] = useState<PendingAutoDebit[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load dismissed IDs from session storage
        const storedDismissed = sessionStorage.getItem('dismissedReminders');
        if (storedDismissed) {
            setDismissed(new Set(JSON.parse(storedDismissed)));
        }

        loadPayments();

        // Listen for transaction updates to check for negative balances in real-time
        // Uses the NO-24h-check version for immediate feedback
        const handleTransactionUpdate = async () => {
            const negativeAccounts = await getNegativeAccounts();
            if (negativeAccounts.length > 0) {
                await createNegativeBalanceNotificationRealtime(negativeAccounts);
            }
        };

        window.addEventListener('transactionUpdated', handleTransactionUpdate);

        return () => {
            window.removeEventListener('transactionUpdated', handleTransactionUpdate);
        };
    }, []);

    const loadPayments = async () => {
        try {
            // Load pending payments
            const data = await getUpcomingPayments();
            setPayments(data);

            // Load pending auto-debits
            const autoDebitData = await getPendingAutoDebits();
            setAutoDebits(autoDebitData);

            // Create notifications for pending payments
            if (data.length > 0) {
                await createPaymentNotifications(data);
            }

            // Check for negative balance accounts and create notifications (with 24h check)
            const negativeAccounts = await getNegativeAccounts();
            if (negativeAccounts.length > 0) {
                await createNegativeBalanceNotifications(negativeAccounts);
            }
        } catch (error) {
            console.error('Error loading payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = (id: string) => {
        const newDismissed = new Set(dismissed);
        newDismissed.add(id);
        setDismissed(newDismissed);
        sessionStorage.setItem('dismissedReminders', JSON.stringify([...newDismissed]));
    };

    const handleDismissAll = () => {
        const paymentIds = payments.map(p => p.id);
        const autoDebitIds = autoDebits.map(ad => ad.id);
        const allIds = [...paymentIds, ...autoDebitIds];
        const newDismissed = new Set([...dismissed, ...allIds]);
        setDismissed(newDismissed);
        sessionStorage.setItem('dismissedReminders', JSON.stringify([...newDismissed]));
    };

    const handleMarkAsPaid = async (payment: PendingPayment) => {
        try {
            // Get user for the update
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get account for balance update
            const { data: movement } = await supabase
                .from('movements')
                .select('account_id, amount, type')
                .eq('id', payment.id)
                .single();

            if (movement?.account_id) {
                // Update account balance
                const { data: account } = await supabase
                    .from('accounts')
                    .select('balance')
                    .eq('id', movement.account_id)
                    .single();

                if (account) {
                    const newBalance = movement.type === 'income'
                        ? account.balance + movement.amount
                        : account.balance - movement.amount;

                    await supabase
                        .from('accounts')
                        .update({ balance: newBalance })
                        .eq('id', movement.account_id);
                }
            }

            // Mark as paid
            await supabase
                .from('movements')
                .update({ is_paid: true })
                .eq('id', payment.id);

            // Refresh list
            loadPayments();

            // Dispatch event to refresh dashboard
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('transactionUpdated'));
            }
        } catch (error) {
            console.error('Error marking as paid:', error);
        }
    };

    const handleConfirmAutoDebit = async (autoDebit: PendingAutoDebit) => {
        try {
            const result = await confirmAutoDebit(autoDebit.id);
            if (result.success) {
                // Refresh list
                loadPayments();

                // Dispatch event to refresh dashboard
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('transactionUpdated'));
                }
            } else {
                console.error('Error confirming auto-debit:', result.error);
            }
        } catch (error) {
            console.error('Error confirming auto-debit:', error);
        }
    };

    // Filter out dismissed items
    const visiblePayments = payments.filter(p => !dismissed.has(p.id));
    const visibleAutoDebits = autoDebits.filter(ad => !dismissed.has(ad.id));

    const totalItems = visiblePayments.length + visibleAutoDebits.length;

    if (loading || totalItems === 0) {
        return null;
    }

    const overduePayments = visiblePayments.filter(p => p.type === 'overdue');
    const tomorrowPayments = visiblePayments.filter(p => p.type === 'tomorrow');
    const dueAutoDebits = visibleAutoDebits.filter(ad => ad.type === 'due_today');
    const missingValueAutoDebits = visibleAutoDebits.filter(ad => ad.type === 'missing_value');

    const formatAmount = (amount: number) => {
        return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string) => {
        // Parse directly from string to avoid timezone issues
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}`;
    };

    return (
        <div className="w-full max-w-2xl mx-auto mb-4 px-2">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 animate-in slide-in-from-top duration-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span className="font-medium text-amber-200">
                            {totalItems} {totalItems === 1 ? 'item precisa' : 'itens precisam'} de atenção
                        </span>
                    </div>
                    <button
                        onClick={handleDismissAll}
                        className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                        title="Dispensar todos"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Payment List */}
                <div className="space-y-2">
                    {/* Overdue payments first */}
                    {overduePayments.map(payment => (
                        <div
                            key={payment.id}
                            className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-red-400 text-xs font-medium">
                                        ATRASADA
                                    </span>
                                    <span className="text-neutral-200 truncate">
                                        {payment.description}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-400">
                                    {formatAmount(payment.amount)} · venceu {formatDate(payment.due_date)}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <button
                                    onClick={() => handleMarkAsPaid(payment)}
                                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                    title="Marcar como paga"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Paguei
                                </button>
                                <button
                                    onClick={() => handleDismiss(payment.id)}
                                    className="px-2 py-1 bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-400 rounded-lg transition-colors text-xs"
                                    title="Lembrar depois"
                                >
                                    Depois
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Tomorrow payments */}
                    {tomorrowPayments.map(payment => (
                        <div
                            key={payment.id}
                            className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-neutral-200 truncate">
                                        {payment.description}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-400">
                                    {formatAmount(payment.amount)} · vence amanhã
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <button
                                    onClick={() => handleMarkAsPaid(payment)}
                                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                    title="Marcar como paga"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Paguei
                                </button>
                                <button
                                    onClick={() => handleDismiss(payment.id)}
                                    className="px-2 py-1 bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-400 rounded-lg transition-colors text-xs"
                                    title="Lembrar depois"
                                >
                                    Depois
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Auto-debits ready to confirm */}
                    {dueAutoDebits.map(autoDebit => (
                        <div
                            key={autoDebit.id}
                            className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-blue-400 text-xs font-medium">
                                        DÉBITO AUTOMÁTICO
                                    </span>
                                    <span className="text-neutral-200 truncate">
                                        {autoDebit.description}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-400">
                                    {formatAmount(autoDebit.amount)} · debitado dia {formatDate(autoDebit.next_due_date)}
                                    {autoDebit.account_name && ` no ${autoDebit.account_name}`}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <button
                                    onClick={() => handleConfirmAutoDebit(autoDebit)}
                                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                    title="Confirmar débito"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Confirmar
                                </button>
                                <button
                                    onClick={() => handleDismiss(autoDebit.id)}
                                    className="px-2 py-1 bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-400 rounded-lg transition-colors text-xs"
                                    title="Ainda não"
                                >
                                    Ainda não
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Auto-debits missing value */}
                    {missingValueAutoDebits.map(autoDebit => (
                        <div
                            key={autoDebit.id}
                            className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                                    <span className="text-purple-400 text-xs font-medium">
                                        VALOR PENDENTE
                                    </span>
                                    <span className="text-neutral-200 truncate">
                                        {autoDebit.description}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-400">
                                    Vence dia {formatDate(autoDebit.next_due_date)} · Chegou a conta?
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <button
                                    onClick={() => handleDismiss(autoDebit.id)}
                                    className="px-2 py-1 bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-400 rounded-lg transition-colors text-xs"
                                    title="Lembrar depois"
                                >
                                    Depois
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
