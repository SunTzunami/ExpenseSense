import React from 'react';
import RetroSelect from './RetroSelect';

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
                        <RetroSelect 
                            value={routerProvider} 
                            onChange={val => setRouterProvider && setRouterProvider(val)} 
                            options={[{ value: 'llamacpp', label: 'LlamaCpp (Local)' }]} 
                            width="100%" 
                            className="mb-4"
                        />
                        
                        <div className="mb-2 text-[13px] font-bold">Analyst Provider:</div>
                        <RetroSelect 
                            value={specialistProvider} 
                            onChange={val => setSpecialistProvider && setSpecialistProvider(val)} 
                            options={[{ value: 'llamacpp', label: 'LlamaCpp (Local)' }]} 
                            width="100%" 
                        />
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
