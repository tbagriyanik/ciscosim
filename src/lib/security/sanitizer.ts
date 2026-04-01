/**
 * Security utilities for input sanitization and data protection
 */

export function sanitizeHTML(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

/**
 * Sanitize HTML content allowing only <b> and <i> tags for HTTP service content
 * This removes all other HTML tags and dangerous attributes while preserving formatting
 */
export function sanitizeHTTPContent(input: string): string {
    // First, escape all HTML to make it safe
    const escaped = input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Then selectively allow <b> and <i> tags by converting them back
    // We use a safe pattern that only matches properly formatted tags
    let result = escaped
        .replace(/&lt;u&gt;/g, '<u>')
        .replace(/&lt;\/u&gt;/g, '</u>')
        .replace(/&lt;b&gt;/g, '<b>')
        .replace(/&lt;\/b&gt;/g, '</b>')
        .replace(/&lt;i&gt;/g, '<i>')
        .replace(/&lt;\/i&gt;/g, '</i>');

    return result;
}

export function sanitizeInput(input: string): string {
    return input
        .replace(/[<>`]/g, '')
        .replace(/javascript:/gi, '')
        .trim();
}

export function sanitizeObject<T>(value: T): T {
    if (typeof value === 'string') {
        return sanitizeInput(value) as T;
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeObject(item)) as T;
    }

    if (value && typeof value === 'object') {
        const result: Record<string, any> = {};
        Object.entries(value as Record<string, any>).forEach(([key, entry]) => {
            result[sanitizeInput(key)] = sanitizeObject(entry);
        });
        return result as T;
    }

    return value;
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validateIPAddress(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

export function validateSubnetMask(subnet: string): boolean {
    if (!validateIPAddress(subnet)) return false;

    const parts = subnet.split('.').map((p) => parseInt(p, 10));
    let foundZero = false;

    for (const part of parts) {
        const binary = part.toString(2).padStart(8, '0');
        if (foundZero && binary.includes('1')) {
            return false; // Invalid subnet mask pattern
        }
        if (binary.includes('0')) {
            foundZero = true;
        }
    }

    return true;
}

export function validateMACAddress(mac: string): boolean {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})$/;
    return macRegex.test(mac);
}

export function validateURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function escapeJSON(obj: any): string {
    return JSON.stringify(sanitizeObject(obj))
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

export function safeParseJSON<T>(value: string, fallback: T): T {
    try {
        return sanitizeObject(JSON.parse(value));
    } catch {
        return fallback;
    }
}

export function validateConfigData(config: Record<string, any>): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Check for required fields
    if (!config.name || typeof config.name !== 'string') {
        errors.push('Name is required and must be a string');
    }

    // Validate IP if present
    if (config.ip && !validateIPAddress(config.ip)) {
        errors.push('Invalid IP address format');
    }

    // Validate subnet if present
    if (config.subnet && !validateSubnetMask(config.subnet)) {
        errors.push('Invalid subnet mask format');
    }

    // Validate gateway if present
    if (config.gateway && !validateIPAddress(config.gateway)) {
        errors.push('Invalid gateway IP address format');
    }

    // Validate DNS if present
    if (config.dns && !validateIPAddress(config.dns)) {
        errors.push('Invalid DNS IP address format');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function secureLocalStorage() {
    return {
        setItem: (key: string, value: any) => {
            try {
                const sanitizedKey = sanitizeInput(key);
                const serialized = JSON.stringify(value);
                localStorage.setItem(sanitizedKey, serialized);
            } catch (e) {
                console.error('Failed to set item in localStorage:', e);
            }
        },

        getItem: (key: string) => {
            try {
                const sanitizedKey = sanitizeInput(key);
                const item = localStorage.getItem(sanitizedKey);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error('Failed to get item from localStorage:', e);
                return null;
            }
        },

        removeItem: (key: string) => {
            try {
                const sanitizedKey = sanitizeInput(key);
                localStorage.removeItem(sanitizedKey);
            } catch (e) {
                console.error('Failed to remove item from localStorage:', e);
            }
        },

        clear: () => {
            try {
                localStorage.clear();
            } catch (e) {
                console.error('Failed to clear localStorage:', e);
            }
        },
    };
}

export function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

export function generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        token += chars[array[i] % chars.length];
    }
    return token;
}
