import React, { useState, useEffect, useRef } from 'react';

function getShortModelName(modelName) {
    if (!modelName) return "";
    if (modelName === 'llamacpp') return 'LlamaCpp';
    let clean = modelName.replace(/\.gguf$/i, "");
    clean = clean.replace(/[-_]Q8_0$/i, "");
    clean = clean.replace(/[-_]q8$/i, "");
    if (clean.toLowerCase().includes("exaone")) return "EXAONE 1.2B";
    if (clean.toLowerCase().includes("gemma-4")) return "Gemma-4 2B";
    if (clean.toLowerCase().includes("gemma-3") || clean.toLowerCase().includes("gemma")) return "Gemma-3 1B";
    if (clean.toLowerCase().includes("lfm2")) return "LFM2 1.2B";
    if (clean.toLowerCase().includes("minicpm")) return "MiniCPM 1B";
    if (clean.toLowerCase().includes("qwen3.5-0.8b")) return "Qwen3.5 0.8B";
    if (clean.toLowerCase().includes("qwen3.5-2b")) return "Qwen3.5 2B";
    if (clean.toLowerCase().includes("qwen3.5-4b")) return "Qwen3.5 4B";
    return clean;
}

export default function RetroSelect({ value, onChange, options, className = "", width = '150px' }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizedOptions = (options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) return { value: opt.value, label: opt.label };
        return { value: opt, label: getShortModelName(opt) || opt };
    });

    const currentOpt = normalizedOptions.find(o => o.value === value) || { value, label: getShortModelName(value) || value };

    return (
        <div
            ref={containerRef}
            className={`relative inline-block select-none ${className}`}
            style={{ width, fontFamily: 'var(--font-sans)' }}
        >
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="app-select-box"
                style={{ width }}
            >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
                    {currentOpt.label}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s', flexShrink: 0 }}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <div
                    className="app-select-dropdown modern-scrollbar"
                    style={{ position: 'absolute', zIndex: 9999, left: 0, top: '100%', marginTop: '2px', width }}
                >
                    {normalizedOptions.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <div
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`app-select-option ${isSelected ? 'selected' : ''}`}
                            >
                                {opt.label}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
