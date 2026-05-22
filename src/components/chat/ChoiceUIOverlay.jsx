import React from 'react';

export default function ChoiceUIOverlay({
    showChoiceUI, setShowChoiceUI,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    backendConnected
}) {
    if (!showChoiceUI) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6">
            <div className="retro-window w-full max-w-sm">
                <div className="retro-titlebar">
                    <span>Provider Configuration</span>
                    <div className="retro-titlebar-buttons">
                        <div className="retro-titlebar-button" onClick={() => setShowChoiceUI(false)}>X</div>
                    </div>
                </div>
                
                <div className="retro-content bg-[#c0c0c0] flex flex-col p-4">
                    <div className="mb-4 text-[13px]">
                        Please confirm your provider settings before continuing.
                    </div>

                    <div className="retro-panel mb-4">
                        <div className="mb-2 text-[13px] font-bold">Router Provider:</div>
                        <select className="retro-select w-full mb-4" value={routerProvider} onChange={e => setRouterProvider && setRouterProvider(e.target.value)}>
                            <option value="llamacpp">LlamaCpp (Local)</option>
                        </select>
                        
                        <div className="mb-2 text-[13px] font-bold">Analyst Provider:</div>
                        <select className="retro-select w-full" value={specialistProvider} onChange={e => setSpecialistProvider && setSpecialistProvider(e.target.value)}>
                            <option value="llamacpp">LlamaCpp (Local)</option>
                        </select>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.setItem('expense_ai_setup_done', 'true');
                            localStorage.setItem('router_provider', 'llamacpp');
                            localStorage.setItem('specialist_provider', 'llamacpp');
                            setShowChoiceUI(false);
                        }}
                        className="retro-button justify-center font-bold"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
