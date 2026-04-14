'use client';

import { useState, useEffect } from 'react';
import type { CanvasDevice } from './networkTopology.types';

/** PC monitor icon */
export const PCIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
    </svg>
);

/** WiFi signal strength meter (1-5 bars) */
export const WifiSignalMeter = ({ strength }: { strength: number }) => {
    const activeColor = '#22c55e';
    const dimColor = '#94a3b8';
    const bar1Color = strength >= 1 ? activeColor : dimColor;
    const bar2Color = strength >= 2 ? activeColor : dimColor;
    const bar3Color = strength >= 3 ? activeColor : dimColor;
    const bar4Color = strength >= 4 ? activeColor : dimColor;
    const bar5Color = strength >= 5 ? activeColor : dimColor;

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 22 14" className="pointer-events-none w-full h-full">
                <rect x="1" y="10.5" width="2.5" height="3" fill={bar1Color} rx="0.3" />
                <rect x="5" y="8.5" width="2.5" height="5" fill={bar2Color} rx="0.3" />
                <rect x="9" y="6.5" width="2.5" height="7" fill={bar3Color} rx="0.3" />
                <rect x="13" y="4.5" width="2.5" height="9" fill={bar4Color} rx="0.3" />
                <rect x="17" y="2.5" width="2.5" height="11" fill={bar5Color} rx="0.3" />
            </svg>
        </div>
    );
};

