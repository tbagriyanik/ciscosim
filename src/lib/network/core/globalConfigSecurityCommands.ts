import { IOS_ERRORS, iosModeError } from './iosErrors';
import type { CommandContext } from './commandTypes';
import type { SwitchState, CommandResult } from '../types';
import { getPvstUpdate } from './commandHelpers';
import { encryptMd5Password, encryptType7Password } from '../crypto';

/**
 * No Spanning-Tree - Disable spanning-tree globally or per-VLAN
 */
export function cmdNoSpanningTree(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const lang = ctx.language || 'en';

  const vlanMatch = input.match(/^no\s+spanning-tree\s+vlan\s+(\d+)$/i);
  if (vlanMatch) {
    const vlanId = parseInt(vlanMatch[1]);
    const spanningTreeVlans = state.spanningTreeVlans || {};

    const updatedVlans = {
      ...spanningTreeVlans,
      [vlanId]: {
        ...spanningTreeVlans[vlanId],
        enabled: false
      }
    };

    const updatedCurrentState = {
      ...state,
      spanningTreeVlans: updatedVlans
    };

    const pvst = getPvstUpdate(updatedCurrentState, ctx);
    if ('error' in pvst) return pvst.error;
    const { allUpdatedStates, myUpdatedState } = pvst;

    return {
      success: true,
      output: lang === 'tr' ?
        `Spanning-tree VLAN ${vlanId} devre disi birakildi` :
        `Spanning-tree disabled on VLAN ${vlanId}`,
      newState: myUpdatedState || { spanningTreeVlans: updatedVlans },
      updatedDeviceStates: allUpdatedStates
    };
  }

  return {
    success: false,
    error: '% Command not available in Global Configuration mode.'
  };
}

/**
 * No Username - Remove username
 */
export function cmdNoUsername(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^no\s+username\s+(\S+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid username command' };
  }

  const username = match[1];
  const currentUsers = Array.isArray(state.security?.users) ? state.security.users : [];
  const newUsers = currentUsers.filter((user: { username: string; password: string; privilege: number }) => (user?.username || '').toLowerCase() !== username.toLowerCase());

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        users: newUsers
      }
    }
  };
}

/**
 * No Interface - Delete interface config (for VLAN interfaces)
 */
export function cmdNoInterface(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^no\s+interface\s+vlan\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid interface command' };
  }

  const vlanId = match[1];
  const newVlans = { ...state.vlans };

  if (!newVlans[vlanId]) {
    return { success: false, error: `% VLAN ${vlanId} does not exist` };
  }

  newVlans[vlanId] = {
    ...newVlans[vlanId],
    ipAddress: undefined,
    subnetMask: undefined
  };

  return {
    success: true,
    newState: { vlans: newVlans }
  };
}

/**
 * Spanning-Tree VLAN - Enable STP on VLAN or configure priority/root
 */
export function cmdSpanningTreeVlan(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };

  const match = input.match(/^spanning-tree\s+vlan\s+(\d+)(?:\s+(priority|root)(?:\s+(primary|secondary|\d+))?)?$/i);
  if (!match) return { success: false, error: '% Invalid spanning-tree vlan command' };

  const vlanId = parseInt(match[1]);
  const subCommand = match[2];
  const value = match[3];

  const lang = ctx.language || 'en';
  const spanningTreeVlans = state.spanningTreeVlans || {};

  if (!subCommand) {
    const updatedVlans = {
      ...spanningTreeVlans,
      [vlanId]: {
        ...spanningTreeVlans[vlanId],
        enabled: true
      }
    };

    return {
      success: true,
      output: lang === 'tr' ?
        `Spanning-tree VLAN ${vlanId} etkinlestirildi` :
        `Spanning-tree enabled on VLAN ${vlanId}`,
      newState: { spanningTreeVlans: updatedVlans }
    };
  }

  if (subCommand === 'priority' && value) {
    const priorityValue = parseInt(value);
    const allowedPriorities = [0, 4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440];
    if (!allowedPriorities.includes(priorityValue)) {
      const firstLine = allowedPriorities.slice(0, 8).map(v => String(v).padStart(6)).join(' ');
      const secondLine = allowedPriorities.slice(8).map(v => String(v).padStart(6)).join(' ');
      return {
        success: false,
        error: `% Bridge Priority must be in increments of 4096.\n% Allowed values are:\n  ${firstLine}\n  ${secondLine}`
      };
    }
  }

  let finalValue = value;
  if (subCommand === 'root') {
    if (value === 'primary') {
      finalValue = '24576';
    } else if (value === 'secondary') {
      finalValue = '28672';
    } else if (!value) {
      finalValue = '24576';
    }
  } else if (subCommand === 'priority' && !value) {
    return { success: false, error: '% Incomplete command.' };
  }

  const updatedVlans = {
    ...spanningTreeVlans,
    [vlanId]: {
      ...spanningTreeVlans[vlanId],
      enabled: true,
      priority: subCommand === 'root' || subCommand === 'priority' ? finalValue : value
    }
  };

  const updatedCurrentState = {
    ...state,
    spanningTreeVlans: updatedVlans
  };

  const pvst = getPvstUpdate(updatedCurrentState, ctx);
  if ('error' in pvst) return pvst.error;
  const { allUpdatedStates, myUpdatedState } = pvst;

  return {
    success: true,
    output: lang === 'tr' ?
      `Spanning-tree VLAN ${vlanId} ${subCommand} yapılandırıldı` :
      `Spanning-tree VLAN ${vlanId} ${subCommand} configured`,
    newState: myUpdatedState || { spanningTreeVlans: updatedVlans },
    updatedDeviceStates: allUpdatedStates
  };
}

