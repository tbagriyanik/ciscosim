'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Info, Terminal, Search, X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'about' | 'help';

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('about');
  const version = process.env.NEXT_PUBLIC_GIT_COMMIT_COUNT;
  const isDark = theme === 'dark';
  const lang = (t as any).language || 'en';
  const isTR = lang === 'tr';

  // Help content data - memoized to prevent infinite loops
  const helpCategories = useMemo(() => [
    {
      id: 'system',
      title: isTR ? 'Sistem & Oturum' : 'System & Session',
      cmds: [
        ['enable', isTR ? 'Ayrıcalıklı moda geç' : 'Enter privileged mode'],
        ['configure terminal', isTR ? 'Konfigürasyon modu' : 'Enter config mode'],
        ['exit', isTR ? 'Moddan çık' : 'Exit current mode'],
        ['end', isTR ? 'Ayrıcalıklı moda dön' : 'Return to privileged'],
      ]
    },
    {
      id: 'privileged',
      title: isTR ? 'Privileged EXEC' : 'Privileged EXEC',
      cmds: [
        ['ping <host>', isTR ? 'Bağlantı testi' : 'Ping host'],
        ['traceroute <host>', isTR ? 'Rota izleme' : 'Trace route'],
        ['telnet <host>', isTR ? 'Telnet bağlantısı' : 'Telnet connection'],
        ['ssh <host>', isTR ? 'SSH bağlantısı' : 'SSH connection'],
        ['write memory', isTR ? 'Yapılandırmayı kaydet' : 'Save config'],
        ['reload', isTR ? 'Cihazı yeniden yükle' : 'Reload device'],
      ]
    },
    {
      id: 'global',
      title: isTR ? 'Global Konfigürasyon' : 'Global Config',
      cmds: [
        ['hostname <name>', isTR ? 'Cihaz adı' : 'Set hostname'],
        ['vlan <id>', isTR ? 'VLAN oluştur' : 'Create VLAN'],
        ['interface <name>', isTR ? 'Arayüz seç' : 'Select interface'],
        ['ip routing', isTR ? 'IP yönlendirme' : 'Enable IP routing'],
        ['router rip', isTR ? 'RIP yönlendirmesi' : 'Enable RIP'],
        ['router ospf', isTR ? 'OSPF yönlendirmesi' : 'Enable OSPF'],
      ]
    },
    {
      id: 'interface',
      title: isTR ? 'Arayüz Konfigürasyonu' : 'Interface Config',
      cmds: [
        ['shutdown', isTR ? 'Arayüzü kapat' : 'Disable interface'],
        ['no shutdown', isTR ? 'Arayüzü aç' : 'Enable interface'],
        ['speed {10|100|1000|auto}', isTR ? 'Hız ayarla' : 'Set speed'],
        ['switchport mode access', isTR ? 'Erişim modu' : 'Access mode'],
        ['switchport mode trunk', isTR ? 'Trunk modu' : 'Trunk mode'],
        ['ip address <ip> <mask>', isTR ? 'IP adresi ata' : 'Set IP address'],
      ]
    },
    {
      id: 'show',
      title: isTR ? 'Show Komutları' : 'Show Commands',
      cmds: [
        ['show running-config', isTR ? 'Çalışan config' : 'Running config'],
        ['show ip interface brief', isTR ? 'IP özet' : 'IP interface brief'],
        ['show vlan', isTR ? 'VLAN listesi' : 'VLAN list'],
        ['show mac address-table', isTR ? 'MAC tablosu' : 'MAC table'],
        ['show ip route', isTR ? 'Yönlendirme tablosu' : 'Routing table'],
      ]
    },
  ], [isTR]);

  const [expandedHelp, setExpandedHelp] = useState<Record<string, boolean>>({
    system: true,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const toggleHelp = (id: string) => {
    setExpandedHelp(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter categories based on search query
  const filteredHelpCategories = useMemo(() => {
    if (!searchQuery.trim()) return helpCategories;
    
    const query = searchQuery.toLowerCase();
    return helpCategories.map(cat => ({
      ...cat,
      cmds: cat.cmds.filter(([cmd, desc]) => 
        cmd.toLowerCase().includes(query) || 
        desc.toLowerCase().includes(query)
      )
    })).filter(cat => cat.cmds.length > 0);
  }, [searchQuery, helpCategories]);

  // Auto-expand categories when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const newExpanded: Record<string, boolean> = {};
      filteredHelpCategories.forEach(cat => {
        newExpanded[cat.id] = true;
      });
      setExpandedHelp(prev => ({ ...prev, ...newExpanded }));
    }
  }, [searchQuery, filteredHelpCategories]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] md:max-w-2xl lg:max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {activeTab === 'about' ? t.aboutTitle : (isTR ? 'Komut Referansı' : 'Command Reference')}
          </DialogTitle>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setActiveTab('about')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'about'
                  ? isDark
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-cyan-100 text-cyan-700'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              <Info className="w-4 h-4" />
              {t.aboutTitle}
            </button>
            <button
              onClick={() => setActiveTab('help')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'help'
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-emerald-100 text-emerald-700'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              <Terminal className="w-4 h-4" />
              {isTR ? 'Komut Referansı' : 'Command Reference'}
            </button>
          </div>
          <DialogDescription className="sr-only">
            {activeTab === 'about' ? t.aboutIntro : (isTR ? 'CLI Komut Referansı' : 'CLI Command Reference')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] w-full rounded-md border p-4">
          {activeTab === 'about' ? (
            <div className="space-y-4">
              <h4 className="text-lg font-bold">{t.termsAndConditions}</h4>
              <p className="text-sm">{t.termsText}</p>
              <div className="p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mb-1">{t.gitAddressLabel}:</p>
                <a 
                  href="https://github.com/tbagriyanik/ciscosim" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-blue-500 hover:underline break-all"
                >
                  https://github.com/tbagriyanik/ciscosim
                </a>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.openSourceInfo}</p>
              </div>
              <div>
                <a 
                  href="https://tuzlamtal.meb.k12.tr" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  {t.licenseInfo}
                </a>
              </div>
              <div className="text-xs text-slate-500">Version: {version}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', isDark ? 'text-slate-500' : 'text-slate-400')} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isTR ? 'Komut ara...' : 'Search commands...'}
                  autoFocus
                  className={cn(
                    'w-full pl-9 pr-9 py-2.5 rounded-lg text-sm border outline-none transition-all',
                    isDark 
                      ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50' 
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500'
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className={cn('absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors', isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search Results Info */}
              {searchQuery.trim() && (
                <div className={cn('text-xs px-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  {filteredHelpCategories.reduce((acc, cat) => acc + cat.cmds.length, 0)} {isTR ? 'komut bulundu' : 'commands found'}
                </div>
              )}

              {/* Command Modes Legend */}
              {!searchQuery.trim() && (
                <div className={cn('p-3 rounded-lg text-xs space-y-1', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-slate-50 border border-slate-200')}>
                  <p className={cn('font-semibold mb-2', isDark ? 'text-slate-200' : 'text-slate-700')}>
                    {isTR ? 'Komut Modları:' : 'Command Modes:'}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>User (&gt;)</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{isTR ? 'Temel komutlar' : 'Basic commands'}</span>
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Privileged (#)</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{isTR ? 'Tüm komutlar' : 'All commands'}</span>
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Config (config)#</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{isTR ? 'Global config' : 'Global config'}</span>
                  </div>
                </div>
              )}

              {/* Help Categories */}
              {filteredHelpCategories.map((cat) => {
                const isExp = expandedHelp[cat.id];
                return (
                  <div key={cat.id} className={cn('rounded-lg border overflow-hidden', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
                    <button
                      onClick={() => toggleHelp(cat.id)}
                      className={cn('w-full flex items-center justify-between p-3 text-left transition-colors', isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}
                    >
                      <span className={cn('font-medium text-sm', isDark ? 'text-slate-200' : 'text-slate-700')}>{cat.title}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                        {cat.cmds.length}
                      </span>
                    </button>
                    {isExp && (
                      <div className={cn('border-t', isDark ? 'border-slate-700' : 'border-slate-200')}>
                        <table className="w-full text-xs">
                          <tbody>
                            {cat.cmds.map(([cmd, desc], idx) => (
                              <tr key={idx} className={cn('border-b last:border-b-0', isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50')}>
                                <td className="p-2 w-1/2">
                                  <code className={cn('font-mono text-[11px]', isDark ? 'text-emerald-400' : 'text-emerald-600')}>{cmd}</code>
                                </td>
                                <td className={cn('p-2', isDark ? 'text-slate-400' : 'text-slate-600')}>{desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>{t.close}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
