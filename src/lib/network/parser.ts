// Network Command Parser
import { CommandMode, ParsedCommand, CommandValidationResult, SwitchState } from './types';
import { commandAliases } from './initialState';
import { useAppStore } from '../store/appStore';
import { IOS_ERRORS } from "./core/iosErrors";
import { getDeviceCapabilities, type DeviceCapabilities } from './capabilities';
import type { DeviceType } from '@/components/network/networkTopology.types';

// Modüler komut pattern'leri
import type { CommandPattern } from './parser/commandPatterns.types';
import { modePatterns } from './parser/modePatterns';
import { routingPatterns } from './parser/routingPatterns';
import { interfacePatterns } from './parser/interfacePatterns';
import { lineVlanPatterns } from './parser/lineVlanPatterns';
import { showPatterns } from './parser/showPatterns';
import { systemPatterns } from './parser/systemPatterns';

export type { CommandPattern };

// Desteklenen komutlar ve pattern'leri — alt modüllerden birleştirilir
export const commandPatterns: Record<string, CommandPattern> = {
  ...modePatterns,
  ...routingPatterns,
  ...interfacePatterns,
  ...lineVlanPatterns,
  ...showPatterns,
  ...systemPatterns,
};


// BOLT: Pre-sorted static command aliases to avoid sorting a massive 1342-element dictionary on every alias resolution.
// This improves resolution time from ~1ms to <0.1ms per call, avoiding main-thread typing latency in the CLI terminal.
// Uses fallback to empty object to remain robust in mock tests where initialState is only partially mocked.
const cachedSortedAliases = Object.entries(commandAliases || {})
  .sort((a, b) => b[0].length - a[0].length);

// Komut alias'larını çöz - Gelişmiş versiyon
export function resolveAliases(input: string, state?: Partial<SwitchState>): string {
  const trimmed = input.trim().toLowerCase();

  // Abbreviation: "int gi0/0" is equivalent to
  // "interface gi0/0". Keep the shorthand valid for all interface steps.
  if (/^int\s+\S+/i.test(trimmed)) {
    return `interface${trimmed.substring(3)}`;
  }

  // Special handling for "do <subcommand>" — delegate alias resolution to privileged mode
  if (trimmed.startsWith('do ')) {
    const subInput = input.trim().substring(3);
    const resolvedSub = resolveAliases(subInput, state);
    return `do ${resolvedSub}`;
  }

  // Exec aliases: built-in defaults + user-defined (runtime)
  const builtInExecAliases: Record<string, string> = {
    h: 'show history',
    lo: 'exit'
  };
  const execAliases = { ...builtInExecAliases, ...state?.execAliases };

  // 1. Tam eşleşme (kullanıcı + built-in exec alias)
  if (execAliases[trimmed]) {
    return execAliases[trimmed];
  }

  // 2. Kısmi eşleşme (prefix match: örn. 'lo ...' veya parametreli alias)
  const sortedExecAliases = Object.entries(execAliases)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [alias, full] of sortedExecAliases as [string, string][]) {
    const aliasLower = alias.toLowerCase();
    const fullLower = full.toLowerCase();
    if (trimmed === aliasLower) {
      return full;
    }
    if (trimmed.startsWith(aliasLower + ' ')) {
      if (trimmed === fullLower || trimmed.startsWith(fullLower + ' ')) {
        continue;
      }
      const rest = input.trim().substring(alias.length).trim();
      return rest ? full + ' ' + rest : full;
    }
  }

  // Tam eşleşme - direkt alias
  if (commandAliases[trimmed]) {
    return commandAliases[trimmed];
  }

  // Kısmi eşleşme - daha uzun komutlar için
  // Önce en uzun alias'ları dene (using the pre-sorted cached static list to eliminate the O(N log N) sorting bottleneck)
  for (const [alias, full] of cachedSortedAliases) {
    const aliasLower = alias.toLowerCase();
    const fullLower = full.toLowerCase();

    // Alias ile tam eşleşme
    if (trimmed === aliasLower) {
      return full;
    }

    // Alias ile başlıyor ve boşlukla devam ediyorsa (prefix match)
    if (trimmed.startsWith(aliasLower + ' ')) {
      // Eğer zaten tam komutla (veya onun prefix'iyle) başlıyorsa genişletme yapma
      // Bu, "clear mac address-table" gibi komutların "clear mac" alias'ı yüzünden
      // "clear mac address-table address-table" haline gelmesini önler.
      if (trimmed === fullLower || trimmed.startsWith(fullLower + ' ')) {
        continue;
      }

      const rest = input.trim().substring(alias.length).trim();
      return rest ? full + ' ' + rest : full;
    }
  }

  return input;
}

