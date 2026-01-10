"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, DollarSign, LogOut, X, PieChart, Wallet, Target, HelpCircle, Shield, User, Gift, BarChart3, Calendar, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { cn } from "../lib/utils";
import { getUserLevel } from "../actions/profile";
import { LEVEL_CONFIG, type UserLevel } from "../lib/levels";

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        const { performLogout } = await import('../lib/auth-utils');
        await performLogout(router);
    };

    const [isAdmin, setIsAdmin] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [userLevel, setUserLevel] = useState<UserLevel>(0);
    const [levelLoaded, setLevelLoaded] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            // Check admin
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email === 'neomercadoia@gmail.com') {
                setIsAdmin(true);
                const { getPendingCount } = await import('../actions/admin');
                const count = await getPendingCount();
                setPendingCount(count);
            }

            // Get user level
            try {
                const level = await getUserLevel();
                setUserLevel(level);
            } catch (e) {
                console.error("Error loading user level:", e);
                setUserLevel(1); // Default to level 1 if error
            }
            setLevelLoaded(true);
        };
        loadData();

        const handleLevelUpdate = (e: CustomEvent) => {
            setUserLevel(e.detail.level);
        };
        window.addEventListener('userLevelUpdate', handleLevelUpdate as EventListener);

        return () => {
            window.removeEventListener('userLevelUpdate', handleLevelUpdate as EventListener);
        };
    }, []);

    const menuItems = [
        { icon: Home, label: "Início (IA)", href: "/", minLevel: 0 },
        { icon: PieChart, label: "Visão Geral", href: "/dashboard", minLevel: 1 },
        { icon: DollarSign, label: "Financeiro", href: "/financial", minLevel: 1 },
        { icon: Calendar, label: "Calendário", href: "/calendar", minLevel: 2 },
        { icon: Wallet, label: "Contas e Cartões", href: "/assets", minLevel: 2 },
        { icon: Target, label: "Planejamento", href: "/planning", minLevel: 4 },
        { icon: BarChart3, label: "Relatórios", href: "/reports", minLevel: 1 },
    ];

    const levelConfig = LEVEL_CONFIG[userLevel] || LEVEL_CONFIG[0];

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar */}
            <aside className={cn(
                "w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            Meu Dinheiro
                        </h1>
                        <p className="text-xs text-neutral-500 mt-1">
                            {levelConfig.theme} Nível {userLevel}: {levelConfig.name}
                        </p>
                    </div>
                    <button onClick={onClose} className="lg:hidden text-neutral-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        const isLocked = userLevel < item.minLevel;

                        if (isLocked) {
                            return (
                                <div
                                    key={item.href}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-600 cursor-not-allowed"
                                    title={`Desbloqueado no nível ${item.minLevel}`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium flex-1">{item.label}</span>
                                    <Lock className="w-4 h-4 text-neutral-700" />
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onClose?.()}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Admin Link */}
                {isAdmin && (
                    <div className="px-4 pb-2">
                        <Link
                            href="/admin"
                            onClick={() => onClose?.()}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                pathname === "/admin"
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                            )}
                        >
                            <div className="relative">
                                <Shield className="w-5 h-5" />
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                )}
                            </div>
                            <span className="font-medium">Admin</span>
                            {pendingCount > 0 && (
                                <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                        </Link>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="px-4 pb-4 space-y-2">
                    <Link
                        href="/referral"
                        onClick={() => onClose?.()}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                            pathname === "/referral"
                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        )}
                    >
                        <Gift className="w-5 h-5" />
                        <span className="font-medium">Indicar Amigo</span>
                    </Link>
                    <Link
                        href="/ajuda"
                        onClick={() => onClose?.()}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                            pathname === "/ajuda"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        )}
                    >
                        <HelpCircle className="w-5 h-5" />
                        <span className="font-medium">Ajuda</span>
                    </Link>
                    <Link
                        href="/perfil"
                        onClick={() => onClose?.()}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                            pathname === "/perfil"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        )}
                    >
                        <User className="w-5 h-5" />
                        <span className="font-medium">Meu Perfil</span>
                    </Link>
                </div>

                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-neutral-400 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
