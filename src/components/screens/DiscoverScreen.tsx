import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { findSimilarToCollection } from '@/lib/similarity'
import { FragranceListSkeleton } from '../ui/ContentSkeleton'
import type { Fragrance } from '@/types/database'

interface CollectionItem {
  fragrance: Fragrance | null
  personal_rating: number | null
}

interface Section {
  id: string
  title: string
  subtitle: string
  icon: string
  items: Fragrance[]
}

const NOTE_FAMILY_PICKS = ['Woody', 'Floral', 'Oriental', 'Fresh', 'Citrus', 'Aromatic', 'Gourmand'] as const

export function DiscoverScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFamily, setSelectedFamily] = useState<string>(NOTE_FAMILY_PICKS[0])

  useEffect(() => {
    fetchDiscovery()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchDiscovery() {
    const sects: Section[] = []

    // 1. Top rated overall
    const { data: topRated } = await supabase
      .from('fragrances')
      .select('*')
      .not('image_url', 'is', null)
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(10)

    if (topRated && topRated.length > 0) {
      sects.push({
        id: 'top-rated',
        title: 'Top Rated',
        subtitle: 'Highest community ratings',
        icon: 'star',
        items: topRated as Fragrance[],
      })
    }

    // 2. Hidden gems — high rated but fewer reviews
    const { data: hiddenGems } = await supabase
      .from('fragrances')
      .select('*')
      .not('image_url', 'is', null)
      .gte('rating', 4.0)
      .order('rating', { ascending: false })
      .range(50, 70)

    if (hiddenGems && hiddenGems.length > 0) {
      sects.push({
        id: 'hidden-gems',
        title: 'Hidden Gems',
        subtitle: 'Highly rated, under the radar',
        icon: 'diamond',
        items: hiddenGems as Fragrance[],
      })
    }

    // 3. Personalised picks (if logged in)
    if (user) {
      const { data: collData } = await supabase
        .from('user_collections')
        .select('personal_rating, fragrance:fragrances(*)')
        .eq('user_id', user.id)
        .eq('status', 'own')

      const coll = (collData ?? []) as unknown as CollectionItem[]
      const owned = coll.filter(c => c.fragrance).map(c => ({ ...c.fragrance!, rating: c.personal_rating }))

      if (owned.length >= 3) {
        const ownedIds = new Set(owned.map(f => f.id))
        const { data: candidates } = await supabase
          .from('fragrances')
          .select('*')
          .not('image_url', 'is', null)
          .not('rating', 'is', null)
          .order('rating', { ascending: false })
          .limit(80)

        const pool = (candidates ?? []).filter(c => !ownedIds.has((c as Fragrance).id)) as Fragrance[]
        const personalised = findSimilarToCollection(owned, pool, 10)

        if (personalised.length > 0) {
          sects.splice(1, 0, {
            id: 'for-you',
            title: 'For You',
            subtitle: 'Based on your collection',
            icon: 'auto_awesome',
            items: personalised.map(p => p.fragrance),
          })
        }
      }
    }

    // 4. Niche houses
    const nicheHouses = ['Maison Francis Kurkdjian', 'Le Labo', 'Byredo', 'Amouage', 'Parfums de Marly', 'Xerjoff']
    const randomNiche = nicheHouses[Math.floor(Math.random() * nicheHouses.length)]
    const { data: nicheData } = await supabase
      .from('fragrances')
      .select('*')
      .eq('brand', randomNiche)
      .not('image_url', 'is', null)
      .order('rating', { ascending: false })
      .limit(10)

    if (nicheData && nicheData.length > 0) {
      sects.push({
        id: 'niche',
        title: `Explore ${randomNiche}`,
        subtitle: 'Niche house spotlight',
        icon: 'local_fire_department',
        items: nicheData as Fragrance[],
      })
    }

    setSections(sects)
    setLoading(false)
  }

  // Family explore — loaded on demand
  const [familyResults, setFamilyResults] = useState<Fragrance[]>([])
  const [familyLoading, setFamilyLoading] = useState(false)

  useEffect(() => {
    setFamilyLoading(true)
    supabase
      .from('fragrances')
      .select('*')
      .eq('note_family', selectedFamily)
      .not('image_url', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(12)
      .then(({ data }) => {
        setFamilyResults((data ?? []) as Fragrance[])
        setFamilyLoading(false)
      })
  }, [selectedFamily])

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-8">
      <div>
        <h2 className="font-headline text-2xl text-on-surface">Discover</h2>
        <p className="text-[11px] text-secondary/50 mt-1">Explore new fragrances</p>
      </div>

      {loading ? (
        <FragranceListSkeleton count={6} />
      ) : (
        <>
          {/* Dynamic sections */}
          {sections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon name={section.icon} className="text-primary" size={18} />
                <div>
                  <h3 className="text-sm font-medium text-on-surface">{section.title}</h3>
                  <p className="text-[10px] text-secondary/50">{section.subtitle}</p>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {section.items.map((frag) => (
                  <button
                    key={frag.id}
                    onClick={() => navigate(`/fragrance/${frag.id}`)}
                    className="flex-shrink-0 w-[110px] text-left active:scale-95 transition-transform"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-highest mb-2">
                      {frag.image_url ? (
                        <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="water_drop" className="text-secondary/30" size={24} />
                        </div>
                      )}
                      {frag.rating && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                          <Icon name="star" filled className="text-[9px] text-primary" />
                          <span className="text-[9px] text-white font-bold">{Number(frag.rating).toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] uppercase tracking-[0.1em] font-label text-secondary/60">{frag.brand}</p>
                    <p className="text-[11px] font-medium text-on-surface truncate">{frag.name}</p>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {/* Explore by Note Family */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="spa" className="text-primary" size={18} />
              <div>
                <h3 className="text-sm font-medium text-on-surface">Explore by Family</h3>
                <p className="text-[10px] text-secondary/50">Dive into a note family</p>
              </div>
            </div>

            {/* Family pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 pb-1">
              {NOTE_FAMILY_PICKS.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFamily(f)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                    selectedFamily === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Family results */}
            {familyLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {familyResults.slice(0, 9).map(frag => (
                  <button
                    key={frag.id}
                    onClick={() => navigate(`/fragrance/${frag.id}`)}
                    className="text-left active:scale-95 transition-transform"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-surface-container-highest mb-1.5">
                      {frag.image_url ? (
                        <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="water_drop" className="text-secondary/30" size={20} />
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-secondary/50 truncate">{frag.brand}</p>
                    <p className="text-[10px] text-on-surface font-medium truncate">{frag.name}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Quick links */}
          <section className="space-y-2">
            <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary font-bold">MORE TO EXPLORE</h3>
            <button
              onClick={() => navigate('/notes')}
              className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left"
            >
              <Icon name="hub" className="text-primary" />
              <div className="flex-1">
                <p className="text-sm text-on-surface font-medium">Notes Explorer</p>
                <p className="text-[10px] text-secondary/50">Browse by individual notes</p>
              </div>
              <Icon name="chevron_right" className="text-secondary/40" />
            </button>
            <button
              onClick={() => navigate('/layering-lab')}
              className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left"
            >
              <Icon name="science" className="text-primary" />
              <div className="flex-1">
                <p className="text-sm text-on-surface font-medium">Layering Lab</p>
                <p className="text-[10px] text-secondary/50">Find perfect fragrance combos</p>
              </div>
              <Icon name="chevron_right" className="text-secondary/40" />
            </button>
            <button
              onClick={() => navigate('/seasonal')}
              className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left"
            >
              <Icon name="thermostat" className="text-primary" />
              <div className="flex-1">
                <p className="text-sm text-on-surface font-medium">Seasonal Picks</p>
                <p className="text-[10px] text-secondary/50">Best for the current season</p>
              </div>
              <Icon name="chevron_right" className="text-secondary/40" />
            </button>
          </section>
        </>
      )}
    </main>
  )
}
