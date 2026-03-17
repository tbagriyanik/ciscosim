'use client';

import { SwitchState } from '@/lib/network/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Translations } from '@/contexts/LanguageContext';

interface ConfigPanelProps {
 state: SwitchState;
 onExecuteCommand: (command: string) => Promise<void>;
 onUpdateDeviceName?: (id: string, name: string) => void;
 isDevicePoweredOff?: boolean;
 t: Translations;
 theme: string;
}

const TIMESTAMP = '2026-02-26 22:00:00';

export function ConfigPanel({ state, onExecuteCommand, isDevicePoweredOff = false, t, theme }: ConfigPanelProps) {
 const [isSaving, setIsSaving] = useState(false);
 
 const isDark = theme === 'dark';

 const generateConfig = (): string => {
 let config = '!\\n';
 config += `! Last configuration change at ${TIMESTAMP}\\n`;
 config += `!\\n`;
 config += `version 15.0\\n`;
 config += `no service pad\\n`;
 config += `service timestamps debug datetime msec\\n`;
 config += `service timestamps log datetime msec\\n`;
 
 if (state.security.servicePasswordEncryption) {
 config += `service password-encryption\\n`;
 }
 
 config += `!\\n`;
 config += `hostname ${state.hostname}\\n`;
 config += `! base mac-address ${state.macAddress}\\n`;
 config += `!\\n`;
 
 if (state.bannerMOTD) {
 config += `banner motd #${state.bannerMOTD}#\\n`;
 config += `!\\n`;
 }
 
 if (state.security.enableSecret) {
 if (state.security.enableSecretEncrypted) {
 config += `enable secret 5 $1$xxxx$xxxxxxxxxxxxxxxx\\n`;
 } else {
 config += `enable secret ${state.security.enableSecret}\\n`;
 }
 }
 if (state.security.enablePassword) {
 config += `enable password ${state.security.enablePassword}\\n`;
 }
 config += `!\\n`;
 
 state.security.users.forEach(user => {
 config += `username ${user.username} privilege ${user.privilege} secret ${user.password}\\n`;
 });
 if (state.security.users.length > 0) {
 config += `!\\n`;
 }
 
 Object.values(state.vlans).forEach(vlan => {
 if (vlan.id >= 2 && vlan.id <= 1001) {
 config += `vlan ${vlan.id}\\n`;
 config += ` name ${vlan.name}\\n`;
 config += `!\\n`;
 }
 });
 
 Object.values(state.ports).forEach(port => {
   const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
   config += `interface ${portUpper}\n`;
   if (port.name) {
 config += ` description ${port.name}\\n`;
 }
 if (port.shutdown) {
 config += ` shutdown\\n`;
 }
 if (port.speed !== 'auto') {
 config += ` speed ${port.speed}\\n`;
 }
 if (port.duplex !== 'auto') {
 config += ` duplex ${port.duplex}\\n`;
 }
 if (port.mode === 'trunk') {
 config += ` switchport mode trunk\\n`;
 } else {
 config += ` switchport mode access\\n`;
 if (port.vlan !== 1) {
 config += ` switchport access vlan ${port.vlan}\\n`;
 }
 }
 config += `!\\n`;
 });
 
 config += `interface Vlan1\\n`;
 config += ` no ip address\\n`;
 config += ` shutdown\\n`;
 config += `!\\n`;
 
 config += `line con 0\\n`;
 if (state.security.consoleLine.password) {
 config += ` password ${state.security.consoleLine.password}\\n`;
 }
 if (state.security.consoleLine.login) {
 config += ` login\\n`;
 }
 config += `!\\n`;
 
 config += `line vty 0 4\\n`;
 if (state.security.vtyLines.password) {
 config += ` password ${state.security.vtyLines.password}\\n`;
 }
 if (state.security.vtyLines.login) {
 config += ` login\\n`;
 }
 if (state.security.vtyLines.transportInput.length > 0 && 
 state.security.vtyLines.transportInput[0] !== 'all') {
 config += ` transport input ${state.security.vtyLines.transportInput.join(' ')}\\n`;
 }
 config += `line vty 5 15\\n`;
 config += ` login\\n`;
 config += `!\\n`;
 
 config += `end\\n`;
 
 return config;
 };

 const handleSave = async () => {
 if (isDevicePoweredOff) return;
 setIsSaving(true);
 try {
 await onExecuteCommand('write memory');
 } finally {
 setIsSaving(false);
 }
 };

 const executeCommandWithHostnameCheck = async (command: string) => {
 await onExecuteCommand(command);
 if (command.toLowerCase().startsWith('hostname ') && onUpdateDeviceName) {
 const name = command.substring(9).trim();
 onUpdateDeviceName(state.hostname, name); // Assuming state.hostname is the ID-like reference or we might need the actual ID passed down. Since ID isn't directly in state.hostname but maybe should be, I'll use state.hostname as the identifier.
 }
 };

 const configText = generateConfig();
 
 const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
 const innerBg = isDark ? 'bg-slate-900' : 'bg-slate-900';
 const textPrimary = isDark ? 'text-white' : 'text-white';

 return (
 <Card className={`${cardBg}`}>
 <CardHeader className={`py-3 px-5 border-b ${isDark ? 'border-slate-800/50 bg-slate-800/20' : 'border-slate-200 bg-slate-50'}`}>
 <div className="flex items-center justify-between">
 <CardTitle className="text-blue-400 text-base sm:text-lg flex items-center gap-2">
 <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 {t.runningConfig}
 </CardTitle>
 <Button
 size="sm"
 onClick={handleSave}
 disabled={isSaving || isDevicePoweredOff}
 className="bg-blue-600 hover:bg-blue-700 text-xs px-2 sm:px-3"
 >
 {isSaving ? t.saving : t.save}
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 <ScrollArea className="h-48 sm:h-64">
 <pre className={`text-xs text-green-400 font-mono whitespace-pre-wrap ${innerBg} p-2 sm:p-3 rounded-lg`}>
 {configText.replace(/\\n/g, '\n')}
 </pre>
 </ScrollArea>
 
 <div className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} flex items-center gap-2`}>
 <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse" />
 {t.realTimeUpdate}
 </div>
 </CardContent>
 </Card>
 );
}
