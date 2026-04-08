const CACHE_VERSION = 'scentfolio-v3'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DATA_CACHE = `${CACHE_VERSION}-data`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
]

// Max items per cache to prevent unbounded growth
const MAX_DATA_ENTRIES = 50
const MAX_IMAGE_ENTRIES = 200

// ── Install ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate — clean old caches ────────────────────────────────────
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, DATA_CACHE, IMAGE_CACHE]
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !currentCaches.includes(k)).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Helper: trim cache to max size ─────────────────────────────────
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    await cache.delete(keys[0])
    return trimCache(cacheName, maxEntries)
  }
}

// ── Fetch strategies ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests (except for offline queue handling)
  if (event.request.method !== 'GET') return

  // ── Supabase API: Network-first, cache fallback ──
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(event.request, clone)
              trimCache(DATA_CACHE, MAX_DATA_ENTRIES)
            })
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // ── Fragrance images: Cache-first with network fallback ──
  if (
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('fragrantica') ||
    url.hostname.includes('parfumo') ||
    url.pathname.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(IMAGE_CACHE).then((cache) => {
                cache.put(event.request, clone)
                trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES)
              })
            }
            return res
          }).catch(() => new Response('', { status: 404 }))
      )
    )
    return
  }

  // ── Google Fonts: Cache-first ──
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const clone = res.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
            return res
          })
      )
    )
    return
  }

  // ── Navigation: Network-first with offline fallback ──
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
          return res
        })
        .catch(() => caches.match('/') || caches.match('/offline.html'))
    )
    return
  }

  // ── Static assets (JS/CSS chunks): Stale-while-revalidate ──
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return res
        })
        return cached || fetchPromise
      })
    )
    return
  }

  // ── Default: Network-first ──
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Push Notifications ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'ScentFolio', body: 'Check your collection!', icon: '/icons/icon-192x192.png' }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [],
    tag: data.tag || 'scentfolio-notification',
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ── Notification click ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen)
    })
  )
})

// ── Background Sync for offline wear logs ──────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-wear-logs') {
    event.waitUntil(syncOfflineWearLogs())
  }
})

async function syncOfflineWearLogs() {
  try {
    // Read queued wear logs from IndexedDB
    const db = await openOfflineDB()
    const tx = db.transaction('offline-wear-logs', 'readonly')
    const store = tx.objectStore('offline-wear-logs')
    const logs = await getAllFromStore(store)

    if (logs.length === 0) return

    // Try to sync each log
    for (const log of logs) {
      try {
        const response = await fetch(log.url, {
          method: 'POST',
          headers: log.headers,
          body: JSON.stringify(log.body),
        })
        if (response.ok) {
          // Remove synced log from IndexedDB
          const deleteTx = db.transaction('offline-wear-logs', 'readwrite')
          deleteTx.objectStore('offline-wear-logs').delete(log.id)
        }
      } catch {
        // Will retry on next sync
        break
      }
    }
  } catch {
    // IndexedDB not available or other error
  }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('scentfolio-offline', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('offline-wear-logs')) {
        db.createObjectStore('offline-wear-logs', { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
