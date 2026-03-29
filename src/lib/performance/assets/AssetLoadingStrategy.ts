/**
 * Asset Loading Strategy
 * Manages critical asset loading order, HTTP caching, and cache busting
 * Ensures HTML, CSS, core JS load first, with non-critical assets deferred
 */

export interface AssetLoadingConfig {
    criticalAssets: string[];
    deferredAssets: string[];
    cacheDuration: number; // in seconds
    enableCacheBusting: boolean;
    versionHash?: string;
}

export interface CacheHeader {
    'Cache-Control': string;
    'ETag'?: string;
    'Last-Modified'?: string;
}

/**
 * AssetLoadingStrategy - Manages asset loading order and caching
 */
export class AssetLoadingStrategy {
    private config: AssetLoadingConfig;
    private loadedAssets: Set<string> = new Set();
    private assetVersions: Map<string, string> = new Map();

    constructor(config: AssetLoadingConfig) {
        this.config = config;
        this.initializeVersions();
    }

    /**
     * Initialize asset versions for cache busting
     */
    private initializeVersions(): void {
        const versionHash = this.config.versionHash || this.generateVersionHash();

        // Add version hash to all assets
        [...this.config.criticalAssets, ...this.config.deferredAssets].forEach(
            (asset) => {
                this.assetVersions.set(asset, versionHash);
            }
        );
    }

    /**
     * Generate version hash based on current timestamp
     */
    private generateVersionHash(): string {
        return Date.now().toString(36);
    }

    /**
     * Get asset URL with cache busting hash
     */
    public getAssetUrl(assetPath: string): string {
        if (!this.config.enableCacheBusting) {
            return assetPath;
        }

        // Get or generate version for this asset
        let version = this.assetVersions.get(assetPath);
        if (!version) {
            version = this.generateVersionHash();
            this.assetVersions.set(assetPath, version);
        }

        const separator = assetPath.includes('?') ? '&' : '?';
        return `${assetPath}${separator}v=${version}`;
    }

    /**
     * Load critical assets (HTML, CSS, core JS)
     * These should load first and block rendering
     */
    public async loadCriticalAssets(): Promise<void> {
        const promises = this.config.criticalAssets.map((asset) =>
            this.loadAsset(asset, 'critical')
        );

        await Promise.all(promises);
    }

    /**
     * Load deferred assets (non-critical)
     * These load after initial render
     */
    public async loadDeferredAssets(): Promise<void> {
        // Use requestIdleCallback if available, otherwise use setTimeout
        if ('requestIdleCallback' in window) {
            return new Promise((resolve) => {
                requestIdleCallback(() => {
                    this.loadDeferredAssetsInternal().then(resolve);
                });
            });
        } else {
            // Fallback: defer with setTimeout
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.loadDeferredAssetsInternal().then(resolve);
                }, 0);
            });
        }
    }

    /**
     * Internal method to load deferred assets
     */
    private async loadDeferredAssetsInternal(): Promise<void> {
        const promises = this.config.deferredAssets.map((asset) =>
            this.loadAsset(asset, 'deferred')
        );

        await Promise.all(promises);
    }

    /**
     * Load a single asset
     */
    private async loadAsset(
        assetPath: string,
        priority: 'critical' | 'deferred'
    ): Promise<void> {
        if (this.loadedAssets.has(assetPath)) {
            return;
        }

        const url = this.getAssetUrl(assetPath);

        try {
            const response = await fetch(url, {
                priority: priority === 'critical' ? 'high' : 'low',
            });

            if (!response.ok) {
                throw new Error(`Failed to load asset: ${assetPath}`);
            }

            this.loadedAssets.add(assetPath);
        } catch (error) {
            console.error(`Error loading asset ${assetPath}:`, error);
            throw error;
        }
    }

    /**
     * Get HTTP cache headers for static assets
     */
    public getCacheHeaders(assetPath: string): CacheHeader {
        const isCritical = this.config.criticalAssets.includes(assetPath);
        const duration = isCritical ? 3600 : this.config.cacheDuration; // 1 hour for critical, configurable for others

        return {
            'Cache-Control': `public, max-age=${duration}, immutable`,
            'ETag': this.assetVersions.get(assetPath),
        };
    }

    /**
     * Check if asset is loaded
     */
    public isAssetLoaded(assetPath: string): boolean {
        return this.loadedAssets.has(assetPath);
    }

    /**
     * Get all loaded assets
     */
    public getLoadedAssets(): string[] {
        return Array.from(this.loadedAssets);
    }

    /**
     * Reset loaded assets
     */
    public reset(): void {
        this.loadedAssets.clear();
    }
}

/**
 * Global asset loading strategy instance
 */
let strategyInstance: AssetLoadingStrategy | null = null;

/**
 * Initialize global asset loading strategy
 */
export function initializeAssetLoadingStrategy(
    config: AssetLoadingConfig
): AssetLoadingStrategy {
    strategyInstance = new AssetLoadingStrategy(config);
    return strategyInstance;
}

/**
 * Get global asset loading strategy
 */
export function getAssetLoadingStrategy(): AssetLoadingStrategy {
    if (!strategyInstance) {
        // Default configuration
        strategyInstance = new AssetLoadingStrategy({
            criticalAssets: [
                '/index.html',
                '/styles/main.css',
                '/js/core.js',
            ],
            deferredAssets: [
                '/js/terminal.js',
                '/js/config-panel.js',
                '/js/security-panel.js',
            ],
            cacheDuration: 86400, // 24 hours
            enableCacheBusting: true,
        });
    }
    return strategyInstance;
}
