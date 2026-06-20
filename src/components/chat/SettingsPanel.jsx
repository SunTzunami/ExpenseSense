import React from 'react';
import RetroSelect from './RetroSelect';

export default function SettingsPanel({
    showSettings,
    temperature, setTemperature,
    topP, setTopP,
    topK, setTopK,
    routerProvider, setRouterProvider,
    specialistProvider, setSpecialistProvider,
    backendConnected
}) {
    if (!showSettings) return null;

    const sliderLabel = { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' };
    const sliderValue = { fontSize: '12px', fontWeight: 700, color: 'var(--accent)' };

    return (
        <div style={{
            margin: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            boxShadow: 'var(--shadow-sm)',
        }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                LLM Configuration
            </h4>

            {[
                { label: 'Temperature', value: temperature, setter: setTemperature, min: 0, max: 1, step: 0.1, parse: parseFloat },
                { label: 'Top P', value: topP, setter: setTopP, min: 0, max: 1, step: 0.05, parse: parseFloat },
                { label: 'Top K', value: topK, setter: setTopK, min: 1, max: 100, step: 1, parse: parseInt },
            ].map(({ label, value, setter, min, max, step, parse }) => (
                <div key={label} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={sliderLabel}>{label}</span>
                        <span style={sliderValue}>{value}</span>
                    </div>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => setter(parse(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent)' }}
                    />
                </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '4px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Providers
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { label: 'Router', value: routerProvider, setter: setRouterProvider },
                        { label: 'Specialist', value: specialistProvider, setter: setSpecialistProvider },
                    ].map(({ label, value, setter }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ ...sliderLabel }}>{label}</span>
                            <RetroSelect
                                value={value}
                                onChange={val => setter && setter(val)}
                                options={[{ value: 'llamacpp', label: 'LlamaCpp' }]}
                                width="120px"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
