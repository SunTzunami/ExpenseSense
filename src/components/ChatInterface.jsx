import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, AlertCircle, RefreshCw, Clock, Settings } from 'lucide-react';
import { listLlamaCppModels } from '../utils/llamacpp';
import { runPythonStream } from '../utils/pythonRunner';
import { CATEGORY_MAPPING, MAJOR_CATEGORIES } from '../utils/categoryMapping';

import SettingsPanel from './chat/SettingsPanel';
import ChoiceUIOverlay from './chat/ChoiceUIOverlay';
import MessageItem, { PlotlyChart } from './chat/MessageItem';

export default function ChatInterface({ data, visible, currency, onStatusChange }) {
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCodeModel, setSelectedCodeModel] = useState('');
    const [selectedRouterModel, setSelectedRouterModel] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [backendConnected, setBackendConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showSettings] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);
    const [workflowStatus, setWorkflowStatus] = useState([]);

    // Provider State - Locked to llamacpp
    const [routerProvider] = useState('llamacpp');
    const [specialistProvider] = useState('llamacpp');

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

                // Check if setup is needed
                const hasSetup = localStorage.getItem('expense_ai_setup_done');
                if (!hasSetup) {
                    setShowChoiceUI(true);
                } else {
                    const savedRouter = localStorage.getItem('selected_router_model');
                    const savedSpecialist = localStorage.getItem('selected_specialist_model');

                    setSelectedRouterModel(availableModels.includes(savedRouter) ? savedRouter : availableModels[0]);
                    setSelectedCodeModel(availableModels.includes(savedSpecialist) ? savedSpecialist : availableModels[0]);
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
                routerProvider: 'llamacpp',
                specialistProvider: 'llamacpp',
                options: { temperature, top_p: topP, top_k: topK }
            }, (status) => {
                setWorkflowStatus(prev => [...prev, { ...status, timestamp: performance.now() }]);
            });

            const { result, fig, code } = analysisResult;

            const endTime = performance.now();
            const durationSec = ((endTime - startTime) / 1000).toFixed(1);

            const newMessage = {
                role: 'assistant',
                content: result || (fig ? "I've generated a visualization for you." : "Analysis complete."),
                fig: fig ? JSON.parse(fig) : null,
                code: code,
                executionTime: durationSec,
                validation_fixes: analysisResult.validation_fixes || null
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
        <div className="w-full h-full flex flex-col bg-[#c0c0c0]" style={{ fontFamily: "'Consolas', 'Courier New', monospace" }}>
            <SettingsPanel
                showSettings={showSettings}
                temperature={temperature} setTemperature={setTemperature}
                topP={topP} setTopP={setTopP}
                topK={topK} setTopK={setTopK}
                routerProvider={routerProvider}
                specialistProvider={specialistProvider}
                backendConnected={backendConnected}
            />

            <div className="p-1 bg-[#c0c0c0] text-[13px] flex items-center justify-between border-b border-[#808080]">
                <div className="flex items-center gap-3 px-2">
                    <div className="flex items-center gap-1.5" title={backendConnected ? "Backend Connected" : "Backend Offline"}>
                        <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500' : 'bg-red-500'}`} style={{ border: '1px solid black' }} />
                        <span className="text-[13px] text-black font-medium">LlamaCpp</span>
                        {!backendConnected && (
                            <button onClick={initializeConnections} className="retro-button ml-2">
                                Retry
                            </button>
                        )}
                    </div>
                </div>

                {isConnected && (
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-black font-bold">Router</span>
                            <select value={selectedRouterModel} onChange={(e) => setSelectedRouterModel(e.target.value)} className="retro-select w-[150px]">
                                {llamacppModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-black font-bold">Specialist</span>
                            <select value={selectedCodeModel} onChange={(e) => setSelectedCodeModel(e.target.value)} className="retro-select w-[150px]">
                                {llamacppModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 retro-panel retro-scrollbar bg-[#ffffff]">
                {!isConnected && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-black space-y-2 text-center p-4">
                        <p>{connectionError || "Local backend unreachable."}</p>
                        <button onClick={initializeConnections} className="retro-button">
                            Retry Connection
                        </button>
                    </div>
                )}

                {messages.length === 0 && isConnected && (
                    <div className="flex flex-col items-center justify-center h-full text-black space-y-4">
                        <p className="font-bold text-[16px]">Q&A Assistant Ready</p>
                        <div className="flex flex-col gap-2 w-full max-w-md">
                            {["How much did I spend in total on gym in 2024?", "Compare Groceries 2024 vs 2025", "What were my top 5 expenses for past month?"].map(q => (
                                <button key={q} onClick={() => setInput(q)} className="retro-button w-full text-left justify-start">
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
                    <div className="mb-4">
                        <div className="text-[11px] font-bold mb-1 text-black">Q&A Assistant</div>
                        <div className="p-2 retro-panel" style={{ borderStyle: 'solid', borderColor: '#808080', borderWidth: '1px' }}>
                            <WorkflowIndicator status={workflowStatus} elapsed={elapsedTime} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-2 bg-[#c0c0c0] border-t border-[#ffffff] flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask a question..."
                    disabled={!isConnected || isLoading}
                    className="retro-input flex-1"
                />
                <button
                    onClick={handleSend}
                    disabled={!isConnected || isLoading || !input.trim()}
                    className="retro-button font-bold"
                >
                    Send
                </button>
            </div>

            <ChoiceUIOverlay
                showChoiceUI={showChoiceUI} setShowChoiceUI={setShowChoiceUI}
                routerProvider={routerProvider}
                specialistProvider={specialistProvider}
                backendConnected={backendConnected}
            />

            {expandedChart && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8">
                    <div className="retro-window w-full h-full max-w-6xl max-h-[85vh] flex flex-col">
                        <div className="retro-titlebar">
                            <span>{expandedChart.layout?.title?.text || 'Analysis Result'}</span>
                            <div className="retro-titlebar-buttons">
                                <div className="retro-titlebar-button" onClick={() => setExpandedChart(null)}>X</div>
                            </div>
                        </div>
                        <div className="retro-content flex-1 bg-[#ffffff]">
                            <PlotlyChart data={expandedChart} isExpanded={true} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const WORKFLOW_STAGES = [
    { key: 'router', label: 'Router' },
    { key: 'specialist', label: 'Specialist' },
    { key: 'executing', label: 'Executing' },
];

function WorkflowIndicator({ status, elapsed }) {
    const stages = status || [];

    const routerInfo = stages.find(s => s.stage === 'router');
    const specialistInfo = stages.find(s => s.stage === 'specialist');
    const executingInfo = stages.find(s => s.stage === 'executing');

    // 1. Router status
    let routerStatus = '[   ]';
    let routerText = 'Router: Intent classification pending';
    if (routerInfo) {
        if (specialistInfo || executingInfo) {
            const tool = specialistInfo?.tool || routerInfo?.tool || 'unknown';
            routerStatus = '[OK]';
            routerText = `Router: Intent classified as ${tool}`;
        } else {
            routerStatus = '[...]';
            routerText = 'Router: Classifying intent...';
        }
    }

    // 2. Specialist status
    let specialistStatus = '[   ]';
    let specialistText = 'Specialist: Parameter generation pending';
    if (specialistInfo) {
        if (executingInfo) {
            specialistStatus = '[OK]';
            specialistText = 'Specialist: Parameters generated';
        } else {
            specialistStatus = '[...]';
            specialistText = 'Specialist: Generating parameters...';
        }
    } else if (routerInfo) {
        specialistStatus = '[...]';
        specialistText = 'Specialist: Waiting for router...';
    }

    // 3. Validator status
    let validatorStatus = '[   ]';
    let validatorText = 'Validator: Python AST execution pending';
    if (executingInfo) {
        validatorStatus = '[...]';
        validatorText = 'Validator: Executing Python AST...';
    } else if (specialistInfo) {
        validatorStatus = '[   ]';
        validatorText = 'Validator: Waiting for specialist...';
    }

    return (
        <div style={{ fontFamily: "'Consolas', 'Courier New', monospace" }} className="text-[12px] leading-relaxed text-black font-mono">
            <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-[#000080]">{routerStatus}</span>
                <span>{routerText}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-[#000080]">{specialistStatus}</span>
                <span>{specialistText}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-[#000080]">{validatorStatus}</span>
                <span>{validatorText}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-[#808080] mt-2 text-[#808080] text-[11px]">
                <Clock size={10} />
                <span>Elapsed: {elapsed}s</span>
            </div>
        </div>
    );
}
