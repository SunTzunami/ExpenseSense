import React from 'react';
import RetroSelect from './RetroSelect';

export default function SettingsPanel({
    showSettings,
    temperature, setTemperature,
    topP, setTopP,
    topK, setTopK,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    backendConnected
}) {
    if (!showSettings) return null;

    return (
        <div className="retro-panel m-2">
            <h4 className="text-[11px] font-bold mb-2">LLM Configuration</h4>

            {/* Temperature */}
            <div className="mb-2">
                <div className="flex justify-between text-[11px]">
                    <span title="Controls randomness">Temperature</span>
                    <span className="font-bold text-[#000080]">{temperature}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                />
            </div>

            {/* Top P */}
            <div className="mb-2">
                <div className="flex justify-between text-[11px]">
                    <span title="Nucleus sampling">Top P</span>
                    <span className="font-bold text-[#000080]">{topP}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full"
                />
            </div>

            {/* Top K */}
            <div className="mb-2">
                <div className="flex justify-between text-[11px]">
                    <span title="Top K sampling">Top K</span>
                    <span className="font-bold text-[#000080]">{topK}</span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value))}
                    className="w-full"
                />
            </div>

            <div className="border-t border-[#808080] pt-2 mt-2">
                <h4 className="text-[11px] font-bold mb-2">Providers</h4>

                <div className="flex flex-col gap-2 text-[11px]">
                    <div className="flex justify-between items-center">
                        <span>Router:</span>
                        <RetroSelect 
                            value={routerProvider} 
                            onChange={val => setRouterProvider && setRouterProvider(val)} 
                            options={[{ value: 'llamacpp', label: 'LlamaCpp' }]} 
                            width="100px" 
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Specialist:</span>
                        <RetroSelect 
                            value={specialistProvider} 
                            onChange={val => setSpecialistProvider && setSpecialistProvider(val)} 
                            options={[{ value: 'llamacpp', label: 'LlamaCpp' }]} 
                            width="100px" 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
