import React from 'react';
import RetroSelect from './RetroSelect';

export default function ChoiceUIOverlay({
    showChoiceUI, setShowChoiceUI,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    backendConnected
}) {
    if (!showChoiceUI) return null;

    return (
        <div className="app-overlay-backdrop">
            <div className="app-card" style={{ width: '100%', maxWidth: '380px' }}>
                <div className="app-card-header">
                    <div className="app-card-title">
                        <span className="title-dot" />
                        Provider Configuration
                    </div>
                    <div className="app-window-controls">
                        <button className="app-window-btn close" onClick={() => setShowChoiceUI(false)} title="Close" />
                    </div>
                </div>

                <div style={{ padding: '20px 20px 24px' }}>
                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Confirm your provider settings before continuing.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Router Provider
                            </label>
                            <RetroSelect
                                value={routerProvider}
                                onChange={val => setRouterProvider && setRouterProvider(val)}
                                options={[{ value: 'llamacpp', label: 'LlamaCpp (Local)' }]}
                                width="100%"
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Analyst Provider
                            </label>
                            <RetroSelect
                                value={specialistProvider}
                                onChange={val => setSpecialistProvider && setSpecialistProvider(val)}
                                options={[{ value: 'llamacpp', label: 'LlamaCpp (Local)' }]}
                                width="100%"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.setItem('expense_ai_setup_done', 'true');
                            localStorage.setItem('router_provider', 'llamacpp');
                            localStorage.setItem('specialist_provider', 'llamacpp');
                            setShowChoiceUI(false);
                        }}
                        className="app-btn app-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', padding: '9px' }}
                    >
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
