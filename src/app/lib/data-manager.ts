import { supabase } from "./supabase";
import { Transaction, PaymentMethod, Category } from "../types";
import { checkWritePermission } from "../actions/subscription";

export const DataManager = {

    // ============================================
    // PAYMENT METHODS
    // ============================================
    addPaymentMethod: async (methodData: Partial<PaymentMethod>) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('payment_methods')
            .insert([{ ...methodData, user_id: user.id }])
            .select()
            .single();

        if (error) throw error;
        return data as PaymentMethod;
    },

    getPaymentMethods: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true });

        if (error) throw error;
        return data as PaymentMethod[];
    },

    // ============================================
    // TRANSACTIONS
    // ============================================
    addTransaction: async (transactionData: Partial<Transaction>) => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('transactions')
            .insert([{ ...transactionData, user_id: user.id }])
            .select()
            .single();

        if (error) throw error;
        return data as Transaction;
    },

    getTransactions: async (startDate?: string, endDate?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        let query = supabase
            .from('transactions')
            .select('*, payment_method:payment_methods(name), category:categories(name)')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        } else {
            query = query.limit(50);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data as Transaction[];
    },

    deleteLastAction: async () => {
        const perm = await checkWritePermission();
        if (!perm.allowed) throw new Error(perm.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: lastTrans } = await supabase
            .from('transactions')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!lastTrans) return false;

        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', lastTrans.id);

        if (error) throw error;
        return true;
    },

    // ============================================
    // CATEGORIES
    // ============================================
    getCategories: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .or(`user_id.eq.${user.id},is_default.eq.true`)
            .order('name', { ascending: true });

        if (error) throw error;
        return data as Category[];
    },

    // ============================================
    // BALANCE / DASHBOARD
    // ============================================
    getBalance: async (month: number, year: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('transactions')
            .select('amount, type, is_paid')
            .eq('user_id', user.id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) throw error;

        const income = data.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = data.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const balance = income - expense;

        return { income, expense, balance };
    }
};
