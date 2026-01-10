import React from 'react';
import { cn } from "@/app/lib/utils";

export const VoiceOrb = ({ mode = 'LISTENING' }: { mode?: 'LISTENING' | 'PROCESSING' | 'SPEAKING' }) => {
    return (
        <div className="w-full flex flex-col items-center justify-end pb-8">
            <style jsx>{`
                @keyframes colorCycle {
                    0% { filter: hue-rotate(0deg) brightness(1); }
                    50% { filter: hue-rotate(180deg) brightness(1.2); }
                    100% { filter: hue-rotate(360deg) brightness(1); }
                }
                .animate-color-cycle {
                    animation: colorCycle 3s linear infinite;
                }
            `}</style>

            {/* Text Label */}
            <div className="mb-6 text-white font-medium tracking-widest text-sm uppercase animate-pulse transition-all duration-500 text-shadow-sm">
                {mode === 'LISTENING' && "Ouvindo..."}
                {mode === 'PROCESSING' && "Processando..."}
                {mode === 'SPEAKING' && "Falando..."}
            </div>

            {/* Orb Container */}
            <div className={cn(
                "relative w-full h-[80px] flex items-end justify-center overflow-hidden transition-all duration-500",
                (mode === 'LISTENING' || mode === 'SPEAKING') && "animate-color-cycle"
            )}>

                {/* Main Horizontal Bar */}
                <div className={cn(
                    "absolute bottom-0 h-1.5 bg-white rounded-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(255,255,255,0.8)]",
                    mode === 'SPEAKING' ? "w-[95%] opacity-100" :
                        mode === 'PROCESSING' ? "w-[50%] opacity-80 animate-pulse" :
                            "w-[30%] opacity-60 animate-pulse"
                )} />

                {/* Wide Glow Layer 1 (Violet) */}
                <div className={cn(
                    "absolute bottom-0 h-[120px] bg-violet-600/60 blur-[50px] rounded-t-full transition-all duration-500",
                    mode === 'SPEAKING' ? "w-full opacity-90" :
                        mode === 'PROCESSING' ? "w-[80%] opacity-70" :
                            "w-[60%] opacity-50"
                )} />

                {/* Wide Glow Layer 2 (Blue/Cyan) */}
                <div className={cn(
                    "absolute bottom-0 h-[100px] bg-cyan-500/50 blur-[40px] rounded-t-full transition-all duration-500 delay-75",
                    mode === 'SPEAKING' ? "w-[90%] opacity-90" :
                        mode === 'PROCESSING' ? "w-[70%] opacity-60" :
                            "w-[40%] opacity-40"
                )} />

                {/* Wide Glow Layer 3 (Warm) */}
                <div className={cn(
                    "absolute bottom-0 h-[80px] bg-rose-500/40 blur-[30px] rounded-t-full transition-all duration-500 delay-150",
                    mode === 'SPEAKING' ? "w-[80%] opacity-80" :
                        mode === 'PROCESSING' ? "w-[60%] opacity-50" :
                            "w-[20%] opacity-20"
                )} />
            </div>
        </div>
    );
};
