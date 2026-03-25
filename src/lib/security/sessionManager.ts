import { generateSecureToken, safeParseJSON, sanitizeInput } from './sanitizer';

export interface AppSession {
  id: string;
  createdAt: number;
  expiresAt: number;
  language: 'tr' | 'en';
  theme: 'dark' | 'light';
  autoSave: boolean;
}

const SESSION_KEY = 'netsim_app_session';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 8;

export function createAppSession(overrides: Partial<Omit<AppSession, 'id' | 'createdAt' | 'expiresAt'>> = {}): AppSession {
  const createdAt = Date.now();
  return {
    id: generateSecureToken(24),
    createdAt,
    expiresAt: createdAt + DEFAULT_TTL_MS,
    language: overrides.language ?? 'tr',
    theme: overrides.theme ?? 'dark',
    autoSave: overrides.autoSave ?? true,
  };
}

export function isSessionValid(session: AppSession | null | undefined): session is AppSession {
  return !!session && typeof session.id === 'string' && session.id.length > 0 && session.expiresAt > Date.now();
}

export function persistAppSession(session: AppSession): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(sanitizeInput(SESSION_KEY), JSON.stringify(session));
}

export function readAppSession(): AppSession | null {
  if (typeof sessionStorage === 'undefined') return null;

  const stored = sessionStorage.getItem(sanitizeInput(SESSION_KEY));
  if (!stored) return null;

  const parsed = safeParseJSON<AppSession | null>(stored, null);
  return isSessionValid(parsed) ? parsed : null;
}

export function clearAppSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(sanitizeInput(SESSION_KEY));
}
