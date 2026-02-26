import React from 'react';

export function ProviderSelector({ label, value, onChange, ollamaOk, backendOk }) {
    return (
        <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5">
            <span className="text-sm font-medium text-slate-300">{label}</span>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                {[
                    { id: 'ollama', ok: ollamaOk },
                    { id: 'mlx', ok: backendOk }
                ].map(p => (
                    <button
                        key={p.id}
                        disabled={!p.ok}
                        onClick={() => onChange(p.id)}
                        className={`px-4 py-1.5 rounded-md text-xs uppercase font-bold transition-all flex items-center gap-2 ${value === p.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                        title={!p.ok ? `${p.id} is offline` : ""}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${p.ok ? 'bg-green-400' : 'bg-red-500'}`} />
                        {p.id}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ProviderSelectorSmall({ label, value, onChange, ollamaOk, backendOk }) {
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">{label}</span>
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
                {[
                    { id: 'ollama', ok: ollamaOk },
                    { id: 'mlx', ok: backendOk }
                ].map(p => (
                    <button
                        key={p.id}
                        disabled={!p.ok}
                        onClick={() => onChange(p.id)}
                        className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all flex items-center gap-1.5 ${value === p.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                        title={!p.ok ? `${p.id} is offline` : ""}
                    >
                        <div className={`w-1 h-1 rounded-full ${p.ok ? 'bg-green-400' : 'bg-red-500'}`} />
                        {p.id}
                    </button>
                ))}
            </div>
        </div>
    );
}
