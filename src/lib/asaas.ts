import { createClient } from '@supabase/supabase-js';

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    console.error("Asaas environment variables are missing.");
}

interface AsaasCustomer {
    id: string;
    name: string;
    email: string;
    cpfCnpj?: string;
    mobilePhone?: string;
}

interface AsaasSubscription {
    id: string;
    customer: string;
    value: number;
    nextDueDate: string;
    cycle: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
    description?: string;
    billingType?: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
}

export async function createAsaasCustomer(customerData: {
    name: string;
    email: string;
    cpfCnpj?: string;
    mobilePhone?: string;
    externalReference: string;
}): Promise<AsaasCustomer> {
    // First, try to find if customer already exists by email
    const searchResponse = await fetch(`${ASAAS_API_URL}/customers?email=${customerData.email}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        }
    });

    if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
            return searchData.data[0];
        }
    }

    // If not found, create new
    const response = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        },
        body: JSON.stringify(customerData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create Asaas customer: ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

export async function createAsaasSubscription(subscriptionData: {
    customer: string;
    billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
    value: number;
    nextDueDate: string;
    cycle: 'MONTHLY';
    description: string;
    externalReference: string;
}): Promise<AsaasSubscription & { invoiceUrl: string, bankSlipUrl?: string }> { // invoiceUrl is usually returned in the response or related payment
    const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        },
        body: JSON.stringify({
            customer: subscriptionData.customer,
            billingType: subscriptionData.billingType,
            value: subscriptionData.value,
            nextDueDate: subscriptionData.nextDueDate,
            cycle: subscriptionData.cycle,
            description: subscriptionData.description,
            externalReference: subscriptionData.externalReference
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create Asaas subscription: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // Asaas subscription response doesn't always have the payment link directly if it's just created. 
    // Usually for subscriptions, you might want to get the first payment to show the link.
    // However, Asaas often sends an email. 
    // Let's try to fetch the first payment of this subscription to get the payment link.

    const paymentsResponse = await fetch(`${ASAAS_API_URL}/subscriptions/${data.id}/payments`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        }
    });

    if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        if (paymentsData.data && paymentsData.data.length > 0) {
            const firstPayment = paymentsData.data[0];
            return { ...data, invoiceUrl: firstPayment.invoiceUrl, bankSlipUrl: firstPayment.bankSlipUrl };
        }
    }

    return data;
}

export async function getAsaasSubscription(id: string) {
    const response = await fetch(`${ASAAS_API_URL}/subscriptions/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        }
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

export async function updateAsaasSubscription(id: string, data: {
    value?: number;
    description?: string;
    cycle?: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
    nextDueDate?: string;
    updatePendingPayments?: boolean;
}) {
    const response = await fetch(`${ASAAS_API_URL}/subscriptions/${id}`, {
        method: 'POST', // Asaas uses POST for updates usually, or PUT. Docs say POST for update.
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update Asaas subscription: ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

export async function createAsaasCharge(chargeData: {
    customer: string;
    billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
    value: number;
    dueDate: string;
    description?: string;
    externalReference: string;
}) {
    const response = await fetch(`${ASAAS_API_URL}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY!
        },
        body: JSON.stringify(chargeData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create Asaas charge: ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

export async function cancelAsaasSubscription(subscriptionId: string) {
    const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: {
            'access_token': ASAAS_API_KEY!
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to cancel Asaas subscription: ${JSON.stringify(errorData)}`);
    }

    return response.json();
}
