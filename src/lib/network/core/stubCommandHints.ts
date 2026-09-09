import type { CommandHandler, CommandContext } from './commandTypes';
import type { SwitchState, CommandResult } from '../types';

const STUB_COMMAND_HINTS: Record<string, { tr: string; en: string }> = {
  'priority-queue out': {
    tr: 'priority-queue out, arayüz çıkışında yüksek öncelikli bir kuyruk (expedite queue) oluşturur. VoIP gibi gecikmeye duyarlı trafiğin her zaman gönderilmesini sağlar.',
    en: 'priority-queue out creates an expedite queue on the egress interface. Ensures delay-sensitive traffic (e.g., VoIP) is always transmitted first.'
  },
  'queue-set': {
    tr: 'queue-set, bir arayüz için kuyruk kümesini yapılandırır.',
    en: 'queue-set configures the queue set for an interface.'
  },
  'tx-queue': {
    tr: 'tx-queue, arayüz çıkış kuyruğu parametrelerini yapılandırır.',
    en: 'tx-queue configures egress queue parameters.'
  },
  'ip directed-broadcast': { tr: 'Yönlü yayın IP yapılandırması henüz simüle edilmiyor.', en: 'Directed broadcast IP configuration not yet simulated.' },
  'no ip directed-broadcast': { tr: 'Yönlü yayın IP devre dışı bırakma henüz simüle edilmiyor.', en: 'Directed broadcast IP disable not yet simulated.' },
  'ip arp inspection limit': { tr: 'ARP denetimi sınırı yapılandırması henüz simüle edilmiyor.', en: 'ARP inspection limit configuration not yet simulated.' },
  'carrier-delay': { tr: 'Taşıyıcı gecikmesi yapılandırması henüz simüle edilmiyor.', en: 'Carrier delay configuration not yet simulated.' },
  'load-interval': { tr: 'İstatistik aralığı yapılandırması henüz simüle edilmiyor.', en: 'Load interval configuration not yet simulated.' },
  'cdp timer': { tr: 'CDP zamanlayıcı süresi yapılandırması henüz simüle edilmiyor.', en: 'CDP timer configuration not yet simulated.' },
  'cdp holdtime': { tr: 'CDP bekleme süresi yapılandırması henüz simüle edilmiyor.', en: 'CDP holdtime configuration not yet simulated.' },
  'archive': { tr: 'Arşiv yapılandırması henüz simüle edilmiyor.', en: 'Archive configuration not yet simulated.' },
  'macro': { tr: 'Komut makrosu yapılandırması henüz simüle edilmiyor.', en: 'Command macro configuration not yet simulated.' },
  'default interface': { tr: 'Varsayılan arayüz yapılandırması henüz simüle edilmiyor.', en: 'Default interface configuration not yet simulated.' },
  'configure replace': { tr: 'Yapılandırma değiştirme (replace) henüz simüle edilmiyor.', en: 'Configuration replace not yet simulated.' },
  'mac access-list': { tr: 'MAC erişim listesi yapılandırması henüz simüle edilmiyor.', en: 'MAC access-list configuration not yet simulated.' },
  'template': { tr: 'Şablon (template) yapılandırması henüz simüle edilmiyor.', en: 'Template configuration not yet simulated.' },
  'transport output': { tr: 'Çıkış protokolü yapılandırması henüz simüle edilmiyor.', en: 'Output transport configuration not yet simulated.' },
  'transport preferred': { tr: 'Tercih edilen protokol yapılandırması henüz simüle edilmiyor.', en: 'Preferred transport configuration not yet simulated.' },
  'access-class': { tr: 'Erişim sınıfı (access-class) yapılandırması henüz simüle edilmiyor.', en: 'Access-class configuration not yet simulated.' },
  'session-limit': { tr: 'Oturum sınırı yapılandırması henüz simüle edilmiyor.', en: 'Session limit configuration not yet simulated.' },
  'lockable': { tr: 'Kilitlenebilir hat yapılandırması henüz simüle edilmiyor.', en: 'Lockable line configuration not yet simulated.' },
};

export function createStubHandler(commandKey: string): CommandHandler {
  return (_state: SwitchState, input: string, _ctx: CommandContext): CommandResult => {
    const hint = STUB_COMMAND_HINTS[commandKey] || {
      tr: 'Bu komut kabul edildi ancak simülasyonu henüz mevcut değil.',
      en: 'Command accepted but its simulation is not yet available.'
    };
    return {
      success: true,
      output: `% ${input.trim()} configured`,
      realismLevel: 'stub',
      hint
    };
  };
}
