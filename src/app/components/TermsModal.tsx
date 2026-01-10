'use client';

import { useState, useEffect, useRef } from 'react';
import { acceptTerms, checkTermsAccepted } from '../actions/auth';
import { ShieldCheck, ScrollText, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function TermsModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [canAccept, setCanAccept] = useState(false);
    const [hasAccepted, setHasAccepted] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        console.log('TermsModal mounted');
        checkStatus();

        const handleOpenEvent = () => {
            console.log('open-terms-modal event received');
            setIsOpen(true);
            setCanAccept(false); // Reset scroll requirement for re-viewing
            // Optional: Scroll to top if needed, but contentRef might not be ready immediately
            setTimeout(() => {
                if (contentRef.current) contentRef.current.scrollTop = 0;
            }, 100);
        };

        window.addEventListener('open-terms-modal', handleOpenEvent);
        return () => window.removeEventListener('open-terms-modal', handleOpenEvent);
    }, []);

    const checkStatus = async () => {
        try {
            // Check localStorage first as fallback
            const localAccepted = localStorage.getItem('terms_accepted_v1');
            if (localAccepted === 'true') {
                setHasAccepted(true);
                setLoading(false);
                return;
            }

            const accepted = await checkTermsAccepted();
            setHasAccepted(accepted);

            if (accepted) {
                // Store in localStorage for faster future checks
                localStorage.setItem('terms_accepted_v1', 'true');
            } else {
                setIsOpen(true);
            }
        } catch (error) {
            console.error('Error checking terms:', error);
            // Don't block user on error
            const localAccepted = localStorage.getItem('terms_accepted_v1');
            if (localAccepted === 'true') {
                setHasAccepted(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Check if scrolled to bottom (with small buffer)
        if (scrollHeight - scrollTop - clientHeight < 50) {
            setCanAccept(true);
        }
    };

    const handleAccept = async () => {
        if (!canAccept) return;
        setAccepting(true);
        try {
            await acceptTerms();
            localStorage.setItem('terms_accepted_v1', 'true');
            setHasAccepted(true);
            setIsOpen(false);
        } catch (error) {
            console.error('Error accepting terms:', error);
            alert('Erro ao aceitar os termos. Tente novamente.');
        } finally {
            setAccepting(false);
        }
    };

    const handleDecline = async () => {
        if (confirm("Ao recusar os termos, você será desconectado. Deseja continuar?")) {
            await supabase.auth.signOut();
            router.push('/login');
        }
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    if (loading || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-shrink-0">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Termos de Uso</h2>
                        <p className="text-sm text-gray-500">
                            {hasAccepted ? "Visualização dos termos" : "Leia até o final para aceitar"}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div
                    ref={contentRef}
                    onScroll={handleScroll}
                    className="p-6 overflow-y-auto text-gray-600 text-sm leading-relaxed space-y-6 flex-1 scroll-smooth"
                >
                    {/* ... content remains same ... */}
                    <h3 className="text-lg font-bold text-gray-900 text-center mb-4">📄 TERMOS DE USO</h3>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">1. Aceitação dos Termos</h4>
                        <p>Ao criar uma conta e utilizar este aplicativo, você declara que leu, entendeu e concorda com os presentes Termos de Uso. Caso não concorde com qualquer condição aqui descrita, recomendamos que não utilize o serviço.</p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">2. Descrição do serviço</h4>
                        <p>Este aplicativo é uma ferramenta de apoio à organização do trabalho, permitindo o registro, consulta e gerenciamento de informações relacionadas às atividades profissionais do usuário.</p>
                        <p className="mt-2">O serviço é disponibilizado no formato digital, podendo ser acessado por navegador ou instalado como aplicativo (PWA), sem necessidade de download em lojas oficiais.</p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">3. Cadastro e uso da conta</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Cada conta é pessoal e intransferível.</li>
                            <li>O usuário é responsável por manter suas informações corretas e atualizadas.</li>
                            <li>Para criar uma assinatura, é necessário fornecer um CPF válido. O CPF informado será vinculado permanentemente à conta e não poderá ser alterado após a confirmação.</li>
                            <li>O acesso ao aplicativo depende do status da assinatura, e não apenas do login.</li>
                            <li>A criação de múltiplas contas com a finalidade de obter vantagens indevidas (como uso repetido de período gratuito) pode resultar na limitação ou suspensão de benefícios promocionais, sem prejuízo do acesso mediante pagamento.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">4. Período gratuito (Trial)</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>O aplicativo pode oferecer um período gratuito inicial, destinado à avaliação do serviço.</li>
                            <li>O período gratuito é concedido uma única vez por usuário.</li>
                            <li>A empresa se reserva o direito de limitar ou remover o acesso ao trial em casos de uso indevido.</li>
                            <li>Ao final do período gratuito, o acesso a determinadas funcionalidades pode ser limitado até a regularização da assinatura.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">5. Assinatura, pagamentos e cobranças</h4>

                        <h5 className="font-semibold text-gray-700 mt-3 mb-1">5.1 Forma de pagamento</h5>
                        <p>Os pagamentos são realizados por meios eletrônicos disponibilizados no aplicativo, como Pix, boleto ou cartão de crédito, por intermédio de plataforma de pagamento terceirizada. A confirmação do pagamento pode levar algum tempo, de acordo com o meio utilizado.</p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>Pix e Boleto:</strong> Pagamento mensal avulso. É necessário realizar um novo pagamento a cada mês.</li>
                            <li><strong>Cartão de Crédito:</strong> Assinatura recorrente. O pagamento é renovado automaticamente todo mês até o cancelamento.</li>
                        </ul>

                        <h5 className="font-semibold text-gray-700 mt-3 mb-1">5.2 Ciclo de cobrança</h5>
                        <p>As assinaturas têm ciclo mensal. O vencimento ocorre sempre no mesmo dia do mês em que a assinatura foi contratada.</p>
                        <p className="mt-2"><strong>Exemplo:</strong> Se a assinatura for criada no dia 5 de janeiro, os próximos vencimentos serão nos dias 5 de fevereiro, 5 de março, e assim sucessivamente.</p>
                        <p className="mt-2 text-xs text-gray-500">Nota: Para meses com menos dias que a data de vencimento (ex: assinatura criada em 31/jan), o vencimento será ajustado para o último dia do mês.</p>

                        <h5 className="font-semibold text-gray-700 mt-3 mb-1">5.3 Pagamento antecipado</h5>
                        <p>Quando o pagamento é realizado antes da data de vencimento, o período de acesso é estendido automaticamente, sem perda de dias.</p>

                        <h5 className="font-semibold text-gray-700 mt-3 mb-1">5.4 Pagamento após o vencimento</h5>
                        <p>Caso o pagamento não seja realizado até a data de vencimento:</p>
                        <ul className="list-disc pl-5 space-y-1 mt-1">
                            <li>O acesso ao aplicativo poderá ser parcialmente limitado, afetando algumas funcionalidades.</li>
                            <li>Os dados do usuário não são apagados.</li>
                        </ul>
                        <p className="mt-2">Após a confirmação do pagamento:</p>
                        <ul className="list-disc pl-5 space-y-1 mt-1">
                            <li>O acesso é restabelecido automaticamente.</li>
                            <li>O novo período de uso passa a contar a partir da data do pagamento, sem desconto dos dias em que o acesso esteve limitado.</li>
                        </ul>

                        <h5 className="font-semibold text-gray-700 mt-3 mb-1">5.5 Pagamento duplicado</h5>
                        <p>Caso o usuário realize pagamentos duplicados de forma não intencional:</p>
                        <ul className="list-disc pl-5 space-y-1 mt-1">
                            <li>O valor excedente será convertido em saldo a favor.</li>
                            <li>Esse saldo será automaticamente utilizado para estender o período de acesso.</li>
                            <li>Não há necessidade de solicitação manual para esse ajuste.</li>
                        </ul>

                        <h5 className="font-semibold text-gray-700 mt-3 mb-1">5.6 Inadimplência</h5>
                        <p>O não pagamento da assinatura pode resultar em restrição progressiva de funcionalidades, conforme o tempo de atraso. A empresa não aplica multas ou cobranças adicionais além do valor da assinatura vigente.</p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">6. Limitação e suspensão de funcionalidades</h4>
                        <p>Em caso de inadimplência, uso indevido ou manutenção técnica, algumas funcionalidades do aplicativo podem ser temporariamente indisponibilizadas, sem que isso implique na exclusão de dados. O acesso completo será restabelecido após a regularização da situação.</p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">7. Cancelamento</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>O usuário pode cancelar o uso do aplicativo a qualquer momento.</li>
                            <li>Não há fidelidade mínima.</li>
                            <li>Não há taxa de cancelamento.</li>
                            <li>O cancelamento interrompe cobranças futuras, mas não gera reembolso de valores já pagos referentes a períodos já concedidos.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">8. Responsabilidades do usuário</h4>
                        <p>O usuário é responsável por:</p>
                        <ul className="list-disc pl-5 space-y-1 mt-1">
                            <li>Utilizar o aplicativo de forma lícita e ética.</li>
                            <li>Manter cópias de informações importantes.</li>
                            <li>Não utilizar o serviço para fins ilegais, fraudulentos ou que violem direitos de terceiros.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">9. Limitação de responsabilidade</h4>
                        <p>O aplicativo é fornecido “no estado em que se encontra”, podendo sofrer interrupções temporárias para manutenção, atualizações ou por fatores externos.</p>
                        <p className="mt-2">A empresa:</p>
                        <ul className="list-disc pl-5 space-y-1 mt-1">
                            <li>Não garante funcionamento ininterrupto.</li>
                            <li>Não se responsabiliza por perdas financeiras, lucros cessantes ou danos indiretos decorrentes do uso ou da impossibilidade de uso do aplicativo.</li>
                            <li>Não se responsabiliza por informações inseridas incorretamente pelo usuário.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">10. Dados e privacidade</h4>
                        <p>O tratamento de dados pessoais é realizado conforme descrito na Política de Privacidade, em conformidade com a legislação aplicável. O usuário pode solicitar a exclusão de seus dados, observadas as obrigações legais de armazenamento.</p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">11. Alterações nos Termos</h4>
                        <p>Estes Termos de Uso podem ser atualizados a qualquer momento para refletir melhorias no serviço ou mudanças legais. Sempre que possível, alterações relevantes serão comunicadas dentro do aplicativo.</p>
                    </section>

                    <section>
                        <h4 className="font-bold text-gray-800 mb-2">12. Disposições finais</h4>
                        <p>O uso continuado do aplicativo após alterações nos Termos representa concordância com as novas condições. Em caso de dúvidas, o usuário poderá entrar em contato pelos canais de suporte disponibilizados no aplicativo.</p>
                    </section>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-6">
                        <h4 className="font-bold text-blue-800 mb-1">📌 Declaração final</h4>
                        <p className="text-blue-700">Este aplicativo é uma ferramenta de apoio à organização profissional e não substitui controles pessoais, financeiros ou contábeis do usuário.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
                    {hasAccepted ? (
                        <div className="w-full flex justify-end">
                            <button
                                onClick={handleClose}
                                className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleDecline}
                                className="text-gray-500 hover:text-red-500 text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sair / Recusar
                            </button>

                            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                                {!canAccept && (
                                    <p className="text-xs text-orange-500 animate-pulse text-center sm:text-right w-full">
                                        Role até o fim para aceitar
                                    </p>
                                )}
                                <button
                                    onClick={handleAccept}
                                    disabled={!canAccept || accepting}
                                    className={`w-full sm:w-auto px-8 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${canAccept
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-500/20'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {accepting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Processando...
                                        </>
                                    ) : (
                                        <>
                                            <ScrollText className="w-4 h-4" />
                                            Li e Aceito os Termos
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
