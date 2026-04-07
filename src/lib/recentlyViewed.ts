const STORAGE_KEY = 'scentfolio-recently-viewed'
const MAX_ITEMS = 12

interface RecentItem {
  id: string
  name: string
  brand: string
  image_url: string | null
  viewedAt: number
}

export function getRecentlyViewed(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentItem[]
  } catch { return [] }
}

export function addRecentlyViewed(item: Omit<RecentItem, 'viewedAt'>) {
  const existing = getRecentlyViewed()
  const filtered = existing.filter((r) => r.id !== item.id)
  const updated = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function clearRecentlyViewed() {
  localStorage.removeItem(STORAGE_KEY)
}
