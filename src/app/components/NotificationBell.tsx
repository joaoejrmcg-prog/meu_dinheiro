"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Trash2, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

type Notification = {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    read: boolean;
    created_at: string;
};

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            // Silently fail if table doesn't exist (42P01)
            if (error?.code === '42P01') {
                setNotifications([]);
                return;
            }
            if (error) throw error;
            setNotifications(data || []);
        } catch (error: any) {
            // Only log if not a "relation does not exist" error
            if (error?.code !== '42P01') {
                console.error('Error fetching notifications:', error);
            }
        } finally {
            setLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchNotifications();

        // Set up real-time subscription
        const channel = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                setNotifications(prev => [payload.new as Notification, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchNotifications]);

    const handleClearAll = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id);

            setNotifications([]);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
            default: return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getBgColor = (type: string) => {
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
                onClick={() => setIsOpen(true)}
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
                                        className={`${getBgColor(notification.type)} border rounded-xl p-4 relative group`}
                                    >
                                        <button
                                            onClick={() => handleDelete(notification.id)}
                                            className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-neutral-100 text-sm">
                                                    {notification.title}
                                                </p>
                                                <p className="text-neutral-400 text-sm mt-1">
                                                    {notification.message}
                                                </p>
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
