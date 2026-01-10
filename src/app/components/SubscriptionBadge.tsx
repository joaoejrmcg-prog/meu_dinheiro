interface SubscriptionBadgeProps {
    plan: string;
    status: string;
}

export default function SubscriptionBadge({ plan, status }: SubscriptionBadgeProps) {
    // Cores por plano
    const planColors = {
        'vip': 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white',
        'pro': 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white',
        'light': 'bg-gradient-to-r from-green-500 to-emerald-600 text-white',
        'trial': 'bg-gray-200 text-gray-700',
    };

    // Cores por status
    const statusColors = {
        'active': 'bg-green-100 text-green-700 border-green-300',
        'trial': 'bg-blue-100 text-blue-700 border-blue-300',
        'overdue': 'bg-yellow-100 text-yellow-700 border-yellow-300',
        'canceled': 'bg-red-100 text-red-700 border-red-300',
    };

    // Textos formatados
    const planNames = {
        'vip': 'VIP',
        'pro': 'PRO',
        'light': 'LIGHT',
        'trial': 'TRIAL',
    };

    const statusNames = {
        'active': 'Ativo',
        'trial': 'Período de Testes',
        'overdue': 'Vencido',
        'canceled': 'Cancelado',
    };

    const planColor = planColors[plan as keyof typeof planColors] || planColors.trial;
    const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.active;
    const planName = planNames[plan as keyof typeof planNames] || plan.toUpperCase();
    const statusName = statusNames[status as keyof typeof statusNames] || status;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Badge do Plano */}
            <span className={`px-4 py-2 rounded-lg font-bold text-sm ${planColor}`}>
                {planName}
            </span>

            {/* Badge do Status */}
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                {statusName}
            </span>
        </div>
    );
}
