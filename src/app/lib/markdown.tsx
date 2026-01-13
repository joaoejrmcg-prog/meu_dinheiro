import React from 'react';

export function formatMarkdown(text: string): React.ReactNode {
    if (!text) return null;

    // Split by **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </span>
    );
}
