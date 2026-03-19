import type { CommandHandler } from './commandTypes';

// Line (console/vty) komutları (line console, password, login, transport input, vs.)

export const lineHandlers: Record<string, CommandHandler> = {
  'line console': cmdLineConsole,
  'line vty': cmdLineVty,
  'password': cmdPassword,
  'login': cmdLogin,
  'transport input': cmdTransportInput,
  'logging synchronous': cmdLoggingSynchronous,
  'exec-timeout': cmdExecTimeout,
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
    newSecurity.vtyLine = {
      ...newSecurity.vtyLine,
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

  if (state.currentLine.startsWith('console')) {
    newSecurity.consoleLine = {
      ...newSecurity.consoleLine,
      login: true
    };
  } else if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLine = {
      ...newSecurity.vtyLine,
      login: true
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

  const match = input.match(/^transport\s+input\s+(ssh|telnet|all|none)$/i);
  if (!match) {
    return { success: false, error: '% Invalid transport input protocol' };
  }

  const newSecurity = { ...state.security };

  if (state.currentLine.startsWith('vty')) {
    newSecurity.vtyLine = {
      ...newSecurity.vtyLine,
      transport: match[1].toLowerCase()
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
    newSecurity.vtyLine = {
      ...newSecurity.vtyLine,
      execTimeout: { minutes, seconds }
    };
  }

  return {
    success: true,
    newState: { security: newSecurity }
  };
}
