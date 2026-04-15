import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProviderSelector } from './ProviderSelector';

export default function ChoiceUIOverlay({
    showChoiceUI, setShowChoiceUI,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    summarizerProvider, setSummarizerProvider,
    backendConnected
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
                            <p className="text-sm text-slate-400">Confirm the LlamaCpp backend for each stage of analysis.</p>
                        </div>

                        <div className="space-y-6 py-4">
                            <ProviderSelector label="Router" value={routerProvider} onChange={setRouterProvider} backendOk={backendConnected} />
                            <ProviderSelector label="Analyst" value={specialistProvider} onChange={setSpecialistProvider} backendOk={backendConnected} />
                            <ProviderSelector label="Summarizer" value={summarizerProvider} onChange={setSummarizerProvider} backendOk={backendConnected} />
                        </div>

                        <button
                            onClick={() => {
                                localStorage.setItem('expense_ai_setup_done', 'true');
                                localStorage.setItem('router_provider', 'llamacpp');
                                localStorage.setItem('specialist_provider', 'llamacpp');
                                localStorage.setItem('summarizer_provider', 'llamacpp');
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
