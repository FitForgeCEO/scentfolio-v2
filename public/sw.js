const CACHE_NAME = 'scentfolio-v1'
const STATIC_ASSETS = ['/', '/manifest.json']

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network first for API, cache first for static assets and images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Network-first for Supabase API
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Cache-first for Google Fonts and fragrance images
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('googleusercontent.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            return res
          })
      )
    )
    return
  }

  // Network-first for same-origin navigation, cache-first for assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    )
    return
  }

  // Default: try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})
