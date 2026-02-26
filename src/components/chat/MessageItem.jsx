import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Database, Bot, Maximize2, Clock } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';

export function PlotlyChart({ data, isExpanded = false }) {
    const containerRef = useRef(null);
    useEffect(() => {
        if (containerRef.current && data) {
            const layout = {
                ...data.layout,
                autosize: true,
                margin: isExpanded ? { l: 80, r: 40, t: 60, b: 80 } : { l: 50, r: 20, t: 40, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: {
                    color: '#94a3b8',
                    family: 'Outfit, sans-serif',
                    size: isExpanded ? 14 : 11
                },
                title: isExpanded ? { text: '' } : {
                    ...data.layout?.title,
                    font: {
                        ...data.layout?.title?.font,
                        size: 16,
                        color: '#f8fafc'
                    }
                },
                xaxis: {
                    ...data.layout?.xaxis,
                    gridcolor: 'rgba(255,255,255,0.1)',
                    zerolinecolor: 'rgba(255,255,255,0.1)',
                    tickfont: { color: '#94a3b8', size: isExpanded ? 12 : 10 },
                    titlefont: { color: '#94a3b8', size: isExpanded ? 14 : 11 },
                    automargin: true
                },
                yaxis: {
                    ...data.layout?.yaxis,
                    gridcolor: 'rgba(255,255,255,0.1)',
                    zerolinecolor: 'rgba(255,255,255,0.1)',
                    tickfont: { color: '#94a3b8', size: isExpanded ? 12 : 10 },
                    titlefont: { color: '#94a3b8', size: isExpanded ? 14 : 11 },
                    automargin: true
                },
                legend: {
                    orientation: 'h',
                    y: isExpanded ? -0.15 : -0.2,
                    font: { color: '#94a3b8', size: isExpanded ? 12 : 10 }
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

    return <div ref={containerRef} className={`w-full ${isExpanded ? 'h-full' : 'h-72'}`} />;
}

export default function MessageItem({ msg, setExpandedChart }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' :
                msg.isSystem ? 'bg-slate-700 text-slate-400' :
                    'bg-primary/20 text-primary'}`}>
                {msg.role === 'user' ? <User size={14} /> : msg.isSystem ? <Database size={14} /> : <Bot size={14} />}
            </div>
            <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'max-w-[85%] bg-indigo-600 text-white' : (msg.fig ? 'w-full max-w-[95%]' : 'max-w-[95%]') + ' bg-slate-800 text-slate-200'} text-sm ${msg.isError ? 'bg-red-500/10 text-red-200 border border-red-500/20' :
                msg.isSystem ? 'bg-slate-800/50 text-slate-400 italic' : ''
                }`}>
                {msg.content}

                {msg.fig && (
                    <div className="mt-4 bg-black/20 rounded-lg p-2 overflow-hidden border border-white/5 w-full relative group/chart">
                        <PlotlyChart data={msg.fig} />
                        <button
                            onClick={() => setExpandedChart(msg.fig)}
                            className="absolute top-4 right-4 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-primary rounded-lg opacity-0 group-hover/chart:opacity-100 transition-all border border-white/10"
                            title="Expand Plot"
                        >
                            <Maximize2 size={16} />
                        </button>
                    </div>
                )}

                <div className="flex items-start justify-between mt-2 gap-2 w-full">
                    {msg.code && (
                        <details className="opacity-50 text-[10px] flex-1 min-w-0">
                            <summary className="cursor-pointer hover:underline select-none font-medium">View Logic</summary>
                            <div className="mt-1.5 w-full bg-black/40 rounded border border-white/5 overflow-x-auto">
                                <pre className="p-2 whitespace-pre-wrap break-all font-mono min-w-0">
                                    {msg.code}
                                </pre>
                            </div>
                        </details>
                    )}

                    {msg.executionTime && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 ml-auto flex-shrink-0 pt-[1px]">
                            <Clock size={10} />
                            <span>{msg.executionTime}s</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
