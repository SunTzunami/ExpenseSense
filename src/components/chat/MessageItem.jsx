import React, { useState, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Set these to your generated sprite paths once available
// See sprite generation prompts in SPRITE_PROMPTS.md
const USER_SPRITE = '/sprites/user.png';
const AI_SPRITE = '/sprites/ai.png';

function Avatar({ isUser }) {
    const src = isUser ? USER_SPRITE : AI_SPRITE;
    const label = isUser ? 'U' : 'A';
    const bg = isUser ? 'var(--accent-light)' : '#f0fdf4';
    const color = isUser ? 'var(--accent)' : 'var(--success)';

    if (src) {
        return (
            <img
                src={src}
                alt={isUser ? 'User' : 'AI'}
                style={{
                    width: '40px',
                    height: '40px',
                    imageRendering: 'pixelated',
                    borderRadius: '4px',
                    flexShrink: 0,
                    border: '1px solid var(--border-light)',
                    backgroundColor: '#ffffff',
                }}
            />
        );
    }

    return (
        <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: bg,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            flexShrink: 0,
            border: '1px solid var(--border-light)',
            fontFamily: 'var(--font-sans)',
        }}>
            {label}
        </div>
    );
}

export function PlotlyChart({ data, isExpanded = false }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current && data) {
            const colorway = ['#4361ee', '#7209b7', '#06d6a0', '#ef476f', '#ffd166', '#118ab2', '#073b4c', '#3a86ff'];

            const layout = {
                ...data.layout,
                autosize: true,
                colorway,
                margin: isExpanded ? { l: 70, r: 30, t: 50, b: 70 } : { l: 50, r: 20, t: 40, b: 55 },
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#f8f9fa',
                font: {
                    color: '#212529',
                    family: "'Inter', -apple-system, sans-serif",
                    size: isExpanded ? 14 : 12
                },
                title: isExpanded ? {
                    text: data.layout?.title?.text || '',
                    font: { size: 16, color: '#212529', family: "'Inter', sans-serif", weight: 600 }
                } : {
                    ...data.layout?.title,
                    font: { ...data.layout?.title?.font, size: 13, color: '#212529', family: "'Inter', sans-serif" }
                },
                xaxis: {
                    ...data.layout?.xaxis,
                    gridcolor: '#e9ecef',
                    zerolinecolor: '#ced4da',
                    linecolor: '#ced4da',
                    linewidth: 1,
                    showline: true,
                    tickfont: { color: '#6c757d', size: isExpanded ? 12 : 11, family: "'Inter', sans-serif" },
                    titlefont: { color: '#495057', size: isExpanded ? 13 : 12, family: "'Inter', sans-serif" },
                    automargin: true
                },
                yaxis: {
                    ...data.layout?.yaxis,
                    gridcolor: '#e9ecef',
                    zerolinecolor: '#ced4da',
                    linecolor: '#ced4da',
                    linewidth: 1,
                    showline: true,
                    tickfont: { color: '#6c757d', size: isExpanded ? 12 : 11, family: "'Inter', sans-serif" },
                    titlefont: { color: '#495057', size: isExpanded ? 13 : 12, family: "'Inter', sans-serif" },
                    automargin: true
                },
                legend: {
                    orientation: 'h',
                    y: isExpanded ? -0.15 : -0.25,
                    font: { color: '#6c757d', size: isExpanded ? 12 : 11, family: "'Inter', sans-serif" },
                    bgcolor: 'rgba(255,255,255,0.9)',
                    bordercolor: '#e9ecef',
                    borderwidth: 1
                },
                hoverlabel: {
                    bgcolor: '#212529',
                    bordercolor: '#212529',
                    font: { family: "'Inter', sans-serif", size: isExpanded ? 13 : 12, color: '#ffffff' }
                }
            };

            Plotly.react(containerRef.current, data.data, layout, {
                responsive: true,
                displayModeBar: isExpanded
            });
        }
    }, [data, isExpanded]);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(() => {
            if (containerRef.current) Plotly.Plots.resize(containerRef.current);
        });
        resizeObserver.observe(containerRef.current);
        const timer = setTimeout(() => {
            if (containerRef.current) Plotly.Plots.resize(containerRef.current);
        }, 400);
        return () => { resizeObserver.disconnect(); clearTimeout(timer); };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`w-full ${isExpanded ? 'h-full' : 'h-96'}`}
            style={{
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                overflow: 'hidden',
                backgroundColor: '#ffffff'
            }}
        />
    );
}

export default function MessageItem({ msg, setExpandedChart }) {
    const isUser = msg.role === 'user';
    const [showCode, setShowCode] = useState(false);

    return (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
            {/* Sender row with avatar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                marginBottom: '5px',
                flexDirection: isUser ? 'row-reverse' : 'row',
            }}>
                <Avatar isUser={isUser} />
                <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    {isUser ? 'You' : msg.isSystem ? 'System' : 'Assistant'}
                </span>
            </div>

            {/* Router badge */}
            {!isUser && msg.tool_name && (
                <div className="router-badge" style={{ marginBottom: '6px' }}>
                    <span>Router</span>
                    <span className="route-arrow">→</span>
                    <span className="route-tool">{msg.tool_name}</span>
                    {msg.router_output && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={msg.router_output.trim()}>
                            · {msg.router_output.trim()}
                        </span>
                    )}
                </div>
            )}

            {/* Bubble */}
            <div className={isUser ? 'msg-user-bubble' : 'msg-assistant-bubble'}>
                <div className="markdown-content" style={{ fontSize: '14px' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                    </ReactMarkdown>
                </div>

                {/* Validation fixes */}
                {msg.validation_fixes && msg.validation_fixes.length > 0 && (
                    <div className="app-warning-banner" style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, fontSize: '12px' }}>
                            <span>⚠️ Auto-corrected parameters via fuzzy matching</span>
                            <button
                                onClick={() => setShowCode(!showCode)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: 0, marginLeft: '8px', fontWeight: 500 }}
                            >
                                {showCode ? 'Hide' : 'Details'}
                            </button>
                        </div>
                        {showCode && (
                            <ul style={{ marginTop: '8px', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {msg.validation_fixes.map((fix, idx) => <li key={idx}>{fix}</li>)}
                            </ul>
                        )}
                    </div>
                )}

                {/* Chart */}
                {msg.fig && (
                    <div style={{ marginTop: '12px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                            <button
                                onClick={() => setExpandedChart(msg.fig)}
                                className="app-btn"
                                style={{ fontSize: '11px', padding: '3px 9px' }}
                                title="Expand chart"
                            >
                                ⤢ Expand
                            </button>
                        </div>
                        <PlotlyChart data={msg.fig} />
                    </div>
                )}

                {/* Footer: Code + Time */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '10px', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                    {msg.code && (
                        <details style={{ flex: 1, minWidth: 0 }}>
                            <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--accent)', userSelect: 'none', listStyle: 'none' }}>
                                › Specialist Output
                            </summary>
                            <pre style={{
                                marginTop: '8px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-light)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '10px 12px',
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-primary)',
                                maxHeight: '200px',
                                overflowY: 'auto',
                            }}>
                                {msg.code}
                            </pre>
                        </details>
                    )}
                    {msg.executionTime && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }}>
                            {msg.executionTime}s
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
