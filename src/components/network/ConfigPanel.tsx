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

export type { ConfigPanelProps };

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

    // VTP configuration
    if (state.vtpMode && state.vtpMode !== 'transparent') {
      config += `!\\n`;
      config += `vtp version 2\\n`;
      config += `vtp mode ${state.vtpMode}\\n`;
      if (state.vtpDomain) {
        config += `vtp domain ${state.vtpDomain}\\n`;
      }
      config += `!\\n`;
    }

    config += `!\\n`;
    config += `hostname ${state.hostname}\\n`;
    config += `!\\n`;

    // Banner MOTD
    if (state.bannerMOTD) {
      const escapedBanner = state.bannerMOTD.replace(/\n/g, '\\n');
      config += `banner motd #${escapedBanner}#\\n`;
      config += `!\\n`;
    }

    // Boot system
    config += `boot system flash:${state.switchModel === 'WS-C3560-24PS' ? 'c3560-ipbase-mz.150-2.SE4.bin' : 'c2960-lanbase-mz.150-2.SE4.bin'}\\n`;
    config += `!\\n`;

    // Enable configurations
    if (state.security.enableSecret) {
      config += `enable secret 5 $1$xxxx$xxxxxxxxxxxxxxxx\\n`;
    }
    if (state.security.enablePassword) {
      if (state.security.servicePasswordEncryption) {
        config += `enable password 7 ********\\n`;
      } else {
        config += `enable password ${state.security.enablePassword}\\n`;
      }
    }
    config += `!\\n`;

    // Username configurations
    state.security.users.forEach(user => {
      if (state.security.servicePasswordEncryption) {
        config += `username ${user.username} privilege ${user.privilege} secret 7 ********\\n`;
      } else {
        config += `username ${user.username} privilege ${user.privilege} secret ${user.password}\\n`;
      }
    });
    if (state.security.users.length > 0) {
      config += `!\\n`;
    }

    // IP routing (for L3 switches)
    if (state.ipRouting) {
      config += `ip routing\\n`;
      config += `!\\n`;
    }

    // Default gateway
    if (state.defaultGateway) {
      config += `ip default-gateway ${state.defaultGateway}\\n`;
      config += `!\\n`;
    }

    // VLAN configurations
    Object.values(state.vlans).forEach(vlan => {
      if (vlan.id >= 2 && vlan.id <= 1001 && vlan.name) {
        config += `vlan ${vlan.id}\\n`;
        config += ` name ${vlan.name}\\n`;
        if (vlan.status === 'suspend') {
          config += ` state suspend\\n`;
        }
        config += `!\\n`;
      }
    });

    // Physical interface configurations
    Object.values(state.ports).forEach(port => {
      if (port.id.toLowerCase().startsWith('vlan')) return;
      const portUpper = port.id.toUpperCase().replace('FA', 'FastEthernet').replace('GI', 'GigabitEthernet');
      config += `interface ${portUpper}\\n`;

      if ((port as any).description || port.name) config += ` description ${((port as any).description || port.name)}\\n`;

      // Switchport mode
      if (port.mode === 'trunk') {
        config += ` switchport mode trunk\\n`;
        if (port.allowedVlans && port.allowedVlans !== 'all' && port.allowedVlans.length > 0) {
          config += ` switchport trunk allowed vlan ${port.allowedVlans.join(',') || '1-4094'}\\n`;
        }
      } else {
        config += ` switchport mode access\\n`;
        const vlanId = Number((port as any).accessVlan || port.vlan || 1);
        if (vlanId !== 1) config += ` switchport access vlan ${vlanId}\\n`;
      }

      // IP address for routed ports (L3 switches)
      if (port.ipAddress && port.subnetMask) config += ` ip address ${port.ipAddress} ${port.subnetMask}\\n`;

      // Port settings
      if (port.speed !== 'auto') config += ` speed ${port.speed}\\n`;
      if (port.duplex !== 'auto') config += ` duplex ${port.duplex}\\n`;
      if (port.shutdown) config += ` shutdown\\n`;

      // WiFi configurations
      if (port.id.toLowerCase().startsWith('wlan') && port.wifi) {
        const wifiMode =
          port.wifi.mode === 'disabled'
            ? 'disabled'
            : port.wifi.mode === 'client'
              ? 'ap'
              : (port.wifi.mode || 'ap');
        if (port.wifi.ssid) config += ` ssid ${port.wifi.ssid}\\n`;
        if (port.wifi.security) config += ` encryption ${port.wifi.security}\\n`;
        if (port.wifi.password) config += ` wifi-password ${port.wifi.password}\\n`;
        if (port.wifi.channel) config += ` wifi-channel ${port.wifi.channel}\\n`;
        if (wifiMode) config += ` wifi-mode ${wifiMode}\\n`;
      }

      config += `!\\n`;
    });

    // VLAN interface configurations
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

    // Default VLAN1 interface
    const vlan1Port = state.ports['vlan1'];
    if (!vlan1Port || !vlan1Port.ipAddress || !vlan1Port.subnetMask) {
      config += `interface Vlan1\\n`;
      config += ` no ip address\\n`;
      config += ` no shutdown\\n`;
      config += `!\\n`;
    }

    // Line configurations
    config += `line con 0\\n`;
    if (state.security.consoleLine?.password) {
      if (state.security.servicePasswordEncryption) {
        config += ` password 7 ********\\n`;
      } else {
        config += ` password ${state.security.consoleLine.password}\\n`;
      }
    }
    if (state.security.consoleLine?.login) config += ` login\\n`;
    config += `!\\n`;

    config += `line vty 0 4\\n`;
    config += ` login\\n`;
    if (state.security.vtyLines?.password) {
      if (state.security.servicePasswordEncryption) {
        config += ` password 7 ********\\n`;
      } else {
        config += ` password ${state.security.vtyLines.password}\\n`;
      }
    }
    if (state.security.vtyLines?.transportInput && state.security.vtyLines.transportInput.length > 0 && state.security.vtyLines.transportInput[0] !== 'all') {
      config += ` transport input ${state.security.vtyLines.transportInput.join(' ')}\\n`;
    }
    config += `line vty 5 15\\n`;
    config += ` login\\n`;
    config += `!\\n`;

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

  const configText = state.runningConfig && state.runningConfig.length > 0
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
      <div className="flex flex-col p-3 sm:p-4 bg-background">
        <div className="overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 custom-scrollbar h-[calc(80vh-140px)]">
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
