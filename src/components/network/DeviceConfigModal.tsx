import { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasDevice } from './networkTopology.types';
import { useLanguage } from '../../contexts/LanguageContext';
import { normalizeMAC } from '../../lib/utils';

interface DeviceConfigModalProps {
  device: CanvasDevice;
  onClose: () => void;
  onSave: (deviceId: string, updates: Partial<CanvasDevice>) => void;
  isMobile: boolean;
  isDark: boolean;
}

export function DeviceConfigModal({
  device,
  onClose,
  onSave,
  isMobile,
  isDark,
}: DeviceConfigModalProps) {
  const { t, language } = useLanguage();
  const configInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [tempNameValue, setTempNameValue] = useState(device.name || '');
  const [ipValue, setIpValue] = useState(device.ip || '');
  const [subnetValue, setSubnetValue] = useState(device.subnet || '255.255.255.0');

  const initialGateway = device.gateway || (device.ip ? (() => {
    const parts = device.ip.split('.');
    parts[3] = '1';
    return parts.join('.');
  })() : '192.168.1.1');

  const [gatewayValue, setGatewayValue] = useState(initialGateway);
  const [ipv6Value, setIpv6Value] = useState(device.ipv6 || '');
  const [dnsValue, setDnsValue] = useState(device.dns || '8.8.8.8');
  const [configError, setConfigError] = useState('');

  // Validate IPs
  const isValidIpv4 = useCallback((ip: string) => {
    if (!ip) return true;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => {
      const num = parseInt(p, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }, []);

  const isValidIpv6 = useCallback((ip: string) => {
    if (!ip) return true;
    const trimmed = ip.trim();
    if (trimmed === '::') return true;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(trimmed);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => configInputRef.current?.focus(), 50);
    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  useEffect(() => {
    const handleMobileBack = () => onClose();
    window.addEventListener('mobile-back-pressed', handleMobileBack);
    return () => window.removeEventListener('mobile-back-pressed', handleMobileBack);
  }, [onClose]);

  const handleSave = () => {
    const nextIp = ipValue.trim();
    const nextSubnet = subnetValue.trim();
    const nextGateway = gatewayValue.trim();
    const nextDns = dnsValue.trim();
    const nextIpv6 = ipv6Value.trim();

    if (!isValidIpv4(nextIp)) {
      setConfigError(t.invalidIpv4Address || 'Enter a valid IPv4 address.');
      return;
    }
    if (!isValidIpv4(nextSubnet)) {
      setConfigError(t.invalidSubnetMask);
      return;
    }
    if (!isValidIpv4(nextGateway)) {
      setConfigError(t.invalidGatewayAddress);
      return;
    }
    if (!isValidIpv4(nextDns)) {
      setConfigError(t.invalidDnsAddress);
      return;
    }
    if (!isValidIpv6(nextIpv6)) {
      setConfigError(t.invalidIpv6Address);
      return;
    }

    setConfigError('');
    onSave(device.id, {
      name: tempNameValue.trim() || device.name,
      ip: nextIp,
      subnet: nextSubnet,
      ipv6: nextIpv6,
      gateway: nextGateway,
      dns: nextDns
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal" onClick={onClose}>
      <div className="absolute inset-0 bg-secondary-950/40" />
      <div
        ref={modalRef}
        className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border transition-all duration-500 hover:shadow-accent-500/10 ${isDark ? 'bg-secondary-900/80 border-secondary-800/50 shadow-2xl' : 'bg-white/90 border-secondary-200/50 shadow-2xl'
          }`}
        onClick={e => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
          }
        }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-config-title"
      >
        {/* Modal Header */}
        <div className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} border-b ${isDark ? 'border-secondary-500/60 bg-secondary-700' : 'border-secondary-100 bg-secondary-50/50'}`}>
          <div className="flex items-center gap-4">
            <div className={`${isMobile ? 'p-2' : 'p-3'} rounded-2xl shadow-inner ${isDark ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20' : 'bg-accent-50 text-accent-600 border border-accent-100'}`}>
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} drop-shadow-sm`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0 -2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0 -1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1 -6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 id="device-config-title" className={`${isMobile ? 'text-lg' : 'text-xl'} font-black tracking-tight ${isDark ? 'text-white' : 'text-secondary-900'}`}>
                {t.configure}
              </h3>
              <div className={`text-[10px] font-bold tracking-widest opacity-30 ${isDark ? 'text-secondary-400' : 'text-secondary-500'}`}>
                {device.name}
              </div>
            </div>
          </div>
        </div>

        <div className={`${isMobile ? 'p-4 space-y-4' : 'p-6 space-y-6'}`}>
          {/* Hostname */}
          <div className="space-y-2">
            <label className={`text-[10px] font-black tracking-widest ml-1 ${isDark ? 'text-secondary-500' : 'text-secondary-400'}`}>
              {t.deviceName}
            </label>
            <div className="relative group">
              <input
                ref={configInputRef}
                type="text"
                autoCapitalize="off"
                autoCorrect="off"
                value={tempNameValue}
                onChange={(e) => setTempNameValue(e.target.value)}
                className={`w-full ${isMobile ? 'px-4 py-2.5' : 'px-4 py-3'} rounded-2xl border transition-all duration-300 font-bold ${isDark
                  ? 'bg-secondary-950/50 border-secondary-800 text-white placeholder-secondary-700 focus:border-accent-500/50 focus:bg-secondary-950 focus:ring-4 focus:ring-accent-500/10'
                  : 'bg-secondary-50 border-secondary-200 text-secondary-900 placeholder-secondary-400 focus:border-accent-500/50 focus:bg-white focus:ring-4 focus:ring-accent-500/10'
                  } outline-none`}
                placeholder={language === 'tr' ? 'Örn: Router-X' : 'e.g. Router-X'}
              />
            </div>
          </div>

          {/* Device Info (MAC Address) */}
          <div className={`p-3 rounded-2xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200/50'}`}>
            <div className={`text-[10px] font-black tracking-widest mb-2 opacity-70 ${isDark ? 'text-accent-400' : 'text-accent-600'}`}>
              {t.deviceInfo}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-secondary-400' : 'text-secondary-500'}`}>MAC Address</span>
              <span className={`text-xs font-mono font-bold ${isDark ? 'text-secondary-200' : 'text-secondary-700'}`}>
                {device.macAddress ? normalizeMAC(device.macAddress) : 'N/A'}
              </span>
            </div>
          </div>

          {/* IP Configuration Section - Only for PCs */}
          {(device.type === 'pc' || device.type === 'iot') && (
            <div className={`${isMobile ? 'p-3' : 'p-4'} rounded-2xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200/50'}`}>
              <div className={`text-[10px] font-black tracking-widest ${isMobile ? 'mb-3' : 'mb-4'} opacity-70 ${isDark ? 'text-accent-400' : 'text-accent-600'}`}>
                {t.ipConfiguration}
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-secondary-500' : 'text-secondary-400'}`}>
                    {language === 'tr' ? 'IP Adresi' : 'IP Address'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={ipValue}
                    onChange={(e) => setIpValue(e.target.value)}
                    className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                      ? 'bg-secondary-900/50 border-secondary-700 text-white placeholder-secondary-700 focus:border-accent-500/50'
                      : 'bg-white border-secondary-200 text-secondary-900 placeholder-secondary-300 focus:border-accent-500/50'
                      } outline-none`}
                    placeholder="192.168.1.1"
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-secondary-500' : 'text-secondary-400'}`}>
                    {language === 'tr' ? 'Alt Ağ Maskesi' : 'Subnet Mask'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={subnetValue}
                    onChange={(e) => setSubnetValue(e.target.value)}
                    className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                      ? 'bg-secondary-900/50 border-secondary-700 text-white placeholder-secondary-700 focus:border-accent-500/50'
                      : 'bg-white border-secondary-200 text-secondary-900 placeholder-secondary-300 focus:border-accent-500/50'
                      } outline-none`}
                    placeholder="255.255.255.0"
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-secondary-500' : 'text-secondary-400'}`}>
                    {language === 'tr' ? 'Ağ Geçidi' : 'Gateway'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={gatewayValue}
                    onChange={(e) => setGatewayValue(e.target.value)}
                    className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                      ? 'bg-secondary-900/50 border-secondary-700 text-white placeholder-secondary-700 focus:border-accent-500/50'
                      : 'bg-white border-secondary-200 text-secondary-900 placeholder-secondary-300 focus:border-accent-500/50'
                      } outline-none`}
                    placeholder="192.168.1.254"
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-secondary-500' : 'text-secondary-400'}`}>
                    IPv6
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={ipv6Value}
                    onChange={(e) => setIpv6Value(e.target.value)}
                    className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                      ? 'bg-secondary-900/50 border-secondary-700 text-white placeholder-secondary-700 focus:border-accent-500/50'
                      : 'bg-white border-secondary-200 text-secondary-900 placeholder-secondary-300 focus:border-accent-500/50'
                      } outline-none`}
                    placeholder="2001:db8::1"
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-bold tracking-widest ml-1 ${isDark ? 'text-secondary-500' : 'text-secondary-400'}`}>
                    DNS Server
                  </label>
                  <input
                    type="text"
                    value={dnsValue}
                    onChange={(e) => setDnsValue(e.target.value)}
                    className={`w-full px-4 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl border font-mono font-bold transition-all duration-300 ${isDark
                      ? 'bg-secondary-900/50 border-secondary-700 text-white placeholder-secondary-700 focus:border-accent-500/50'
                      : 'bg-white border-secondary-200 text-secondary-900 placeholder-secondary-300 focus:border-accent-500/50'
                      } outline-none`}
                    placeholder="8.8.8.8"
                  />
                </div>
              </div>
            </div>
          )}

          {configError && (
            <div role="alert" aria-live="assertive" className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 ${isDark ? 'bg-error-500/10 text-error-400 border border-error-500/20' : 'bg-error-50 text-error-600 border border-error-100'}`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {configError}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className={`${isMobile ? 'p-4' : 'p-6'} bg-secondary-950/20 border-t ${isDark ? 'border-secondary-800/50' : 'border-secondary-100'}`}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${isDark
                ? 'bg-secondary-800 hover:bg-secondary-700 text-secondary-300 hover:text-white'
                : 'bg-secondary-100 hover:bg-secondary-200 text-secondary-600 hover:text-secondary-900'
                }`}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-accent-500 to-primary-500 hover:from-accent-400 hover:to-primary-400 text-white rounded-xl font-bold transition-all duration-300 shadow-lg shadow-accent-500/20 hover:shadow-accent-500/40"
            >
              {t.saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
