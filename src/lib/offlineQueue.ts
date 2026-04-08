/**
 * Offline queue for wear logs.
 * When the user logs a wear while offline, it's stored in IndexedDB
 * and synced when the connection is restored.
 */

const DB_NAME = 'scentfolio-offline'
const DB_VERSION = 1
const STORE_NAME = 'offline-wear-logs'

interface QueuedWearLog {
  id?: number
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Queue a wear log for later sync */
export async function queueWearLog(log: Omit<QueuedWearLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.add({ ...log, timestamp: Date.now() })

    // Request background sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready
      await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-wear-logs')
    }
  } catch {
    // IndexedDB not available — silently fail
    console.warn('Failed to queue offline wear log')
  }
}

/** Get count of pending offline logs */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

/** Manually flush the offline queue (called when back online) */
export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  let synced = 0
  let failed = 0

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    const logs: QueuedWearLog[] = await new Promise((resolve) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve([])
    })

    for (const log of logs) {
      try {
        const response = await fetch(log.url, {
          method: 'POST',
          headers: log.headers,
          body: JSON.stringify(log.body),
        })

        if (response.ok) {
          // Remove from queue
          const deleteTx = db.transaction(STORE_NAME, 'readwrite')
          if (log.id !== undefined) {
            deleteTx.objectStore(STORE_NAME).delete(log.id)
          }
          synced++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
  } catch {
    // IndexedDB not available
  }

  return { synced, failed }
}

/** Listen for online event and auto-flush */
export function setupOnlineSync(): void {
  window.addEventListener('online', async () => {
    const { synced } = await flushOfflineQueue()
    if (synced > 0) {
      // Dispatch a custom event so the UI can show a toast
      window.dispatchEvent(
        new CustomEvent('scentfolio:sync-complete', { detail: { synced } })
      )
    }
  })
}
