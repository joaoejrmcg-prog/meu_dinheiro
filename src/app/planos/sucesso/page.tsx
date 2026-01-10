'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

export default function SucessoPage() {
    const searchParams = useSearchParams();
    const paymentUrl = searchParams.get('paymentUrl');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">Aguardando Pagamento</h1>

                <p className="text-gray-600 mb-8">
                    Seu pedido foi gerado! Realize o pagamento para liberar seu acesso.
                </p>

                {paymentUrl && (
                    <div className="mb-8">
                        <p className="text-sm text-gray-500 mb-3">Clique abaixo para realizar o pagamento:</p>
                        <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-4 px-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                        >
                            Pagar Agora <ExternalLink size={20} />
                        </a>
                    </div>
                )}

                <div className="space-y-4">
                    <Link
                        href="/planos"
                        className="block w-full bg-indigo-50 text-indigo-700 py-3 px-4 rounded-xl font-semibold hover:bg-indigo-100 transition-colors"
                    >
                        Ver Minha Assinatura
                    </Link>

                    <Link
                        href="/"
                        className="block w-full text-gray-500 font-medium hover:text-gray-700 transition-colors"
                    >
                        Voltar ao Início
                    </Link>
                </div>
            </div>
        </div>
    );
}
