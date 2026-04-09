import type { CommandHandler } from './commandTypes';

// Sistem ve oturum komutları (enable, configure terminal, ping, reload, debug, vs.)

export const systemHandlers: Record<string, CommandHandler> = {
  'enable': cmdEnable,
  'disable': cmdDisable,
  'configure terminal': cmdConfigureTerminal,
  'exit': cmdExit,
  'end': cmdEnd,
  'do': cmdDo,
};

/**
 * Enable - Enter privileged mode
 */
function cmdEnable(
  state: any,
  input: string,
  ctx: any
): any {
  // Check if already in privileged mode
  if (state.currentMode === 'privileged') {
    return { success: true, output: '' };
  }

  // Check if enable secret/password is configured
  const needsPassword = !!(state.security?.enableSecret || state.security?.enablePassword);

  if (needsPassword) {
    return {
      success: true,
      output: 'Password: ',
      requiresPassword: true,
      passwordPrompt: 'Password: ',
      passwordContext: 'enable',
      newState: {
        awaitingPassword: true,
        passwordContext: 'enable'
      }
    };
  }

  // If no enable password is set, allow direct access to privileged mode
  return {
    success: true,
    newState: {
      currentMode: 'privileged'
    }
  };
}

/**
 * Disable - Return to user mode
 */
function cmdDisable(
  state: any,
  input: string,
  ctx: any
): any {
  if (state.currentMode !== 'privileged') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: {
      currentMode: 'user'
    }
  };
}

/**
 * Configure Terminal - Enter global configuration mode
 */
function cmdConfigureTerminal(
  state: any,
  input: string,
  ctx: any
): any {
  if (state.currentMode !== 'privileged') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  return {
    success: true,
    newState: {
      currentMode: 'config'
    }
  };
}

/**
 * Exit - Exit current mode
 */
function cmdExit(
  state: any,
  input: string,
  ctx: any
): any {
  switch (state.currentMode) {
    case 'interface':
      return {
        success: true,
        newState: {
          currentMode: 'config',
          currentInterface: undefined
        }
      };
    case 'config-if-range':
      return {
        success: true,
        newState: {
          currentMode: 'config',
          currentInterface: undefined,
          selectedInterfaces: undefined
        }
      };
    case 'line':
      return {
        success: true,
        newState: {
          currentMode: 'config',
          currentLine: undefined
        }
      };
    case 'vlan':
      return {
        success: true,
        newState: {
          currentMode: 'config',
          currentVlan: undefined
        }
      };
    case 'config':
      return {
        success: true,
        newState: {
          currentMode: 'privileged'
        }
      };
    case 'router-config':
      return {
        success: true,
        newState: {
          currentMode: 'config'
        }
      };
    case 'dhcp-config':
      return {
        success: true,
        newState: {
          currentMode: 'config',
          currentDhcpPool: undefined
        }
      };
    case 'privileged':
    case 'user':
      return {
        success: true,
        output: '',
        exitSession: true
      };
    default:
      return { success: true, output: '', exitSession: true };
  }
}

/**
 * End - Return to privileged mode from any sub-mode
 */
function cmdEnd(
  state: any,
  input: string,
  ctx: any
): any {
  // Handle all sub-modes and return to privileged
  switch (state.currentMode) {
    case 'interface':
    case 'config-if-range':
    case 'line':
    case 'vlan':
    case 'router-config':
    case 'dhcp-config':
      return {
        success: true,
        newState: {
          currentMode: 'privileged',
          currentInterface: undefined,
          selectedInterfaces: undefined,
          currentLine: undefined,
          currentVlan: undefined,
          currentDhcpPool: undefined,
          ospfProcessId: undefined,
          ripEnabled: undefined
        }
      };
    case 'config':
      return {
        success: true,
        newState: {
          currentMode: 'privileged',
          currentInterface: undefined,
          currentLine: undefined,
          currentVlan: undefined,
          ospfProcessId: undefined,
          ripEnabled: undefined
        }
      };
    default:
      return { success: true, output: '' };
  }
}


/**
 * Do - Execute privileged commands from config mode
 */
function cmdDo(
  state: any,
  input: string,
  ctx: any
): any {
  // Extract the command after "do"
  const match = input.match(/^do\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid command' };
  }

  const command = match[1];

  // Return error - this should be handled by specific do handlers
  return { success: false, error: `% Unknown command: ${command}` };
}


