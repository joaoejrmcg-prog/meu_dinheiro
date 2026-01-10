'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Loan, LoanType } from '../types';

async function getSupabase() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );
}

// ============ GET LOANS ============

export async function getLoans(): Promise<Loan[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching loans:", error);
        return [];
    }
    return data || [];
}

// ============ CREATE LOAN ============

export async function createLoan(params: {
    description: string;
    total_amount: number;
    type: LoanType;
    interest_rate?: number;
    due_date?: string;
}): Promise<{ success: boolean; data?: Loan; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { description, total_amount, type, interest_rate, due_date } = params;

    if (!description || !total_amount || !type) {
        return { success: false, error: 'Descrição, valor e tipo são obrigatórios.' };
    }

    const { data, error } = await supabase
        .from('loans')
        .insert({
            user_id: user.id,
            description,
            total_amount,
            remaining_amount: total_amount, // Starts equal to total
            type,
            interest_rate: interest_rate || null,
            due_date: due_date || null
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating loan:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

// ============ UPDATE LOAN ============

export async function updateLoan(id: string, params: {
    description?: string;
    total_amount?: number;
    remaining_amount?: number;
    interest_rate?: number;
    due_date?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
        .from('loans')
        .update(params)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error("Error updating loan:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

// ============ DELETE LOAN ============

export async function deleteLoan(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error("Error deleting loan:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

// ============ REGISTER LOAN PAYMENT ============

export async function registerLoanPayment(params: {
    loanId: string;
    amount: number;
    accountId?: string;
    date?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { loanId, amount, accountId, date } = params;
    const paymentDate = date || new Date().toISOString().split('T')[0];

    // 1. Get the loan
    const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .eq('user_id', user.id)
        .single();

    if (loanError || !loan) {
        return { success: false, error: 'Empréstimo não encontrado.' };
    }

    // 2. Validate payment amount
    if (amount > loan.remaining_amount) {
        return { success: false, error: `Valor excede o saldo devedor (R$ ${loan.remaining_amount.toFixed(2)}).` };
    }

    // 3. Calculate new remaining amount
    const newRemaining = loan.remaining_amount - amount;

    // 4. Update loan remaining_amount
    const { error: updateError } = await supabase
        .from('loans')
        .update({ remaining_amount: newRemaining })
        .eq('id', loanId);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    // 5. Create movement record
    // For 'taken' loans: payment is an expense (I'm paying back)
    // For 'given' loans: payment is income (they're paying me back)
    const movementType = loan.type === 'taken' ? 'expense' : 'income';
    const description = loan.type === 'taken'
        ? `Pagamento: ${loan.description}`
        : `Recebimento: ${loan.description}`;

    // Get default account if not specified
    let finalAccountId = accountId;
    if (!finalAccountId) {
        const { data: defaultAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'wallet')
            .limit(1)
            .single();
        finalAccountId = defaultAccount?.id;
    }

    const { error: movError } = await supabase
        .from('movements')
        .insert({
            user_id: user.id,
            description,
            amount,
            date: paymentDate,
            type: movementType,
            account_id: finalAccountId,
            is_loan: true,
            loan_id: loanId,
            is_paid: true,
            is_reserve: false,
            is_reimbursement: false
        });

    if (movError) {
        console.error("Error creating payment movement:", movError);
        // Try to rollback loan update
        await supabase
            .from('loans')
            .update({ remaining_amount: loan.remaining_amount })
            .eq('id', loanId);
        return { success: false, error: movError.message };
    }

    // 6. Update account balance if applicable
    if (finalAccountId) {
        const { data: account } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', finalAccountId)
            .single();

        if (account) {
            const newBalance = movementType === 'expense'
                ? account.balance - amount
                : account.balance + amount;

            await supabase
                .from('accounts')
                .update({ balance: newBalance })
                .eq('id', finalAccountId);
        }
    }

    return { success: true };
}
