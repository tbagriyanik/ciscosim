// Image optimization components and utilities

// SVG Inlining Utilities
export {
    fetchSVG,
    clearSVGCache,
    getSVGCacheSize,
    inlineSVG,
    optimizeSVG,
    createInlineSVGElement,
    batchInlineSVGs,
    preloadSVGs,
    getSVGStats,
} from './svgInliner';

// Asset Loading Strategy
export {
    AssetLoadingStrategy,
    initializeAssetLoadingStrategy,
    getAssetLoadingStrategy,
    type AssetLoadingConfig,
    type CacheHeader,
} from './AssetLoadingStrategy';

// Service Worker Caching
export {
    ServiceWorkerCaching,
    initializeServiceWorkerCaching,
    getServiceWorkerCaching,
    type CacheConfig,
    type CacheEntry,
} from './ServiceWorkerCaching';

// HTTP Caching Headers
export {
    HttpCachingHeaders,
    getHttpCachingHeaders,
    createCacheHeadersMiddleware,
    type CacheHeaderConfig,
    type CacheHeaderResult,
} from './HttpCachingHeaders';
