import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { listLlamaCppModels } from '../utils/llamacpp';
import { runPythonStream } from '../utils/pythonRunner';
import { CATEGORY_MAPPING, MAJOR_CATEGORIES } from '../utils/categoryMapping';

import SettingsPanel from './chat/SettingsPanel';
import ChoiceUIOverlay from './chat/ChoiceUIOverlay';
import MessageItem, { PlotlyChart } from './chat/MessageItem';
import RetroSelect from './chat/RetroSelect';

// Avatar image paths — replace with generated sprites once available
// Prompt for USER sprite: see below in MessageItem
const USER_AVATAR = null;   // e.g. '/sprites/user_sprite.png'
const AI_AVATAR = null;     // e.g. '/sprites/ai_sprite.png'

export { USER_AVATAR, AI_AVATAR };

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
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [routerProvider] = useState('llamacpp');
    const [specialistProvider] = useState('llamacpp');

    const [llamacppModels, setLlamacppModels] = useState([]);
    const [showChoiceUI, setShowChoiceUI] = useState(false);

    const visibleRef = useRef(visible);

    useEffect(() => {
        visibleRef.current = visible;
        if (visible) setUnreadCount(0);
    }, [visible]);

    useEffect(() => {
        if (onStatusChange) onStatusChange({ loading: isLoading, unreadCount });
    }, [isLoading, unreadCount, onStatusChange]);

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
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [messages, isLoading]);

    useEffect(() => {
        if (visible) initializeConnections();
    }, [visible]);

    useEffect(() => {
        if (selectedRouterModel) localStorage.setItem('selected_router_model', selectedRouterModel);
    }, [selectedRouterModel]);

    useEffect(() => {
        if (selectedCodeModel) localStorage.setItem('selected_specialist_model', selectedCodeModel);
    }, [selectedCodeModel]);

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
            const metadataStr = `\n### CATEGORIES:\n${allCats.map(c => `- ${c}`).join('\n')}\n`;

            const analysisResult = await runPythonStream(null, data, {
                prompt: currentInput,
                metadata: metadataStr,
                currency,
                model: selectedCodeModel,
                routerModel: selectedRouterModel,
                routerProvider: 'llamacpp',
                specialistProvider: 'llamacpp',
                options: { temperature, top_p: topP, top_k: topK }
            }, (status) => {
                setWorkflowStatus(prev => [...prev, { ...status, timestamp: performance.now() }]);
            });

            const { result, fig, code, router_output, tool_name } = analysisResult;
            const endTime = performance.now();
            const durationSec = ((endTime - startTime) / 1000).toFixed(1);

            const newMessage = {
                role: 'assistant',
                content: result || (fig ? "I've generated a visualization for you." : "Analysis complete."),
                fig: fig ? JSON.parse(fig) : null,
                code,
                router_output,
                tool_name,
                executionTime: durationSec,
                validation_fixes: analysisResult.validation_fixes || null
            };

            setMessages(prev => [...prev, newMessage]);
            if (!visibleRef.current) setUnreadCount(prev => prev + 1);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}`, isError: true }]);
        } finally {
            setIsLoading(false);
            setWorkflowStatus([]);
        }
    };

    return (
        <div className="w-full h-full flex" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }}>

            {/* ── Main chat column ── */}
            <div className="flex flex-col flex-1 min-w-0 h-full">
                <SettingsPanel
                    showSettings={showSettings}
                    temperature={temperature} setTemperature={setTemperature}
                    topP={topP} setTopP={setTopP}
                    topK={topK} setTopK={setTopK}
                    routerProvider={routerProvider}
                    specialistProvider={specialistProvider}
                    backendConnected={backendConnected}
                />

                {/* Thin status bar */}
                <div style={{
                    padding: '5px 14px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-surface-2)',
                    fontSize: '12px',
                    gap: '12px',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span
                            className={`status-dot ${backendConnected ? 'online' : 'offline'}`}
                            title={backendConnected ? 'Backend connected' : 'Backend offline'}
                        />
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>LlamaCpp</span>
                        {!backendConnected && (
                            <button onClick={initializeConnections} className="app-btn" style={{ fontSize: '11px', padding: '2px 7px' }}>
                                Retry
                            </button>
                        )}
                    </div>

                    {/* Sidebar toggle */}
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="app-btn"
                        style={{ fontSize: '11px', padding: '2px 8px', gap: '4px' }}
                        title={sidebarOpen ? 'Hide model panel' : 'Show model panel'}
                    >
                        {sidebarOpen ? 'Hide Models' : 'Models'}
                        <span style={{ fontSize: '9px', transform: sidebarOpen ? 'none' : 'rotate(180deg)', display: 'inline-block', transition: 'transform 0.2s' }}>
                            ›
                        </span>
                    </button>
                </div>

                {/* Messages */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto modern-scrollbar"
                    style={{ padding: '16px', background: 'var(--bg-base)' }}
                >
                    {!isConnected && !isLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-secondary)' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                                <path d="M5 12H3m18 0h-2M12 5V3m0 18v-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M7.05 16.95l-1.414 1.414M18.364 5.636 16.95 7.05" />
                            </svg>
                            <p style={{ margin: 0, fontSize: '13px', textAlign: 'center' }}>{connectionError || "Local backend unreachable."}</p>
                            <button onClick={initializeConnections} className="app-btn">Retry Connection</button>
                        </div>
                    )}

                    {messages.length === 0 && isConnected && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Ask anything about your expenses
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                                Try one of the suggestions below or type your own question
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%', maxWidth: '420px' }}>
                                {[
                                    "How much did I spend in total on gym in 2024?",
                                    "Compare Groceries 2024 vs 2025",
                                    "What were my top 5 expenses for past month?"
                                ].map(q => (
                                    <button key={q} onClick={() => setInput(q)} className="app-btn" style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '13px' }}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <MessageItem key={i} msg={msg} setExpandedChart={setExpandedChart} />
                    ))}

                    {isLoading && messages.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Assistant
                            </div>
                            <div className="msg-assistant-bubble" style={{ display: 'inline-block' }}>
                                <WorkflowIndicator status={workflowStatus} elapsed={elapsedTime} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick chips */}
                {isConnected && (
                    <div style={{ padding: '7px 12px 4px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {["Monthly breakdown", "Top 5 expenses", "Compare Groceries 2024 vs 2025", "Show spending trend", "Total on Transport"].map(q => (
                            <button
                                key={q}
                                onClick={() => setInput(q)}
                                disabled={isLoading}
                                className="app-chip"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input bar */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '10px 12px',
                    borderTop: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    alignItems: 'center',
                }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask a question about your expenses…"
                        disabled={!isConnected || isLoading}
                        className="app-input"
                        style={{ flex: 1 }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!isConnected || isLoading || !input.trim()}
                        className="app-btn app-btn-primary"
                        style={{ flexShrink: 0, padding: '8px 16px' }}
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* ── Right Sidebar: Model Selection ── */}
            {sidebarOpen && (
                <div style={{
                    width: '210px',
                    flexShrink: 0,
                    borderLeft: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    height: '100%',
                }}>
                    {/* Sidebar header */}
                    <div style={{
                        padding: '9px 12px',
                        borderBottom: '1px solid var(--border-light)',
                        background: 'var(--bg-surface-2)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        flexShrink: 0,
                    }}>
                        Model Selection
                    </div>

                    <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Connection status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span className={`status-dot ${backendConnected ? 'online' : 'offline'}`} />
                            <span>{backendConnected ? 'Connected' : 'Offline'}</span>
                        </div>

                        {/* Router model */}
                        <div>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginBottom: '6px',
                            }}>
                                Router Model
                            </div>
                            <RetroSelect
                                value={selectedRouterModel}
                                onChange={setSelectedRouterModel}
                                options={llamacppModels}
                                width="100%"
                            />
                            <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Routes queries to the correct tool
                            </p>
                        </div>

                        {/* Specialist model */}
                        <div>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginBottom: '6px',
                            }}>
                                Specialist Model
                            </div>
                            <RetroSelect
                                value={selectedCodeModel}
                                onChange={setSelectedCodeModel}
                                options={llamacppModels}
                                width="100%"
                            />
                            <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Generates analysis parameters
                            </p>
                        </div>

                        {/* LLM parameters */}
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: '12px',
                            }}>
                                Parameters
                            </div>
                            {[
                                { label: 'Temperature', value: temperature, setter: setTemperature, min: 0, max: 1, step: 0.1, parse: parseFloat },
                                { label: 'Top P', value: topP, setter: setTopP, min: 0, max: 1, step: 0.05, parse: parseFloat },
                                { label: 'Top K', value: topK, setter: setTopK, min: 1, max: 100, step: 1, parse: parseInt },
                            ].map(({ label, value, setter, min, max, step, parse }) => (
                                <div key={label} style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>{value}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={min} max={max} step={step} value={value}
                                        onChange={(e) => setter(parse(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Refresh backend */}
                        <button
                            onClick={initializeConnections}
                            className="app-btn"
                            style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                        >
                            Refresh Models
                        </button>
                    </div>
                </div>
            )}

            <ChoiceUIOverlay
                showChoiceUI={showChoiceUI}
                setShowChoiceUI={setShowChoiceUI}
                routerProvider={routerProvider}
                specialistProvider={specialistProvider}
                backendConnected={backendConnected}
            />

            {expandedChart && (
                <div className="app-overlay-backdrop">
                    <div className="app-card" style={{ width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="app-card-header">
                            <div className="app-card-title">
                                <span className="title-dot" />
                                {expandedChart.layout?.title?.text || 'Analysis Result'}
                            </div>
                            <div className="app-window-controls">
                                <button className="app-window-btn close" onClick={() => setExpandedChart(null)} title="Close" />
                            </div>
                        </div>
                        <div style={{ flex: 1, background: 'var(--bg-surface)', padding: '12px', minHeight: 0 }}>
                            <PlotlyChart data={expandedChart} isExpanded={true} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function WorkflowIndicator({ status, elapsed }) {
    const stages = status || [];
    const routerInfo = stages.find(s => s.stage === 'router');
    const specialistInfo = stages.find(s => s.stage === 'specialist');
    const executingInfo = stages.find(s => s.stage === 'executing');

    let routerCls = 'pending', routerText = 'Router: pending';
    if (routerInfo) {
        if (specialistInfo || executingInfo) { routerCls = 'done'; routerText = `Router → ${specialistInfo?.tool || routerInfo?.tool || 'tool'}`; }
        else { routerCls = 'running'; routerText = 'Router: classifying…'; }
    }

    let specCls = 'pending', specText = 'Specialist: pending';
    if (specialistInfo) {
        if (executingInfo) { specCls = 'done'; specText = 'Specialist: done'; }
        else { specCls = 'running'; specText = 'Specialist: generating…'; }
    } else if (routerInfo) { specCls = 'running'; specText = 'Specialist: waiting…'; }

    let valCls = 'pending', valText = 'Executor: pending';
    if (executingInfo) { valCls = 'running'; valText = 'Executor: running…'; }
    else if (specialistInfo) { valText = 'Executor: waiting…'; }

    const icon = (cls) => cls === 'done' ? '✓' : cls === 'running' ? '…' : '·';

    return (
        <div style={{ fontFamily: 'var(--font-sans)', minWidth: '220px' }}>
            {[[routerCls, routerText], [specCls, specText], [valCls, valText]].map(([cls, text], i) => (
                <div key={i} className="workflow-step">
                    <span className={`step-status ${cls}`}>{icon(cls)}</span>
                    <span style={{ color: cls === 'running' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px' }}>{text}</span>
                </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', borderTop: '1px solid var(--border-light)', marginTop: '6px', paddingTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Clock size={10} />
                <span>{elapsed}s</span>
            </div>
        </div>
    );
}
