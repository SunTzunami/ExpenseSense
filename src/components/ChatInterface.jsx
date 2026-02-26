import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Bot, Loader2, AlertCircle, RefreshCw, Clock, Settings, Minimize2 } from 'lucide-react';
import { checkOllamaConnection, listModels, chatWithOllama } from '../utils/ollama';
import { listMLXModels } from '../utils/mlx';
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
    const [ollamaConnected, setOllamaConnected] = useState(false);
    const [backendConnected, setBackendConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);
    const [workflowStatus, setWorkflowStatus] = useState([]);

    // Provider State
    const [routerProvider, setRouterProvider] = useState('ollama');
    const [specialistProvider, setSpecialistProvider] = useState('ollama');
    const [summarizerProvider, setSummarizerProvider] = useState('ollama');

    const [mlxModels, setMlxModels] = useState([]);
    const [ollamaModels, setOllamaModels] = useState([]);
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

    // LLM Config - Defaults set for strict/restrictive generation
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
        // Multiple backups for async content like plots
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

    // Side effect to sync models when providers change
    useEffect(() => {
        const models_available = routerProvider === 'mlx' ? mlxModels : ollamaModels;
        if (models_available.length > 0 && !models_available.includes(selectedRouterModel)) {
            setSelectedRouterModel(models_available[0]);
        }
    }, [routerProvider, mlxModels, ollamaModels]);

    useEffect(() => {
        const models_available = specialistProvider === 'mlx' ? mlxModels : ollamaModels;
        if (models_available.length > 0 && !models_available.includes(selectedCodeModel)) {
            setSelectedCodeModel(models_available[0]);
        }
    }, [specialistProvider, mlxModels, ollamaModels]);

    useEffect(() => {
        const models_available = summarizerProvider === 'mlx' ? mlxModels : ollamaModels;
        if (models_available.length > 0 && !models_available.includes(selectedChatModel)) {
            setSelectedChatModel(models_available[0]);
        }
    }, [summarizerProvider, mlxModels, ollamaModels]);

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
            // Check connections in parallel
            const [ollamaOk, backendOk] = await Promise.all([
                checkOllamaConnection(),
                // Simplistic backend check: if we can list models, it's ok
                fetch('http://localhost:8000/models/mlx').then(r => r.ok).catch(() => false)
            ]);

            setOllamaConnected(ollamaOk);
            setBackendConnected(backendOk);

            const eitherConnected = ollamaOk || backendOk;
            setIsConnected(eitherConnected);

            if (eitherConnected) {
                setConnectionError(null);

                // Fetch models in parallel from whoever is online
                const [availableOllamaModels, availableMlxModels] = await Promise.all([
                    ollamaOk ? listModels() : Promise.resolve([]),
                    backendOk ? listMLXModels() : Promise.resolve([])
                ]);

                setOllamaModels(availableOllamaModels);
                setMlxModels(availableMlxModels);
                setModels([...availableOllamaModels, ...availableMlxModels]);

                if (availableOllamaModels.length > 0 || availableMlxModels.length > 0) {
                    // Check if setup is needed (first time)
                    const hasSetup = localStorage.getItem('expense_ai_setup_done');
                    if (!hasSetup) {
                        setShowChoiceUI(true);
                    } else {
                        // Load saved preferences
                        setRouterProvider(localStorage.getItem('router_provider') || 'ollama');
                        setSpecialistProvider(localStorage.getItem('specialist_provider') || 'ollama');
                        setSummarizerProvider(localStorage.getItem('summarizer_provider') || 'ollama');

                        const savedRouter = localStorage.getItem('selected_router_model');
                        const savedSpecialist = localStorage.getItem('selected_specialist_model');
                        const savedChat = localStorage.getItem('selected_chat_model');

                        const allAvailable = [...availableOllamaModels, ...availableMlxModels];

                        // Router selection
                        if (savedRouter && allAvailable.includes(savedRouter)) {
                            setSelectedRouterModel(savedRouter);
                        } else {
                            const defaultRouterOllama = availableOllamaModels.find(m => m.includes('qwen') || m.includes('llama')) || availableOllamaModels[0] || availableMlxModels[0];
                            setSelectedRouterModel(defaultRouterOllama);
                        }

                        // Specialist selection
                        if (savedSpecialist && allAvailable.includes(savedSpecialist)) {
                            setSelectedCodeModel(savedSpecialist);
                        } else {
                            const preferredOllama = availableOllamaModels.find(m => m.includes('coder') || m.includes('llama3')) || availableOllamaModels[0] || availableMlxModels[0];
                            setSelectedCodeModel(preferredOllama);
                        }

                        // Chat selection
                        if (savedChat && allAvailable.includes(savedChat)) {
                            setSelectedChatModel(savedChat);
                        } else {
                            const preferredOllama = availableOllamaModels.find(m => m.includes('coder') || m.includes('llama3')) || availableOllamaModels[0] || availableMlxModels[0];
                            setSelectedChatModel(preferredOllama);
                        }
                    }
                }

                // Proactively init Pyodide
                try {
                    await initPyodide();
                } catch (e) {
                    console.error("Failed to init Pyodide:", e);
                }
            } else {
                setConnectionError("Could not connect to LLM services (Ollama & Backend). Make sure they are running.");
            }
        } catch (error) {
            console.error("Chat initialization failed:", error);
            setIsConnected(false);
            setConnectionError("Initialization failed. Check console for details.");
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
            // 1. Gather Metadata
            const metadata = getPromptMetadata(data);
            const allCats = Array.from(new Set([...MAJOR_CATEGORIES, ...Object.keys(CATEGORY_MAPPING)])).sort();
            const metadataStr = `
### CATEGORIES (available options for 'category' argument):
${allCats.map(c => `- ${c}`).join('\n')}
`;

            // 2. Execute Code (with streaming)
            const analysisResult = await runPythonStream(null, data, {
                prompt: currentInput,
                metadata: metadataStr,
                currency: currency,
                model: selectedCodeModel,
                routerModel: selectedRouterModel,
                chatModel: selectedChatModel,
                routerProvider: routerProvider,
                specialistProvider: specialistProvider,
                summarizerProvider: summarizerProvider,
                options: { temperature, top_p: topP, top_k: topK }
            }, (status) => {
                setWorkflowStatus(prev => [...prev, { ...status, timestamp: performance.now() }]);
            });

            let { result, fig, code, backend } = analysisResult;

            if (!backend) {
                // Fallback Logic: Get Code from LLM First
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Backend offline. Running in-browser (slower)...",
                    isSystem: true
                }]);

                const systemPrompt = PYTHON_ANALYSIS_PROMPT
                    .replace('{{metadata}}', metadataStr)
                    .replace('{{prompt}}', currentInput)
                    .replace('{{current_date}}', new Date().toISOString().split('T')[0]);

                const response = await chatWithOllama(selectedCodeModel, [
                    { role: 'system', content: systemPrompt },
                    ...messages.filter(m => m.role !== 'system'),
                    userMessage
                ], false, { temperature, top_p: topP, top_k: topK });

                const rawContent = response?.content || "";
                code = rawContent.trim();
                const pythonMatch = code.match(/```python\s*([\s\S]*?)```/);
                const genericMatch = code.match(/```\s*([\s\S]*?)```/);
                const backtickMatch = code.match(/^`([\s\S]*?)`$/);

                if (pythonMatch) code = pythonMatch[1].trim();
                else if (genericMatch) code = genericMatch[1].trim();
                else if (backtickMatch) code = backtickMatch[1].trim();
                else code = code.replace(/```python/g, '').replace(/```/g, '').trim();

                const localResult = await runPython(code, data);
                result = localResult.result;
                fig = localResult.fig;
            }

            // 3. Final Summary (only if not already summarized by backend)
            let finalContent = result;
            if (!backend && result && result !== 'None' && result.length < 500) {
                const summaryPrompt = `Summarize the result in one natural sentence in the same language as the user's question.
CRITICAL: YOU MUST USE THE EXACT NUMBER FROM THE RESULT. DO NOT CHANGE, ROUND, OR ADD DIGITS.
Currency: ${currency}`;

                const summaryResponse = await chatWithOllama(selectedChatModel, [
                    { role: 'system', content: summaryPrompt },
                    { role: 'user', content: `Question: ${currentInput}\nResult: ${result}` }
                ], false, { temperature, top_p: topP, top_k: topK });
                finalContent = summaryResponse.content;
            }

            const endTime = performance.now();
            const durationSec = ((endTime - startTime) / 1000).toFixed(1);

            const newMessage = {
                role: 'assistant',
                content: finalContent || (fig ? "I've generated a visualization for you." : "Analysis complete."),
                fig: fig ? JSON.parse(fig) : null,
                code: code,
                executionTime: durationSec
            };

            setMessages(prev => [...prev, newMessage]);

            // If not visible, increment unread count
            // We use visibleRef.current here because 'visible' prop might have changed 
            // since this async function started.
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
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Bot className="text-primary" />
                                <h2 className="font-semibold text-white">Ask your data</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <div onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer text-slate-400 hover:text-white transition-colors">
                                    <Settings size={16} />
                                </div>
                                <div onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer text-slate-400 hover:text-white transition-colors" title="Minimize">
                                    <Minimize2 size={16} />
                                </div>
                                <div onClick={() => {
                                    // Full close could reset everything if desired, but for now we just close the UI
                                    onClose();
                                }} className="p-1.5 rounded-lg hover:bg-red-500/20 cursor-pointer text-slate-400 hover:text-red-400 transition-colors" title="Close">
                                    <X size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Settings Panel */}
                        <SettingsPanel
                            showSettings={showSettings}
                            temperature={temperature} setTemperature={setTemperature}
                            topP={topP} setTopP={setTopP}
                            topK={topK} setTopK={setTopK}
                            routerProvider={routerProvider} setRouterProvider={setRouterProvider}
                            specialistProvider={specialistProvider} setSpecialistProvider={setSpecialistProvider}
                            summarizerProvider={summarizerProvider} setSummarizerProvider={setSummarizerProvider}
                            ollamaConnected={ollamaConnected} backendConnected={backendConnected}
                        />

                        {/* Connection / Model Status */}
                        <div className="p-2 bg-slate-800/30 text-xs flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-3 px-2">
                                <div className="flex items-center gap-1.5" title={ollamaConnected ? "Ollama Connected" : "Ollama Offline"}>
                                    <div className={`w-2 h-2 rounded-full ${ollamaConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                    <span className="text-[10px] text-slate-400 font-medium">Ollama</span>
                                    {!ollamaConnected && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); initializeConnections(); }}
                                            className={`p-0.5 hover:bg-white/10 rounded transition-colors ${isLoading ? 'animate-spin opacity-50' : 'opacity-70 hover:opacity-100'}`}
                                            title="Retry connection"
                                        >
                                            <RefreshCw size={10} className="text-slate-400" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5" title={backendConnected ? "Backend/MLX Connected" : "Backend Offline"}>
                                    <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                    <span className="text-[10px] text-slate-400 font-medium">MLX</span>
                                    {!backendConnected && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); initializeConnections(); }}
                                            className={`p-0.5 hover:bg-white/10 rounded transition-colors ${isLoading ? 'animate-spin opacity-50' : 'opacity-70 hover:opacity-100'}`}
                                            title="Retry connection"
                                        >
                                            <RefreshCw size={10} className="text-slate-400" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isConnected && (
                                <div className="flex gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 uppercase font-bold ml-1">Router</span>
                                        <select
                                            value={selectedRouterModel}
                                            onChange={(e) => setSelectedRouterModel(e.target.value)}
                                            className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-slate-300 outline-none focus:border-primary max-w-[150px] text-[10px]"
                                            title="Model for Routing (Stage 1)"
                                        >
                                            <option value="" disabled>Router</option>
                                            {(routerProvider === 'mlx' ? (backendConnected ? mlxModels : []) : (ollamaConnected ? ollamaModels : [])).map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 uppercase font-bold ml-1">Specialist</span>
                                        <select
                                            value={selectedCodeModel}
                                            onChange={(e) => setSelectedCodeModel(e.target.value)}
                                            className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-slate-300 outline-none focus:border-primary max-w-[150px] text-[10px]"
                                            title="Model for Tool Call (Stage 2)"
                                        >
                                            <option value="" disabled>Specialist</option>
                                            {(specialistProvider === 'mlx' ? (backendConnected ? mlxModels : []) : (ollamaConnected ? ollamaModels : [])).map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-500 uppercase font-bold ml-1">Summary</span>
                                        <select
                                            value={selectedChatModel}
                                            onChange={(e) => setSelectedChatModel(e.target.value)}
                                            className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-slate-300 outline-none focus:border-primary max-w-[150px] text-[10px]"
                                            title="Model for Chat/Summarization"
                                        >
                                            <option value="" disabled>Chat</option>
                                            {(summarizerProvider === 'mlx' ? (backendConnected ? mlxModels : []) : (ollamaConnected ? ollamaModels : [])).map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Messages Area */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                        >
                            {!isConnected && !isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 text-center p-4">
                                    <AlertCircle size={32} className="text-red-400 mb-2" />
                                    <p>{connectionError || "Local LLM services unreachable."}</p>
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

                        {/* Input Area */}
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

            {/* Choice UI Overlay */}
            <ChoiceUIOverlay
                showChoiceUI={showChoiceUI} setShowChoiceUI={setShowChoiceUI}
                routerProvider={routerProvider} setRouterProvider={setRouterProvider}
                specialistProvider={specialistProvider} setSpecialistProvider={setSpecialistProvider}
                summarizerProvider={summarizerProvider} setSummarizerProvider={setSummarizerProvider}
                ollamaConnected={ollamaConnected} backendConnected={backendConnected}
            />

            {/* Expanded Chart Modal */}
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
                                <button
                                    onClick={() => setExpandedChart(null)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                                >
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
    // status is an array of all received stage events
    const stages = status || [];
    const latestStage = stages.length > 0 ? stages[stages.length - 1] : null;
    const currentIndex = latestStage
        ? WORKFLOW_STAGES.findIndex(s => s.key === latestStage.stage)
        : -1;

    // Build a map of stage key -> info for all received stages
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
                // Hide summarizing until we actually reach it
                if (stage.key === 'summarizing' && isPending) return null;

                const info = stageInfo[stage.key];

                // Calculate duration
                let duration = null;
                if (info) {
                    const nextInfo = stages.find((s, idx) => {
                        const sIdx = WORKFLOW_STAGES.findIndex(ws => ws.key === s.stage);
                        return sIdx > i;
                    });

                    if (nextInfo) {
                        duration = ((nextInfo.timestamp - info.timestamp) / 1000).toFixed(1);
                    } else if (isActive) {
                        duration = ((performance.now() - info.timestamp) / 1000).toFixed(1);
                        if (parseFloat(duration) < 0) duration = "0.0";
                    }
                }

                return (
                    <div
                        key={stage.key}
                        className={`flex items-start gap-2 py-0.5 ${isCompleted ? 'text-green-400/80' :
                            isActive ? 'text-white' :
                                'text-slate-600'
                            }`}
                    >
                        <span className="w-4 flex-shrink-0 text-center">
                            {isCompleted && '\u2713'}
                            {isActive && (
                                <Loader2 size={11} className="animate-spin inline-block" />
                            )}
                            {isPending && '\u00B7'}
                        </span>

                        <div className="flex-1 overflow-hidden">
                            <span className={isActive ? 'font-bold' : ''}>
                                {stage.label}
                            </span>

                            {/* Active stage: show live message + model + tool */}
                            {isActive && info && (
                                <span className="text-slate-300 ml-1.5 whitespace-nowrap">
                                    {' '}-- {info.message}
                                    {info.model && (
                                        <span className="text-slate-400"> [{info.model}]</span>
                                    )}
                                    {info.tool && (
                                        <span className="text-indigo-300"> {'>'} {info.tool}</span>
                                    )}
                                </span>
                            )}

                            {/* Completed stage: show resolved details */}
                            {isCompleted && info && (
                                <span className="text-slate-500 ml-1.5 whitespace-nowrap">
                                    {info.model && (<span> [{info.model}]</span>)}
                                    {info.tool && (<span> {'>'} {info.tool}</span>)}
                                </span>
                            )}

                            {/* Duration for this stage - moved next to contents */}
                            {duration !== null && (
                                <span className="text-[10px] text-slate-400 ml-2 tabular-nums">
                                    {duration}s
                                </span>
                            )}
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
