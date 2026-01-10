"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";
import { Menu } from "lucide-react";
import TipOfTheDay from "./TipOfTheDay";
import NotificationBell from "./NotificationBell";

interface HeaderProps {
    onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('user_id', user.id)
                    .single();

                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url);
                }
            }
        };
        getUser();
    }, []);

    const handleAvatarClick = () => {
        document.getElementById('avatar-upload')?.click();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Você deve selecionar uma imagem para fazer upload.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user?.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('user_id', user?.id);

            if (updateError) {
                throw updateError;
            }

            setAvatarUrl(publicUrl);
            alert('Avatar atualizado com sucesso!');
        } catch (error: any) {
            alert('Erro ao atualizar avatar: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <header className="h-16 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 text-neutral-400 hover:text-white"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-neutral-200 font-medium">
                    Olá, <span className="bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent font-bold">{user?.email?.split('@')[0] || 'Visitante'}</span>
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <NotificationBell />
                <TipOfTheDay />
                <div
                    onClick={handleAvatarClick}
                    className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer overflow-hidden relative hover:opacity-80 transition-opacity"
                    title="Clique para alterar a foto"
                >
                    {uploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    ) : avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        user?.email?.[0].toUpperCase()
                    )}
                    <input
                        type="file"
                        id="avatar-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                </div>
            </div>
        </header>
    );
}
