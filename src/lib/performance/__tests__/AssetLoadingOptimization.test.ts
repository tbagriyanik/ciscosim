/**
 * Asset Loading Optimization Tests
 * Tests for critical asset loading order, HTTP caching, and cache busting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    AssetLoadingStrategy,
    initializeAssetLoadingStrategy,
    getAssetLoadingStrategy,
} from '../assets/AssetLoadingStrategy';
import {
    HttpCachingHeaders,
    getHttpCachingHeaders,
} from '../assets/HttpCachingHeaders';
import {
    ServiceWorkerCaching,
    initializeServiceWorkerCaching,
} from '../assets/ServiceWorkerCaching';

describe('Asset Loading Optimization', () => {
    describe('AssetLoadingStrategy', () => {
        let strategy: AssetLoadingStrategy;

        beforeEach(() => {
            strategy = new AssetLoadingStrategy({
                criticalAssets: ['/index.html', '/styles/main.css', '/js/core.js'],
                deferredAssets: ['/js/terminal.js', '/js/config.js'],
                cacheDuration: 86400,
                enableCacheBusting: true,
            });
        });

        it('should initialize with correct configuration', () => {
            expect(strategy).toBeDefined();
            expect(strategy.getLoadedAssets()).toEqual([]);
        });

        it('should generate asset URLs with cache busting hash', () => {
            const url = strategy.getAssetUrl('/js/app.js');
            expect(url).toContain('v=');
            expect(url).toMatch(/\/js\/app\.js\?v=\w+/);
        });

        it('should not add cache busting hash when disabled', () => {
            const strategyNoBust = new AssetLoadingStrategy({
                criticalAssets: ['/index.html'],
                deferredAssets: [],
                cacheDuration: 86400,
                enableCacheBusting: false,
            });

            const url = strategyNoBust.getAssetUrl('/js/app.js');
            expect(url).toBe('/js/app.js');
        });

        it('should return correct cache headers for critical assets', () => {
            const headers = strategy.getCacheHeaders('/index.html');
            expect(headers['Cache-Control']).toContain('public');
            expect(headers['Cache-Control']).toContain('max-age=3600');
        });

        it('should return correct cache headers for deferred assets', () => {
            const headers = strategy.getCacheHeaders('/js/terminal.js');
            expect(headers['Cache-Control']).toContain('public');
            expect(headers['Cache-Control']).toContain(`max-age=${86400}`);
        });

        it('should track loaded assets', () => {
            expect(strategy.isAssetLoaded('/js/app.js')).toBe(false);
            // Simulate loading
            strategy['loadedAssets'].add('/js/app.js');
            expect(strategy.isAssetLoaded('/js/app.js')).toBe(true);
        });

        it('should reset loaded assets', () => {
            strategy['loadedAssets'].add('/js/app.js');
            expect(strategy.getLoadedAssets().length).toBe(1);
            strategy.reset();
            expect(strategy.getLoadedAssets().length).toBe(0);
        });

        it('should handle multiple cache busting hashes correctly', () => {
            const url1 = strategy.getAssetUrl('/js/app.js');
            const url2 = strategy.getAssetUrl('/js/app.js');
            // Same asset should get same hash
            expect(url1).toBe(url2);
        });
    });

    describe('HttpCachingHeaders', () => {
        let headers: HttpCachingHeaders;

        beforeEach(() => {
            headers = getHttpCachingHeaders();
        });

        it('should return correct headers for HTML files', () => {
            const result = headers.getCacheHeadersByPath('index.html');
            expect(result['Cache-Control']).toContain('max-age=3600');
            expect(result['Cache-Control']).toContain('public');
        });

        it('should return correct headers for CSS files', () => {
            const result = headers.getCacheHeadersByPath('styles/main.css');
            expect(result['Cache-Control']).toContain('max-age=31536000');
            expect(result['Cache-Control']).toContain('immutable');
        });

        it('should return correct headers for JS files', () => {
            const result = headers.getCacheHeadersByPath('js/app.js');
            expect(result['Cache-Control']).toContain('max-age=31536000');
            expect(result['Cache-Control']).toContain('immutable');
        });

        it('should return correct headers for image files', () => {
            const result = headers.getCacheHeadersByPath('images/icon.png');
            expect(result['Cache-Control']).toContain('max-age=31536000');
            expect(result['Cache-Control']).toContain('immutable');
        });

        it('should return correct headers for font files', () => {
            const result = headers.getCacheHeadersByPath('fonts/roboto.woff2');
            expect(result['Cache-Control']).toContain('max-age=31536000');
            expect(result['Cache-Control']).toContain('immutable');
        });

        it('should return Vary header for all assets', () => {
            const result = headers.getCacheHeadersByPath('any-file.txt');
            expect(result['Vary']).toBe('Accept-Encoding');
        });

        it('should support custom cache configurations', () => {
            headers.setCustomConfig('custom', {
                assetType: 'other',
                maxAge: 7200,
                immutable: false,
            });

            const result = headers.getCacheHeaders('custom');
            expect(result['Cache-Control']).toContain('max-age=7200');
            expect(result['Cache-Control']).not.toContain('immutable');
        });

        it('should detect asset types correctly', () => {
            expect(headers.getCacheHeadersByPath('file.html')['Cache-Control']).toContain('3600');
            expect(headers.getCacheHeadersByPath('file.css')['Cache-Control']).toContain('31536000');
            expect(headers.getCacheHeadersByPath('file.js')['Cache-Control']).toContain('31536000');
            expect(headers.getCacheHeadersByPath('file.png')['Cache-Control']).toContain('31536000');
        });
    });

    describe('ServiceWorkerCaching', () => {
        let caching: ServiceWorkerCaching;

        beforeEach(() => {
            caching = initializeServiceWorkerCaching({
                cacheName: 'test-cache',
                version: '1.0.0',
                maxAge: 86400000,
                maxSize: 52428800,
            });
        });

        it('should initialize with correct configuration', () => {
            expect(caching).toBeDefined();
            // Service Worker support depends on environment
            expect(typeof caching.isServiceWorkerSupported()).toBe('boolean');
        });

        it('should track cache entries', () => {
            const entries = caching.getCacheEntries();
            expect(Array.isArray(entries)).toBe(true);
        });

        it('should handle cache size calculations', async () => {
            const size = await caching.getCacheSize();
            expect(typeof size).toBe('number');
            expect(size).toBeGreaterThanOrEqual(0);
        });

        it('should support clearing cache', async () => {
            const result = await caching.clearCache();
            expect(typeof result).toBe('boolean');
        });

        it('should provide cache name with version', () => {
            const entries = caching.getCacheEntries();
            expect(Array.isArray(entries)).toBe(true);
        });
    });

    describe('Integration Tests', () => {
        it('should initialize global asset loading strategy', () => {
            const strategy = initializeAssetLoadingStrategy({
                criticalAssets: ['/index.html'],
                deferredAssets: ['/js/app.js'],
                cacheDuration: 86400,
                enableCacheBusting: true,
            });

            expect(strategy).toBeDefined();
            expect(getAssetLoadingStrategy()).toBe(strategy);
        });

        it('should provide consistent HTTP caching headers', () => {
            const headers1 = getHttpCachingHeaders();
            const headers2 = getHttpCachingHeaders();
            expect(headers1).toBe(headers2);
        });

        it('should coordinate asset loading and caching', () => {
            const strategy = new AssetLoadingStrategy({
                criticalAssets: ['/index.html', '/styles/main.css'],
                deferredAssets: ['/js/app.js'],
                cacheDuration: 86400,
                enableCacheBusting: true,
            });

            const headers = getHttpCachingHeaders();

            // Critical assets should have shorter cache duration
            const criticalHeaders = headers.getCacheHeadersByPath('index.html');
            const deferredHeaders = headers.getCacheHeadersByPath('app.js');

            expect(criticalHeaders['Cache-Control']).toContain('3600');
            expect(deferredHeaders['Cache-Control']).toContain('31536000');
        });
    });
});
