import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Fragrance } from '@/types/database'

export interface BrandStats {
  brand: string
  count: number
  avgRating: number | null
  topFamily: string | null
  imageUrl: string | null
  fragranceIds: string[]
}

export type BrandSortOption = 'most' | 'alpha' | 'rating'

interface CollectionItem {
  fragrance_id: string
  personal_rating: number | null
  status: string
  fragrance: Fragrance | null
}

export function useBrandExplorer() {
  const { user } = useAuth()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<BrandSortOption>('most')
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

  const brands = useMemo(() => {
    const map = new Map<string, {
      count: number
      ratings: number[]
      families: Map<string, number>
      imageUrl: string | null
      fragranceIds: string[]
    }>()

    for (const item of items) {
      const f = item.fragrance
      if (!f) continue
      const brand = f.brand

      if (!map.has(brand)) {
        map.set(brand, { count: 0, ratings: [], families: new Map(), imageUrl: null, fragranceIds: [] })
      }
      const entry = map.get(brand)!
      entry.count++
      entry.fragranceIds.push(f.id)

      const rating = item.personal_rating ?? (f.rating ? Number(f.rating) : null)
      if (rating && rating > 0) entry.ratings.push(rating)

      if (f.note_family) {
        entry.families.set(f.note_family, (entry.families.get(f.note_family) ?? 0) + 1)
      }

      if (!entry.imageUrl && f.image_url) entry.imageUrl = f.image_url
    }

    const result: BrandStats[] = []
    for (const [brand, entry] of map.entries()) {
      const avgRating = entry.ratings.length > 0
        ? Math.round((entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length) * 10) / 10
        : null

      let topFamily: string | null = null
      let topFamilyCount = 0
      for (const [fam, cnt] of entry.families.entries()) {
        if (cnt > topFamilyCount) { topFamily = fam; topFamilyCount = cnt }
      }

      result.push({ brand, count: entry.count, avgRating, topFamily, imageUrl: entry.imageUrl, fragranceIds: entry.fragranceIds })
    }

    // Apply search filter
    let filtered = result
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = result.filter(b => b.brand.toLowerCase().includes(q))
    }

    // Apply sort
    switch (sort) {
      case 'most':
        filtered.sort((a, b) => b.count - a.count)
        break
      case 'alpha':
        filtered.sort((a, b) => a.brand.localeCompare(b.brand))
        break
      case 'rating':
        filtered.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
        break
    }

    return filtered
  }, [items, sort, search])

  const totalBrands = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      if (item.fragrance) set.add(item.fragrance.brand)
    }
    return set.size
  }, [items])

  return { brands, loading, sort, setSort, search, setSearch, totalBrands, totalFragrances: items.length }
}

export function useBrandFragrances(brand: string | null) {
  const { user } = useAuth()
  const [fragrances, setFragrances] = useState<(Fragrance & { personal_rating: number | null; date_added: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !brand) { setLoading(false); return }
    setLoading(true)

    supabase
      .from('user_collections')
      .select('fragrance_id, personal_rating, date_added, status, fragrance:fragrances(*)')
      .eq('user_id', user.id)
      .eq('status', 'own')
      .then(({ data }) => {
        type Row = { fragrance_id: string; personal_rating: number | null; date_added: string; status: string; fragrance: Fragrance | null }
        const rows = (data ?? []) as unknown as Row[]
        const matched = rows
          .filter(r => r.fragrance && r.fragrance.brand === brand)
          .map(r => ({ ...r.fragrance!, personal_rating: r.personal_rating, date_added: r.date_added }))
          .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0))
        setFragrances(matched)
        setLoading(false)
      })
  }, [user, brand])

  return { fragrances, loading }
}
