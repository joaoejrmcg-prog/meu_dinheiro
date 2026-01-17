"use client";
// Vercel Connection Verified ✅


import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import TermsModal from "./TermsModal";
import TipsModal from "./TipsModal";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthCallback, setIsAuthCallback] = useState(false);

    const publicRoutes = ['/login', '/forgot-password', '/update-password'];
    const isPublicPage = publicRoutes.includes(pathname);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Auth check failed", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                setIsAuthenticated(false);

                // Only redirect if not on public page
                if (!publicRoutes.includes(window.location.pathname)) {
                    router.push('/login');
                }
            } else if (session) {
                setIsAuthenticated(true);

                // Keep biometric token fresh
                if (typeof window !== 'undefined' && localStorage.getItem('biometric_enrolled') === 'true' && session.refresh_token) {
                    localStorage.setItem('biometric_refresh_token', session.refresh_token);
                    if (session.user.email) {
                        localStorage.setItem('biometric_email', session.user.email);
                    }
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    // Protect private routes
    useEffect(() => {
        const isAuthCallback = window.location.search.includes('code=');
        if (!isLoading && !isAuthenticated && !isPublicPage && !isAuthCallback) {
            router.push('/login');
            router.refresh();
        }
    }, [isLoading, isAuthenticated, isPublicPage, router]);

    // Close sidebar on route change
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    // Check for auth code on mount to avoid hydration mismatch
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
            setIsAuthCallback(true);
        }
    }, []);

    // Safety net: If stuck in redirect state for too long, force hard navigation
    useEffect(() => {
        if (!isAuthenticated && !isAuthCallback && !isPublicPage && !isLoading) {
            const timer = setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, isAuthCallback, isPublicPage, isLoading]);

    if (isLoading && !isPublicPage) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950" suppressHydrationWarning>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" suppressHydrationWarning></div>
            </div>
        );
    }

    if (isPublicPage) {
        return <>{children}</>;
    }

    if (!isAuthenticated && !isAuthCallback) {
        // Show loading state instead of null (black screen) while redirecting
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950" suppressHydrationWarning>
                <div className="flex flex-col items-center gap-4" suppressHydrationWarning>
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" suppressHydrationWarning></div>
                    <p className="text-neutral-400 text-sm">Redirecionando...</p>
                </div>
            </div>
        );
    }

    // Determine if we're on the home page (light theme)
    const isHomePage = pathname === '/';

    return (
        <div className={`flex min-h-screen font-sans ${isHomePage ? 'text-slate-800' : 'bg-neutral-950 text-neutral-100'}`}
            style={isHomePage ? { background: 'var(--light-background)' } : {}}>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 lg:ml-64 flex flex-col w-full">
                <div className="print:hidden sticky top-0 z-40">
                    <Header onMenuClick={() => setIsSidebarOpen(true)} isLightTheme={isHomePage} />
                </div>
                <main className={`flex-1 relative overflow-y-auto ${isHomePage ? 'p-0' : 'p-4 lg:p-8'}`}>
                    {children}
                </main>
            </div>
            <TermsModal />
            <TipsModal />
        </div>
    );
}
