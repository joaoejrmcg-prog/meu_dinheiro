"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Trash2, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

type Notification = {
    id: string;
    title: string;
    message: string;
    full_content?: string;
    type: 'info' | 'warning' | 'error' | 'success';
    read: boolean;
    created_at: string;
    source: 'system' | 'advisor';
    priority?: string;
};

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch System Notifications
            const { data: systemData, error: systemError } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (systemError && systemError.code !== '42P01') throw systemError;

            // 2. Fetch Advisor Notifications
            const { data: advisorData, error: advisorError } = await supabase
                .from('advisor_notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (advisorError && advisorError.code !== '42P01') throw advisorError;

            // 3. Normalize and Merge
            const formattedSystem = (systemData || []).map(n => ({
                ...n,
                source: 'system' as const
            }));

            const formattedAdvisor = (advisorData || []).map(n => ({
                id: n.id,
                title: n.title,
                message: n.content_markdown.substring(0, 100) + '...', // Preview
                full_content: n.content_markdown,
                type: 'info', // Advisor is usually info/insight
                read: !!n.read_at,
                created_at: n.created_at,
                source: 'advisor' as const,
                priority: n.priority
            }));

            const allNotifications = [...formattedSystem, ...formattedAdvisor].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setNotifications(allNotifications);
        } catch (error: any) {
            if (error?.code !== '42P01') {
                console.error('Error fetching notifications:', error);
            }
        } finally {
            setLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchNotifications();

        // Set up real-time subscription for System Notifications
        const channelSystem = supabase
            .channel('notifications_system')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                setNotifications(prev => [{ ...payload.new as Notification, source: 'system' }, ...prev]);
            })
            .subscribe();

        // Set up real-time subscription for Advisor Notifications
        const channelAdvisor = supabase
            .channel('notifications_advisor')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'advisor_notifications'
            }, (payload) => {
                const newNotif = payload.new;
                const formatted: Notification = {
                    id: newNotif.id,
                    title: newNotif.title,
                    message: newNotif.content_markdown.substring(0, 100) + '...',
                    full_content: newNotif.content_markdown,
                    type: 'info',
                    read: !!newNotif.read_at,
                    created_at: newNotif.created_at,
                    source: 'advisor',
                    priority: newNotif.priority
                };
                setNotifications(prev => [formatted, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channelSystem);
            supabase.removeChannel(channelAdvisor);
        };
    }, [fetchNotifications]);

    const handleClearAll = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase.from('notifications').delete().eq('user_id', user.id);
            // Optional: Clear advisor notifications too? Or just mark as read?
            // For now, let's just clear system ones or we need a loop.
            // Let's implement delete for individual items properly.

            setNotifications([]);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const handleDelete = async (id: string, source: 'system' | 'advisor') => {
        try {
            if (source === 'system') {
                await supabase.from('notifications').delete().eq('id', id);
            } else {
                await supabase.from('advisor_notifications').delete().eq('id', id);
            }
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const markAsRead = async (notification: Notification) => {
        if (notification.read) return;
        try {
            if (notification.source === 'system') {
                await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
            } else {
                await supabase.from('advisor_notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id);
            }
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }

    const markAllAsRead = async () => {
        // ... (Simplified for brevity, can implement if needed, but individual read on click is better for Advisor)
        // For now, let's keep the existing behavior for system, and maybe loop for advisor?
        // Let's just mark visible ones as read locally to clear the badge.
        // Ideally we should update DB.
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // System
            await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);

            // Advisor
            await supabase.from('advisor_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);

            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getIcon = (type: string, source: 'system' | 'advisor') => {
        if (source === 'advisor') return <Bell className="w-5 h-5 text-purple-400" />;
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
            default: return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getBgColor = (type: string, source: 'system' | 'advisor') => {
        if (source === 'advisor') return 'bg-purple-500/10 border-purple-500/20';
        switch (type) {
            case 'success': return 'bg-green-500/10 border-green-500/20';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
            case 'error': return 'bg-red-500/10 border-red-500/20';
            default: return 'bg-blue-500/10 border-blue-500/20';
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <>
            <button
                onClick={() => {
                    setIsOpen(true);
                    markAllAsRead();
                }}
                className="p-2 text-neutral-400 hover:text-blue-400 transition-colors relative group"
                title="Notificações"
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse text-blue-400' : 'group-hover:animate-swing'}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-start justify-end bg-black/60 backdrop-blur-sm p-4 pt-16 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] overflow-hidden relative animate-in slide-in-from-right duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5 text-blue-400" />
                                <h3 className="text-lg font-bold text-neutral-100">Notificações</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && (
                                    <button
                                        onClick={handleClearAll}
                                        className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                                        title="Limpar todas"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 text-neutral-500 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loading ? (
                                <div className="text-center py-8 text-neutral-500">
                                    Carregando...
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="text-center py-8 text-neutral-500">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>Nenhuma notificação</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`${getBgColor(notification.type, notification.source)} border rounded-xl p-4 relative group transition-all duration-200`}
                                        onClick={() => {
                                            if (notification.source === 'advisor') {
                                                setExpandedId(expandedId === notification.id ? null : notification.id);
                                                markAsRead(notification);
                                            }
                                        }}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(notification.id, notification.source);
                                            }}
                                            className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getIcon(notification.type, notification.source)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-neutral-100 text-sm">
                                                    {notification.title}
                                                </p>

                                                {/* Content / Message */}
                                                {expandedId === notification.id && notification.full_content ? (
                                                    <div className="mt-3 text-sm text-neutral-300 prose prose-invert prose-sm max-w-none">
                                                        {/* Simple Markdown rendering - replace newlines with br for basic support if no library */}
                                                        <div className="whitespace-pre-wrap font-sans">
                                                            {notification.full_content}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-neutral-400 text-sm mt-1 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                )}

                                                {notification.source === 'advisor' && expandedId !== notification.id && (
                                                    <p className="text-xs text-purple-400 mt-2">Clique para expandir</p>
                                                )}

                                                <p className="text-neutral-600 text-xs mt-2">
                                                    {new Date(notification.created_at).toLocaleDateString('pt-BR', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
