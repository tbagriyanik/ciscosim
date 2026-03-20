// Service Worker for Network Simulator Offline Functionality
const CACHE_NAME = 'netsim-v1';
const STATIC_CACHE = 'netsim-static-v1';
const DYNAMIC_CACHE = 'netsim-dynamic-v1';

// Assets to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.svg',
  '/icon-512x512.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Clearing old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests - let them fail gracefully
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response since it can only be consumed once
            const responseToCache = response.clone();

            // Cache dynamic content for offline use
            if (shouldCacheDynamic(event.request)) {
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }

            return response;
          })
          .catch(() => {
            // If both cache and network fail, try to serve offline page
            if (event.request.destination === 'document') {
              return caches.match('/');
            }

            // For other requests, just fail
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Determine if a request should be cached dynamically
function shouldCacheDynamic(request) {
  // Cache pages, CSS, JS, and images
  const cacheableTypes = [
    'document',
    'script',
    'style',
    'image'
  ];

  return cacheableTypes.includes(request.destination) ||
    request.url.includes('.css') ||
    request.url.includes('.js') ||
    request.url.includes('.png') ||
    request.url.includes('.jpg') ||
    request.url.includes('.jpeg') ||
    request.url.includes('.gif') ||
    request.url.includes('.svg') ||
    request.url.includes('.ico');
}

// Handle background sync for when connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Sync data with server when connection is restored
async function syncData() {
  try {
    // Get all offline data from IndexedDB or localStorage
    // and send to server
    console.log('Service Worker: Syncing data...');

    // This would be implemented based on your specific sync needs
    // For example, syncing saved projects, settings, etc.

    return true;
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
    return false;
  }
}

// Handle push notifications (optional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: '/icon-192x192.svg',
      badge: '/icon-192x192.svg',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

console.log('Service Worker: Loaded');
