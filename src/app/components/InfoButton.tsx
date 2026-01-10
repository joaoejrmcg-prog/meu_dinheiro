"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface InfoButtonProps {
    text: string;
}

export function InfoButton({ text }: InfoButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative inline-flex items-center ml-2" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors focus:outline-none"
                aria-label="Informações"
            >
                <HelpCircle className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-64 p-3 mt-2 text-xs text-neutral-200 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl -translate-x-1/2 left-1/2 top-full">
                    <div className="relative">
                        {/* Seta do tooltip */}
                        <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 border-8 border-transparent border-b-neutral-800" />
                        {text}
                    </div>
                </div>
            )}
        </div>
    );
}
