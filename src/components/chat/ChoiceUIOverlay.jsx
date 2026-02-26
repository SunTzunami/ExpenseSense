import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProviderSelector } from './ProviderSelector';

export default function ChoiceUIOverlay({
    showChoiceUI, setShowChoiceUI,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    summarizerProvider, setSummarizerProvider,
    ollamaConnected, backendConnected
}) {
    return (
        <AnimatePresence>
            {showChoiceUI && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6"
                    >
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white">Select Your Providers</h3>
                            <p className="text-sm text-slate-400">Choose the LLM backend for each stage of analysis.</p>
                        </div>

                        <div className="space-y-6 py-4">
                            <ProviderSelector label="Router" value={routerProvider} onChange={setRouterProvider} ollamaOk={ollamaConnected} backendOk={backendConnected} />
                            <ProviderSelector label="Analyst" value={specialistProvider} onChange={setSpecialistProvider} ollamaOk={ollamaConnected} backendOk={backendConnected} />
                            <ProviderSelector label="Summarizer" value={summarizerProvider} onChange={setSummarizerProvider} ollamaOk={ollamaConnected} backendOk={backendConnected} />
                        </div>

                        <button
                            onClick={() => {
                                localStorage.setItem('expense_ai_setup_done', 'true');
                                localStorage.setItem('router_provider', routerProvider);
                                localStorage.setItem('specialist_provider', specialistProvider);
                                localStorage.setItem('summarizer_provider', summarizerProvider);
                                setShowChoiceUI(false);
                            }}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-500/20"
                        >
                            Start Analyzing
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
