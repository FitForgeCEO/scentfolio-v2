import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Fragrance } from '@/types/database'

export interface FamilyStats {
  family: string
  count: number
  avgRating: number | null
  topBrands: string[]
  imageUrl: string | null
}

export type FamilySortOption = 'most' | 'alpha' | 'rating'

const FAMILY_ICONS: Record<string, string> = {
  Floral: 'local_florist',
  Woody: 'park',
  Oriental: 'auto_awesome',
  Fresh: 'air',
  Citrus: 'wb_sunny',
  Aromatic: 'spa',
  Gourmand: 'cake',
  Aquatic: 'water',
  Spicy: 'whatshot',
  Fruity: 'nutrition',
  Green: 'eco',
  Powdery: 'cloud',
  Musky: 'nights_stay',
  Chypre: 'forest',
  Fougere: 'grass',
  Leather: 'style',
}

export function getFamilyIcon(family: string): string {
  return FAMILY_ICONS[family] ?? 'category'
}

interface CollectionItem {
  fragrance_id: string
  personal_rating: number | null
  status: string
  fragrance: Fragrance | null
}

export function useFamilyExplorer() {
  const { user } = useAuth()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<FamilySortOption>('most')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }

    supabase
      .from('user_collections')
      .select('fragrance_id, personal_rating, status, fragrance:fragrances(id, brand, name, image_url, note_family, rating)')
      .eq('user_id', user.id)
      .eq('status', 'own')
      .then(({ data }) => {
        setItems((data ?? []) as unknown as CollectionItem[])
        setLoading(false)
      })
  }, [user])

  const families = useMemo(() => {
    const map = new Map<string, {
      count: number
      ratings: number[]
      brands: Map<string, number>
      imageUrl: string | null
    }>()

    for (const item of items) {
      const f = item.fragrance
      if (!f || !f.note_family) continue
      const family = f.note_family

      if (!map.has(family)) {
        map.set(family, { count: 0, ratings: [], brands: new Map(), imageUrl: null })
      }
      const entry = map.get(family)!
      entry.count++

      const rating = item.personal_rating ?? (f.rating ? Number(f.rating) : null)
      if (rating && rating > 0) entry.ratings.push(rating)

      entry.brands.set(f.brand, (entry.brands.get(f.brand) ?? 0) + 1)

      if (!entry.imageUrl && f.image_url) entry.imageUrl = f.image_url
    }

    const result: FamilyStats[] = []
    for (const [family, entry] of map.entries()) {
      const avgRating = entry.ratings.length > 0
        ? Math.round((entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length) * 10) / 10
        : null

      const topBrands = [...entry.brands.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([b]) => b)

      result.push({ family, count: entry.count, avgRating, topBrands, imageUrl: entry.imageUrl })
    }

    // Search filter
    let filtered = result
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = result.filter(f => f.family.toLowerCase().includes(q))
    }

    // Sort
    switch (sort) {
      case 'most':
        filtered.sort((a, b) => b.count - a.count)
        break
      case 'alpha':
        filtered.sort((a, b) => a.family.localeCompare(b.family))
        break
      case 'rating':
        filtered.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
        break
    }

    return filtered
  }, [items, sort, search])

  const totalFamilies = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      if (item.fragrance?.note_family) set.add(item.fragrance.note_family)
    }
    return set.size
  }, [items])

  return { families, loading, sort, setSort, search, setSearch, totalFamilies, totalFragrances: items.length }
}

export function useFamilyFragrances(family: string | null) {
  const { user } = useAuth()
  const [fragrances, setFragrances] = useState<(Fragrance & { personal_rating: number | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !family) { setLoading(false); return }
    setLoading(true)

    supabase
      .from('user_collections')
      .select('fragrance_id, personal_rating, status, fragrance:fragrances(*)')
      .eq('user_id', user.id)
      .eq('status', 'own')
      .then(({ data }) => {
        type Row = { fragrance_id: string; personal_rating: number | null; status: string; fragrance: Fragrance | null }
        const rows = (data ?? []) as unknown as Row[]
        const matched = rows
          .filter(r => r.fragrance && r.fragrance.note_family === family)
          .map(r => ({ ...r.fragrance!, personal_rating: r.personal_rating }))
          .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0))
        setFragrances(matched)
        setLoading(false)
      })
  }, [user, family])

  return { fragrances, loading }
}
