'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { TooltipWrapper } from '@/components/ui/TooltipWrapper';
import { ShortcutBadge } from '@/components/ui/ShortcutBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from '@/lib/utils';
import {
  Menu, Plus, Save, FolderOpen, Languages, Sun, Moon, File, BookOpen, Leaf, Compass, Info, Sparkles, Cloud, Trophy,
  Mail, GraduationCap, ImageDown, FileText, Wand2
} from 'lucide-react';
import type { Translations } from '@/contexts/LanguageContext';
import type { CanvasDevice, DeviceType } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import type { RefObject } from 'react';

interface AppHeaderProps {
  t: Translations;
  isDark: boolean;
  theme: 'dark' | 'light' | 'high-contrast' | 'auto';
  language: 'tr' | 'en';
  setLanguage: (lang: 'tr' | 'en') => void;
  setTheme: (theme: 'dark' | 'light' | 'high-contrast' | 'auto') => void;
  graphicsQuality: 'high' | 'low';
  setGraphicsQuality: (q: 'high' | 'low') => void;
  activeDeviceType: DeviceType;
  activeDeviceId: string;
  topologyDevices: CanvasDevice[];
  deviceStates: Map<string, SwitchState>;
  helpLevel: 'beginner' | 'intermediate' | 'exam';
  setHelpLevel: (level: 'beginner' | 'intermediate' | 'exam') => void;
  totalScore: number;
  maxScore: number;
  handleNewProject: () => void;
  handleSaveProject: () => void;
  handleLoadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  showMobileMenu: boolean;
  setShowMobileMenu: (v: boolean) => void;
  setShowProjectPicker: (v: boolean) => void;
  setShowOnboarding: (v: boolean) => void;
  setOnboardingStep: (v: number) => void;
  handleRefreshNetwork: () => void;
  setIsEnvironmentPanelOpen: (v: boolean) => void;
  isGuidedModeActive: boolean;
  isPanelMinimized: boolean;
  expandPanel: () => void;
  setShowAboutModal: (v: boolean) => void;
  showBasarilarim: boolean;
  setShowBasarilarim: (v: boolean) => void;
  isPingPanelOpen?: boolean;
  isExamActive?: boolean;
}

