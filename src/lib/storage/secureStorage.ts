import { logger } from '@/lib/logger';

/**
 * Secure Storage Wrapper
 * Adds a basic layer of obfuscation (XOR + Base64) to localStorage to prevent casual tampering.
 */

const LEGACY_SECRET_KEY = 'netsim_secure_storage_key';
const PREFIX = 'ENC:';
const DEVICE_SALT_KEY = 'netsim_secure_storage_device_salt';

function hashKey(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${hash >>> 0}-${input.length}`;
}

function getDeviceSalt(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_SALT_KEY);
    if (stored) return stored;
    const bytes = new Uint8Array(32);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    const salt = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(DEVICE_SALT_KEY, salt);
    return salt;
  } catch {
    return 'fallback-device-salt';
  }
}

function getSecretKey(): string {
  const fingerprint = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    window.screen?.width,
    window.screen?.height,
    window.devicePixelRatio,
  ].join('|');
  return hashKey(`${LEGACY_SECRET_KEY}|${fingerprint}|${getDeviceSalt()}`);
}

function xorCipher(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function encode(data: string): string {
  try {
    // Use encodeURIComponent to handle non-ascii (e.g., Turkish) characters properly.
    // This turns all characters into ASCII.
    const uriEncoded = encodeURIComponent(data);
    // XORing ASCII with ASCII (our secret key) keeps the output in the 0-127 range.
    const xorData = xorCipher(uriEncoded, getSecretKey());
    // Since xorData is pure ASCII, btoa will not throw InvalidCharacterError.
    return PREFIX + btoa(xorData);
  } catch (e) {
    logger.error('Error encoding data', e);
    return data;
  }
}

function decode(data: string): string {
  // Fallback to legacy plain text for backward compatibility
  if (!data.startsWith(PREFIX)) {
    return data;
  }

  const base64Data = data.substring(PREFIX.length);
  let xorData: string;
  try {
    xorData = atob(base64Data);
  } catch (error) {
    logger.error('Error decoding data', error);
    return data;
  }
  try {
    const decodedUri = xorCipher(xorData, getSecretKey());
    return decodeURIComponent(decodedUri);
  } catch {
    try {
      const decodedUri = xorCipher(xorData, LEGACY_SECRET_KEY);
      return decodeURIComponent(decodedUri);
    } catch (legacyError) {
      logger.error('Error decoding data', legacyError);
      return data;
    }
  }
}

export const secureStorage = {
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const encoded = encode(value);
      window.localStorage.setItem(key, encoded);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
        // Attempt emergency cleanup of heavy non-critical storage items
        try {
          if (key !== 'netsim_history') {
            window.localStorage.removeItem('netsim_history');
          }
        } catch { /* ignore */ }

        try {
          const encoded = encode(value);
          window.localStorage.setItem(key, encoded);
          return;
        } catch {
          // Retry failed - throw so caller can reduce payload size if supported
        }
      } else {
        logger.error(`Error setting secureStorage key ${key}`, e);
      }
      throw e;
    }
  },

  getItem(key: string): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return null;
      return decode(value);
    } catch (e) {
      logger.error(`Error getting secureStorage key ${key}`, e);
      return null;
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      logger.error(`Error removing secureStorage key ${key}`, e);
    }
  },

  clear(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.clear();
    } catch (e) {
      logger.error('Error clearing secureStorage', e);
    }
  }
};