export function cmdSpanningTreePortfastDefault(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  return { success: true, output: 'PortFast will be configured in all non-trunking ports', newState: { spanningTreePortfastDefault: true } };
}

export function cmdErrdisableRecovery(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  return { success: true, output: 'Errdisable recovery configured' };
}

export function cmdVtpPassword(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  const match = input.match(/^vtp\s+password\s+(\S+)$/i);
  if (!match) return { success: false, error: '% Invalid vtp password command' };
  return { success: true, newState: { vtpPassword: match[1] } };
}

/**
 * IP ARP Inspection VLAN
 */
export function cmdIpArpInspection(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  const match = input.match(/^ip\s+arp\s+inspection\s+vlan\s+(.+)$/i);
  if (match) {
    const vlans = match[1].split(',').map((v: string) => v.trim());
    return {
      success: true,
      output: `ARP inspection enabled on VLAN(s): ${vlans.join(', ')}`,
      newState: { arpInspectionEnabled: true, arpInspectionVlans: vlans }
    };
  }
  return { success: true, output: 'ARP inspection configured', newState: { arpInspectionEnabled: true } };
}

export function cmdNoIpArpInspection(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };
  const match = input.match(/^no\s+ip\s+arp\s+inspection\s+vlan\s+(.+)$/i);
  if (match && state.arpInspectionVlans) {
    const removeVlans = match[1].split(',').map((v: string) => v.trim());
    const remaining = state.arpInspectionVlans.filter(v => !removeVlans.includes(v));
    return {
      success: true,
      output: remaining.length > 0 ? `ARP inspection remaining VLAN(s): ${remaining.join(', ')}` : 'ARP inspection disabled',
      newState: { arpInspectionVlans: remaining.length > 0 ? remaining : undefined, arpInspectionEnabled: remaining.length > 0 }
    };
  }
  return { success: true, output: 'ARP inspection disabled', newState: { arpInspectionEnabled: false, arpInspectionVlans: undefined } };
}

/**
 * Crypto Key Generate RSA
 */
export function cmdCryptoKeyGenerateRsa(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };

  const match = input.match(/^crypto\s+key\s+generate\s+rsa(?:\s+modulus\s+(\d+))?$/i);
  const modulus = match?.[1] ? parseInt(match[1], 10) : 1024;
  const validModulus = modulus >= 360 && modulus <= 4096 ? modulus : 1024;

  const hostPart = state.hostname || 'Switch';
  const domainPart = state.domainName || 'local';

  return {
    success: true,
    output: `The name for the keys will be: ${hostPart}.${domainPart}\n`
      + `Choose the size of the key modulus in the range of 360 to 4096 for your\n`
      + `General Purpose Keys. Choosing a key modulus greater than 512 may take\n`
      + `a few minutes.\n\n`
      + `How many bits in the modulus [512]: ${validModulus}\n`
      + `% Generating ${validModulus} bit RSA keys, keys will be non-exportable...\n`
      + `[OK] (elapsed time was 1 seconds)\n`,
    newState: {
      rsaKeys: { modulus: validModulus, name: `${hostPart}.${domainPart}` }
    }
  };
}

