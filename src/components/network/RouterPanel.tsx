'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CableInfo, SwitchState, Port, getPortLEDColor, PortLEDColor } from '@/lib/network/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  X,
  Wifi,
  WifiOff,
  Network,
  Settings,
  Server,
  ShieldCheck,
  Activity,
  Globe,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasDevice } from './networkTopology.types';
import { RouterIcon } from './PCPanelWidgets';

interface RouterPanelProps {
  deviceId: string;
  cableInfo: CableInfo;
  isVisible: boolean;
  onClose: () => void;
  topologyDevices?: CanvasDevice[];
  deviceStates?: Map<string, SwitchState>;
}

interface DhcpPoolInfo {
  poolName: string;
  network?: string;
  subnetMask?: string;
  defaultRouter?: string;
  dnsServer?: string;
  leaseTime?: string;
  domainName?: string;
}

export function RouterPanel({
  deviceId,
  cableInfo,
  isVisible,
  onClose,
  topologyDevices = [],
  deviceStates
}: RouterPanelProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'overview' | 'ports' | 'wifi' | 'dhcp'>('overview');
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('router-panel-minimized') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('router-panel-minimized', isMinimized.toString());
  }, [isMinimized]);

  // Get router device from topology
  const routerDevice = useMemo(() =>
    topologyDevices.find(d => d.id === deviceId && d.type === 'router'),
    [deviceId, topologyDevices]
  );

  // Get router state from deviceStates
  const routerState = useMemo(() =>
    deviceStates?.get(deviceId),
    [deviceId, deviceStates]
  );

  // Get ports from router state or topology
  const ports = useMemo(() => {
    if (routerState?.ports) {
      return Object.entries(routerState.ports).map(([id, port]) => port);
    }
    return routerDevice?.ports || [];
  }, [routerState, routerDevice]);

  // Get DHCP pools from router state
  const dhcpPools = useMemo(() => {
    if (routerState?.dhcpPools) {
      return Object.entries(routerState.dhcpPools).map(([name, pool]) => ({
        poolName: name,
        ...pool
      } as DhcpPoolInfo));
    }
    return [];
  }, [routerState]);

  // Get WiFi configuration
  const wifiConfig = useMemo(() => {
    // Check device topology wifi config
    if (routerDevice?.wifi) {
      return routerDevice.wifi;
    }
    // Check device state for wlan0 port wifi config
    if (routerState?.ports?.['wlan0']?.wifi) {
      return routerState.ports['wlan0'].wifi;
    }
    return null;
  }, [routerDevice, routerState]);

  // Get interfaces with IP addresses
  const interfacesWithIP = useMemo(() => {
    const result: Array<{ id: string; ip: string; subnet: string; status: string }> = [];

    if (routerState?.ports) {
      Object.entries(routerState.ports).forEach(([id, port]) => {
        if (port.ipAddress && !port.shutdown) {
          result.push({
            id,
            ip: port.ipAddress,
            subnet: port.subnetMask || '',
            status: port.status
          });
        }
      });
    }

    return result;
  }, [routerState]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'notconnect':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'disabled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'blocked':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPortLEDColorClass = (port: Port | any): string => {
    // Handle both Port (from routerState) and CanvasPort (from topology)
    const isShutdown = port.shutdown ?? false;
    const status = port.status ?? 'notconnect';
    const isSTPBlocked = port.spanningTree?.state === 'blocking' || port.spanningTree?.role === 'alternate';

    if (isShutdown) return 'bg-gray-500';
    if (status === 'blocked' || isSTPBlocked) return 'bg-orange-500';
    if (status === 'connected') return 'bg-green-500';
    if (status === 'notconnect') return 'bg-white';
    return 'bg-gray-400';
  };

  if (!isVisible || !routerDevice) {
    return null;
  }

  return (
    <Dialog open={isVisible} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <RouterIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {routerDevice.name || deviceId}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {t.routerInfoPanel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? t.expand : t.minimize}
                aria-label={isMinimized ? t.expand : t.minimize}
                aria-expanded={!isMinimized}
              >
                {isMinimized ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className={cn("flex border-b overflow-hidden transition-all duration-300", isMinimized ? "max-h-0 opacity-0 border-none" : "max-h-20 opacity-100")} role="tablist" aria-label={language === 'tr' ? 'Router panel sekmeleri' : 'Router panel tabs'}>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2",
              activeTab === 'overview'
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab('overview')}
            role="tab"
            aria-selected={activeTab === 'overview'}
            aria-controls="overview-panel"
          >
            <Activity className="w-4 h-4 mr-2" />
            {t.overview}
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2",
              activeTab === 'ports'
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab('ports')}
            role="tab"
            aria-selected={activeTab === 'ports'}
            aria-controls="ports-panel"
          >
            <Network className="w-4 h-4 mr-2" />
            {t.ports}
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2",
              activeTab === 'wifi'
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab('wifi')}
            role="tab"
            aria-selected={activeTab === 'wifi'}
            aria-controls="wifi-panel"
          >
            <Wifi className="w-4 h-4 mr-2" />
            WiFi
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2",
              activeTab === 'dhcp'
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab('dhcp')}
            role="tab"
            aria-selected={activeTab === 'dhcp'}
            aria-controls="dhcp-panel"
          >
            <Server className="w-4 h-4 mr-2" />
            DHCP
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className={cn("flex-1 transition-all duration-300", isMinimized ? "h-0 opacity-0" : "h-[calc(80vh-140px)]")}>
          <div className="p-4">
            {activeTab === 'overview' && (
              <div id="overview-panel" role="tabpanel" className="space-y-4">
                {/* Device Info */}
                <div className={cn(
                  "p-4 rounded-lg border",
                  isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                )}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t.deviceInformation}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t.deviceNameLabel}:</span>
                      <p className="font-medium">{routerDevice.name || deviceId}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.macAddress}:</span>
                      <p className="font-medium">{routerDevice.macAddress || routerState?.macAddress || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.status}:</span>
                      <p className="font-medium flex items-center gap-1">
                        {routerDevice.status === 'online' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        {routerDevice.status}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.ipRouting}:</span>
                      <p className="font-medium">{routerState?.ipRouting ? (
                        <span className="text-green-500">{t.active}</span>
                      ) : (
                        <span className="text-red-500">{t.suspended}</span>
                      )}</p>
                    </div>
                  </div>
                </div>

                {/* IP Interfaces */}
                <div className={cn(
                  "p-4 rounded-lg border",
                  isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                )}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    {t.ipInterfaces}
                  </h3>
                  {interfacesWithIP.length > 0 ? (
                    <div className="space-y-2">
                      {interfacesWithIP.map((iface) => (
                        <div key={iface.id} className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-slate-900">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(iface.status)}
                            <span className="font-medium">{iface.id}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">IP: </span>
                            <span className="font-mono">{iface.ip}</span>
                            {iface.subnet && (
                              <>
                                <span className="text-muted-foreground ml-2">/</span>
                                <span className="font-mono">{iface.subnet}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t.noIpInterfaces}
                    </p>
                  )}
                </div>

                {/* Port Summary */}
                <div className={cn(
                  "p-4 rounded-lg border",
                  isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                )}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {t.portSummary}
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-3 rounded bg-green-100 dark:bg-green-900/30">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {ports.filter(p => p.id !== 'wlan0' && !p.shutdown && p.status === 'connected').length}
                      </p>
                      <p className="text-muted-foreground">{t.connectedStatus}</p>
                    </div>
                    <div className="text-center p-3 rounded bg-gray-100 dark:bg-gray-900/30">
                      <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {ports.filter(p => p.id !== 'wlan0' && !p.shutdown && p.status === 'notconnect').length}
                      </p>
                      <p className="text-muted-foreground">{t.disconnectedStatus}</p>
                    </div>
                    <div className="text-center p-3 rounded bg-red-100 dark:bg-red-900/30">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {ports.filter(p => p.shutdown).length}
                      </p>
                      <p className="text-muted-foreground">{t.shutdownStatus}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ports' && (
              <div id="ports-panel" role="tabpanel" className="space-y-2">
                {ports.map((port) => (
                  <div
                    key={port.id}
                    className={cn(
                      "p-3 rounded-lg border flex items-center justify-between",
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-3 h-3 rounded-full", getPortLEDColorClass(port))} />
                      <div>
                        <p className="font-medium">{port.id}</p>
                        {port.description && (
                          <p className="text-xs text-muted-foreground">{port.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(port.status)}
                        <span className="text-muted-foreground">{port.status}</span>
                      </div>
                      {port.ipAddress && (
                        <div className="font-mono">
                          {port.ipAddress}
                          {port.subnetMask && `/${port.subnetMask}`}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        {port.speed}/{port.duplex}
                      </div>
                      {port.shutdown && (
                        <span className="text-xs text-red-500 font-medium">
                          {t.shutdownStatus.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'wifi' && (
              <div id="wifi-panel" role="tabpanel" className="space-y-4">
                {wifiConfig ? (
                  <>
                    <div className={cn(
                      "p-4 rounded-lg border",
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          {(wifiConfig as any).enabled || wifiConfig.mode === 'ap' ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-gray-500" />
                          )}
                          {t.wifiStatus}
                        </h3>
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          (wifiConfig as any).enabled || wifiConfig.mode === 'ap'
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        )}>
                          {(wifiConfig as any).enabled || wifiConfig.mode === 'ap'
                            ? t.active
                            : t.suspended
                          }
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t.wifiSsid}:</span>
                          <p className="font-medium">{wifiConfig.ssid || '-'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.modeLabel}</span>
                          <p className="font-medium capitalize">{wifiConfig.mode || '-'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.wifiChannel}:</span>
                          <p className="font-medium">{wifiConfig.channel || '-'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.wifiSecurity}:</span>
                          <p className="font-medium flex items-center gap-1">
                            {wifiConfig.security !== 'open' ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            {wifiConfig.security || 'open'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {wifiConfig.security !== 'open' && wifiConfig.password && (
                      <div className={cn(
                        "p-4 rounded-lg border",
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                      )}>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          {t.wifiPassword}
                        </h3>
                        <p className="font-mono text-sm">••••••••</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={cn(
                    "p-8 rounded-lg border text-center",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                  )}>
                    <WifiOff className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {t.noWifiConfig}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dhcp' && (
              <div id="dhcp-panel" role="tabpanel" className="space-y-4">
                {dhcpPools.length > 0 ? (
                  dhcpPools.map((pool) => (
                    <div
                      key={pool.poolName}
                      className={cn(
                        "p-4 rounded-lg border",
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        {pool.poolName}
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {pool.network && (
                          <div>
                            <span className="text-muted-foreground">{language === 'tr' ? 'Ağ:' : 'Network:'}</span>
                            <p className="font-mono font-medium">{pool.network}</p>
                          </div>
                        )}
                        {pool.subnetMask && (
                          <div>
                            <span className="text-muted-foreground">{t.subnetMask}:</span>
                            <p className="font-mono font-medium">{pool.subnetMask}</p>
                          </div>
                        )}
                        {pool.defaultRouter && (
                          <div>
                            <span className="text-muted-foreground">{t.gateway}:</span>
                            <p className="font-mono font-medium">{pool.defaultRouter}</p>
                          </div>
                        )}
                        {pool.dnsServer && (
                          <div>
                            <span className="text-muted-foreground">{t.dnsServer}:</span>
                            <p className="font-mono font-medium">{pool.dnsServer}</p>
                          </div>
                        )}
                        {pool.leaseTime && (
                          <div>
                            <span className="text-muted-foreground">{language === 'tr' ? 'Kira Süresi:' : 'Lease Time:'}</span>
                            <p className="font-medium">{pool.leaseTime}</p>
                          </div>
                        )}
                        {pool.domainName && (
                          <div>
                            <span className="text-muted-foreground">{language === 'tr' ? 'Domain Adı:' : 'Domain Name:'}</span>
                            <p className="font-medium">{pool.domainName}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={cn(
                    "p-8 rounded-lg border text-center",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                  )}>
                    <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {t.dhcpPoolConfig}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t.dhcpCliConfig}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
