import type { CommandHandler } from './commandTypes';

// Line (console/vty) komutları (line console, password, login, transport input, vs.)

export const lineHandlers: Record<string, CommandHandler> = {
  'line console': cmdLineConsole,
  'line vty': cmdLineVty,
  'password': cmdPassword,
  'no password': cmdNoPassword,
  'login': cmdLogin,
  'no login': cmdNoLogin,
  'transport input': cmdTransportInput,
  'no transport input': cmdNoTransportInput,
  'logging synchronous': cmdLoggingSynchronous,
  'no logging synchronous': cmdNoLoggingSynchronous,
  'exec-timeout': cmdExecTimeout,
  'no exec-timeout': cmdNoExecTimeout,
  'history': cmdHistory,
  'no history': cmdNoHistory,
  'exec': cmdExec,
  'no exec': cmdNoExec,
  'autocommand': cmdAutocommand,
  'no autocommand': cmdNoAutocommand,
  'privilege level': cmdPrivilegeLevel,
};

/**
 * Line Console
 */
function cmdLineConsole(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^line\s+console\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid line console command' };
  }

  return {
    success: true,
    newState: {
      currentMode: 'line',
      currentLine: `console ${match[1]}`
    }
  };
}

/**
 * Line VTY
 */
function cmdLineVty(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'config') {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^line\s+vty\s+(\d+)\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid line vty command' };
  }

  return {
    success: true,
    newState: {
      currentMode: 'line',
      currentLine: `vty ${match[1]} ${match[2]}`
    }
  };
}

/**
 * Password - Set line password
 */
function cmdPassword(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^password\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid password command' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      password: match[1]
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      password: match[1]
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Login - Enable password checking on line
 */
function cmdLogin(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };
  const useLocalLogin = /\blogin\s+local\b/i.test(input);

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      login: true,
      loginLocal: false
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      login: true,
      loginLocal: useLocalLogin
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Login - Disable password checking on line
 */
function cmdNoLogin(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      login: false,
      loginLocal: false
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      login: false,
      loginLocal: false
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Transport Input - Set allowed protocols for line
 */
function cmdTransportInput(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^transport\s+input\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid transport input command' };
  }

  const parts = match[1].toLowerCase().split(/\s+/);
  const protocols = parts.filter(p => ['ssh', 'telnet', 'all', 'none'].includes(p));

  if (protocols.length === 0) {
    return { success: false, error: '% Invalid transport input protocol' };
  }

  // If 'all' or 'none' is present, it usually takes precedence or clears others but we'll just store the list for simplicity.
  const finalProtocols = protocols.includes('all') ? ['all'] : protocols.includes('none') ? ['none'] : protocols;

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      transportInput: finalProtocols
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Logging Synchronous
 */
function cmdLoggingSynchronous(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      loggingSynchronous: true
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Exec-Timeout
 */
function cmdExecTimeout(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^exec-timeout\s+(\d+)(?:\s+(\d+))?$/i);
  if (!match) {
    return { success: false, error: '% Invalid exec-timeout command' };
  }

  const minutes = parseInt(match[1]);
  const seconds = match[2] ? parseInt(match[2]) : 0;

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      execTimeout: { minutes, seconds }
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      execTimeout: { minutes, seconds }
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Password - Remove line password
 */
function cmdNoPassword(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      password: ''
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      password: ''
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Transport Input - Reset transport input
 */
function cmdNoTransportInput(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      transportInput: []
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Logging Synchronous - Disable logging synchronous
 */
function cmdNoLoggingSynchronous(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      loggingSynchronous: false
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Exec-Timeout - Reset exec timeout to default
 */
function cmdNoExecTimeout(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      execTimeout: { minutes: 10, seconds: 0 }
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      execTimeout: { minutes: 10, seconds: 0 }
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * History - Set command history size
 */
function cmdHistory(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^history\s+size\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid history command' };
  }

  const newSecurity = { ...state.security };
  const size = parseInt(match[1]);

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      historySize: size
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      historySize: size
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No History - Disable command history
 */
function cmdNoHistory(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      historySize: 0
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      historySize: 0
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Exec - Enable EXEC mode on line
 */
function cmdExec(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      exec: true
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      exec: true
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Exec - Disable EXEC mode on line
 */
function cmdNoExec(state: any, input: string, cmd: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      exec: false
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      exec: false
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Autocommand - Run command on connection
 */
function cmdAutocommand(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^autocommand\s+(.+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid autocommand' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      autocommand: match[1]
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * No Autocommand - Remove autocommand
 */
function cmdNoAutocommand(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = {
      ...newSecurity.vtyLines,
      autocommand: ''
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}

/**
 * Privilege Level - Set privilege level for line
 */
function cmdPrivilegeLevel(state: any, input: string, ctx: any): any {
  if (state.currentMode !== 'line' || !state.currentLine) {
    return { success: false, error: '% Invalid command at this mode' };
  }

  const match = input.match(/^privilege\s+level\s+(\d+)$/i);
  if (!match) {
    return { success: false, error: '% Invalid privilege level command. Use: privilege level {0|1|15}' };
  }

  const level = parseInt(match[1]);
  if (level < 0 || level > 15) {
    return { success: false, error: '% Privilege level must be between 0 and 15' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = { ...newSecurity.consoleLine, privilegeLevel: level };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLines = { ...newSecurity.vtyLines, privilegeLevel: level };
  }

  return {
    success: true,
    output: `Privilege level ${level} set`,
    newState: { security: newSecurity }
  };
}