/**
 * Crypto Key Zeroize RSA
 */
export function cmdCryptoKeyZeroizeRsa(state: SwitchState, input: string, ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') return { success: false, error: iosModeError() };

  if (!/^crypto\s+key\s+zeroize\s+rsa$/i.test(input)) {
    return { success: false, error: IOS_ERRORS.invalidInput };
  }

  if (!state.rsaKeys) {
    return { success: true, output: '% Keys do not exist.\n' };
  }

  const keyName = state.rsaKeys.name || `${state.hostname || 'Switch'}.${state.domainName || 'local'}`;

  if (ctx?.skipConfirm) {
    return {
      success: true,
      output: `% Keys to be removed are named ${keyName}.\n`
        + `% RSA key pair has been removed.\n`,
      newState: { rsaKeys: undefined }
    };
  }

  return {
    success: true,
    output: '% Are you sure you want to remove all RSA keys? [yes/no]: ',
    requiresConfirmation: true,
    confirmationMessage: `All RSA keys (${keyName}) will be removed. Continue?`,
    confirmationAction: 'crypto-key-zeroize'
  };
}

export function cmdUsername(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^username\s+(\S+)(?:\s+privilege\s+(\d+))?(?:\s+(secret|password)\s+(.+))?$/i);
  if (!match) {
    return { success: false, error: IOS_ERRORS.invalidInput };
  }

  const username = match[1];
  const privilege = match[2] ? parseInt(match[2]) : 0;
  const password = match[4] || '';
  const currentUsers = Array.isArray(state.security?.users) ? state.security.users : [];
  const normalizedUsername = username.toLowerCase();
  const newUsers = currentUsers.filter((user: { username: string; password: string; privilege: number }) => (user?.username || '').toLowerCase() !== normalizedUsername);
  newUsers.push({
    username,
    password,
    privilege
  });

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        users: newUsers
      }
    }
  };
}

export function cmdServicePasswordEncryption(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        servicePasswordEncryption: true
      }
    }
  };
}

export function cmdNoServicePasswordEncryption(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        servicePasswordEncryption: false
      }
    }
  };
}

export function cmdEnableSecret(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^enable\s+secret\s+(.+)$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  const password = match[1];
  const encryptedPassword = encryptMd5Password(password);

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enableSecret: encryptedPassword,
        enableSecretEncrypted: true
      }
    }
  };
}

export function cmdEnablePassword(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^enable\s+password\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid enable password command' };
  }

  const password = match[1];
  const encryptedPassword = state.security?.servicePasswordEncryption
    ? encryptType7Password(password)
    : password;

  return {
    success: true,
    newState: {
      security: {
        ...state.security,
        enablePassword: encryptedPassword
      }
    }
  };
}

export function cmdNoEnableSecret(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const newSecurity = { ...state.security };
  delete newSecurity.enableSecret;
  return {
    success: true,
    newState: { security: newSecurity }
  };
}

export function cmdNoEnablePassword(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const newSecurity = { ...state.security };
  delete newSecurity.enablePassword;
  return {
    success: true,
    newState: { security: newSecurity }
  };
}

export function cmdBannerMotd(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^banner\s+motd\s+(.)([\s\S]*?)\1\s*$/i);
  if (!match) {
    return { success: false, error: "% Invalid input detected at '^' marker." };
  }

  return {
    success: true,
    newState: { bannerMOTD: match[2] }
  };
}

export function cmdNoBannerMotd(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { bannerMOTD: undefined }
  };
}

export function cmdBannerLogin(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^banner\s+login\s+(.)([\s\S]*?)\1\s*$/i);
  if (!match) {
    return { success: false, error: '% Invalid banner command. Use: banner login #message#' };
  }

  return {
    success: true,
    newState: { bannerLogin: match[2] }
  };
}

export function cmdNoBannerLogin(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { bannerLogin: undefined }
  };
}

export function cmdBannerExec(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  const match = input.match(/^banner\s+exec\s+(.)([\s\S]*?)\1\s*$/i);
  if (!match) {
    return { success: false, error: '% Invalid banner command. Use: banner exec #message#' };
  }

  return {
    success: true,
    newState: { bannerExec: match[2] }
  };
}

export function cmdNoBannerExec(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  if (state.currentMode !== 'config') {
    return { success: false, error: iosModeError() };
  }

  return {
    success: true,
    newState: { bannerExec: undefined }
  };
}