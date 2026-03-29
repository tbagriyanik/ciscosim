/**
 * HTTP Caching Headers Configuration
 * Configures cache headers for static assets
 * Sets appropriate cache durations based on asset type
 */

export interface CacheHeaderConfig {
    assetType: 'html' | 'css' | 'js' | 'image' | 'font' | 'other';
    maxAge: number; // in seconds
    sMaxAge?: number; // shared cache max age
    immutable?: boolean;
    public?: boolean;
    private?: boolean;
}

export interface CacheHeaderResult {
    'Cache-Control': string;
    'ETag'?: string;
    'Last-Modified'?: string;
    'Vary'?: string;
}

/**
 * Default cache durations for different asset types
 */
const DEFAULT_CACHE_DURATIONS: Record<string, number> = {
    html: 3600, // 1 hour - HTML changes frequently
    css: 31536000, // 1 year - CSS is versioned
    js: 31536000, // 1 year - JS is versioned
    image: 31536000, // 1 year - Images are versioned
    font: 31536000, // 1 year - Fonts are versioned
    other: 86400, // 1 day - Default
};

/**
 * HttpCachingHeaders - Manages HTTP caching headers for assets
 */
export class HttpCachingHeaders {
    private config: Map<string, CacheHeaderConfig> = new Map();

    constructor() {
        this.initializeDefaults();
    }

    /**
     * Initialize default cache configurations
     */
    private initializeDefaults(): void {
        const assetTypes: Array<'html' | 'css' | 'js' | 'image' | 'font' | 'other'> = [
            'html',
            'css',
            'js',
            'image',
            'font',
            'other',
        ];

        assetTypes.forEach((type) => {
            this.config.set(type, {
                assetType: type,
                maxAge: DEFAULT_CACHE_DURATIONS[type],
                immutable: type !== 'html',
                public: true,
            });
        });
    }

    /**
     * Get cache headers for asset type
     */
    public getCacheHeaders(assetType: string): CacheHeaderResult {
        const config = this.config.get(assetType) || this.config.get('other')!;
        return this.buildCacheControlHeader(config);
    }

    /**
     * Get cache headers for file path
     */
    public getCacheHeadersByPath(filePath: string): CacheHeaderResult {
        const assetType = this.detectAssetType(filePath);
        return this.getCacheHeaders(assetType);
    }

    /**
     * Build Cache-Control header string
     */
    private buildCacheControlHeader(config: CacheHeaderConfig): CacheHeaderResult {
        const parts: string[] = [];

        // Public/Private
        if (config.private) {
            parts.push('private');
        } else if (config.public !== false) {
            parts.push('public');
        }

        // Max age
        parts.push(`max-age=${config.maxAge}`);

        // Shared cache max age
        if (config.sMaxAge !== undefined) {
            parts.push(`s-maxage=${config.sMaxAge}`);
        }

        // Immutable
        if (config.immutable) {
            parts.push('immutable');
        }

        return {
            'Cache-Control': parts.join(', '),
            'Vary': 'Accept-Encoding',
        };
    }

    /**
     * Detect asset type from file path
     */
    private detectAssetType(
        filePath: string
    ): 'html' | 'css' | 'js' | 'image' | 'font' | 'other' {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';

        switch (ext) {
            case 'html':
            case 'htm':
                return 'html';
            case 'css':
                return 'css';
            case 'js':
            case 'mjs':
                return 'js';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'svg':
                return 'image';
            case 'woff':
            case 'woff2':
            case 'ttf':
            case 'otf':
            case 'eot':
                return 'font';
            default:
                return 'other';
        }
    }

    /**
     * Set custom cache configuration for asset type
     */
    public setCustomConfig(
        assetType: string,
        config: Partial<CacheHeaderConfig>
    ): void {
        const existing = this.config.get(assetType) || {
            assetType: assetType as any,
            maxAge: DEFAULT_CACHE_DURATIONS['other'],
        };

        this.config.set(assetType, {
            ...existing,
            ...config,
            assetType: existing.assetType,
        });
    }

    /**
     * Get all configured asset types
     */
    public getConfiguredTypes(): string[] {
        return Array.from(this.config.keys());
    }
}

/**
 * Global HTTP caching headers instance
 */
let headersInstance: HttpCachingHeaders | null = null;

/**
 * Get global HTTP caching headers instance
 */
export function getHttpCachingHeaders(): HttpCachingHeaders {
    if (!headersInstance) {
        headersInstance = new HttpCachingHeaders();
    }
    return headersInstance;
}

/**
 * Middleware for Next.js to set cache headers
 */
export function createCacheHeadersMiddleware() {
    const headers = getHttpCachingHeaders();

    return (filePath: string): CacheHeaderResult => {
        return headers.getCacheHeadersByPath(filePath);
    };
}
