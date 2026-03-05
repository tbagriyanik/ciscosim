'use client';

import { SecurityConfig } from '@/lib/cisco/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Translations } from '@/contexts/LanguageContext';

interface SecurityPanelProps {
  security: SecurityConfig;
  t: Translations;
  theme: string;
}

interface SecurityItem {
  name: string;
  enabled: boolean;
  description: string;
  weight: number;
}

export function SecurityPanel({ security, t, theme }: SecurityPanelProps) {
  const isDark = theme === 'dark';
  
  const securityItems: SecurityItem[] = [
    {
      name: t.enableSecret,
      enabled: !!security.enableSecret,
      description: security.enableSecret 
        ? (t.language === 'tr' ? 'Şifreli enable şifresi yapılandırılmış' : 'Encrypted enable password configured')
        : (t.language === 'tr' ? 'Enable şifresi yapılandırılmamış' : 'Enable password not configured'),
      weight: 25
    },
    {
      name: t.consoleSecurity,
      enabled: security.consoleLine.login && !!security.consoleLine.password,
      description: security.consoleLine.login 
        ? (t.language === 'tr' ? 'Console hattı için giriş aktif' : 'Console line login enabled')
        : (t.language === 'tr' ? 'Console hattı için giriş yapılandırılmamış' : 'Console line login not configured'),
      weight: 20
    },
    {
      name: t.vtySecurity,
      enabled: security.vtyLines.login && !!security.vtyLines.password,
      description: security.vtyLines.login 
        ? (t.language === 'tr' ? 'VTY hatları için giriş aktif' : 'VTY lines login enabled')
        : (t.language === 'tr' ? 'VTY hatları için giriş yapılandırılmamış' : 'VTY lines login not configured'),
      weight: 20
    },
    {
      name: t.passwordEncryption,
      enabled: security.servicePasswordEncryption,
      description: security.servicePasswordEncryption 
        ? (t.language === 'tr' ? 'Şifreler şifrelenmiş durumda' : 'Passwords encrypted')
        : (t.language === 'tr' ? 'Şifreler düz metin olarak saklanıyor' : 'Passwords stored in plain text'),
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
        ? (t.language === 'tr' ? 'Sadece SSH erişimi aktif' : 'SSH-only access enabled')
        : security.vtyLines.transportInput.includes('telnet')
        ? (t.language === 'tr' ? 'Telnet erişimi aktif (güvenli değil)' : 'Telnet access enabled (insecure)')
        : (t.language === 'tr' ? 'Erişim protokolü yapılandırılmamış' : 'Access protocol not configured'),
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
      <CardHeader className="pb-2">
        <CardTitle className="text-orange-400 text-base sm:text-lg flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {t.securityControls}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
          <div className={`mt-1 text-[10px] sm:text-xs ${textMuted} transition-colors duration-300`}>
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
                <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300 ${
                  item.enabled ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
                } ${item.enabled ? 'animate-pulse' : ''}`} />
                <div className="min-w-0">
                  <div className={`text-xs sm:text-sm ${textPrimary} truncate transition-colors`}>{item.name}</div>
                  <div className={`text-[10px] ${textMuted} truncate hidden sm:block transition-colors`}>{item.description}</div>
                </div>
              </div>
              <Badge 
                variant={item.enabled ? 'default' : 'destructive'}
                className={`text-[9px] sm:text-[10px] flex-shrink-0 ml-1 transition-all duration-300 ${
                  item.enabled 
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
            <div className={`text-[10px] sm:text-xs ${textSecondary} mb-1`}>{t.definedUsers}</div>
            <div className="flex flex-wrap gap-1">
              {security.users.map((user) => (
                <Badge 
                  key={user.username} 
                  variant="outline" 
                  className="text-[10px] transition-all duration-200 hover:scale-105 hover:bg-orange-500/10 hover:text-orange-400"
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
