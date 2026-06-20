import React, { useState, useEffect, useRef } from 'react';

function getShortModelName(modelName) {
    if (!modelName) return "";
    // If it's a provider name or similar, handle it cleanly or return it
    if (modelName === 'llamacpp') return 'LlamaCpp';
    let clean = modelName.replace(/\.gguf$/i, "");
    clean = clean.replace(/[-_]Q8_0$/i, "");
    clean = clean.replace(/[-_]q8$/i, "");
    if (clean.toLowerCase().includes("exaone")) {
        return "EXAONE 1.2B";
    }
    if (clean.toLowerCase().includes("gemma-4")) {
        return "Gemma-4 2B";
    }
    if (clean.toLowerCase().includes("gemma-3") || clean.toLowerCase().includes("gemma")) {
        return "Gemma-3 1B";
    }
    if (clean.toLowerCase().includes("lfm2")) {
        return "LFM2 1.2B";
    }
    if (clean.toLowerCase().includes("minicpm")) {
        return "MiniCPM 1B";
    }
    if (clean.toLowerCase().includes("qwen3.5-0.8b")) {
        return "Qwen3.5 0.8B";
    }
    if (clean.toLowerCase().includes("qwen3.5-2b")) {
        return "Qwen3.5 2B";
    }
    if (clean.toLowerCase().includes("qwen3.5-4b")) {
        return "Qwen3.5 4B";
    }
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

    // Normalize options to [{ value, label }]
    const normalizedOptions = (options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return { value: opt.value, label: opt.label };
        }
        return { value: opt, label: getShortModelName(opt) || opt };
    });

    const currentOpt = normalizedOptions.find(o => o.value === value) || { value, label: getShortModelName(value) || value };

    return (
        <div
            ref={containerRef}
            className={`relative inline-block select-none ${className}`}
            style={{
                width,
                fontFamily: "'MS Sans Serif', Geneva, sans-serif"
            }}
        >
            {/* The select box */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between cursor-default bg-white border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white text-black h-[24px] px-1 text-[13px] leading-tight"
                style={{
                    boxShadow: "inset -1px -1px 0px #0a0a0a, inset 1px 1px 0px #dfdfdf",
                }}
            >
                <span className="truncate pr-1 select-none">{currentOpt.label}</span>
                {/* Arrow Button */}
                <div
                    className="flex items-center justify-center bg-[#c0c0c0] w-[18px] h-[18px] border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] ml-1 active:border-inset select-none"
                    style={{
                        boxShadow: isOpen ? "inset 1px 1px 0px #0a0a0a" : "none",
                        borderStyle: isOpen ? "inset" : "outset",
                        borderWidth: "2px"
                    }}
                >
                    <span className="text-[8px] scale-75 select-none" style={{ marginTop: '1px' }}>▼</span>
                </div>
            </div>

            {/* Dropdown popup */}
            {isOpen && (
                <div
                    className="absolute z-[9999] left-0 mt-[1px] bg-white text-black border-2 border-t-[#808080] border-l-[#808080] border-b-black border-r-black overflow-y-auto max-h-[160px] w-full retro-scrollbar"
                    style={{
                        boxShadow: "inset -1px -1px 0px #dfdfdf, inset 1px 1px 0px #0a0a0a, 2px 2px 5px rgba(0,0,0,0.2)",
                    }}
                >
                    {normalizedOptions.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`px-2 py-0.5 text-[12px] cursor-default whitespace-nowrap truncate leading-normal ${isSelected
                                    ? "bg-[#000080] text-white"
                                    : "hover:bg-[#000080] hover:text-white"
                                    }`}
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