/** Live IoT sensor chart + value display */
export const IoTSensorDisplay = ({
    device,
    environment,
    language,
    isDark,
}: {
    device: CanvasDevice;
    environment: any;
    language: string;
    isDark: boolean;
}) => {
    const [history, setHistory] = useState<number[]>([]);

    useEffect(() => {
        if (!device?.iot?.sensorType || !device.iot?.collaborationEnabled) {
            setHistory([]);
            return;
        }

        const sensorType = device.iot.sensorType;
        let baseValue = 0;
        let maxDelta = 1;

        switch (sensorType) {
            case 'temperature': baseValue = environment?.temperature ?? 22; maxDelta = 0.5; break;
            case 'humidity': baseValue = environment?.humidity ?? 50; maxDelta = 1.0; break;
            case 'light': baseValue = environment?.light ?? 70; maxDelta = 3; break;
            case 'sound': baseValue = 40; maxDelta = 5; break;
            case 'motion': baseValue = 0; maxDelta = 1; break;
        }

        let seed = 0;
        for (let i = 0; i < device.id.length; i++) seed += device.id.charCodeAt(i);
        const pseudoRandom = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        const points: number[] = [];
        let currentVal = baseValue;
        for (let i = 0; i < 300; i++) {
            if (sensorType === 'motion') {
                points.push(pseudoRandom() > 0.8 ? 1 : 0);
            } else {
                const walk = (pseudoRandom() - 0.5) * maxDelta;
                currentVal += walk;
                if (currentVal > baseValue + maxDelta * 5) currentVal -= Math.abs(walk);
                if (currentVal < baseValue - maxDelta * 5) currentVal += Math.abs(walk);
                points.push(currentVal);
            }
        }
        setHistory(points);

        const interval = setInterval(() => {
            setHistory(prev => {
                let nextVal = 0;
                if (sensorType === 'motion') {
                    nextVal = Math.random() > 0.8 ? 1 : 0;
                } else {
                    const walk = (Math.random() - 0.5) * maxDelta;
                    const lastVal = prev[prev.length - 1] ?? baseValue;
                    nextVal = lastVal + walk;
                    if (nextVal > baseValue + maxDelta * 5) nextVal -= Math.abs(walk);
                    if (nextVal < baseValue - maxDelta * 5) nextVal += Math.abs(walk);
                }
                return [...prev.slice(1), nextVal];
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [device.id, device.iot?.sensorType, device.iot?.collaborationEnabled, environment]);

    const isPassive = device.iot?.collaborationEnabled === false;
    if (!device?.iot?.sensorType || (history.length === 0 && !isPassive)) return null;

    const sensorType = device.iot.sensorType;
    const latestVal = history.length > 0 ? history[history.length - 1] : 0;

    let displayStr = '-';
    if (!device.iot?.collaborationEnabled) {
        displayStr = language === 'tr' ? 'PASİF' : 'PASSIVE';
    } else {
        switch (sensorType) {
            case 'temperature': displayStr = `${latestVal.toFixed(1)} °C`; break;
            case 'humidity': displayStr = `${latestVal.toFixed(1)} %`; break;
            case 'light': displayStr = `${Math.round(latestVal)} lx`; break;
            case 'sound': displayStr = `${Math.round(latestVal)} dB`; break;
            case 'motion': displayStr = latestVal > 0.5
                ? (language === 'tr' ? '🔴 Hareket Var' : '🔴 Detected')
                : (language === 'tr' ? '🟢 Hareket Yok' : '🟢 None');
                break;
        }
    }

    const isDigital = sensorType === 'motion';
    const margin = { top: 10, right: 10, bottom: 10, left: 15 };
    const width = 450;
    const height = 100;
    const gWidth = width - margin.left - margin.right;
    const gHeight = height - margin.top - margin.bottom;

    let min = isDigital ? 0 : Math.min(...history);
    let max = isDigital ? 1 : Math.max(...history);
    if (max === min) { max += 1; min -= 1; }

    let pointsStr = '';
    if (isDigital) {
        pointsStr = history.map((val, i) => {
            const x = margin.left + (i / (history.length - 1)) * gWidth;
            const y = margin.top + gHeight - ((val - min) / (max - min)) * gHeight;
            if (i === 0) return `${x},${y}`;
            const prevX = margin.left + ((i - 1) / (history.length - 1)) * gWidth;
            return `${prevX},${y} ${x},${y}`;
        }).join(' ');
    } else {
        pointsStr = history.map((val, i) => {
            const x = margin.left + (i / (history.length - 1)) * gWidth;
            const y = margin.top + gHeight - ((val - min) / (max - min)) * gHeight;
            return `${x},${y}`;
        }).join(' ');
    }

    return (
        <div className="space-y-4">
            <div className={`p-4 rounded-lg border-l-4 ${isDark ? 'bg-slate-800 border-cyan-500' : 'bg-cyan-50 border-cyan-500'}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 mb-1">
                            {language === 'tr' ? 'Anlık Sensör Değeri' : 'Live Sensor Value'}
                        </div>
                        <div className="text-2xl font-bold text-cyan-500">{displayStr}</div>
                    </div>
                    <div className={`p-3 rounded-full ${isDark ? 'bg-slate-700' : 'bg-white'}`}>
                        {sensorType === 'temperature' && <span className="text-2xl">🌡️</span>}
                        {sensorType === 'humidity' && <span className="text-2xl">💧</span>}
                        {sensorType === 'motion' && <span className="text-2xl">🏃</span>}
                        {sensorType === 'light' && <span className="text-2xl">💡</span>}
                        {sensorType === 'sound' && <span className="text-2xl">🔊</span>}
                    </div>
                </div>
            </div>

            <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-100/50'}`}>
                <div className="flex justify-between items-end mb-2">
                    <div className="text-xs font-semibold text-slate-500">
                        {language === 'tr' ? 'Son 5 Dakika (300sn) Geçmişi' : 'Last 5 Minutes History'}
                    </div>
                    {!isPassive && (
                        <div className="text-xs text-cyan-500/80 font-mono">
                            {latestVal.toFixed(isDigital ? 0 : 1)}{' '}
                            {isDigital ? '' : (sensorType === 'temperature' ? '°C' : sensorType === 'humidity' ? '%' : sensorType === 'light' ? 'lx' : 'dB')}
                        </div>
                    )}
                </div>
                <div className="w-full overflow-hidden rounded relative" style={{ height: '100px' }}>
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        <line x1={margin.left} y1={margin.top} x2={width - margin.right} y2={margin.top} stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1" strokeDasharray="4 4" />
                        <line x1={margin.left} y1={margin.top + gHeight / 2} x2={width - margin.right} y2={margin.top + gHeight / 2} stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1" strokeDasharray="4 4" />
                        <line x1={margin.left} y1={margin.top + gHeight} x2={width - margin.right} y2={margin.top + gHeight} stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1" strokeDasharray="4 4" />
                        <text x={0} y={margin.top + 3} fill={isDark ? '#64748b' : '#94a3b8'} fontSize="8" fontFamily="monospace">{max.toFixed(1)}</text>
                        <text x={0} y={margin.top + gHeight + 3} fill={isDark ? '#64748b' : '#94a3b8'} fontSize="8" fontFamily="monospace">{min.toFixed(1)}</text>
                        <polyline
                            fill="none"
                            stroke="url(#lineGradHistory)"
                            strokeWidth={isDigital ? '1' : '2'}
                            points={pointsStr}
                            style={{ vectorEffect: 'non-scaling-stroke' }}
                        />
                        <defs>
                            <linearGradient id="lineGradHistory" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>
        </div>
    );
};
