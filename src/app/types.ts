export type MovementType = 'income' | 'expense' | 'transfer' | 'adjustment';
export type AccountType = 'wallet' | 'bank' | 'savings';
export type LoanType = 'taken' | 'given';

export interface Account {
    id: string;
    user_id: string;
    name: string;
    type: AccountType;
    balance: number;
    created_at: string;
    is_default?: boolean;
}

export interface CreditCard {
    id: string;
    user_id: string;
    name: string;
    closing_day: number;
    due_day: number;
    limit_amount: number;
    created_at: string;
    is_default?: boolean;
}

export interface Category {
    id: string;
    user_id?: string;
    name: string;
    icon?: string;
    is_default: boolean;
    created_at: string;
}

export interface Reserve {
    id: string;
    user_id: string;
    name: string;
    current_amount: number;
    target_amount?: number;
    color?: string;
    deadline?: string;
    created_at: string;
}

export interface Loan {
    id: string;
    user_id: string;
    description: string;
    total_amount: number;
    remaining_amount: number;
    type: LoanType;
    interest_rate?: number;
    due_date?: string;
    created_at: string;
}

export interface Movement {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    date: string;
    due_date?: string; // Payment due date (for pending payments)
    type: MovementType;

    account_id?: string;
    card_id?: string;
    category_id?: string;

    // Flags
    is_loan: boolean;
    loan_id?: string;

    is_reserve: boolean;
    reserve_id?: string;

    is_reimbursement: boolean;
    parent_movement_id?: string;

    is_paid: boolean;

    created_at: string;
}

export interface Recurrence {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    frequency: 'monthly' | 'weekly' | 'yearly';
    next_due_date: string;
    active: boolean;
    category_id?: string;
    account_id?: string;
    card_id?: string;
    created_at: string;
}

// AI Types
export type IntentType =
    | 'REGISTER_MOVEMENT'
    | 'GET_FINANCIAL_STATUS'
    | 'ADJUST_BALANCE'
    | 'SIMULATE_SCENARIO'
    | 'BLOCKED_FEATURE'
    | 'CONFIRMATION_REQUIRED'
    | 'RECONCILE_PAYMENT'
    | 'TRANSFER_CONFIRM_NEGATIVE'
    | 'DELETE_LAST_MOVEMENT'
    | 'NAVIGATE'
    | 'UNKNOWN';

export interface AIResponse {
    intent: IntentType;
    data?: any;
    message: string;
    spokenMessage?: string;
    confidence: number;
    audio?: string;
}

export interface Client {
    id: string;
    name: string;
    full_name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    created_at?: string;
}

export interface Appointment {
    id: string;
    user_id: string;
    client_id: string;
    date_time: string;
    description: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    created_at: string;
    client?: Client;
}

export interface FinancialRecord {
    id: string;
    type: 'income' | 'expense';
    description: string;
    amount: number;
    created_at: string;
    client?: Client;
}

export interface PaymentMethod {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
}

export interface Transaction {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
    is_paid: boolean;
    payment_method_id?: string;
    category_id?: string;
    client_id?: string;
    created_at: string;
    payment_method?: { name: string };
    category?: { name: string };
    client?: { name: string };
}
