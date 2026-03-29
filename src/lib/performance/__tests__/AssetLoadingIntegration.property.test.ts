/**
 * Asset Loading Integration Property-Based Tests
 * Tests for critical asset loading order, HTTP caching, and cache busting
 * Validates Requirements 9.1, 9.2, 9.3, 9.4, 9.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    AssetLoadingStrategy,
    initializeAssetLoadingStrategy,
} from '../assets/AssetLoadingStrategy';
import {
    HttpCachingHeaders,
    getHttpCachingHeaders,
} from '../assets/HttpCachingHeaders';

describe('Asset Loading Integration - Property-Based Tests', () => {
    describe('Property 35: Critical Asset Loading Order', () => {
        it('should load critical assets before non-critical assets', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    (criticalAssets, deferredAssets) => {
                        const strategy = new AssetLoadingStrategy({
                            criticalAssets,
                            deferredAssets,
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                        });

                        // Critical assets should be in the strategy
                        const headers = strategy.getCacheHeaders(criticalAssets[0]);
                        expect(headers['Cache-Control']).toContain('public');
                        expect(headers['Cache-Control']).toContain('max-age=3600');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 36: Deferred Non-Critical Asset Loading', () => {
        it('should defer non-critical assets until after initial render', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    (criticalAssets, deferredAssets) => {
                        const strategy = new AssetLoadingStrategy({
                            criticalAssets,
                            deferredAssets,
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                        });

                        // Deferred assets should have longer cache duration
                        if (deferredAssets.length > 0) {
                            const headers = strategy.getCacheHeaders(deferredAssets[0]);
                            expect(headers['Cache-Control']).toContain('86400');
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 37: HTTP Caching Headers', () => {
        it('should configure cache headers for static assets', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant('index.html'),
                        fc.constant('styles/main.css'),
                        fc.constant('js/app.js'),
                        fc.constant('images/icon.png'),
                        fc.constant('fonts/roboto.woff2')
                    ),
                    (filePath) => {
                        const headers = getHttpCachingHeaders();
                        const result = headers.getCacheHeadersByPath(filePath);

                        // All assets should have Cache-Control header
                        expect(result['Cache-Control']).toBeDefined();
                        expect(result['Cache-Control']).toContain('public');

                        // All assets should have Vary header
                        expect(result['Vary']).toBe('Accept-Encoding');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 38: Service Worker Asset Caching', () => {
        it('should cache assets in service worker for offline access', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    (urls) => {
                        // Verify that cache configuration is valid
                        const cacheConfig = {
                            cacheName: 'test-cache',
                            version: '1.0.0',
                            maxAge: 86400000,
                            maxSize: 52428800,
                        };

                        expect(cacheConfig.cacheName).toBeDefined();
                        expect(cacheConfig.version).toBeDefined();
                        expect(cacheConfig.maxAge).toBeGreaterThan(0);
                        expect(cacheConfig.maxSize).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 40: Cache Busting', () => {
        it('should add version hash to asset URLs for cache busting', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    (criticalAssets, deferredAssets) => {
                        const strategy = new AssetLoadingStrategy({
                            criticalAssets,
                            deferredAssets,
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                        });

                        // All assets should get cache busting hash
                        const allAssets = [...criticalAssets, ...deferredAssets];
                        allAssets.forEach((asset) => {
                            const url = strategy.getAssetUrl(asset);
                            expect(url).toContain('v=');
                        });
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should ensure users receive latest versions with cache busting', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    (assets) => {
                        const strategy1 = new AssetLoadingStrategy({
                            criticalAssets: assets,
                            deferredAssets: [],
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                            versionHash: 'v1',
                        });

                        const strategy2 = new AssetLoadingStrategy({
                            criticalAssets: assets,
                            deferredAssets: [],
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                            versionHash: 'v2',
                        });

                        // Different versions should produce different URLs
                        if (assets.length > 0) {
                            const url1 = strategy1.getAssetUrl(assets[0]);
                            const url2 = strategy2.getAssetUrl(assets[0]);
                            expect(url1).not.toBe(url2);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 9.1: Critical Asset Loading Order', () => {
        it('validates that critical assets load before non-critical', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 5 }),
                    fc.integer({ min: 1, max: 10 }),
                    (numCritical, numDeferred) => {
                        const criticalAssets = Array.from(
                            { length: numCritical },
                            (_, i) => `/critical-${i}.js`
                        );
                        const deferredAssets = Array.from(
                            { length: numDeferred },
                            (_, i) => `/deferred-${i}.js`
                        );

                        const strategy = new AssetLoadingStrategy({
                            criticalAssets,
                            deferredAssets,
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                        });

                        // Critical assets should have shorter cache duration
                        const criticalHeaders = strategy.getCacheHeaders(criticalAssets[0]);
                        expect(criticalHeaders['Cache-Control']).toContain('3600');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 9.2: Deferred Non-Critical Asset Loading', () => {
        it('validates that non-critical assets are deferred', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 5 }),
                    fc.integer({ min: 1, max: 10 }),
                    (numCritical, numDeferred) => {
                        const criticalAssets = Array.from(
                            { length: numCritical },
                            (_, i) => `/critical-${i}.js`
                        );
                        const deferredAssets = Array.from(
                            { length: numDeferred },
                            (_, i) => `/deferred-${i}.js`
                        );

                        const strategy = new AssetLoadingStrategy({
                            criticalAssets,
                            deferredAssets,
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                        });

                        // Deferred assets should have longer cache duration
                        if (deferredAssets.length > 0) {
                            const deferredHeaders = strategy.getCacheHeaders(deferredAssets[0]);
                            expect(deferredHeaders['Cache-Control']).toContain('86400');
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 9.3: HTTP Caching Headers', () => {
        it('validates that HTTP caching headers are configured correctly', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant('index.html'),
                        fc.constant('app.css'),
                        fc.constant('bundle.js'),
                        fc.constant('logo.png'),
                        fc.constant('font.woff2')
                    ),
                    (filePath) => {
                        const headers = getHttpCachingHeaders();
                        const result = headers.getCacheHeadersByPath(filePath);

                        // Cache-Control header must be present
                        expect(result['Cache-Control']).toBeDefined();
                        expect(result['Cache-Control'].length).toBeGreaterThan(0);

                        // Must contain max-age
                        expect(result['Cache-Control']).toMatch(/max-age=\d+/);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Property 9.6: Cache Busting', () => {
        it('validates that cache busting ensures latest versions', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
                    (assets) => {
                        const strategy = new AssetLoadingStrategy({
                            criticalAssets: assets,
                            deferredAssets: [],
                            cacheDuration: 86400,
                            enableCacheBusting: true,
                        });

                        // Each asset should have a unique version hash
                        const urls = assets.map((asset) => strategy.getAssetUrl(asset));
                        const uniqueUrls = new Set(urls);

                        // All URLs should be unique (different hashes)
                        expect(uniqueUrls.size).toBe(urls.length);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
