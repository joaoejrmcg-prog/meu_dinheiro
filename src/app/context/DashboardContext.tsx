"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMonthSummary } from '../actions/financial';
import { getAccounts } from '../actions/assets';

interface DashboardMetrics {
    incomeMonth: number;
    expenseMonth: number;
    balanceMonth: number;
    totalAssets: number;
}

interface DashboardContextType {
    metrics: DashboardMetrics;
    loading: boolean;
    refreshData: () => Promise<void>;
    tutorialAction: string | null;
    triggerTutorial: (action: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        incomeMonth: 0,
        expenseMonth: 0,
        balanceMonth: 0,
        totalAssets: 0
    });
    const [tutorialAction, setTutorialAction] = useState<string | null>(null);

    const triggerTutorial = (action: string) => {
        setTutorialAction(action);
        // Reset after a short delay to allow re-triggering
        setTimeout(() => setTutorialAction(null), 100);
    };

    const refreshData = async () => {
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            const [summary, accounts] = await Promise.all([
                getMonthSummary(month, year),
                getAccounts()
            ]);

            const totalAssets = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

            setMetrics({
                incomeMonth: summary.income,
                expenseMonth: summary.expense,
                balanceMonth: summary.balance,
                totalAssets
            });

        } catch (error) {
            console.error("Erro ao atualizar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    return (
        <DashboardContext.Provider value={{
            metrics,
            loading,
            refreshData,
            tutorialAction,
            triggerTutorial
        }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}
