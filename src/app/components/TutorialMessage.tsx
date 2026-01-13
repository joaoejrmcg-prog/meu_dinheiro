"use client";

import { TypewriterText } from "./TypewriterText";
import { formatMarkdown } from "../lib/markdown";

interface TutorialButton {
    label: string;
    value: string;
    variant?: 'primary' | 'secondary' | 'bank';
}

interface TutorialMessageProps {
    content: string;
    buttons?: TutorialButton[];
    onButtonClick: (value: string) => void;
    disabled?: boolean;
    typingComplete?: boolean; // Controlled from parent
    onTypingComplete?: () => void; // Callback when typing finishes
    onType?: () => void; // Callback during typing for auto-scroll
}

export function TutorialMessage({
    content,
    buttons,
    onButtonClick,
    disabled,
    typingComplete = false,
    onTypingComplete,
    onType
}: TutorialMessageProps) {

    return (
        <div className="flex flex-col gap-3">
            {!typingComplete ? (
                <TypewriterText
                    text={content}
                    speed={25}
                    onComplete={onTypingComplete}
                    onType={onType}
                />
            ) : (
                formatMarkdown(content)
            )}

            {typingComplete && buttons && buttons.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {buttons.map((btn, index) => (
                        <button
                            key={index}
                            onClick={() => !disabled && onButtonClick(btn.value)}
                            disabled={disabled}
                            className={`
                                px-4 py-2 rounded-xl text-sm font-medium 
                                transition-all duration-200 
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${btn.variant === 'primary'
                                    ? 'bg-[var(--primary)] text-black hover:bg-[var(--primary)]/80 shadow-lg shadow-[var(--primary)]/20'
                                    : btn.variant === 'bank'
                                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 hover:border-purple-400'
                                        : 'bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600'
                                }
                            `}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
