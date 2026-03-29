// Image optimization components and utilities

// Optimized Device Icon
export {
    OptimizedDeviceIcon,
    LazyOptimizedDeviceIcon,
    EagerOptimizedDeviceIcon,
    type OptimizedDeviceIconProps,
} from './OptimizedDeviceIcon';

// Responsive Image
export {
    ResponsiveImage,
    LazyResponsiveImage,
    EagerResponsiveImage,
    ResponsiveImageWithBreakpoints,
    type ResponsiveImageProps,
} from './ResponsiveImage';

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