export function AppHeader({
  t, isDark, language, setLanguage, setTheme,
  graphicsQuality, setGraphicsQuality,
  activeDeviceType, activeDeviceId,
  topologyDevices,
  totalScore, maxScore,
  handleNewProject, handleSaveProject, handleLoadProject,
  fileInputRef, showMobileMenu, setShowMobileMenu,
  setShowProjectPicker, setShowOnboarding, setOnboardingStep,
  handleRefreshNetwork, setIsEnvironmentPanelOpen,
  isGuidedModeActive, isPanelMinimized, expandPanel, setShowAboutModal,
  showBasarilarim, setShowBasarilarim,
  helpLevel, setHelpLevel,
  isPingPanelOpen,
  isExamActive = false
}: AppHeaderProps) {
  return (
    <header className={cn("fixed top-0 left-0 right-0 z-[50] border-b px-3 sm:px-5 h-14 sm:h-16 flex items-center", isDark ? "liquid-glass border-secondary-800" : "bg-white/90 backdrop-blur-md border-secondary-200")}>
      <div className="w-full">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <TooltipWrapper title={t.reloadPage}>
            <Button
              variant="ghost"
              aria-label={`${t.title} ${t.subtitle} ${t.reloadPage}`}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="flex items-center gap-3 px-2 py-2.5 h-auto overflow-visible"
            >
              <div className="p-1 flex items-center justify-center shrink-0">
                <Image src="/icon192.svg" alt="Logo" width={28} height={28} loading="eager" className="w-7 h-7 object-contain" />
              </div>
              <div className="hidden md:flex flex-col text-left py-0.5">
                <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-accent-400 to-primary-500 bg-clip-text text-transparent leading-none">
                  {t.title}
                </h2>
                <p className="text-xs font-medium mt-1 text-secondary-600 dark:text-secondary-200 leading-normal pb-0.5">{t.subtitle}</p>
              </div>
            </Button>
          </TooltipWrapper>

          {/* Total Score - Desktop */}
          {activeDeviceType !== 'pc' && activeDeviceType !== 'iot' && activeDeviceType !== 'firewall' && topologyDevices && topologyDevices.length > 0 && activeDeviceId && maxScore > 0 && (
            <div className="hidden md:flex items-center gap-4">
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-wider text-secondary-400 dark:text-secondary-200">
                    {t.labProgress}
                  </span>
                  <span
                    key={totalScore}
                    className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full animate-scale-in ${totalScore >= maxScore * 0.7 ? 'bg-success-500/10 text-success-400' :
                      totalScore >= maxScore * 0.4 ? 'bg-warning-500/10 text-warning-400' :
                        'bg-error-500/10 text-error-400'
                      }`}
                  >
                    {Math.round((totalScore / maxScore) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full overflow-hidden p-[px] bg-secondary-200 dark:bg-secondary-800">
                    <div
                      className="h-full bg-gradient-to-r from-accent-400 to-primary-500 rounded-full progress-fill"
                      style={{ '--progress-width': `${(totalScore / maxScore) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-xs font-black tabular-nums text-secondary-900 dark:text-white">
                      {totalScore}
                    </span>
                    <span className="text-[10px] font-bold opacity-30 text-secondary-500 dark:text-secondary-400">
                      /{maxScore}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Controls - Integrated Toolbar */}
          <div className="flex items-center gap-2 sticky top-0 z-10">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border bg-white border-secondary-200/60 shadow-sm dark:bg-secondary-800/40 dark:border-secondary-800">
              {/* Project Controls - Desktop only */}
              <div className="hidden md:flex items-center">
                <div className="flex items-center rounded-lg border overflow-hidden bg-white border-secondary-200 dark:bg-secondary-800/50 dark:border-secondary-700">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.newProject}
                        className="h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50 text-secondary-600 hover:text-primary-600 dark:text-secondary-300 dark:hover:text-primary-400 dark:hover:bg-secondary-700/50"
                        onClick={handleNewProject}
                      >
                        <File className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.newProject}</span>
                      <ShortcutBadge shortcut="Alt+N" variant="primary" />
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.loadProject}
                        className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-primary-400 hover:bg-secondary-700/50' : 'text-secondary-600 hover:text-primary-600')}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.loadProject}</span>
                      <ShortcutBadge shortcut="Ctrl+O" variant="primary" />
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.saveProject}
                        className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-primary-400 hover:bg-secondary-700/50' : 'text-secondary-600 hover:text-primary-600')}
                        onClick={handleSaveProject}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.saveProject}</span>
                      <ShortcutBadge shortcut="Ctrl+S" variant="success" />
                    </TooltipContent>
                  </Tooltip>
                  <div className={cn("w-px h-5 mx-1", isDark ? "bg-secondary-700" : "bg-secondary-300")} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.saveAsPNG}
                        className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-success-400 hover:bg-secondary-700/50' : 'text-secondary-600 hover:text-success-600')}
                        onClick={() => window.dispatchEvent(new CustomEvent('trigger-topology-export-png'))}
                      >
                        <ImageDown className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.saveAsPNG}</span>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.topologyGenerator}
                        className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-primary-400 hover:bg-secondary-700/50' : 'text-secondary-600 hover:text-primary-600')}
                        onClick={() => window.dispatchEvent(new CustomEvent('trigger-topology-generator'))}
                      >
                        <Wand2 className="w-4 h-4 text-purple-500 animate-pulse" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.topologyGenerator}</span>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.generateSummary}
                        className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-primary-400 hover:bg-secondary-700/50' : 'text-secondary-600 hover:text-primary-600', isExamActive && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-secondary-300")}
                        disabled={isExamActive}
                        onClick={() => window.dispatchEvent(new CustomEvent('add-summary-note'))}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.generateSummary}</span>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label={t.contactTitle} className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-primary-400 hover:bg-secondary-700/50' : 'text-secondary-500 hover:text-primary-600')} onClick={(e) => { e.stopPropagation(); setShowAboutModal(true); }}>
                        <Info className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      <span>{t.contactTitle}</span>
                      <ShortcutBadge shortcut="F1" variant="warning" />
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>                  <input ref={fileInputRef} type="file" accept=".json,.exam" onChange={handleLoadProject} className="hidden" />

              {/* Achievements - always visible */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button aria-label={t.basarilarim} className={cn("h-8 w-8 flex items-center justify-center transition-all hover:bg-secondary-200/50", isDark ? 'text-secondary-300 hover:text-warning-400 hover:bg-secondary-700/50' : 'text-secondary-500 hover:text-warning-600')} onClick={() => setShowBasarilarim(!showBasarilarim)}>
                    <Trophy className={`w-4 h-4 ${showBasarilarim ? 'text-warning-500' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="flex items-center gap-2">
                  <span>{t.basarilarim}</span>
                </TooltipContent>
              </Tooltip>


              {/* Settings & Theme */}
              <div className={`w-px h-4 mx-1 ${isDark ? 'bg-secondary-700' : 'bg-secondary-300'} hidden md:block`} />
              <TooltipWrapper title={language === 'tr' ? 'Switch to English' : "Türkçe'ye Geç"}>
                <button
                  aria-label={`${language.toUpperCase()}: ${language === 'tr' ? 'Switch to English' : "Türkçe'ye Geç"}`}
                  onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                  className={cn("text-[10px] font-bold h-8 px-1.5 flex items-center gap-1 rounded transition-all ui-hover-surface", isDark ? 'text-secondary-300 hover:text-purple-300' : 'text-secondary-700 hover:text-purple-700')}
                >
                  <Languages className="w-3.5 h-3.5" />
                  {language.toUpperCase()}
                </button>
              </TooltipWrapper>
              <ThemeToggle
                isDark={isDark}
                lightLabel={t.lightMode}
                darkLabel={t.darkMode}
                onToggle={() => setTheme(isDark ? 'light' : 'dark')}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={graphicsQuality !== 'high' ? t.highRes : t.lowRes}
                    className={cn("h-8 w-8 rounded flex items-center justify-center transition-all ui-hover-surface", graphicsQuality === 'high' ? (isDark ? 'text-secondary-300 hover:text-success-300' : 'text-secondary-500 hover:text-success-600') : (isDark ? 'text-secondary-300 hover:text-warning-300' : 'text-secondary-500 hover:text-warning-600'))}
                    onClick={() => setGraphicsQuality(graphicsQuality === 'high' ? 'low' : 'high')}
                  >
                    {graphicsQuality === 'high' ? <Sparkles className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{graphicsQuality !== 'high' ? t.highRes : t.lowRes}</TooltipContent>
              </Tooltip>
              <div className={`w-px h-4 mx-1 ${isDark ? 'bg-secondary-700' : 'bg-secondary-300'} hidden md:block`} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={`${t.helpLevelLabel}: ${helpLevel === 'beginner'
                        ? t.beginner
                        : helpLevel === 'intermediate'
                          ? t.intermediate
                          : t.advanced
                      }`}
                    className={cn(
                      "h-8 w-8 rounded flex items-center justify-center transition-all ui-hover-surface",
                      helpLevel === 'beginner' ? 'text-success-500' : helpLevel === 'intermediate' ? 'text-warning-500' : 'text-error-500'
                    )}
                    onClick={() => {
                      const next: Record<string, 'beginner' | 'intermediate' | 'exam'> = {
                        beginner: 'intermediate',
                        intermediate: 'exam',
                        exam: 'beginner'
                      };
                      setHelpLevel(next[helpLevel]);
                    }}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">{t.helpLevelLabel}</span>
                    <span className="text-[10px] opacity-80">
                      {helpLevel === 'beginner'
                        ? `🟢 ${t.beginnerLevel}`
                        : helpLevel === 'intermediate'
                          ? `🟡 ${t.intermediateLevel}`
                          : `🔴 ${t.advancedLevel}`}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Mobile Menu */}
          <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className={`${isDark ? 'bg-secondary-900 border-secondary-800' : 'bg-white'} p-0 w-72 h-dvh overflow-hidden`}>
              <SheetHeader className="p-4 text-left border-b border-secondary-800/50">
                <SheetTitle className="text-lg font-black flex items-center gap-2">
                  <div className="p-1 flex items-center justify-center">
                    <Image src="/icon192.svg" alt="Logo" width={20} height={20} loading="eager" className="w-5 h-5 object-contain" />
                  </div>
                  {t.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Main navigation and project controls
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-80px)] overflow-y-auto">
                <div className="p-3 space-y-4">
                  {/* Group 1: New / Save / Load */}
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200'}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => { setShowProjectPicker(true); setShowMobileMenu(false); }}
                      >
                        <File className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.new}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-purple-400" : "hover:text-purple-600")}
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('trigger-topology-generator'));
                          }
                          setShowMobileMenu(false);
                        }}
                      >
                        <Wand2 className="w-3.5 h-3.5 flex-shrink-0 text-purple-500" />
                        <span>{t.topologyGenerator}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => { handleSaveProject(); setShowMobileMenu(false); }}
                      >
                        <Save className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.saveLabel}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => { fileInputRef.current?.click(); setShowMobileMenu(false); }}
                      >
                        <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.load}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Group: Exports */}
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200'}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-success-400" : "hover:text-success-600")}
                        onClick={() => { window.dispatchEvent(new CustomEvent('trigger-topology-export-png')); setShowMobileMenu(false); }}
                      >
                        <ImageDown className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.saveAsPNG}</span>
                      </Button>
                        <Button
                          variant="outline"
                          disabled={isExamActive}
                          className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-primary-400" : "hover:text-primary-600", isExamActive && "opacity-40 cursor-not-allowed")}
                          onClick={() => { window.dispatchEvent(new CustomEvent('add-summary-note')); setShowMobileMenu(false); }}
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.generateSummary}</span>
                        </Button>
                    </div>
                  </div>

                  {/* Group 2: Language / Theme / Graphics */}
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200'}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                      >
                        <Languages className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{language === 'tr' ? t.english : t.turkish}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                      >
                        <div className="flex-shrink-0">
                          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        </div>
                        <span>{isDark ? t.lightMode : t.darkMode}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => setGraphicsQuality(graphicsQuality === 'high' ? 'low' : 'high')}
                      >
                        <div className="flex-shrink-0">
                          {graphicsQuality === 'high' ? <Sparkles className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                        </div>
                        <span>{graphicsQuality !== 'high' ? t.highRes : t.lowRes}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Group 3: Add Device / Connect / Refresh / Settings / Ping */}
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200'}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const event = new CustomEvent('trigger-topology-palette');
                            window.dispatchEvent(event);
                          }
                          setShowMobileMenu(false);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{t.addDeviceOrCable}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const event = new CustomEvent('trigger-topology-connect');
                            window.dispatchEvent(event);
                          }
                          setShowMobileMenu(false);
                        }}
                      >
                        <div className="flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0 -5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0 -5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <span>{t.connectDevices}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => {
                          handleRefreshNetwork();
                          setShowMobileMenu(false);
                        }}
                      >
                        <div className="flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <span>{t.refreshNetworkF5}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => {
                          setIsEnvironmentPanelOpen(true);
                          setShowMobileMenu(false);
                        }}
                      >
                        <Leaf className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{t.environmentSettings}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        disabled={isPingPanelOpen}
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const event = new CustomEvent('toggle-ping-mode');
                            window.dispatchEvent(event);
                          }
                          setShowMobileMenu(false);
                        }}
                      >
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{t.ping}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Group 4: Achievements / Tour / Help */}
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-secondary-800/30 border-secondary-800/50' : 'bg-secondary-50 border-secondary-200'}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-warning-400" : "hover:text-warning-600")}
                        onClick={() => { setShowBasarilarim(!showBasarilarim); setShowMobileMenu(false); }}
                      >
                        <Trophy className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.basarilarim}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={() => { setShowOnboarding(true); setOnboardingStep(0); setShowMobileMenu(false); }}
                      >
                        <Compass className="w-3.5 h-3.5 flex-shrink-0" /> <span>{t.tour}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("justify-start gap-2 h-11 text-xs font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap animate-marquee-hover", isDark ? "hover:text-accent-400" : "hover:text-accent-600")}
                        onClick={(e) => { e.stopPropagation(); setShowAboutModal(true); setShowMobileMenu(false); }}
                      >
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{t.help}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Lab Progress Mobile */}
                  {activeDeviceType !== 'pc' && activeDeviceType !== 'iot' && activeDeviceType !== 'firewall' && topologyDevices && topologyDevices.length > 0 && activeDeviceId && maxScore > 0 && (
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-secondary-800/30' : 'bg-secondary-50'} border ${isDark ? 'border-secondary-800/50' : 'border-secondary-200'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold tracking-[0.15em] text-secondary-500">{t.labProgress}</span>
                        <span className="text-xs font-bold text-accent-400">{Math.round((totalScore / maxScore) * 100)}%</span>
                      </div>
                      <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-secondary-800' : 'bg-secondary-200'} overflow-hidden mb-1.5`}>
                        <div
                          className="h-full bg-accent-500 shadow-[0_0_3px_rgba(6,182,212,0.2)] transition-all duration-500"
                          style={{ width: `${(totalScore / maxScore) * 100}%` }}
                        />
                      </div>
                      <p className={`text-center text-xs font-bold ${isDark ? 'text-white' : 'text-secondary-900'}`}>{totalScore} / {maxScore} {t.pts}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Guided Lesson Button */}
      {isGuidedModeActive && isPanelMinimized && (
        <div className="flex md:hidden items-center gap-1.5 mr-auto mt-1 sm:mt-2 pb-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t.openGuidedLesson}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-500 hover:bg-primary-500/10 animate-pulse"
                onClick={expandPanel}
              >
                <BookOpen className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.openGuidedLesson}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </header>
  );
}

