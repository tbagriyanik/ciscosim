'use client';

import { SecurityConfig } from '@/lib/network/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Translations } from '@/contexts/LanguageContext';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SecurityPanelProps {
 security: SecurityConfig;
 t: Translations;
 theme: string;
 deviceId?: string;
 isDevicePoweredOff?: boolean;
 onTogglePower?: (deviceId: string) => void;
}

interface SecurityItem {
 name: string;
 enabled: boolean;
 description: string;
 weight: number;
}

export function SecurityPanel({ security, t, theme, deviceId, isDevicePoweredOff = false, onTogglePower }: SecurityPanelProps) {
 const isDark = theme === 'dark';

 const securityItems: SecurityItem[] = [
 {
 name: t.enableSecret,
 enabled: !!security.enableSecret,
 description: security.enableSecret ? t.secEnableSecretOn : t.secEnableSecretOff,
 weight: 25
 },
 {
 name: t.consoleSecurity,
 enabled: security.consoleLine.login && !!security.consoleLine.password,
 description: security.consoleLine.login ? t.secConsoleOn : t.secConsoleOff,
 weight: 20
 },
 {
 name: t.vtySecurity,
 enabled: security.vtyLines.login && !!security.vtyLines.password,
 description: security.vtyLines.login ? t.secVtyOn : t.secVtyOff,
 weight: 20
 },
 {
 name: t.passwordEncryption,
 enabled: security.servicePasswordEncryption,
 description: security.servicePasswordEncryption ? t.secPassEncOn : t.secPassEncOff,
 weight: 15
 },
 {
 name: t.sshAccess,
 enabled: security.vtyLines.transportInput.includes('ssh') &&
 !security.vtyLines.transportInput.includes('telnet') &&
 security.vtyLines.transportInput[0] !== 'all' &&
 security.vtyLines.transportInput[0] !== 'none',
 description: security.vtyLines.transportInput.includes('ssh') &&
 !security.vtyLines.transportInput.includes('telnet')
 ? t.secSshOnly
 : security.vtyLines.transportInput.includes('telnet')
 ? t.secTelnetWarn
 : t.secNoProtocol,
 weight: 20
 }
 ];

 const totalScore = securityItems.reduce((acc, item) => {
 return acc + (item.enabled ? item.weight : 0);
 }, 0);

 const getScoreColor = (score: number) => {
 if (score >= 80) return isDark ? 'text-green-400' : 'text-green-600';
 if (score >= 60) return isDark ? 'text-yellow-400' : 'text-yellow-600';
 if (score >= 40) return isDark ? 'text-orange-400' : 'text-orange-600';
 return isDark ? 'text-red-400' : 'text-red-600';
 };

 const getScoreText = (score: number) => {
 if (score >= 80) return t.goodSecurity;
 if (score >= 60) return t.mediumSecurity;
 if (score >= 40) return t.lowSecurity;
 return t.criticalSecurity;
 };

 const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
 const innerBg = isDark ? 'bg-slate-900' : 'bg-slate-100';
 const itemBg = isDark ? 'bg-slate-900' : 'bg-slate-50';
 const textPrimary = isDark ? 'text-white' : 'text-slate-900';
 const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
 const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';

 return (
 <Card className={`${cardBg} transition-all duration-300 hover:shadow-lg`}>
 <CardHeader className={`py-3 px-5 border-b ${isDark ? 'border-slate-800/50 bg-slate-800/20' : 'border-slate-200 bg-slate-50'}`}>
 <div className="flex items-center justify-between gap-3">
 <CardTitle className="text-orange-400 text-base sm:text-lg flex items-center gap-2">
 <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
 {t.securityControls}
 </CardTitle>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => deviceId && onTogglePower?.(deviceId)}
 className={`h-8 w-8 rounded-lg transition-all ${isDevicePoweredOff ? 'text-rose-500 hover:bg-rose-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
 aria-label={t.language === 'tr' ? 'Güç' : 'Power'}
 disabled={!deviceId || !onTogglePower}
 >
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0" />
 </svg>
 </Button>
 </TooltipTrigger>
 <TooltipContent hideArrow side="bottom" className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isDark ? 'text-white' : 'text-slate-900'} p-2 text-xs`}>
 {t.language === 'tr'
 ? `Güç: ${isDevicePoweredOff ? 'Kapalı' : 'Açık'}`
 : `Power: ${isDevicePoweredOff ? 'Off' : 'On'}`}
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </div>
 </CardHeader>
 <CardContent>
 {isDevicePoweredOff && (
 <div className="mb-4 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-bold text-center">
 {t.language === 'tr' ? 'Bağlantı hatası' : 'Connection error'}
 </div>
 )}
 <div className={`mb-4 p-2 sm:p-3 ${innerBg} rounded-lg transition-all duration-300 hover:bg-opacity-80`}>
 <div className="flex items-center justify-between mb-2">
 <span className={`text-xs sm:text-sm ${textSecondary}`}>{t.securityLevel}</span>
 <span className={`text-base sm:text-lg font-bold ${getScoreColor(totalScore)} transition-all duration-300`}>
 {totalScore}%
 </span>
 </div>
 <Progress
 value={totalScore}
 className="h-2 bg-slate-700 transition-all duration-500"
 />
 <div className={`mt-1 text-xs ${textMuted} transition-colors duration-300`}>
 {getScoreText(totalScore)}
 </div>
 </div>

 <div className="space-y-1.5 sm:space-y-2">
 {securityItems.map((item, index) => (
 <div
 key={item.name}
 className={`flex items-center justify-between p-2 ${itemBg} rounded-lg transition-all duration-300 hover:bg-opacity-80`}
 style={{ animationDelay: `${index * 50}ms` }}
 >
 <div className="flex items-center gap-2 min-w-0">
 <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300 ${item.enabled ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
 } ${item.enabled ? 'animate-pulse' : ''}`} />
 <div className="min-w-0">
 <div className={`text-xs sm:text-sm ${textPrimary} truncate transition-colors`}>{item.name}</div>
 <div className={`text-xs ${textMuted} truncate hidden sm:block transition-colors`}>{item.description}</div>
 </div>
 </div>
 <Badge
 variant={item.enabled ? 'default' : 'destructive'}
 className={`text-xs flex-shrink-0 ml-1 transition-all duration-300 ${item.enabled
 ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
 : 'hover:bg-red-500/20'
 }`}
 >
 {item.enabled ? t.on : t.off}
 </Badge>
 </div>
 ))}
 </div>

 {security.users.length > 0 && (
 <div className={`mt-3 sm:mt-4 p-2 ${innerBg} rounded-lg animate-fade-in`}>
 <div className={`text-xs ${textSecondary} mb-1`}>{t.definedUsers}</div>
 <div className="flex flex-wrap gap-1">
 {security.users.map((user) => (
 <Badge
 key={user.username}
 variant="outline"
 className="text-xs transition-all duration-200 hover:scale-105 hover:bg-orange-500/10 hover:text-orange-400"
 >
 {user.username} (priv: {user.privilege})
 </Badge>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 );
}
