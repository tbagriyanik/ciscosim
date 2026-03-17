'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { CableType, CableInfo, getCableTypeLabel } from '@/lib/network/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DeviceIcon } from './DeviceIcon';
import type { DeviceType } from './networkTopology.types';

interface Device {
 id: string;
 type: DeviceType;
 name: string;
 ports: { id: string; label: string; status: 'connected' | 'disconnected' }[];
}

interface PortSelectorProps {
 devices: Device[];
 cableInfo: CableInfo;
 onConnect: (sourceDeviceId: string, sourcePortId: string, targetDeviceId: string, targetPortId: string, cableType: CableType) => void;
 onClose: () => void;
}

const CABLE_COLORS = {
 straight: { primary: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
 crossover: { primary: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
 console: { primary: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30' },
};

export function PortSelector({ devices, cableInfo, onConnect, onClose }: PortSelectorProps) {
 const { language } = useLanguage();
 const { theme } = useTheme();
 const isDark = theme === 'dark';

 const [step, setStep] = useState<'source' | 'target'>('source');
 const [selectedSource, setSelectedSource] = useState<{ deviceId: string; portId: string } | null>(null);
 const [selectedCableType, setSelectedCableType] = useState<CableType>(cableInfo.cableType);

 // Get all available ports
 const getAvailablePorts = (deviceId: string) => {
 const device = devices.find(d => d.id === deviceId);
 if (!device) return [];
 return device.ports.filter(p => p.status === 'disconnected');
 };

 // Handle source port selection
 const handleSourceSelect = (deviceId: string, portId: string) => {
 setSelectedSource({ deviceId, portId });
 setStep('target');
 };

 // Handle target port selection
 const handleTargetSelect = (deviceId: string, portId: string) => {
 if (selectedSource) {
 onConnect(selectedSource.deviceId, selectedSource.portId, deviceId, portId, selectedCableType);
 onClose();
 }
 };

 // Handle back button
 const handleBack = () => {
 setStep('source');
 setSelectedSource(null);
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
 <div className={`w-full max-w-md mx-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-2xl overflow-hidden`}>
 {/* Header */}
 <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {step === 'target' && (
 <button
 onClick={handleBack}
 className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 )}
 <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
 {step === 'source' 
 ? (language === 'tr' ? 'Başlangıç Portu Seçin' : 'Select Source Port')
 : (language === 'tr' ? 'Hedef Portu Seçin' : 'Select Target Port')
 }
 </h3>
 </div>
 <button
 onClick={onClose}
 className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Cable Type Selector */}
 <div className="mt-3">
 <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-2`}>
 {language === 'tr' ? 'Kablo Tipi' : 'Cable Type'}
 </div>
 <div className="flex gap-2">
 {(['straight', 'crossover', 'console'] as CableType[]).map((type) => {
 const typeLabel = getCableTypeLabel(type, language);
 return (
 <button
 key={type}
 onClick={() => setSelectedCableType(type)}
 className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
 selectedCableType === type
 ? `${CABLE_COLORS[type].bg} text-white`
 : isDark
 ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 <div className={`w-2.5 h-2.5 rounded ${CABLE_COLORS[type].bg}`} />
 <span className="text-xs font-semibold tracking-tight leading-snug">
 {typeLabel}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Device & Port List */}
 <div className="max-h-80 overflow-y-auto p-4 space-y-3">
 {devices.map((device) => {
 const availablePorts = getAvailablePorts(device.id);
 if (availablePorts.length === 0) return null;

 // For target step, exclude the source device
 if (step === 'target' && selectedSource?.deviceId === device.id) return null;

 return (
 <div
 key={device.id}
 className={`rounded-xl border ${isDark ? 'border-slate-700 bg-slate-700/30' : 'border-slate-200 bg-slate-50'}`}
 >
 {/* Device Header */}
 <div className={`px-3 py-2 flex items-center gap-2 border-b ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
 <DeviceIcon
 type={device.type}
 className={`${device.type === 'pc' ? 'text-blue-400' : device.type === 'router' ? 'text-purple-400' : 'text-emerald-400'} w-5 h-5`}
 />
 <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
 {device.name}
 </span>
 <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
 ({availablePorts.length} {language === 'tr' ? 'müsait port' : 'available'})
 </span>
 </div>

 {/* Port Grid */}
 <div className="p-3 flex flex-wrap gap-2">
 {availablePorts.map((port) => (
 <button
 key={port.id}
 onClick={() => {
 if (step === 'source') {
 handleSourceSelect(device.id, port.id);
 } else {
 handleTargetSelect(device.id, port.id);
 }
 }}
 className={`px-3 py-2 rounded-lg text-sm font-mono transition-all ${
 isDark
 ? 'bg-slate-600 hover:bg-cyan-600 text-slate-200 hover:text-white'
 : 'bg-white hover:bg-cyan-500 text-slate-700 hover:text-white border border-slate-200'
 }`}
 >
 {port.label}
 </button>
 ))}
 </div>
 </div>
 );
 })}
 </div>

 {/* Footer Hint */}
 <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} text-center`}>
 <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
 {step === 'source'
 ? (language === 'tr' ? 'Bağlantıyı başlatacak portu seçin' : 'Select the port to start connection from')
 : (language === 'tr' ? 'Bağlantıyı tamamlayacak portu seçin' : 'Select the port to complete connection')
 }
 </p>
 </div>
 </div>
 </div>
 );
}
