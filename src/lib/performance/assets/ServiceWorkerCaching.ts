/**
 * Service Worker Caching System
 * Manages asset caching in service worker for offline access
 * Implements cache update strategy and versioning
 */

export interface CacheConfig {
    cacheName: string;
    version: string;
    maxAge: number; // in milliseconds
    maxSize: number; // in bytes
}

export interface CacheEntry {
    url: string;
    timestamp: number;
    size: number;
}

/**
 * ServiceWorkerCaching - Manages service worker asset caching
 */
export class ServiceWorkerCaching {
    private config: CacheConfig;
    private cacheEntries: Map<string, CacheEntry> = new Map();
    private isSupported: boolean;

    constructor(config: CacheConfig) {
        this.config = config;
        this.isSupported = 'caches' in window && 'serviceWorker' in navigator;
    }

    /**
     * Register service worker
     */
    public async registerServiceWorker(swPath: string): Promise<ServiceWorkerRegistration | null> {
        if (!this.isSupported) {
            console.warn('[ServiceWorkerCaching] Service Workers not supported');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.register(swPath, {
                scope: '/',
            });
            console.log('[ServiceWorkerCaching] Service Worker registered');
            return registration;
        } catch (error) {
            console.error('[ServiceWorkerCaching] Failed to register Service Worker:', error);
            return null;
        }
    }

    /**
     * Cache asset
     */
    public async cacheAsset(url: string): Promise<boolean> {
        if (!this.isSupported) {
            return false;
        }

        try {
            const cache = await caches.open(this.getCacheName());
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch asset: ${url}`);
            }

            // Check cache size before adding
            const size = parseInt(response.headers.get('content-length') || '0', 10);
            if (!this.canAddToCache(size)) {
                await this.evictOldestEntry();
            }

            await cache.put(url, response.clone());

            // Track cache entry
            this.cacheEntries.set(url, {
                url,
                timestamp: Date.now(),
                size,
            });

            return true;
        } catch (error) {
            console.error(`[ServiceWorkerCaching] Failed to cache asset ${url}:`, error);
            return false;
        }
    }

    /**
     * Cache multiple assets
     */
    public async cacheAssets(urls: string[]): Promise<boolean[]> {
        return Promise.all(urls.map((url) => this.cacheAsset(url)));
    }

    /**
     * Get cached asset
     */
    public async getCachedAsset(url: string): Promise<Response | null> {
        if (!this.isSupported) {
            return null;
        }

        try {
            const cache = await caches.open(this.getCacheName());
            const response = await cache.match(url);
            return response || null;
        } catch (error) {
            console.error(`[ServiceWorkerCaching] Failed to get cached asset ${url}:`, error);
            return null;
        }
    }

    /**
     * Update cache (remove old version, add new)
     */
    public async updateCache(url: string): Promise<boolean> {
        if (!this.isSupported) {
            return false;
        }

        try {
            // Remove old version
            const cache = await caches.open(this.getCacheName());
            await cache.delete(url);

            // Cache new version
            return this.cacheAsset(url);
        } catch (error) {
            console.error(`[ServiceWorkerCaching] Failed to update cache for ${url}:`, error);
            return false;
        }
    }

    /**
     * Clear cache
     */
    public async clearCache(): Promise<boolean> {
        if (!this.isSupported) {
            return false;
        }

        try {
            const cacheName = this.getCacheName();
            const deleted = await caches.delete(cacheName);
            this.cacheEntries.clear();
            return deleted;
        } catch (error) {
            console.error('[ServiceWorkerCaching] Failed to clear cache:', error);
            return false;
        }
    }

    /**
     * Get cache size
     */
    public async getCacheSize(): Promise<number> {
        let totalSize = 0;
        this.cacheEntries.forEach((entry) => {
            totalSize += entry.size;
        });
        return totalSize;
    }

    /**
     * Check if asset can be added to cache
     */
    private canAddToCache(size: number): boolean {
        const currentSize = Array.from(this.cacheEntries.values()).reduce(
            (sum, entry) => sum + entry.size,
            0
        );
        return currentSize + size <= this.config.maxSize;
    }

    /**
     * Evict oldest cache entry
     */
    private async evictOldestEntry(): Promise<void> {
        let oldestUrl: string | null = null;
        let oldestTime = Infinity;

        this.cacheEntries.forEach((entry, url) => {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestUrl = url;
            }
        });

        if (oldestUrl) {
            const cache = await caches.open(this.getCacheName());
            await cache.delete(oldestUrl);
            this.cacheEntries.delete(oldestUrl);
        }
    }

    /**
     * Get cache name with version
     */
    private getCacheName(): string {
        return `${this.config.cacheName}-v${this.config.version}`;
    }

    /**
     * Get cache entries
     */
    public getCacheEntries(): CacheEntry[] {
        return Array.from(this.cacheEntries.values());
    }

    /**
     * Check if service worker is supported
     */
    public isServiceWorkerSupported(): boolean {
        return this.isSupported;
    }
}

/**
 * Global service worker caching instance
 */
let cachingInstance: ServiceWorkerCaching | null = null;

/**
 * Initialize global service worker caching
 */
export function initializeServiceWorkerCaching(
    config: CacheConfig
): ServiceWorkerCaching {
    cachingInstance = new ServiceWorkerCaching(config);
    return cachingInstance;
}

/**
 * Get global service worker caching instance
 */
export function getServiceWorkerCaching(): ServiceWorkerCaching {
    if (!cachingInstance) {
        cachingInstance = new ServiceWorkerCaching({
            cacheName: 'network-simulator-cache',
            version: '1.0.0',
            maxAge: 86400000, // 24 hours
            maxSize: 52428800, // 50MB
        });
    }
    return cachingInstance;
}
