import React, { useRef, useState } from 'react';

const FileUploader = ({ onFileUpload, onUseDemo }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileInput = async (e) => {
        if (e.target.files && e.target.files[0]) {
            setIsLoading(true);
            try {
                await onFileUpload(e.target.files[0]);
            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to parse file");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            setIsLoading(true);
            try {
                await onFileUpload(file);
            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to parse file");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div style={{
            width: '100%',
            minHeight: '100vh',
            display: 'flex',
            fontFamily: 'var(--font-sans)',
            background: 'var(--bg-base)',
        }}>
            {/* ── Left: Branding panel ── */}
            <div style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '60px 64px',
                background: '#fff',
                borderRight: '1px solid var(--border-light)',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Subtle background grid */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `
                        linear-gradient(var(--border-light) 1px, transparent 1px),
                        linear-gradient(90deg, var(--border-light) 1px, transparent 1px)
                    `,
                    backgroundSize: '32px 32px',
                    opacity: 0.5,
                    pointerEvents: 'none',
                }} />

                {/* Accent gradient blob */}
                <div style={{
                    position: 'absolute',
                    top: '-80px',
                    right: '-80px',
                    width: '360px',
                    height: '360px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(67,97,238,0.08) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-60px',
                    left: '40px',
                    width: '280px',
                    height: '280px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(46,204,113,0.07) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', maxWidth: '460px' }}>
                    {/* Wordmark */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
                        {/* Mini logo mark */}
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3v18h18" />
                                <path d="M18 9l-5 5-4-4-3 3" />
                            </svg>
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            ExpenseSense
                        </span>
                    </div>

                    {/* Hero heading */}
                    <h1 style={{
                        margin: '0 0 16px',
                        fontSize: '42px',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                    }}>
                        Understand your<br />
                        <span style={{ color: 'var(--accent)' }}>spending</span>,<br />
                        instantly.
                    </h1>

                    <p style={{
                        margin: '0 0 40px',
                        fontSize: '16px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.65,
                        maxWidth: '380px',
                    }}>
                        Drop in your expense spreadsheet and ask questions in plain English. Charts, trends, and breakdowns — generated on-device.
                    </p>

                    {/* Feature pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[
                            'Runs locally',
                            'No data sent to cloud',
                            'Natural language queries',
                            'Auto-generated charts',
                        ].map(f => (
                            <span key={f} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '99px',
                                padding: '4px 11px',
                            }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
                                {f}
                            </span>
                        ))}
                    </div>

                    {/* ── Conversation Demo ── */}
                    <div className="comic-panel" style={{
                        marginTop: '32px',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                    }}>
                        {/* ── Row 1: User speaks (sprite left, bubble right) ── */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                            <img
                                src="/sprites/user.png" alt="User"
                                style={{
                                    width: '80px', height: '80px', borderRadius: '12px',
                                    imageRendering: 'pixelated',
                                    border: '3px solid #111111',
                                    background: '#fff', flexShrink: 0,
                                    boxShadow: '4px 4px 0px #111111',
                                }}
                            />
                            <div
                                className="comic-bubble comic-bubble-left"
                                style={{
                                    fontSize: '13px',
                                    maxWidth: '300px',
                                }}
                            >
                                can ya compare spend on grocery jan 2026 vs jan '25?
                            </div>
                        </div>

                        {/* ── Row 2: AI speaks (bubble left, sprite right) ── */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', justifyContent: 'flex-end' }}>
                            <div
                                className="comic-bubble comic-bubble-right"
                                style={{
                                    flex: 1,
                                    maxWidth: '300px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                }}
                            >
                                {/* Router badge */}
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '10px', fontWeight: 800, alignSelf: 'flex-start',
                                    background: '#f1f3f5', border: '2px solid #111111',
                                    borderRadius: '99px', padding: '2px 8px', color: '#111111',
                                    boxShadow: '1.5px 1.5px 0px #111111',
                                }}>
                                    <span>Router</span>
                                    <span>{'\u2192'}</span>
                                    <span style={{ color: 'var(--accent)' }}>plot_comparison_bars</span>
                                </div>

                                {/* Workflow steps */}
                                <div style={{
                                    display: 'flex', gap: '10px', fontSize: '10px', color: '#666666',
                                    flexWrap: 'wrap', alignItems: 'center', fontWeight: 600,
                                }}>
                                    {[
                                        { icon: '\u2713', text: 'Router' },
                                        { icon: '\u2713', text: 'Specialist' },
                                        { icon: '\u2713', text: 'Executor' },
                                    ].map((s, i) => (
                                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                            <span style={{ color: 'var(--success)', fontWeight: 800 }}>{s.icon}</span>
                                            <span>{s.text}</span>
                                        </span>
                                    ))}
                                    <span style={{ color: '#888888', fontSize: '9px' }}>· 2.4s</span>
                                </div>

                                {/* Response text */}
                                <div style={{ fontSize: '12px', color: '#111111', lineHeight: 1.45 }}>
                                    Comparing spending in <strong>grocery</strong> for 2025-01 (¥43,200) vs 2026-01 (¥31,500), it <strong>decreased</strong> by <strong>27.1%</strong>.
                                </div>

                                {/* Mini bar chart with comic styling */}
                                <div style={{
                                    background: '#ffffff',
                                    border: '2px solid #111111',
                                    borderRadius: '10px',
                                    padding: '8px 10px',
                                    boxShadow: '2.5px 2.5px 0px #111111',
                                }}>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#111111', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                        grocery: 2025-01 vs 2026-01
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '14px', height: '54px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#111111' }}>¥43.2k</span>
                                            <div style={{ width: '24px', height: '36px', background: '#3b82f6', border: '2px solid #111111', borderRadius: '3px 3px 0 0' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#111111' }}>¥31.5k</span>
                                            <div style={{ width: '24px', height: '26px', background: '#a855f7', border: '2px solid #111111', borderRadius: '3px 3px 0 0' }} />
                                        </div>
                                    </div>
                                    <div style={{ borderTop: '2px solid #111111', marginTop: '6px', paddingTop: '4px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#3b82f6', border: '1px solid #111111', display: 'inline-block' }} />
                                            <span style={{ fontSize: '8px', fontWeight: 700, color: '#555555' }}>Jan 2025</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#a855f7', border: '1px solid #111111', display: 'inline-block' }} />
                                            <span style={{ fontSize: '8px', fontWeight: 700, color: '#555555' }}>Jan 2026</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <img
                                src="/sprites/ai.png" alt="AI"
                                style={{
                                    width: '80px', height: '80px', borderRadius: '12px',
                                    imageRendering: 'pixelated',
                                    border: '3px solid #111111',
                                    background: '#fff', flexShrink: 0,
                                    boxShadow: '4px 4px 0px #111111',
                                }}
                            />
                        </div>
                    </div>

                </div>

                {/* Footer note */}
                <p style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '64px',
                    margin: 0,
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                }}>
                    ExpenseSense
                </p>
            </div>

            {/* ── Right: Upload panel ── */}
            <div style={{
                width: '420px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '48px 40px',
                background: 'var(--bg-base)',
            }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Get started
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Upload an Excel file or try demo data
                </p>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div className="loading-dots" style={{ marginBottom: '14px' }}>
                            <span /><span /><span />
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Processing your file…
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Drop zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            style={{
                                border: `2px dashed ${isDragOver ? 'var(--accent)' : 'var(--border-medium)'}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '36px 24px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: isDragOver ? 'var(--accent-light)' : '#fff',
                                transition: 'all 0.18s ease',
                                marginBottom: '20px',
                            }}
                        >
                            {/* Upload icon */}
                            <div style={{
                                width: '44px',
                                height: '44px',
                                margin: '0 auto 14px',
                                borderRadius: 'var(--radius-md)',
                                background: isDragOver ? 'rgba(67,97,238,0.12)' : 'var(--bg-surface-2)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.18s',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDragOver ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: isDragOver ? 'var(--accent)' : 'var(--text-primary)' }}>
                                Drop your file here
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                                or click to browse · .xls, .xlsx
                            </p>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileInput}
                            accept=".xls,.xlsx"
                            style={{ display: 'none' }}
                        />

                        {/* Divider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                        </div>

                        {/* Demo button */}
                        <button
                            className="app-btn"
                            onClick={onUseDemo}
                            style={{ width: '100%', justifyContent: 'center', fontSize: '13px', padding: '10px' }}
                        >
                            Try with Demo Data
                        </button>

                        <p style={{ margin: '16px 0 0', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                            Your data never leaves your machine.<br />All analysis runs on a local LLM.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default FileUploader;
