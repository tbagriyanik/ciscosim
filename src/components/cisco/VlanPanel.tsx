'use client';

import { Vlan, Port } from '@/lib/cisco/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Translations } from '@/contexts/LanguageContext';

interface VlanPanelProps {
  vlans: Record<number, Vlan>;
  ports: Record<string, Port>;
  deviceName?: string;
  deviceModel?: string;
  onExecuteCommand: (command: string) => Promise<void>;
  t: Translations;
  theme: string;
}

interface VlanTask {
  id: string;
  name: string;
  description: string;
  weight: number;
  completed: boolean;
  hint: string;
}

export function VlanPanel({ vlans, ports, deviceName, onExecuteCommand, t, theme }: VlanPanelProps) {
  const [newVlanId, setNewVlanId] = useState('');
  const [newVlanName, setNewVlanName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const isDark = theme === 'dark';

  const getPortsForVlan = (vlanId: number): string[] => {
    return Object.values(ports)
      .filter(p => p.vlan === vlanId && !p.shutdown)
      .map(p => p.id.toUpperCase());
  };

  // VLAN Görevleri
  const getVlanTasks = (): VlanTask[] => {
    const userVlans = Object.values(vlans).filter(v => v.id > 1 && v.id < 1002);
    const namedVlans = userVlans.filter(v => v.name !== `VLAN${v.id}`);
    const trunkPorts = Object.values(ports).filter(p => p.mode === 'trunk' && !p.shutdown);
    const portsWithNonDefaultVlan = Object.values(ports).filter(p => p.vlan !== 1 && !p.shutdown);
    
    return [
      {
        id: 'create-vlan',
        name: t.language === 'tr' ? 'VLAN Oluştur' : 'Create VLAN',
        description: t.language === 'tr' 
          ? 'Varsayılan olmayan en az 1 VLAN oluştur' 
          : 'Create at least 1 non-default VLAN',
        weight: 20,
        completed: userVlans.length >= 1,
        hint: 'vlan 10'
      },
      {
        id: 'name-vlan',
        name: t.language === 'tr' ? 'VLAN İsimlendir' : 'Name VLAN',
        description: t.language === 'tr' 
          ? 'Bir VLAN\'a özel isim ver' 
          : 'Give a custom name to a VLAN',
        weight: 15,
        completed: namedVlans.length >= 1,
        hint: 'name MUHASEBE'
      },
      {
        id: 'assign-port',
        name: t.language === 'tr' ? 'Port Ata' : 'Assign Port',
        description: t.language === 'tr' 
          ? 'Bir portu VLAN\'a ata' 
          : 'Assign a port to a VLAN',
        weight: 20,
        completed: portsWithNonDefaultVlan.length >= 1,
        hint: 'switchport access vlan 10'
      },
      {
        id: 'create-trunk',
        name: t.language === 'tr' ? 'Trunk Port' : 'Trunk Port',
        description: t.language === 'tr' 
          ? 'Bir portu trunk moduna al' 
          : 'Configure a port as trunk',
        weight: 20,
        completed: trunkPorts.length >= 1,
        hint: 'switchport mode trunk'
      },
      {
        id: 'multiple-vlans',
        name: t.language === 'tr' ? 'Çoklu VLAN' : 'Multiple VLANs',
        description: t.language === 'tr' 
          ? 'En az 3 kullanıcı VLAN\'ı oluştur' 
          : 'Create at least 3 user VLANs',
        weight: 15,
        completed: userVlans.length >= 3,
        hint: 'vlan 20, vlan 30'
      },
      {
        id: 'all-named',
        name: t.language === 'tr' ? 'Tam İsimlendirme' : 'Full Naming',
        description: t.language === 'tr' 
          ? 'Tüm VLAN\'ları isimlendir' 
          : 'Name all VLANs properly',
        weight: 10,
        completed: userVlans.length > 0 && namedVlans.length === userVlans.length,
        hint: 'Her VLAN için: name <isim>'
      }
    ];
  };

  const vlanTasks = getVlanTasks();
  const totalScore = vlanTasks.reduce((acc, task) => acc + (task.completed ? task.weight : 0), 0);
  const completedTasks = vlanTasks.filter(t => t.completed).length;

  const getScoreColor = (score: number) => {
    if (score >= 80) return isDark ? 'text-green-400' : 'text-green-600';
    if (score >= 60) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    if (score >= 40) return isDark ? 'text-orange-400' : 'text-orange-600';
    return isDark ? 'text-red-400' : 'text-red-600';
  };

  const getScoreText = (score: number) => {
    if (score >= 80) return t.language === 'tr' ? 'Mükemmel VLAN yapılandırması!' : 'Excellent VLAN configuration!';
    if (score >= 60) return t.language === 'tr' ? 'İyi VLAN yapısı' : 'Good VLAN structure';
    if (score >= 40) return t.language === 'tr' ? 'VLAN yapılandırma devam ediyor' : 'VLAN configuration in progress';
    return t.language === 'tr' ? 'VLAN yapılandırması gerekli' : 'VLAN configuration needed';
  };

  const handleCreateVlan = async () => {
    const id = parseInt(newVlanId);
    if (isNaN(id) || id < 1 || id > 4094) {
      return;
    }
    
    setIsCreating(true);
    try {
      await onExecuteCommand('configure terminal');
      await new Promise(resolve => setTimeout(resolve, 150));
      await onExecuteCommand(`vlan ${id}`);
      await new Promise(resolve => setTimeout(resolve, 150));
      if (newVlanName) {
        await onExecuteCommand(`name ${newVlanName}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      await onExecuteCommand('exit');
      await new Promise(resolve => setTimeout(resolve, 150));
      await onExecuteCommand('exit');
      setNewVlanId('');
      setNewVlanName('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteVlan = async (vlanId: number) => {
    if ([1, 1002, 1003, 1004, 1005].includes(vlanId)) {
      return;
    }
    await onExecuteCommand('configure terminal');
    await new Promise(resolve => setTimeout(resolve, 150));
    await onExecuteCommand(`no vlan ${vlanId}`);
    await new Promise(resolve => setTimeout(resolve, 150));
    await onExecuteCommand('exit');
  };

  const sortedVlans = Object.values(vlans).sort((a, b) => a.id - b.id);
  
  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const innerBg = isDark ? 'bg-slate-900' : 'bg-slate-100';
  const itemBg = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-600';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';

  return (
    <Card className={`${cardBg} transition-all duration-300 hover:shadow-lg`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-purple-400 text-base sm:text-lg flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {deviceName || t.vlanStatus}
          <span className={`text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'} ml-2`}>
            {deviceModel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Puan ve Görev Durumu */}
        <div className={`mb-4 p-2 sm:p-3 ${innerBg} rounded-lg transition-all duration-300 hover:bg-opacity-80`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs sm:text-sm ${textSecondary}`}>
                {t.language === 'tr' ? 'VLAN Puanı' : 'VLAN Score'}
              </span>
              <Badge variant="outline" className="text-[10px] transition-transform hover:scale-105">
                {completedTasks}/{vlanTasks.length}
              </Badge>
            </div>
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

        {/* VLAN Görevleri */}
        <div className={`mb-4 p-2 sm:p-3 ${innerBg} rounded-lg`}>
          <div className={`text-xs font-medium ${textSecondary} mb-2 flex items-center gap-1`}>
            <svg className="w-3 h-3 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t.language === 'tr' ? 'VLAN Görevleri' : 'VLAN Tasks'}
          </div>
          <div className="space-y-1.5">
            {vlanTasks.map((task, index) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg transition-all duration-300 ${
                  task.completed 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : itemBg
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    task.completed 
                      ? 'bg-green-500 text-white scale-110' 
                      : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {task.completed ? (
                      <svg className="w-3 h-3 animate-success-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-[10px] font-bold">{task.weight}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[10px] sm:text-xs font-medium ${task.completed ? 'text-green-400' : textPrimary} truncate transition-colors`}>
                      {task.name}
                    </div>
                    <div className={`text-[9px] sm:text-[10px] ${textMuted} truncate hidden sm:block`}>
                      {task.description}
                    </div>
                  </div>
                </div>
                {!task.completed && (
                  <Badge 
                    variant="outline"
                    className="text-[8px] sm:text-[10px] px-1.5 py-0.5 text-purple-400 border-purple-500/30 transition-all hover:scale-105 hover:bg-purple-500/10"
                  >
                    +{task.weight}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* VLAN Oluşturma Formu */}
        <div className={`mb-4 p-2 sm:p-3 ${innerBg} rounded-lg`}>
          <div className={`text-xs ${textSecondary} mb-2`}>{t.newVlan}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="vlan-id" className={`text-xs ${textMuted}`}>{t.vlanId}</Label>
              <Input
                id="vlan-id"
                type="number"
                min={1}
                max={4094}
                value={newVlanId}
                onChange={(e) => setNewVlanId(e.target.value)}
                placeholder="10"
                className={`h-8 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'} ${textPrimary} text-sm`}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="vlan-name" className={`text-xs ${textMuted}`}>{t.vlanName}</Label>
              <Input
                id="vlan-name"
                type="text"
                value={newVlanName}
                onChange={(e) => setNewVlanName(e.target.value)}
                placeholder="SALES"
                className={`h-8 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'} ${textPrimary} text-sm`}
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleCreateVlan}
                disabled={!newVlanId || isCreating}
                className="h-8 bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
              >
                {t.create}
              </Button>
            </div>
          </div>
        </div>

        {/* VLAN Listesi */}
        <ScrollArea className="h-36 sm:h-48">
          <div className="space-y-1">
            <div className={`grid grid-cols-12 gap-1 sm:gap-2 px-2 py-1 text-[10px] sm:text-xs ${textSecondary} border-b ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
              <div className="col-span-1">ID</div>
              <div className="col-span-3">{t.vlanName}</div>
              <div className="col-span-2">{t.status}</div>
              <div className="col-span-5">{t.ports}</div>
              <div className="col-span-1"></div>
            </div>
            
            {sortedVlans.map((vlan) => {
              const vlanPorts = getPortsForVlan(vlan.id);
              const isDefault = [1, 1002, 1003, 1004, 1005].includes(vlan.id);
              
              return (
                <div
                  key={vlan.id}
                  className={`grid grid-cols-12 gap-1 sm:gap-2 px-2 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded hover:${isDark ? 'bg-slate-700/50' : 'bg-slate-100'} ${isDefault ? 'opacity-75' : ''}`}
                >
                  <div className="col-span-1 font-mono text-yellow-400">
                    {vlan.id}
                  </div>
                  <div className={`col-span-3 ${textPrimary} truncate`} title={vlan.name}>
                    {vlan.name}
                  </div>
                  <div className="col-span-2">
                    <Badge 
                      variant={vlan.status === 'active' ? 'default' : 'secondary'}
                      className="text-[9px] sm:text-[10px]"
                    >
                      {vlan.status === 'active' ? t.active : t.suspended}
                    </Badge>
                  </div>
                  <div className={`col-span-5 ${isDark ? 'text-slate-400' : 'text-slate-500'} truncate text-[9px] sm:text-[10px]`} title={vlanPorts.join(', ')}>
                    {vlanPorts.length > 0 ? vlanPorts.slice(0, 3).join(', ') + (vlanPorts.length > 3 ? '...' : '') : '-'}
                  </div>
                  <div className="col-span-1">
                    {!isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteVlan(vlan.id)}
                        className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-red-400 hover:text-red-300 hover:bg-slate-700"
                        title={`${t.delete} VLAN ${vlan.id}`}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
