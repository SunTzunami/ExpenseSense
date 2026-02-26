import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { ProviderSelectorSmall } from './ProviderSelector';

export default function SettingsPanel({
    showSettings,
    temperature, setTemperature,
    topP, setTopP,
    topK, setTopK,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    summarizerProvider, setSummarizerProvider,
    ollamaConnected, backendConnected
}) {
    return (
        <AnimatePresence>
            {showSettings && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-slate-900/50 border-b border-white/10 overflow-hidden"
                >
                    <div className="p-4 space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">LLM Configuration</h4>

                        {/* Temperature */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 group relative">
                                    <span className="text-slate-300">Temperature</span>
                                    <div className="cursor-help text-slate-500 hover:text-primary transition-colors">
                                        <Info size={12} />
                                    </div>
                                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-slate-300 hidden group-hover:block z-50 backdrop-blur-xl shadow-xl">
                                        Controls randomness. Lower is more deterministic (better for code), higher is more creative.
                                    </div>
                                </div>
                                <span className="text-primary font-mono">{temperature}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>

                        {/* Top P */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 group relative">
                                    <span className="text-slate-300">Top P</span>
                                    <div className="cursor-help text-slate-500 hover:text-primary transition-colors">
                                        <Info size={12} />
                                    </div>
                                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-slate-300 hidden group-hover:block z-50 backdrop-blur-xl shadow-xl">
                                        Nucleus sampling. Limits choices to top percentage of probability mass.
                                    </div>
                                </div>
                                <span className="text-primary font-mono">{topP}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={topP}
                                onChange={(e) => setTopP(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>

                        {/* Top K */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 group relative">
                                    <span className="text-slate-300">Top K</span>
                                    <div className="cursor-help text-slate-500 hover:text-primary transition-colors">
                                        <Info size={12} />
                                    </div>
                                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-slate-300 hidden group-hover:block z-50 backdrop-blur-xl shadow-xl">
                                        Top-k sampling. Limits choices to the top K most likely tokens.
                                    </div>
                                </div>
                                <span className="text-primary font-mono">{topK}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                step="1"
                                value={topK}
                                onChange={(e) => setTopK(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>

                        <div className="border-t border-white/5 pt-4 space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Providers</h4>

                            <div className="flex flex-col gap-3">
                                <ProviderSelectorSmall label="Router" value={routerProvider} onChange={setRouterProvider} ollamaOk={ollamaConnected} backendOk={backendConnected} />
                                <ProviderSelectorSmall label="Specialist" value={specialistProvider} onChange={setSpecialistProvider} ollamaOk={ollamaConnected} backendOk={backendConnected} />
                                <ProviderSelectorSmall label="Summarizer" value={summarizerProvider} onChange={setSummarizerProvider} ollamaOk={ollamaConnected} backendOk={backendConnected} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
