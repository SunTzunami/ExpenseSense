import React, { useState, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function PlotlyChart({ data, isExpanded = false }) {
    const containerRef = useRef(null);
    useEffect(() => {
        if (containerRef.current && data) {
            const retroColorway = ['#000080', '#ff00ff', '#008080', '#800000', '#0000ff', '#808080', '#00ff00', '#ff0000', '#ffff00'];
            
            const layout = {
                ...data.layout,
                autosize: true,
                colorway: retroColorway,
                margin: isExpanded ? { l: 80, r: 40, t: 60, b: 80 } : { l: 60, r: 30, t: 50, b: 60 },
                paper_bgcolor: '#c0c0c0',
                plot_bgcolor: '#ffffff',
                font: {
                    color: '#000000',
                    family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace",
                    size: isExpanded ? 14 : 11
                },
                title: isExpanded ? { text: data.layout?.title?.text || '' } : {
                    ...data.layout?.title,
                    font: {
                        ...data.layout?.title?.font,
                        size: 13,
                        color: '#000000',
                        family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace",
                        weight: 'bold'
                    }
                },
                xaxis: {
                    ...data.layout?.xaxis,
                    gridcolor: '#c0c0c0',
                    zerolinecolor: '#000000',
                    linecolor: '#000000',
                    linewidth: 1,
                    mirror: true,
                    showline: true,
                    tickfont: { color: '#000000', size: isExpanded ? 11 : 9, family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace" },
                    titlefont: { color: '#000000', size: isExpanded ? 13 : 11, weight: 'bold', family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace" },
                    automargin: true
                },
                yaxis: {
                    ...data.layout?.yaxis,
                    gridcolor: '#c0c0c0',
                    zerolinecolor: '#000000',
                    linecolor: '#000000',
                    linewidth: 1,
                    mirror: true,
                    showline: true,
                    tickfont: { color: '#000000', size: isExpanded ? 11 : 9, family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace" },
                    titlefont: { color: '#000000', size: isExpanded ? 13 : 11, weight: 'bold', family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace" },
                    automargin: true
                },
                legend: {
                    orientation: 'h',
                    y: isExpanded ? -0.15 : -0.25,
                    font: { color: '#000000', size: isExpanded ? 11 : 9, family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace" },
                    bgcolor: '#c0c0c0',
                    bordercolor: '#000000',
                    borderwidth: 1
                },
                hoverlabel: {
                    bgcolor: '#ffffcc',
                    bordercolor: '#000000',
                    font: {
                        family: "'MS Sans Serif', 'Tahoma', 'Consolas', monospace",
                        size: isExpanded ? 12 : 10,
                        color: '#000000'
                    }
                }
            };

            Plotly.react(containerRef.current, data.data, layout, {
                responsive: true,
                displayModeBar: isExpanded
            });
        }
    }, [data, isExpanded]);

    // Cleanup and Resize Handling
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
            if (containerRef.current) {
                Plotly.Plots.resize(containerRef.current);
            }
        });
        resizeObserver.observe(containerRef.current);

        const timer = setTimeout(() => {
            if (containerRef.current) {
                Plotly.Plots.resize(containerRef.current);
            }
        }, 400);

        return () => {
            resizeObserver.disconnect();
            clearTimeout(timer);
        };
    }, []);

    return <div ref={containerRef} className={`w-full border-2 border-[#808080] border-solid ${isExpanded ? 'h-full' : 'h-96'}`} style={{ backgroundColor: '#c0c0c0' }} />;
}

export default function MessageItem({ msg, setExpandedChart }) {
    const isUser = msg.role === 'user';
    const [showDetails, setShowDetails] = useState(false);
    
    return (
        <div className={`mb-4 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <div className={`text-[11px] font-bold mb-1 ${isUser ? 'text-[#000080]' : 'text-black'}`}>
                {isUser ? 'User' : msg.isSystem ? 'System' : 'Q&A Assistant'}
            </div>

            <div className={`p-2 max-w-[95%] ${isUser ? 'retro-panel bg-[#e0e0e0]' : 'retro-panel'}`} style={{ borderStyle: 'solid', borderColor: isUser ? '#808080' : '#808080', borderWidth: '1px' }}>
                <div className="markdown-content text-[14px]" style={{ fontFamily: "'Consolas', 'Courier New', monospace" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                    </ReactMarkdown>
                </div>

                {msg.validation_fixes && msg.validation_fixes.length > 0 && (
                    <div className="mt-2 mb-2 p-2 bg-[#ffffcc] border border-[#808080] text-[12px] text-black" style={{ fontFamily: "'Consolas', 'Courier New', monospace" }}>
                        <div className="flex items-center justify-between font-bold">
                            <span>⚠️ Note: Auto-corrected parameters via fuzzy matching</span>
                            <button 
                                onClick={() => setShowDetails(!showDetails)} 
                                className="text-[#000080] underline cursor-pointer focus:outline-none ml-2"
                                style={{ background: 'none', border: 'none', padding: 0 }}
                            >
                                {showDetails ? '[Hide Details]' : '[View Details]'}
                            </button>
                        </div>
                        {showDetails && (
                            <ul className="mt-1.5 pl-4 list-disc text-[11px] font-mono border-t border-dashed border-[#808080] pt-1.5">
                                {msg.validation_fixes.map((fix, idx) => (
                                    <li key={idx}>{fix}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {msg.fig && (
                    <div className="mt-2 mb-2 border border-[#808080] p-1 bg-[#c0c0c0] w-full relative">
                        <div className="flex justify-end mb-1">
                            <button
                                onClick={() => setExpandedChart(msg.fig)}
                                className="retro-titlebar-button text-[12px] font-bold w-5 h-5 flex items-center justify-center cursor-pointer select-none"
                                title="Expand Plot"
                                style={{ padding: 0, lineHeight: 1 }}
                            >
                                □
                            </button>
                        </div>
                        <PlotlyChart data={msg.fig} />
                    </div>
                )}

                <div className="flex items-start justify-between mt-2 gap-2 w-full border-t border-[#c0c0c0] pt-1">
                    {msg.code && (
                        <details className="text-[11px] flex-1 min-w-0">
                            <summary className="cursor-pointer select-none font-bold text-[#000080]">View Logic</summary>
                            <div className="mt-1 w-full bg-[#ffffff] border border-[#808080] p-1 overflow-x-auto">
                                <pre className="whitespace-pre-wrap break-all font-mono min-w-0" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                                    {msg.code}
                                </pre>
                            </div>
                        </details>
                    )}

                    {msg.executionTime && (
                        <div className="text-[11px] text-[#808080] ml-auto flex-shrink-0">
                            Time: {msg.executionTime}s
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
