import { SwitchState } from '@/lib/network/types';
import { evaluateAcl } from './acl';

export interface NatTranslationResult {
  translated: boolean;
  newSourceIp?: string;
  newTargetIp?: string;
  natTranslatedAt?: string;
  error?: string;
}

/**
 * Evaluates Inside -> Outside or Outside -> Inside NAT rules for a packet hop.
 */
export function evaluateNatForHop(
  stepDeviceId: string,
  state: SwitchState,
  ingressPortId: string,
  egressPortId: string,
  sourceIp: string,
  targetIp: string,
  options?: { protocol?: string; port?: string },
  language: 'tr' | 'en' = 'tr'
): NatTranslationResult {
  const ingressPort = state.ports[ingressPortId];
  const egressPort = state.ports[egressPortId];

  let currentSourceIp = sourceIp;
  let currentTargetIp = targetIp;
  let natTranslatedAt: string | undefined;

  if (ingressPort?.natSide && egressPort?.natSide && ingressPort.natSide !== egressPort.natSide) {
    if (ingressPort.natSide === 'inside' && egressPort.natSide === 'outside') {
      // Source NAT (Inside -> Outside)
      let translated = false;

      // 1. Static NAT
      if (state.natStaticTranslations) {
        const staticEntry = state.natStaticTranslations.find(t => t.localIp === currentSourceIp);
        if (staticEntry) {
          currentSourceIp = staticEntry.globalIp;
          translated = true;
        }
      }

      // 2. Dynamic PAT (Overload) / Pool
      if (!translated && state.natDynamicRules) {
        for (const rule of state.natDynamicRules) {
          const aclResult = evaluateAcl(rule.aclId, state, currentSourceIp, currentTargetIp, options?.protocol, options?.port);
          if (aclResult === 'permit') {
            if (rule.overload && rule.interface) {
              const outPort = state.ports[rule.interface];
              if (outPort?.ipAddress) {
                currentSourceIp = outPort.ipAddress;
                translated = true;
                break;
              }
            } else if (rule.poolName && state.natPools?.[rule.poolName]) {
              currentSourceIp = state.natPools[rule.poolName].startIp;
              translated = true;
              break;
            }
          }
        }
      }

      // 3. Drop if no translation found and only static NAT is configured (no dynamic rules)
      const hasOnlyStaticNat = (state.natStaticTranslations?.length ?? 0) > 0 && !state.natDynamicRules?.length;
      if (!translated && hasOnlyStaticNat) {
        return {
          translated: false,
          error: language === 'tr'
            ? `NAT: ${currentSourceIp} için statik çevrim bulunamadı — paket düşürüldü.`
            : `NAT: no static translation for ${currentSourceIp} — packet dropped.`
        };
      }

      if (translated && state.natStaticTranslations?.length) {
        natTranslatedAt = stepDeviceId;
      }
    } else if (ingressPort.natSide === 'outside' && egressPort.natSide === 'inside') {
      // Destination NAT (Outside -> Inside)
      let translated = false;

      // 1. Static NAT (Outside -> Inside)
      if (state.natStaticTranslations) {
        const staticEntry = state.natStaticTranslations.find(t => t.globalIp === currentTargetIp);
        if (staticEntry) {
          currentTargetIp = staticEntry.localIp;
          translated = true;
        }
      }

      // 2. Check Translation Table (Return traffic)
      if (!translated && state.natTranslations) {
        const entry = state.natTranslations.find(t => t.globalIp === currentTargetIp && t.remoteIp === currentSourceIp);
        if (entry) {
          currentTargetIp = entry.localIp;
          translated = true;
        }
      }

      if (translated) {
        natTranslatedAt = stepDeviceId;
      }
    }
  }

  // Reverse NAT verification
  if (natTranslatedAt === stepDeviceId && state.natStaticTranslations) {
    const hasStaticReverse = state.natStaticTranslations.some(t => t.globalIp === currentSourceIp);
    const hasDynamicNat = state.natDynamicRules && state.natDynamicRules.length > 0;

    if (!hasStaticReverse && !hasDynamicNat) {
      return {
        translated: false,
        error: language === 'tr'
          ? `NAT çevrimi tamamlanamıyor: ${currentSourceIp} için ters çevrim bulunamadı.`
          : `NAT translation incomplete: no reverse mapping for ${currentSourceIp}.`
      };
    }
  }

  return {
    translated: currentSourceIp !== sourceIp || currentTargetIp !== targetIp,
    newSourceIp: currentSourceIp,
    newTargetIp: currentTargetIp,
    natTranslatedAt,
  };
}