// Levenshtein mesafesi hesaplama (bulanık eşleşme için)
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// Komut parse et
export function parseCommand(input: string, currentMode: CommandMode, state?: Partial<SwitchState>): ParsedCommand | null {
  // Guided lesson text may be copied with surrounding quotation marks or a
  // sentence-ending period. Treat those as presentation punctuation, not as
  // part of the CLI command (e.g. `"enable".` -> `enable`).
  const normalizedInput = input.trim().replace(/^["'“”]+|["'“”.,!?]+$/g, '').trim();

  if (normalizedInput && normalizedInput.length > 256) {
    return {
      command: '',
      args: [],
      rawInput: normalizedInput,
      resolvedInput: '',
      intent: { family: 'other', action: 'unknown' }
    };
  }

  const inferredDeviceType = state
    ? (state.deviceType === 'switch'
      ? (state.switchLayer === 'L3' ? 'switchL3' : 'switchL2')
      : state.deviceType || (state.switchLayer === 'FW' ? 'firewall' : state.switchLayer === 'L3' ? 'switchL3' : 'switchL2'))
    : 'switchL2';
  const capabilities = state ? getDeviceCapabilities({ type: inferredDeviceType as DeviceType }, state.switchModel) : undefined;
  const resolvedInput = expandKeywordPrefixes(resolveAliases(normalizedInput, state), currentMode, capabilities);

  if (!resolvedInput) return null;

  // Komut ve argümanları ayır
  const parts = resolvedInput.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);
  const intent = inferIntent(parts.map(p => p.toLowerCase()));

  return {
    command: command.toLowerCase(),
    args: args.map(a => a.toLowerCase()),
    rawInput: normalizedInput,
    resolvedInput: resolvedInput,  // Store resolved input for executor
    intent
  };
}

function inferIntent(tokens: string[]): ParsedCommand['intent'] {
  const [t0 = '', t1 = '', t2 = ''] = tokens;
  if (t0 === 'show') return { family: 'show', action: [t0, t1, t2].filter(Boolean).join(' ') };
  if (t0 === 'interface' || (t0 === 'int')) return { family: 'interface', action: 'interface' };
  if (t0 === 'ip' && (t1 === 'route' || t1 === 'routing')) return { family: 'routing', action: `ip ${t1}` };
  if (t0 === 'router' || (t0 === 'ipv6' && t1 === 'router')) return { family: 'routing', action: [t0, t1, t2].filter(Boolean).join(' ') };
  if (t0 === 'spanning-tree' || (t0 === 'switchport' && t1 === 'port-security')) return { family: 'security', action: [t0, t1, t2].filter(Boolean).join(' ') };
  if (['enable', 'disable', 'exit', 'end', 'reload', 'write', 'copy', 'delete', 'clear', 'debug', 'undebug'].includes(t0)) {
    return { family: 'system', action: [t0, t1].filter(Boolean).join(' ') };
  }
  return { family: 'other', action: t0 || 'unknown' };
}

interface CommandTreeNode {
  children: Map<string, CommandTreeNode>;
  terminalPatterns: string[];
}

function createNode(): CommandTreeNode {
  return { children: new Map<string, CommandTreeNode>(), terminalPatterns: [] };
}

function isKeywordToken(token: string): boolean {
  return /^[a-z0-9-]+$/i.test(token);
}

// BOLT: Cache map to store built command trees to avoid rebuilding the trie on every key press
const commandTreeCache = new Map<string, CommandTreeNode>();

function ensureCommandTree(mode: CommandMode, capabilities?: DeviceCapabilities): CommandTreeNode {
  // BOLT: Construct a unique cache key based on the mode and capability flags
  const routing = capabilities ? !!capabilities.routing : false;
  const switching = capabilities ? !!capabilities.switching : false;
  const firewall = capabilities ? !!capabilities.firewall : false;
  const cacheKey = `${mode}:${routing}:${switching}:${firewall}`;

  const cached = commandTreeCache.get(cacheKey);
  if (cached) return cached;

  const root = createNode();

  for (const [patternName, pattern] of Object.entries(commandPatterns)) {
    if (!pattern.modes.includes(mode)) continue;

    // Filter by capability if provided
    if (capabilities && pattern.capability) {
      if (!capabilities[pattern.capability]) continue;
    }

    const tokens = patternName.toLowerCase().split(/\s+/).filter(isKeywordToken);
    if (tokens.length === 0) continue;
    let current = root;
    for (const token of tokens) {
      if (!current.children.has(token)) current.children.set(token, createNode());
      current = current.children.get(token) as CommandTreeNode;
    }
    current.terminalPatterns.push(patternName);
  }

  commandTreeCache.set(cacheKey, root);
  return root;
}

function tokenize(input: string): string[] {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function expandKeywordPrefixes(input: string, currentMode: CommandMode, capabilities?: DeviceCapabilities): string {
  const rawTokens = input.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return input;

  // Special handling for "do <subcommand>" — delegating keyword expansion to privileged mode
  if (rawTokens[0].toLowerCase() === 'do' && rawTokens.length > 1 && currentMode !== 'privileged' && currentMode !== 'user') {
    const subInput = input.trim().substring(rawTokens[0].length).trim();
    const expandedSub = expandKeywordPrefixes(subInput, 'privileged', capabilities);
    return `do ${expandedSub}`;
  }

  let frontier: CommandTreeNode[] = [ensureCommandTree(currentMode, capabilities)];
  const expanded = [...rawTokens];

  for (let i = 0; i < rawTokens.length; i++) {
    const token = expanded[i].toLowerCase();
    const matches: Array<{ keyword: string; child: CommandTreeNode }> = [];
    for (const node of frontier) {
      for (const [keyword, child] of node.children.entries()) {
        if (keyword.startsWith(token)) matches.push({ keyword, child });
      }
    }
    if (matches.length === 0) break;
    const uniqueKeywords = Array.from(new Set(matches.map(m => m.keyword)));
    if (uniqueKeywords.includes(token)) {
      expanded[i] = token;
      const matched = matches.find(m => m.keyword === token);
      if (matched) {
        frontier = [matched.child];
      }
    } else if (uniqueKeywords.length === 1) {
      expanded[i] = uniqueKeywords[0];
      const matched = matches.find(m => m.keyword === uniqueKeywords[0]);
      if (matched) {
        frontier = [matched.child];
      }
    } else {
      frontier = matches.map(m => m.child);
    }
  }

  return expanded.join(' ');
}

function resolveByCommandTree(input: string, currentMode: CommandMode, capabilities?: DeviceCapabilities): { kind: 'ok' | 'ambiguous' | 'incomplete'; candidates?: string[]; failedTokenIndex?: number } {
  const tokens = tokenize(input);
  if (tokens.length === 0) return { kind: 'ok' };

  let frontier: CommandTreeNode[] = [ensureCommandTree(currentMode, capabilities)];
  let failedTokenIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next: CommandTreeNode[] = [];
    for (const node of frontier) {
      for (const [keyword, child] of node.children.entries()) {
        if (keyword.startsWith(token)) next.push(child);
      }
    }
    if (next.length === 0) {
      failedTokenIndex = i;
      break;
    }
    frontier = next;
  }

  if (failedTokenIndex !== -1) {
    return { kind: 'ok', failedTokenIndex };
  }

  const terminal = frontier.flatMap(n => n.terminalPatterns);
  const hasChildren = frontier.some(n => n.children.size > 0);

  if (terminal.length === 0 && hasChildren) {
    const nextKeywords = Array.from(new Set(frontier.flatMap(n => Array.from(n.children.keys())))).slice(0, 8);
    return { kind: 'incomplete', candidates: nextKeywords };
  }

  if (terminal.length > 1) {
    const unique = Array.from(new Set(terminal)).slice(0, 8);
    return { kind: 'ambiguous', candidates: unique };
  }

  return { kind: 'ok' };
}

// Komut geçerli mi kontrol et
export function validateCommand(
  parsed: ParsedCommand,
  currentMode: CommandMode,
  state?: Partial<SwitchState>
): CommandValidationResult {
  if (parsed.rawInput && parsed.rawInput.length > 256) {
    return {
      valid: false,
      reason: 'unknown-command',
      error: '% Command exceeds maximum length of 256 characters.'
    };
  }

  const resolvedInput = parsed.resolvedInput || resolveAliases(parsed.rawInput, state);
  const inferredDeviceType = state
    ? (state.deviceType === 'switch'
      ? (state.switchLayer === 'L3' ? 'switchL3' : 'switchL2')
      : state.deviceType || (state.switchLayer === 'FW' ? 'firewall' : state.switchLayer === 'L3' ? 'switchL3' : 'switchL2'))
    : 'switchL2';
  const capabilities = state ? getDeviceCapabilities({ type: inferredDeviceType as DeviceType }, state.switchModel) : undefined;

  // Exact pattern match must win over prefix-tree ambiguity.
  let invalidModeError: CommandValidationResult | null = null;
  for (const [name, pattern] of Object.entries(commandPatterns)) {
    const match = resolvedInput.match(pattern.pattern);
    if (!match) continue;

    // Check capability
    if (capabilities && pattern.capability && !capabilities[pattern.capability]) {
      // If capability mismatch, treat as unknown command to get proper caret positioning
      continue;
    }

    if (!pattern.modes.includes(currentMode)) {
      // Record invalid mode error but continue searching for a pattern matching currentMode
      if (!invalidModeError) {
        invalidModeError = {
          valid: false,
          reason: 'invalid-mode',
          error: getInvalidCommandError(parsed.rawInput, 0, currentMode)
        };
      }
      continue;
    }

    // Cihaz uyumluluk kontrolü (Akıllı Destek)
    if (state) {
      const compatibility = checkDeviceCompatibility(name, state);
      if (!compatibility.valid) {
        return {
          valid: false,
          reason: 'unknown-command', // nOS gibi 'invalid' yerine cihaz uyumsuzluğunu belirtiyoruz
          error: compatibility.error
        };
      }
    }

    return { valid: true, reason: 'ok', matchedPattern: name };
  }

  if (invalidModeError) {
    return invalidModeError;
  }

  const treeResolution = resolveByCommandTree(resolvedInput, currentMode, capabilities);
  if (treeResolution.kind === 'ambiguous') {
    const token = resolvedInput.trim().split(/\s+/)[0] || resolvedInput;
    return { valid: false, reason: 'ambiguous', error: `% Ambiguous command: "${token}"` };
  }
  if (treeResolution.kind === 'incomplete') {
    return { valid: false, reason: 'incomplete', error: IOS_ERRORS.incomplete };
  }

  // Check for potentially incomplete commands by token count
  const tokens = resolvedInput.trim().split(/\s+/);
  const matchedBase = Object.keys(commandPatterns).find(key => {
    const pattern = commandPatterns[key];
    if (!pattern.modes.includes(currentMode)) return false;
    // If input starts with a known command base but has too few tokens
    if (resolvedInput.toLowerCase().startsWith(key.toLowerCase()) && tokens.length < pattern.minArgs + key.split(/\s+/).length) {
      return true;
    }
    return false;
  });

  if (matchedBase && !commandPatterns[matchedBase].pattern.test(resolvedInput)) {
    return { valid: false, reason: 'incomplete', error: IOS_ERRORS.incomplete };
  }

  // Eşleşme bulunamadı
  const failedTokenIndex = treeResolution.failedTokenIndex;
  return {
    valid: false,
    reason: 'unknown-command',
    error: getInvalidCommandError(parsed.rawInput, failedTokenIndex, currentMode)
  };
}


// Geçersiz komut hatası
export function getInvalidCommandError(
  input: string,
  failedTokenIndexOrState?: number | Partial<SwitchState>,
  currentMode?: CommandMode
): string {
  // Access global state safely (SSR friendly)
  let helpLevel: 'beginner' | 'intermediate' | 'exam' = 'beginner';
  let language: 'tr' | 'en' = 'tr';
  if (typeof window !== 'undefined') {
    try {
      helpLevel = useAppStore.getState().helpLevel;
      const storedLang = localStorage.getItem('netsim_language');
      if (storedLang === 'en' || storedLang === 'tr') {
        language = storedLang;
      }
    } catch { /* ignore */ }
  }

  let failedTokenIndex: number | undefined = undefined;
  if (typeof failedTokenIndexOrState === 'number') {
    failedTokenIndex = failedTokenIndexOrState;
  } else if (failedTokenIndexOrState && typeof failedTokenIndexOrState === 'object') {
    if (!currentMode && 'currentMode' in failedTokenIndexOrState) {
      currentMode = failedTokenIndexOrState.currentMode;
    }
  }

  const indicatorPos = calculateCaretPosition(input, failedTokenIndex ?? 0);
  const cleanedInput = input.replace(/\s+$/g, '');
  const indicator = ' '.repeat(indicatorPos) + '^';
  let errorMsg = `${cleanedInput}\n${indicator}\n${IOS_ERRORS.invalidInput}`;

  if (currentMode && helpLevel !== 'exam') {
    const cmdTokens = cleanedInput.toLowerCase().split(/\s+/);
    const firstWord = cmdTokens[0];

    const isTr = language === 'tr';
    // Educational hints for specific commands
    if (firstWord === 'interface' || firstWord === 'int') {
      errorMsg += isTr
        ? `\n💡 İpucu: "interface" komutundan sonra bir arayüz adı bekleniyor (Örn: "fa0/1").`
        : `\n💡 Hint: "interface" command expects an interface name (e.g. "fa0/1").`;
    } else if (firstWord === 'vlan') {
      errorMsg += isTr
        ? `\n💡 İpucu: "vlan" komutundan sonra bir numara bekleniyor (1-4094).`
        : `\n💡 Hint: "vlan" command expects a number (1-4094).`;
    } else if (firstWord === 'ip' && cmdTokens[1] === 'address') {
      errorMsg += isTr
        ? `\n💡 İpucu: "ip address" komutu bir IP ve alt ağ maskesi bekler.`
        : `\n💡 Hint: "ip address" command expects an IP and subnet mask.`;
    } else if (firstWord === 'access-list') {
      errorMsg += isTr
        ? `\n💡 İpucu: "access-list" komutu bir numara, permit/deny ve koşul bekler.`
        : `\n💡 Hint: "access-list" command expects a number, permit/deny and condition.`;
    } else if (firstWord === 'line' && (cmdTokens[1] === 'vty' || cmdTokens[1] === 'console' || cmdTokens[1] === 'con')) {
      errorMsg += isTr
        ? `\n💡 İpucu: "line" komutundan sonra hat tipi ve numarası bekleniyor.`
        : `\n💡 Hint: "line" command expects line type and number.`;
    } else if (firstWord === 'router' && (cmdTokens[1] === 'ospf' || cmdTokens[1] === 'rip' || cmdTokens[1] === 'eigrp')) {
      errorMsg += isTr
        ? `\n💡 İpucu: "router" komutundan sonra protokol ve ID bekleniyor.`
        : `\n💡 Hint: "router" command expects protocol and AS/Process ID.`;
    }

    // Mevcut mod için geçerli komutların ilk kelimelerini topla
    const validFirstWords = new Set<string>();
    Object.entries(commandPatterns).forEach(([name, pattern]) => {
      if (pattern.modes.includes(currentMode)) {
        validFirstWords.add(name.split(/\s+/)[0]);
      }
    });

    // En yakın 3 komutu bul
    const suggestions = Array.from(validFirstWords)
      .map(word => ({ word, distance: getLevenshteinDistance(firstWord, word) }))
      .filter(item => item.distance <= 2)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    if (suggestions.length > 0) {
      const suggestionStr = suggestions.map(s => s.word).join(', ');
      errorMsg += `\n\nBunu mu demek istediniz? (Did you mean?): ${suggestionStr}`;
    }
  }

  return errorMsg;
}

/**
 * Cihaz ve komut uyumluluğunu kontrol eder (Akıllı Yardımcı)
 */
function checkDeviceCompatibility(commandName: string, state: Partial<SwitchState>): { valid: boolean; error?: string } {
  const model = state.switchModel || '';
  const isModelL3 = typeof model === 'string' && model.includes('3650');
  const isLayer3 = state.isLayer3Switch || state.switchLayer === 'L3' || isModelL3;
  const deviceType = state.deviceType === 'router'
    ? 'router'
    : (state.deviceType === 'firewall'
      ? 'firewall'
      : (isLayer3 ? 'switchL3' : (state.deviceType || 'switchL2')));
  const deviceLabel = deviceType === 'switchL2'
    ? 'Layer 2 switch'
    : deviceType === 'switchL3'
      ? 'Layer 3 switch'
      : deviceType === 'router'
        ? 'router'
        : 'firewall';
  const unsupported = (cmd: string) => `${IOS_ERRORS.invalidInput}\n${cmd} is not supported on this ${deviceLabel}.`;

  // 1. Router üzerinde Switchport komutları
  if (deviceType === 'router' && (commandName.startsWith('switchport') || commandName === 'vlan' || commandName === 'no vlan')) {
    return { valid: false, error: unsupported(commandName) };
  }

  // 2. L2 Switch üzerinde L3 komutları (no switchport, ip routing, vs.)
  if (deviceType === 'switchL2' && (commandName === 'no switchport' || commandName === 'ip routing' || commandName.startsWith('router ') || commandName.startsWith('ipv6 router '))) {
    return { valid: false, error: unsupported(commandName) };
  }

  // 3. Firewall (ASA) spesifik olmayan ama interface modunda olan komutlar
  if (deviceType === 'firewall' && (commandName.startsWith('switchport') || commandName === 'vlan')) {
    return { valid: false, error: unsupported(commandName) };
  }

  return { valid: true };
}

function calculateCaretPosition(input: string, tokenIndex: number): number {
  const tokens = input.split(/(\s+)/);
  let pos = 0;
  let currentTokenCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].trim() !== '') {
      if (currentTokenCount === tokenIndex) {
        return pos;
      }
      currentTokenCount++;
    }
    pos += tokens[i].length;
  }
  return pos;
}




