"use client";

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium ${copied
                ? 'bg-green-500 text-white shadow-lg scale-105'
                : 'bg-neutral-800 text-white hover:bg-neutral-700 active:scale-95 border border-neutral-700'
                }`}
            title="Copiar Link"
        >
            {copied ? (
                <>
                    <Check size={20} />
                    <span>Copiado!</span>
                </>
            ) : (
                <>
                    <Copy size={20} />
                    <span>Copiar</span>
                </>
            )}
        </button>
    );
}
