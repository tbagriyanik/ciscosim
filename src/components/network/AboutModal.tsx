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
import { Info, Terminal, Search, X, ChevronDown, Compass, Mail, Loader2, MessageSquare, Bug, Lightbulb, Check } from 'lucide-react';
import { getCommandCategories } from './networkTopology.commands';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

type TabType = 'help' | 'about' | 'contact';

export function AboutModal({ isOpen, onClose, onStartTour }: AboutModalProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('help');
  const version = process.env.NEXT_PUBLIC_GIT_COMMIT_COUNT;
  const isDark = theme === 'dark';
  const lang = (t as any).language || 'en';
  const isTR = lang === 'tr';

  // Help content data - memoized to prevent infinite loops
  const helpCategories = useMemo(() => getCommandCategories(isTR), [isTR]);

  const [expandedHelp, setExpandedHelp] = useState<Record<string, boolean>>({
    system: true,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const toggleHelp = (id: string) => {
    setExpandedHelp(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [contactData, setContactData] = useState({
    name: '',
    email: '',
    type: 'bug' as 'bug' | 'suggestion' | 'other',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Theoretically sending to a Apps Script Web App
      // Or a Next.js API route
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contactData,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        })
      });

      if (response.ok) {
        setSubmitStatus('success');
        setContactData({ name: '', email: '', type: 'bug', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Contact submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
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

  const tabButtonClass = (tab: TabType) => cn(
    'relative inline-flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition-all',
    activeTab === tab
      ? isDark
        ? 'bg-slate-900 text-white border-slate-700 shadow-sm'
        : 'bg-white text-slate-900 border-slate-200 shadow-sm'
      : isDark
        ? 'bg-slate-950/40 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/60'
        : 'bg-slate-100 text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
  );

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
      <DialogContent className="sm:max-w-[600px] md:max-w-2xl lg:max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="sr-only">
            {activeTab === 'about' ? t.aboutTitle : t.commandReference}
          </DialogTitle>
          <div className={cn('flex items-end gap-2 mb-2 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <button
              onClick={() => setActiveTab('help')}
              className={tabButtonClass('help')}
            >
              <Terminal className="w-4 h-4" />
              {t.commandReference}
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={tabButtonClass('contact')}
            >
              <Mail className="w-4 h-4" />
              {t.contactTitle}
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={tabButtonClass('about')}
            >
              <Info className="w-4 h-4" />
              {t.aboutTitle}
            </button>
          </div>
          <DialogDescription className="sr-only">
            {activeTab === 'about' ? t.aboutIntro : activeTab === 'contact' ? t.contactTitle : t.commandReference}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden border rounded-md mx-6 mb-2">
          {activeTab === 'help' && (
            <div className={cn('p-4 space-y-3 border-b shrink-0', isDark ? 'bg-slate-900/50' : 'bg-slate-50/50')}>
              {/* Search */}
              <div className="relative">
                <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', isDark ? 'text-slate-500' : 'text-slate-400')} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search}
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
                  {filteredHelpCategories.reduce((acc, cat) => acc + cat.cmds.length, 0)} {t.commandsFound}
                </div>
              )}

              {/* Command Modes Legend */}
              {!searchQuery.trim() && (
                <div className={cn('p-3 rounded-lg text-xs space-y-1', isDark ? 'bg-slate-950/50 border border-slate-800' : 'bg-white border border-slate-200')}>
                  <p className={cn('font-semibold mb-2', isDark ? 'text-slate-200' : 'text-slate-700')}>
                    {t.commandModes}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>User (&gt;)</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.basicCommands}</span>
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Privileged (#)</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.allCommands}</span>
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Config (config)#</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.globalConfigLabel}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
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
            ) : activeTab === 'contact' ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("p-2 rounded-xl", isDark ? "bg-amber-500/20" : "bg-amber-100")}>
                    <MessageSquare className={cn("w-5 h-5", isDark ? "text-amber-400" : "text-amber-600")} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{t.contactTitle}</h4>
                    <p className="text-xs opacity-60">{t.savedViaSheets}</p>
                  </div>
                </div>

                {submitStatus === 'success' ? (
                  <div className={cn("p-6 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300", isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-100")}>
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <h5 className="font-bold text-lg mb-2">{t.contactSuccessTitle}</h5>
                    <p className="text-sm opacity-80">{t.contactSuccessDesc}</p>
                    <Button
                      variant="ghost"
                      className="mt-6"
                      onClick={() => setSubmitStatus('idle')}
                    >
                      {t.newMessage}
                    </Button>
                  </div>
                ) : (
                  <form id="contact-form" onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold opacity-50 px-1">{t.contactName}</label>
                        <input
                          required
                          type="text"
                          value={contactData.name}
                          onChange={e => setContactData(prev => ({ ...prev, name: e.target.value }))}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-xl border outline-none transition-all",
                            isDark ? "bg-slate-900 border-slate-700 focus:border-amber-500/50" : "bg-white border-slate-200 focus:border-amber-600"
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold opacity-50 px-1">{t.contactEmail}</label>
                        <input
                          required
                          type="email"
                          value={contactData.email}
                          onChange={e => setContactData(prev => ({ ...prev, email: e.target.value }))}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-xl border outline-none transition-all",
                            isDark ? "bg-slate-900 border-slate-700 focus:border-amber-500/50" : "bg-white border-slate-200 focus:border-amber-600"
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold opacity-50 px-1">{t.contactType}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'bug', label: t.bugReport, icon: Bug, color: 'text-red-500' },
                          { id: 'suggestion', label: t.suggestion, icon: Lightbulb, color: 'text-amber-500' },
                          { id: 'other', label: t.other, icon: MessageSquare, color: 'text-blue-500' }
                        ].map(type => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setContactData(prev => ({ ...prev, type: type.id as any }))}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                              contactData.type === type.id
                                ? isDark ? "bg-amber-500/20 border-amber-500/50" : "bg-amber-50 border-amber-600 shadow-sm"
                                : isDark ? "bg-slate-900/50 border-slate-800 hover:border-slate-700" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                            )}
                          >
                            <type.icon className={cn("w-4 h-4", contactData.type === type.id ? (isDark ? "text-amber-400" : "text-amber-600") : "opacity-40", type.color)} />
                            <span className="text-[10px] font-bold">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold opacity-50 px-1">{t.contactMessage}</label>
                      <textarea
                        required
                        rows={5}
                        value={contactData.message}
                        onChange={e => setContactData(prev => ({ ...prev, message: e.target.value }))}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none",
                          isDark ? "bg-slate-900 border-slate-700 focus:border-amber-500/50" : "bg-white border-slate-200 focus:border-amber-600"
                        )}
                        placeholder="..."
                      />
                    </div>

                    {submitStatus === 'error' && (
                      <p className="text-xs text-red-500 font-bold px-1">{t.contactErrorDesc}</p>
                    )}

                  </form>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Help Categories */}
                {filteredHelpCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isExp = expandedHelp[cat.id];
                  return (
                    <div key={cat.id} className={cn('rounded-lg border overflow-hidden', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border border-slate-200')}>
                      <button
                        onClick={() => toggleHelp(cat.id)}
                        className={cn('w-full flex items-center justify-between p-3 text-left transition-colors', isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={cn('w-4 h-4', isDark ? 'text-slate-400' : 'text-slate-500')} />
                          <span className={cn('font-medium text-sm', isDark ? 'text-slate-200' : 'text-slate-700')}>{cat.title}</span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                            {cat.cmds.length}
                          </span>
                        </div>
                        <ChevronDown className={cn('w-4 h-4 transition-transform', isExp ? 'rotate-180' : '', isDark ? 'text-slate-400' : 'text-slate-500')} />
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
          </div>
        </div>

        <div className="flex justify-end p-6 pt-2 shrink-0 gap-2">
          {activeTab === 'contact' && submitStatus !== 'success' && (
            <Button
              type="submit"
              form="contact-form"
              disabled={isSubmitting}
              className={cn("gap-2", isDark ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-600 hover:bg-amber-700")}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.sending}
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  {t.contactSend}
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onStartTour}
            className="gap-2"
          >
            <Compass className="w-4 h-4" />
            {t.startTour}
          </Button>
          <Button onClick={onClose}>{t.close}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
