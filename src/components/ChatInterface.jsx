import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Bot, Loader2, AlertCircle, RefreshCw, Clock, Settings, Minimize2 } from 'lucide-react';
import { listLlamaCppModels } from '../utils/llamacpp';
import { runPython, runPythonStream, initPyodide, PYTHON_ANALYSIS_PROMPT, getPromptMetadata } from '../utils/pythonRunner';
import { CATEGORY_MAPPING, MAJOR_CATEGORIES } from '../utils/categoryMapping';

import SettingsPanel from './chat/SettingsPanel';
import ChoiceUIOverlay from './chat/ChoiceUIOverlay';
import MessageItem, { PlotlyChart } from './chat/MessageItem';

export default function ChatInterface({ data, onClose, visible, currency, onStatusChange }) {
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [models, setModels] = useState([]);
    const [selectedCodeModel, setSelectedCodeModel] = useState('');
    const [selectedRouterModel, setSelectedRouterModel] = useState('');
    const [selectedChatModel, setSelectedChatModel] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [backendConnected, setBackendConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);
    const [workflowStatus, setWorkflowStatus] = useState([]);

    // Provider State - Locked to llamacpp
    const [routerProvider] = useState('llamacpp');
    const [specialistProvider] = useState('llamacpp');
    const [summarizerProvider] = useState('llamacpp');

    const [llamacppModels, setLlamacppModels] = useState([]);
    const [showChoiceUI, setShowChoiceUI] = useState(false);

    const visibleRef = useRef(visible);

    // Keep ref in sync for use in async closures
    useEffect(() => {
        visibleRef.current = visible;
        if (visible) {
            setUnreadCount(0);
        }
    }, [visible]);

    // Notify parent of status changes
    useEffect(() => {
        if (onStatusChange) {
            onStatusChange({
                loading: isLoading,
                unreadCount: unreadCount
            });
        }
    }, [isLoading, unreadCount, onStatusChange]);

    // LLM Config
    const [temperature, setTemperature] = useState(0.0);
    const [topP, setTopP] = useState(0.1);
    const [topK, setTopK] = useState(10);

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
        const t1 = setTimeout(scrollToBottom, 300);
        const t2 = setTimeout(scrollToBottom, 1000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [messages, isLoading]);

    useEffect(() => {
        if (visible) {
            initializeConnections();
        }
    }, [visible]);

    useEffect(() => {
        if (selectedRouterModel) localStorage.setItem('selected_router_model', selectedRouterModel);
    }, [selectedRouterModel]);

    useEffect(() => {
        if (selectedCodeModel) localStorage.setItem('selected_specialist_model', selectedCodeModel);
    }, [selectedCodeModel]);

    useEffect(() => {
        if (selectedChatModel) localStorage.setItem('selected_chat_model', selectedChatModel);
    }, [selectedChatModel]);

    // Live Timer Effect
    useEffect(() => {
        let interval;
        if (isLoading) {
            const start = performance.now();
            interval = setInterval(() => {
                setElapsedTime(((performance.now() - start) / 1000).toFixed(1));
            }, 100);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const initializeConnections = async () => {
        setIsLoading(true);
        try {
            const availableModels = await listLlamaCppModels();
            const ok = availableModels.length > 0;

            setBackendConnected(ok);
            setIsConnected(ok);

            if (ok) {
                setConnectionError(null);
                setLlamacppModels(availableModels);
                setModels(availableModels);

                // Check if setup is needed
                const hasSetup = localStorage.getItem('expense_ai_setup_done');
                if (!hasSetup) {
                    setShowChoiceUI(true);
                } else {
                    const savedRouter = localStorage.getItem('selected_router_model');
                    const savedSpecialist = localStorage.getItem('selected_specialist_model');
                    const savedChat = localStorage.getItem('selected_chat_model');

                    setSelectedRouterModel(availableModels.includes(savedRouter) ? savedRouter : availableModels[0]);
                    setSelectedCodeModel(availableModels.includes(savedSpecialist) ? savedSpecialist : availableModels[0]);
                    setSelectedChatModel(availableModels.includes(savedChat) ? savedChat : availableModels[0]);
                }

                try {
                    await initPyodide();
                } catch (e) {
                    console.error("Failed to init Pyodide:", e);
                }
            } else {
                setConnectionError("Could not connect to LlamaCpp Backend. Make sure it is running at :8000");
            }
        } catch (error) {
            console.error("Chat initialization failed:", error);
            setIsConnected(false);
            setConnectionError("Initialization failed. Is the backend running?");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !selectedCodeModel) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            const startTime = performance.now();
            const metadata = getPromptMetadata(data);
            const allCats = Array.from(new Set([...MAJOR_CATEGORIES, ...Object.keys(CATEGORY_MAPPING)])).sort();
            const metadataStr = `
### CATEGORIES:
${allCats.map(c => `- ${c}`).join('\n')}
`;

            const analysisResult = await runPythonStream(null, data, {
                prompt: currentInput,
                metadata: metadataStr,
                currency: currency,
                model: selectedCodeModel,
                routerModel: selectedRouterModel,
                chatModel: selectedChatModel,
                routerProvider: 'llamacpp',
                specialistProvider: 'llamacpp',
                summarizerProvider: 'llamacpp',
                options: { temperature, top_p: topP, top_k: topK }
            }, (status) => {
                setWorkflowStatus(prev => [...prev, { ...status, timestamp: performance.now() }]);
            });

            let { result, fig, code, backend } = analysisResult;

            if (!backend) {
                // Browser fallback (Local execution)
                const localResult = await runPython(code, data);
                result = localResult.result;
                fig = localResult.fig;
            }

            const endTime = performance.now();
            const durationSec = ((endTime - startTime) / 1000).toFixed(1);

            const newMessage = {
                role: 'assistant',
                content: result || (fig ? "I've generated a visualization for you." : "Analysis complete."),
                fig: fig ? JSON.parse(fig) : null,
                code: code,
                executionTime: durationSec
            };

            setMessages(prev => [...prev, newMessage]);

            if (!visibleRef.current) {
                setUnreadCount(prev => prev + 1);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}`, isError: true }]);
        } finally {
            setIsLoading(false);
            setWorkflowStatus([]);
        }
    };

    return (
        <>
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ opacity: 0, x: 300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 300 }}
                        className="fixed right-0 top-0 bottom-0 w-[600px] z-50 flex flex-col shadow-2xl bg-slate-900/70 backdrop-blur-xl border-l border-white/10"
                    >
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Bot className="text-primary" />
                                <h2 className="font-semibold text-white">Ask your data</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <div onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer text-slate-400 hover:text-white transition-colors">
                                    <Settings size={16} />
                                </div>
                                <div onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer text-slate-400 hover:text-white transition-colors">
                                    <Minimize2 size={16} />
                                </div>
                                <div onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/20 cursor-pointer text-slate-400 hover:text-red-400 transition-colors">
                                    <X size={16} />
                                </div>
                            </div>
                        </div>

                        <SettingsPanel
                            showSettings={showSettings}
                            temperature={temperature} setTemperature={setTemperature}
                            topP={topP} setTopP={setTopP}
                            topK={topK} setTopK={setTopK}
                            routerProvider={routerProvider}
                            specialistProvider={specialistProvider}
                            summarizerProvider={summarizerProvider}
                            backendConnected={backendConnected}
                        />

                        <div className="p-2 bg-slate-800/30 text-xs flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-3 px-2">
                                <div className="flex items-center gap-1.5" title={backendConnected ? "Backend Connected" : "Backend Offline"}>
                                    <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                    <span className="text-[10px] text-slate-400 font-medium">LlamaCpp</span>
                                    {!backendConnected && (
                                        <button onClick={initializeConnections} className={`p-0.5 hover:bg-white/10 rounded transition-colors ${isLoading ? 'animate-spin opacity-50' : 'opacity-70 hover:opacity-100'}`}>
                                            <RefreshCw size={10} className="text-slate-400" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isConnected && (
                                <div className="flex gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 uppercase font-bold ml-1">Router</span>
                                        <select value={selectedRouterModel} onChange={(e) => setSelectedRouterModel(e.target.value)} className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-slate-300 outline-none focus:border-primary max-w-[150px] text-[10px]">
                                            {llamacppModels.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 uppercase font-bold ml-1">Specialist</span>
                                        <select value={selectedCodeModel} onChange={(e) => setSelectedCodeModel(e.target.value)} className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-slate-300 outline-none focus:border-primary max-w-[150px] text-[10px]">
                                            {llamacppModels.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 uppercase font-bold ml-1">Summary</span>
                                        <select value={selectedChatModel} onChange={(e) => setSelectedChatModel(e.target.value)} className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-slate-300 outline-none focus:border-primary max-w-[150px] text-[10px]">
                                            {llamacppModels.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {!isConnected && !isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 text-center p-4">
                                    <AlertCircle size={32} className="text-red-400 mb-2" />
                                    <p>{connectionError || "Local backend unreachable."}</p>
                                    <button onClick={initializeConnections} className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-lg hover:bg-slate-700 transition">
                                        <RefreshCw size={14} /> Retry
                                    </button>
                                </div>
                            )}

                            {messages.length === 0 && isConnected && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                                    <Bot size={48} className="opacity-20" />
                                    <p className="text-sm">Ask questions about your expenses</p>
                                    <div className="grid grid-cols-1 gap-2 w-full">
                                        {["Plot Food expenses for the past 6 months", "Compare Groceries 2024 vs 2025", "Average spending on dining in 2024?"].map(q => (
                                            <button key={q} onClick={() => setInput(q)} className="text-xs p-2 bg-slate-800/50 rounded hover:bg-slate-700 text-left transition text-slate-400 hover:text-primary">
                                                "{q}"
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, i) => (
                                <MessageItem key={i} msg={msg} setExpandedChart={setExpandedChart} />
                            ))}

                            {isLoading && messages.length > 0 && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                                        <Bot size={14} />
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-2xl w-full max-w-[90%]">
                                        <WorkflowIndicator status={workflowStatus} elapsed={elapsedTime} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-slate-800/50 border-t border-white/5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Ask a question..."
                                    disabled={!isConnected || isLoading}
                                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-primary outline-none text-white placeholder-slate-500 disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!isConnected || isLoading || !input.trim()}
                                    className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ChoiceUIOverlay
                showChoiceUI={showChoiceUI} setShowChoiceUI={setShowChoiceUI}
                routerProvider={routerProvider}
                specialistProvider={specialistProvider}
                summarizerProvider={summarizerProvider}
                backendConnected={backendConnected}
            />

            <AnimatePresence>
                {expandedChart && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full h-full max-w-6xl max-h-[85vh] bg-slate-900 rounded-2xl border border-white/10 p-8 shadow-2xl flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">{expandedChart.layout?.title?.text || 'Analysis Result'}</h3>
                                <button onClick={() => setExpandedChart(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                                    <Minimize2 size={24} />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0">
                                <PlotlyChart data={expandedChart} isExpanded={true} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

const WORKFLOW_STAGES = [
    { key: 'router', label: 'Router' },
    { key: 'specialist', label: 'Specialist' },
    { key: 'executing', label: 'Executing' },
    { key: 'summarizing', label: 'Summarizing' },
];

function WorkflowIndicator({ status, elapsed }) {
    const stages = status || [];
    const latestStage = stages.length > 0 ? stages[stages.length - 1] : null;
    const currentIndex = latestStage ? WORKFLOW_STAGES.findIndex(s => s.key === latestStage.stage) : -1;

    const stageInfo = {};
    stages.forEach(s => { stageInfo[s.stage] = s; });

    return (
        <div style={{ fontFamily: "'Consolas', 'Courier New', monospace" }} className="text-[11px] leading-relaxed">
            {currentIndex < 0 && (
                <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 size={11} className="animate-spin" />
                    <span>initializing...</span>
                </div>
            )}
            {WORKFLOW_STAGES.map((stage, i) => {
                const isCompleted = i < currentIndex;
                const isActive = i === currentIndex;
                const isPending = i > currentIndex;
                if (stage.key === 'summarizing' && isPending) return null;

                const info = stageInfo[stage.key];
                let duration = null;
                if (info) {
                    const nextInfo = stages.find(s => WORKFLOW_STAGES.findIndex(ws => ws.key === s.stage) > i);
                    if (nextInfo) {
                        duration = ((nextInfo.timestamp - info.timestamp) / 1000).toFixed(1);
                    } else if (isActive) {
                        duration = ((performance.now() - info.timestamp) / 1000).toFixed(1);
                        if (parseFloat(duration) < 0) duration = "0.0";
                    }
                }

                return (
                    <div key={stage.key} className={`flex items-start gap-2 py-0.5 ${isCompleted ? 'text-green-400/80' : isActive ? 'text-white' : 'text-slate-600'}`}>
                        <span className="w-4 flex-shrink-0 text-center">
                            {isCompleted && '\u2713'}
                            {isActive && <Loader2 size={11} className="animate-spin inline-block" />}
                            {isPending && '\u00B7'}
                        </span>
                        <div className="flex-1 overflow-hidden">
                            <span className={isActive ? 'font-bold' : ''}>{stage.label}</span>
                            {isActive && info && (
                                <span className="text-slate-300 ml-1.5 whitespace-nowrap">
                                    {' '}-- {info.message}
                                    {info.model && <span className="text-slate-400"> [{info.model}]</span>}
                                    {info.tool && <span className="text-indigo-300"> {'>'} {info.tool}</span>}
                                </span>
                            )}
                            {isCompleted && info && (
                                <span className="text-slate-500 ml-1.5 whitespace-nowrap">
                                    {info.model && <span> [{info.model}]</span>}
                                    {info.tool && <span> {'>'} {info.tool}</span>}
                                </span>
                            )}
                            {duration !== null && <span className="text-[10px] text-slate-400 ml-2 tabular-nums">{duration}s</span>}
                        </div>
                    </div>
                );
            })}
            <div className="flex items-center gap-2 pt-1 text-slate-500 border-t border-white/5 mt-1">
                <Clock size={10} />
                <span>Total: {elapsed}s</span>
            </div>
        </div>
    );
}
