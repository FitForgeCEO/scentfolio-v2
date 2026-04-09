import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface Milestone {
  id: string
  icon: string
  title: string
  description: string
  threshold: number
  category: 'collection' | 'wears' | 'reviews' | 'social' | 'exploration'
  achieved: boolean
  achievedDate: string | null
  progress: number
}

const MILESTONE_DEFS: Omit<Milestone, 'achieved' | 'achievedDate' | 'progress'>[] = [
  // Collection milestones
  { id: 'col-1', icon: 'water_drop', title: 'First Bottle', description: 'Add your first fragrance', threshold: 1, category: 'collection' },
  { id: 'col-5', icon: 'collections_bookmark', title: 'Starting Out', description: 'Own 5 fragrances', threshold: 5, category: 'collection' },
  { id: 'col-10', icon: 'shelves', title: 'Double Digits', description: 'Own 10 fragrances', threshold: 10, category: 'collection' },
  { id: 'col-25', icon: 'inventory_2', title: 'Enthusiast', description: 'Own 25 fragrances', threshold: 25, category: 'collection' },
  { id: 'col-50', icon: 'diamond', title: 'Connoisseur', description: 'Own 50 fragrances', threshold: 50, category: 'collection' },
  { id: 'col-100', icon: 'emoji_events', title: 'Century Club', description: 'Own 100 fragrances', threshold: 100, category: 'collection' },
  { id: 'col-250', icon: 'workspace_premium', title: 'Legendary Collector', description: 'Own 250 fragrances', threshold: 250, category: 'collection' },

  // Wear milestones
  { id: 'wear-1', icon: 'checkroom', title: 'First Wear', description: 'Log your first wear', threshold: 1, category: 'wears' },
  { id: 'wear-10', icon: 'local_fire_department', title: 'Getting Into It', description: 'Log 10 wears', threshold: 10, category: 'wears' },
  { id: 'wear-50', icon: 'whatshot', title: 'Daily Spritzer', description: 'Log 50 wears', threshold: 50, category: 'wears' },
  { id: 'wear-100', icon: 'military_tech', title: 'Dedicated Wearer', description: 'Log 100 wears', threshold: 100, category: 'wears' },
  { id: 'wear-365', icon: 'auto_awesome', title: 'Year of Scent', description: 'Log 365 wears', threshold: 365, category: 'wears' },

  // Review milestones
  { id: 'rev-1', icon: 'rate_review', title: 'First Review', description: 'Write your first review', threshold: 1, category: 'reviews' },
  { id: 'rev-10', icon: 'edit_note', title: 'Vocal Critic', description: 'Write 10 reviews', threshold: 10, category: 'reviews' },
  { id: 'rev-25', icon: 'school', title: 'Trusted Reviewer', description: 'Write 25 reviews', threshold: 25, category: 'reviews' },
  { id: 'rev-50', icon: 'psychology', title: 'Expert Nose', description: 'Write 50 reviews', threshold: 50, category: 'reviews' },

  // Social milestones
  { id: 'fol-1', icon: 'person_add', title: 'First Follower', description: 'Get your first follower', threshold: 1, category: 'social' },
  { id: 'fol-10', icon: 'groups', title: 'Growing Community', description: 'Get 10 followers', threshold: 10, category: 'social' },
  { id: 'fol-50', icon: 'diversity_3', title: 'Influencer', description: 'Get 50 followers', threshold: 50, category: 'social' },

  // Exploration milestones
  { id: 'brand-5', icon: 'storefront', title: 'Brand Explorer', description: 'Own from 5 different brands', threshold: 5, category: 'exploration' },
  { id: 'brand-15', icon: 'travel_explore', title: 'World of Scent', description: 'Own from 15 different brands', threshold: 15, category: 'exploration' },
  { id: 'fam-5', icon: 'category', title: 'Family Sampler', description: 'Own from 5 note families', threshold: 5, category: 'exploration' },
]

export function useMilestones() {
  const { user } = useAuth()
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    Promise.all([
      supabase.from('user_collections').select('fragrance_id, fragrance:fragrances(brand, note_family)', { count: 'exact' }).eq('user_id', user.id).eq('status', 'own'),
      supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
    ]).then(([collRes, wearRes, reviewRes, followerRes]) => {
      const collCount = collRes.count ?? 0
      const wearCount = wearRes.count ?? 0
      const reviewCount = reviewRes.count ?? 0
      const followerCount = followerRes.count ?? 0

      // Count unique brands and families
      type CollRow = { fragrance_id: string; fragrance: { brand: string; note_family: string | null } | null }
      const collData = (collRes.data ?? []) as unknown as CollRow[]
      const brands = new Set<string>()
      const families = new Set<string>()
      for (const row of collData) {
        if (row.fragrance) {
          brands.add(row.fragrance.brand)
          if (row.fragrance.note_family) families.add(row.fragrance.note_family)
        }
      }

      const getProgress = (def: typeof MILESTONE_DEFS[0]): number => {
        switch (def.category) {
          case 'collection': return collCount
          case 'wears': return wearCount
          case 'reviews': return reviewCount
          case 'social': return followerCount
          case 'exploration':
            if (def.id.startsWith('brand-')) return brands.size
            if (def.id.startsWith('fam-')) return families.size
            return 0
          default: return 0
        }
      }

      const computed: Milestone[] = MILESTONE_DEFS.map(def => {
        const progress = getProgress(def)
        return {
          ...def,
          achieved: progress >= def.threshold,
          achievedDate: progress >= def.threshold ? new Date().toISOString() : null,
          progress,
        }
      })

      setMilestones(computed)
      setLoading(false)
    })
  }, [user])

  const achieved = milestones.filter(m => m.achieved)
  const upcoming = milestones.filter(m => !m.achieved)
  const categories = [...new Set(MILESTONE_DEFS.map(d => d.category))]

  return { milestones, achieved, upcoming, categories, loading }
}
