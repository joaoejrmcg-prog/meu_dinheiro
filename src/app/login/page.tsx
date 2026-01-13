"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, ArrowRight, Fingerprint, Eye, EyeOff } from "lucide-react";
import { getURL } from "../lib/utils";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import BiometricSetupPrompt from "../components/BiometricSetupPrompt";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const searchParams = useSearchParams();
    const referralCode = searchParams.get('ref');
    const [mode, setMode] = useState<'login' | 'signup'>(referralCode ? 'signup' : 'login');
    const router = useRouter();

    // Biometric states
    const { isSupported, isEnrolled, isLoading: biometricLoading, registerBiometric, authenticateBiometric, updateBiometricToken } = useBiometricAuth();
    const [showBiometricSetup, setShowBiometricSetup] = useState(false);
    const biometricAutoTriggered = useRef(false);

    // Auto-trigger biometric authentication when enrolled
    useEffect(() => {
        const tryBiometricLogin = async () => {
            // Check if user just logged out via URL param
            const justLoggedOut = searchParams.get('logged_out') === 'true';

            if (justLoggedOut) {
                // Remove param from URL cleanly without refresh if possible, or just ignore
                return;
            }

            if (isEnrolled && mode === 'login' && !biometricAutoTriggered.current) {
                biometricAutoTriggered.current = true;

                const authData = await authenticateBiometric();

                if (authData) {
                    const { email, refreshToken } = authData;

                    // Try automatic login with refresh token
                    if (refreshToken) {
                        try {
                            // Use refreshSession() to get new access token from refresh token
                            const { data, error } = await supabase.auth.refreshSession({
                                refresh_token: refreshToken
                            });

                            if (error) throw error;

                            if (data.session) {
                                // Navigate immediately without waiting
                                window.location.href = '/';
                                return;
                            }
                        } catch (error: any) {
                            console.error('[BIOMETRIC] Refresh token invalid or expired:', error);
                            // Token inválido - limpar dados biométricos
                            localStorage.removeItem('biometric_refresh_token');
                            localStorage.removeItem('biometric_enrolled');
                        }
                    }

                    // Fallback: apenas preencher email se não houver token ou se falhou
                    setEmail(email);
                }
            }
        };

        tryBiometricLogin();
    }, [isEnrolled, mode, authenticateBiometric]);

    const handleManualBiometric = async () => {
        biometricAutoTriggered.current = false; // Reset trigger
        const authData = await authenticateBiometric();

        if (authData) {
            const { email, refreshToken } = authData;
            if (refreshToken) {
                try {
                    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
                    if (!error && data.session) {
                        window.location.href = '/';
                        return;
                    }
                } catch (e) { console.error(e); }
            }
            setEmail(email);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    throw new Error("As senhas não coincidem.");
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${getURL()}`,
                        data: {
                            referral_code: referralCode
                        }
                    }
                });
                if (error) throw error;
                alert("✅ Cadastro realizado!\n\n📬 Verifique seu email para confirmar sua conta.\n\n💡 O email será enviado por Supabase. Confira o spam se não aparecer na caixa de entrada!");
                setMode('login');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                // After successful login, offer biometric setup if supported and not enrolled
                if (isSupported) {
                    const biometricDeclined = localStorage.getItem('biometric_declined') === 'true';
                    if (!isEnrolled && !biometricDeclined) {
                        setShowBiometricSetup(true);
                        // Don't redirect yet, wait for user decision
                    } else {
                        // Se já tem biometria, atualizar o token para garantir que o auto-login continue funcionando
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.refresh_token) {
                            // Precisamos importar essa função do hook, verifique se foi desestruturada lá em cima
                            // Como não podemos chamar o hook condicionalmente aqui dentro, vamos assumir que ele já foi chamado no componente
                            // e vamos usar a função que já temos disponível no escopo do componente
                            // @ts-ignore - updateBiometricToken will be available after the hook update
                            if (typeof updateBiometricToken === 'function') {
                                // @ts-ignore
                                updateBiometricToken(session.refresh_token);
                            }
                        }

                        router.refresh();
                        router.push("/");
                    }
                } else {
                    router.refresh();
                    router.push("/");
                }
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            if (err.message === "User already registered") {
                setError("Este email já está cadastrado. Tente fazer login.");
            } else if (err.message === "Invalid login credentials") {
                setError("Email ou senha incorretos.");
            } else if (err.message?.includes("Password should be at least")) {
                setError("A senha deve ter pelo menos 6 caracteres.");
            } else if (err.message?.includes("Unable to validate email")) {
                setError("Email inválido. Verifique o formato.");
            } else if (err.message?.includes("Email rate limit")) {
                setError("Muitas tentativas. Aguarde alguns minutos.");
            } else if (err.message?.includes("Signup is disabled")) {
                setError("Cadastro de novos usuários está desabilitado.");
            } else if (err.message?.includes("fetch")) {
                setError("Erro de conexão. Verifique sua internet.");
            } else {
                // Show actual error for debugging in production
                setError(err.message || "Ocorreu um erro ao tentar entrar.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSetupBiometric = async () => {
        // Obter refresh token da sessão atual do Supabase
        const { data: { session } } = await supabase.auth.getSession();

        const refreshToken = session?.refresh_token;

        if (!refreshToken) {
            alert('Erro ao configurar biometria: Sessão inválida. Tente fazer login novamente.');
            return;
        }

        const success = await registerBiometric(email, refreshToken);

        if (success) {
            setShowBiometricSetup(false);
            alert('✅ Biometria ativada com sucesso! Na próxima vez, só use seu dedo!');
            router.refresh();
            router.push("/");
        } else {
            alert('Não foi possível ativar a biometria');
            setShowBiometricSetup(false);
            router.refresh();
            router.push("/");
        }
    };

    const handleSkipBiometric = () => {
        localStorage.setItem('biometric_declined', 'true');
        setShowBiometricSetup(false);
        router.refresh();
        router.push("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 relative overflow-hidden">
            {/* Background Effects (Blue Theme) */}
            {/* Background Effects (Blue Theme for Login, Purple for Signup) */}
            <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[128px] transition-colors duration-1000 ${mode === 'login' ? 'bg-green-600/20' : 'bg-purple-600/20'}`} />
            <div className={`absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[128px] transition-colors duration-1000 ${mode === 'login' ? 'bg-emerald-600/20' : 'bg-green-600/20'}`} />

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr mb-4 shadow-lg transition-all duration-500 ${mode === 'login' ? 'from-green-500 to-emerald-500 shadow-green-500/20' : 'from-purple-500 to-green-500 shadow-purple-500/20'}`}>
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h1 className={`text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent transition-all duration-500 ${mode === 'login' ? 'from-green-200 to-emerald-400' : 'from-purple-200 to-green-400'}`}>
                            Meu Dinheiro
                        </h1>
                        <p className="text-sm text-neutral-400 mt-2">
                            {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                        </p>
                    </div>

                    {referralCode && mode === 'signup' && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs p-3 rounded-lg text-center mb-6 animate-pulse">
                            🎉 Código de indicação aplicado!
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400 ml-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full p-3 bg-neutral-800/60 border border-neutral-700 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-500"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400 ml-1">{mode === 'login' ? 'Senha' : 'Crie uma senha'}</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={mode === 'login' ? '••••••••' : 'Digite sua senha'}
                                    className="w-full p-3 pr-10 bg-neutral-800/60 border border-neutral-700 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-500"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        {mode === 'signup' && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-medium text-neutral-400 ml-1">Confirme sua senha</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repita a senha"
                                        className="w-full p-3 pr-10 bg-neutral-800/60 border border-neutral-700 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all text-neutral-200 placeholder:text-neutral-500"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end">
                            {mode === 'login' && (
                                <a href="/forgot-password" className="text-xs text-green-400 hover:text-green-300 transition-colors">
                                    Esqueci minha senha
                                </a>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                                {error}
                            </div>
                        )}

                        {isEnrolled && mode === 'login' && (
                            <button
                                type="button"
                                onClick={handleManualBiometric}
                                className="w-full p-3 mb-3 bg-neutral-800/50 text-neutral-300 rounded-xl font-medium hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 border border-neutral-700/50 hover:border-neutral-600"
                            >
                                <Fingerprint className="w-5 h-5 text-green-400" />
                                Entrar com Biometria
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full p-3 bg-gradient-to-r text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mt-2 ${mode === 'login' ? 'from-green-600 to-emerald-600 shadow-green-500/20' : 'from-purple-600 to-green-600 shadow-purple-500/20'}`}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                            className={`text-sm transition-colors font-medium ${mode === 'login' ? 'text-green-400 hover:text-green-300 text-base font-bold' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-neutral-600 mt-8">
                    &copy; 2025 Meu Dinheiro. Gestão Inteligente.
                </p>
            </div>

            {/* Biometric Setup Prompt */}
            <BiometricSetupPrompt
                isOpen={showBiometricSetup}
                isLoading={biometricLoading}
                onSetup={handleSetupBiometric}
                onSkip={handleSkipBiometric}
            />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 className="text-green-500 animate-spin" /></div>}>
            <LoginForm />
        </Suspense>
    );
}
