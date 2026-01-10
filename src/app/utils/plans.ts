export const PLAN_LIGHT = 'light';
export const PLAN_PRO = 'pro';
export const PLAN_VIP = 'vip';
export const PLAN_TRIAL = 'trial';

export const PLAN_LIGHT_PRICE = 19.90;
export const PLAN_PRO_PRICE = 39.90;

export const plansData = [
    {
        name: 'LIGHT',
        id: PLAN_LIGHT,
        price: `R$ ${PLAN_LIGHT_PRICE.toFixed(2).replace('.', ',')}/mês`,
        value: PLAN_LIGHT_PRICE,
        features: [
            '10 interações com IA por dia',
            'Agenda ilimitada',
            'Gestão financeira completa',
            'Cadastro de clientes',
            'Suporte por email',
        ],
    },
    {
        name: 'PRO',
        id: PLAN_PRO,
        price: `R$ ${PLAN_PRO_PRICE.toFixed(2).replace('.', ',')}/mês`,
        value: PLAN_PRO_PRICE,
        features: [
            '✨ IA Ilimitada',
            'Agenda ilimitada',
            'Gestão financeira completa',
            'Cadastro de clientes',
            'Suporte prioritário',
            'Relatórios avançados',
        ],
        isMostPopular: true,
    },
];

export function getPlanPrice(planId: string): number {
    if (planId === PLAN_LIGHT) return PLAN_LIGHT_PRICE;
    if (planId === PLAN_PRO) return PLAN_PRO_PRICE;
    return 0;
}

export function getPlanDisplayName(plan: string) {
    switch (plan) {
        case PLAN_LIGHT:
            return 'Plano Light';
        case PLAN_PRO:
            return 'Plano Pro';
        case PLAN_VIP:
            return 'Plano VIP';
        case PLAN_TRIAL:
            return 'Período de Testes';
        default:
            return plan.charAt(0).toUpperCase() + plan.slice(1);
    }
}
