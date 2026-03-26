'use client';

import { SwitchState } from '@/lib/network/types';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Translations } from '@/contexts/LanguageContext';
import { ModernPanel } from '@/components/ui/ModernPanel';
import { Save, FileText } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile, useIsTablet, useIsDesktop } from '@/hooks/use-breakpoint';

interface ConfigPanelProps {
  state: SwitchState;
  onExecuteCommand: (command: string) => Promise<void>;
  isDevicePoweredOff?: boolean;
  t: Translations;
  theme: string;
  className?: string;
  title?: string;
}

const TIMESTAMP = '2026-02-26 22:00:00';

export function ConfigPanel({ state, onExecuteCommand, isDevicePoweredOff = false, t, theme, className, title }: ConfigPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isDark = theme === 'dark';
  
  // Responsive hooks
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

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

    if (state.ipRouting) {
      config += `ip routing\\n`;
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
      if (port.id.toLowerCase().startsWith('vlan')) return;
      const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
      config += `interface ${portUpper}\\n`;
      if (port.name) config += ` description ${port.name}\\n`;
      if (port.shutdown) config += ` shutdown\\n`;
      if (port.speed !== 'auto') config += ` speed ${port.speed}\\n`;
      if (port.duplex !== 'auto') config += ` duplex ${port.duplex}\\n`;
      if (port.mode === 'trunk') config += ` switchport mode trunk\\n`;
      else {
        config += ` switchport mode access\\n`;
        const vlanId = Number((port as any).accessVlan || port.vlan || 1);
        if (vlanId !== 1) config += ` switchport access vlan ${vlanId}\\n`;
      }
      if (port.ipAddress && port.subnetMask) config += ` ip address ${port.ipAddress} ${port.subnetMask}\\n`;
      config += `!\\n`;
    });

    Object.keys(state.ports || {}).forEach(portName => {
      if (portName.toLowerCase().startsWith('vlan')) {
        const port = state.ports[portName];
        const vlanNum = portName.toLowerCase().replace('vlan', '');
        if (vlanNum === '1' && (!port.ipAddress || !port.subnetMask)) return;
        config += `interface Vlan${vlanNum}\\n`;
        if (port.ipAddress && port.subnetMask) config += ` ip address ${port.ipAddress} ${port.subnetMask}\\n`;
        if (!port.shutdown) config += ` no shutdown\\n`;
        else config += ` shutdown\\n`;
        config += `!\\n`;
      }
    });

    const vlan1Port = state.ports['vlan1'];
    if (!vlan1Port || !vlan1Port.ipAddress || !vlan1Port.subnetMask) {
      config += `interface Vlan1\\n`;
      config += ` no ip address\\n`;
      config += ` shutdown\\n`;
      config += `!\\n`;
    }
    config += ` shutdown\\n`;
    config += `!\\n`;

    config += `line con 0\\n`;
    if (state.security.consoleLine.password) config += ` password ${state.security.consoleLine.password}\\n`;
    if (state.security.consoleLine.login) config += ` login\\n`;
    config += `!\\n`;

    config += `line vty 0 15\\n`;
    if (state.security.vtyLines.password) config += ` password ${state.security.vtyLines.password}\\n`;
    if (state.security.vtyLines.login) config += ` login\\n`;
    if (state.security.vtyLines.transportInput.length > 0 && state.security.vtyLines.transportInput[0] !== 'all') {
      config += ` transport input ${state.security.vtyLines.transportInput.join(' ')}\\n`;
    }
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

  const headerAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || isDevicePoweredOff}
          className="bg-blue-600 hover:bg-blue-700 h-8 gap-2"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">{isSaving ? t.saving : t.save}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t.save} Configuration</TooltipContent>
    </Tooltip>
  );

  const configText = state.runningConfig?.length
    ? state.runningConfig.join('\n')
    : generateConfig();

  return (
    <ModernPanel
      id={`config-${state.hostname}`}
      title={title || t.runningConfig}
      headerAction={headerAction}
      collapsible={false}
      className={cn(
        "w-full max-w-none",
        className
      )}
    >
      <div className="flex flex-col h-full overflow-hidden p-3 sm:p-4 bg-background">
        <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950 custom-scrollbar">
          <pre className="p-3 sm:p-4 text-xs sm:text-sm text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
            {configText.replace(/\\n/g, '\n')}
          </pre>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] sm:text-xs font-black tracking-widest text-slate-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className={isMobile ? 'text-[9px]' : ''}>{t.realTimeUpdate}</span>
        </div>
      </div>
    </ModernPanel>
  );
}
