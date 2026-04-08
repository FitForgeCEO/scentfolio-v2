import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { captureElement, shareImage } from '@/lib/share'

const THEMES = [
  { name: 'Noir', bg: '#191210', bgGrad: 'linear-gradient(135deg, #191210 0%, #2a1f1a 50%, #191210 100%)', text: '#f0dfdb', accent: '#e5c276', muted: '#f0dfdb60', dim: '#f0dfdb30' },
  { name: 'Midnight', bg: '#0a0a1a', bgGrad: 'linear-gradient(135deg, #0a0a1a 0%, #15132e 50%, #0a0a1a 100%)', text: '#e0e0ff', accent: '#8b80ff', muted: '#e0e0ff60', dim: '#e0e0ff30' },
  { name: 'Rose', bg: '#1a0f14', bgGrad: 'linear-gradient(135deg, #1a0f14 0%, #2e1825 50%, #1a0f14 100%)', text: '#f0d8e8', accent: '#e878b0', muted: '#f0d8e860', dim: '#f0d8e830' },
]

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface YearStats {
  year: number
  totalWears: number
  uniqueFragrances: number
  newAdditions: number
  reviewsWritten: number
  topWorn: { name: string; brand: string; count: number; image_url: string | null }[]
  topBrands: { brand: string; count: number }[]
  topFamilies: { family: string; count: number }[]
  monthlyWears: number[] // 12 entries, one per month
  longestStreak: number
  mostAdventurousMonth: string | null // month with most unique fragrances
  seasonBreakdown: { season: string; count: number }[]
  displayName: string
}

export function YearInFragranceScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<YearStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [themeIdx, setThemeIdx] = useState(0)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - (new Date().getMonth() < 2 ? 1 : 0))

  const theme = THEMES[themeIdx]
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchYearStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedYear])

  async function fetchYearStats() {
    setLoading(true)
    const startDate = `${selectedYear}-01-01`
    const endDate = `${selectedYear + 1}-01-01`

    const [profileRes, wearsRes, additionsRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user!.id).single(),
      supabase.from('wear_logs').select('wear_date, fragrance_id, fragrance:fragrances(name, brand, image_url, note_family)').eq('user_id', user!.id).gte('wear_date', startDate).lt('wear_date', endDate),
      supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'own').gte('date_added', startDate).lt('date_added', endDate),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).gte('created_at', startDate).lt('created_at', endDate),
    ])

    type WearRow = { wear_date: string; fragrance_id: string; fragrance: { name: string; brand: string; image_url: string | null; note_family: string | null } | null }
    const wears = (wearsRes.data ?? []) as unknown as WearRow[]

    // Unique fragrances
    const uniqueIds = new Set(wears.map(w => w.fragrance_id))

    // Top worn
    const wearMap = new Map<string, { name: string; brand: string; count: number; image_url: string | null }>()
    const familyMap = new Map<string, number>()
    const brandMap = new Map<string, number>()
    const monthlyWears = new Array(12).fill(0) as number[]
    const monthlyUnique = Array.from({ length: 12 }, () => new Set<string>())

    // Season mapping
    const seasonMap = new Map<string, number>([['Winter', 0], ['Spring', 0], ['Summer', 0], ['Autumn', 0]])

    wears.forEach(w => {
      if (!w.fragrance) return
      const key = w.fragrance_id
      const existing = wearMap.get(key)
      if (existing) existing.count++
      else wearMap.set(key, { name: w.fragrance.name, brand: w.fragrance.brand, count: 1, image_url: w.fragrance.image_url })

      if (w.fragrance.note_family) familyMap.set(w.fragrance.note_family, (familyMap.get(w.fragrance.note_family) ?? 0) + 1)
      brandMap.set(w.fragrance.brand, (brandMap.get(w.fragrance.brand) ?? 0) + 1)

      const m = new Date(w.wear_date).getMonth()
      monthlyWears[m]++
      monthlyUnique[m].add(w.fragrance_id)

      // Season
      if (m === 11 || m <= 1) seasonMap.set('Winter', (seasonMap.get('Winter') ?? 0) + 1)
      else if (m >= 2 && m <= 4) seasonMap.set('Spring', (seasonMap.get('Spring') ?? 0) + 1)
      else if (m >= 5 && m <= 7) seasonMap.set('Summer', (seasonMap.get('Summer') ?? 0) + 1)
      else seasonMap.set('Autumn', (seasonMap.get('Autumn') ?? 0) + 1)
    })

    const topWorn = [...wearMap.values()].sort((a, b) => b.count - a.count).slice(0, 10)

    // Longest streak
    const wearDates = new Set(wears.map(w => w.wear_date))
    let maxStreak = 0
    let currentStreak = 0
    const startD = new Date(startDate)
    const endD = new Date(endDate)
    for (let d = new Date(startD); d < endD; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      if (wearDates.has(ds)) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
      else currentStreak = 0
    }

    // Most adventurous month (most unique fragrances)
    let maxUnique = 0
    let adventurousIdx = -1
    monthlyUnique.forEach((s, i) => { if (s.size > maxUnique) { maxUnique = s.size; adventurousIdx = i } })

    setStats({
      year: selectedYear,
      totalWears: wears.length,
      uniqueFragrances: uniqueIds.size,
      newAdditions: additionsRes.count ?? 0,
      reviewsWritten: reviewsRes.count ?? 0,
      topWorn,
      topBrands: [...brandMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([brand, count]) => ({ brand, count })),
      topFamilies: [...familyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([family, count]) => ({ family, count })),
      monthlyWears,
      longestStreak: maxStreak,
      mostAdventurousMonth: adventurousIdx >= 0 ? MONTHS_SHORT[adventurousIdx] : null,
      seasonBreakdown: [...seasonMap.entries()].map(([season, count]) => ({ season, count })),
      displayName: profileRes.data?.display_name ?? 'Fragrance Lover',
    })
    setLoading(false)
  }

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)
    const blob = await captureElement(cardRef.current, theme.bg)
    if (!blob) { showToast('Failed to generate image', 'error'); setSharing(false); return }
    const result = await shareImage(blob, `scentfolio-${selectedYear}-wrapped.png`, `My ${selectedYear} in Fragrance`, `${stats?.totalWears} wears, ${stats?.uniqueFragrances} fragrances — my year in scent!`)
    if (result === 'downloaded') showToast('Image saved!', 'success')
    else if (result === 'shared') showToast('Shared!', 'success')
    else showToast('Could not share', 'error')
    setSharing(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="auto_awesome" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see your year in fragrance</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-5">
      {/* Year selector */}
      <div className="flex gap-2 justify-center">
        {years.map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${y === selectedYear ? 'gold-gradient text-on-primary-container' : 'bg-surface-container text-on-surface-variant'}`}
          >
            {y}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !stats || stats.totalWears === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Icon name="event_busy" className="text-4xl text-primary/20" />
          <p className="text-sm text-on-surface-variant">No wears logged in {selectedYear}</p>
        </div>
      ) : (
        <>
          {/* Shareable wrapped card */}
          <div ref={cardRef} className="rounded-2xl overflow-hidden" style={{ background: theme.bgGrad }}>
            <div className="p-6 space-y-5">
              {/* Hero */}
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ color: theme.accent, fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>YOUR YEAR IN FRAGRANCE</p>
                <p style={{ color: theme.text, fontSize: '36px', fontWeight: 700, lineHeight: 1.1, marginTop: '4px' }}>{stats.year}</p>
                <p style={{ color: theme.muted, fontSize: '11px', marginTop: '4px' }}>{stats.displayName}</p>
              </div>

              {/* Key stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                {[
                  { value: stats.totalWears, label: 'Wears' },
                  { value: stats.uniqueFragrances, label: 'Unique' },
                  { value: stats.newAdditions, label: 'Added' },
                  { value: stats.reviewsWritten, label: 'Reviews' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '10px', backgroundColor: `${theme.accent}10` }}>
                    <p style={{ color: theme.accent, fontSize: '20px', fontWeight: 700 }}>{s.value}</p>
                    <p style={{ color: theme.muted, fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Monthly activity bar chart */}
              <div>
                <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>MONTHLY ACTIVITY</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
                  {stats.monthlyWears.map((count, i) => {
                    const max = Math.max(...stats.monthlyWears, 1)
                    const height = count > 0 ? Math.max(((count / max) * 100), 8) : 4
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <div style={{ width: '100%', height: `${height}%`, backgroundColor: count > 0 ? theme.accent : `${theme.accent}20`, borderRadius: '3px', transition: 'height 0.3s' }} />
                        <span style={{ color: theme.dim, fontSize: '6px' }}>{MONTHS_SHORT[i]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top 5 most worn */}
              {stats.topWorn.length > 0 && (
                <div>
                  <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>MOST WORN</p>
                  {stats.topWorn.slice(0, 5).map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <span style={{ color: theme.accent, fontSize: '14px', fontWeight: 700, width: '18px', textAlign: 'center' }}>{i + 1}</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: `${theme.accent}15` }}>
                        {f.image_url ? <img src={f.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: theme.dim, fontSize: '10px' }}>✦</span></div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: theme.text, fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                        <p style={{ color: theme.muted, fontSize: '8px' }}>{f.brand}</p>
                      </div>
                      <span style={{ color: theme.accent, fontSize: '10px', fontWeight: 700 }}>{f.count}×</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Season breakdown + highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Seasons */}
                <div style={{ backgroundColor: `${theme.accent}08`, padding: '10px', borderRadius: '10px' }}>
                  <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontWeight: 700 }}>BY SEASON</p>
                  {stats.seasonBreakdown.filter(s => s.count > 0).map(s => (
                    <div key={s.season} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: theme.text, fontSize: '10px' }}>{s.season}</span>
                      <span style={{ color: theme.accent, fontSize: '10px', fontWeight: 700 }}>{s.count}</span>
                    </div>
                  ))}
                </div>

                {/* Highlights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {stats.longestStreak > 0 && (
                    <div style={{ backgroundColor: `${theme.accent}08`, padding: '10px', borderRadius: '10px' }}>
                      <p style={{ color: theme.muted, fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>BEST STREAK</p>
                      <p style={{ color: theme.accent, fontSize: '16px', fontWeight: 700 }}>{stats.longestStreak} <span style={{ fontSize: '9px', color: theme.muted }}>days</span></p>
                    </div>
                  )}
                  {stats.mostAdventurousMonth && (
                    <div style={{ backgroundColor: `${theme.accent}08`, padding: '10px', borderRadius: '10px' }}>
                      <p style={{ color: theme.muted, fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MOST ADVENTUROUS</p>
                      <p style={{ color: theme.text, fontSize: '12px', fontWeight: 600 }}>{stats.mostAdventurousMonth}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top brands & families */}
              <div style={{ display: 'flex', gap: '16px' }}>
                {stats.topBrands.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '4px' }}>TOP BRANDS</p>
                    {stats.topBrands.slice(0, 3).map((b, i) => (
                      <p key={b.brand} style={{ color: theme.text, fontSize: '10px', marginBottom: '1px' }}>{i + 1}. {b.brand}</p>
                    ))}
                  </div>
                )}
                {stats.topFamilies.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '4px' }}>TOP FAMILIES</p>
                    {stats.topFamilies.slice(0, 3).map((f, i) => (
                      <p key={f.family} style={{ color: theme.text, fontSize: '10px', marginBottom: '1px' }}>{i + 1}. {f.family}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Watermark */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', paddingTop: '8px', borderTop: `1px solid ${theme.dim}` }}>
                <span style={{ color: theme.dim, fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>scentfolio-app.web.app</span>
              </div>
            </div>
          </div>

          {/* Theme picker */}
          <div className="flex gap-3">
            {THEMES.map((t, i) => (
              <button key={t.name} onClick={() => setThemeIdx(i)} className={`flex-1 py-3 rounded-xl text-center text-xs font-medium transition-all ${i === themeIdx ? 'ring-2 ring-primary' : ''}`} style={{ backgroundColor: t.bg, color: t.text, border: `1px solid ${t.dim}` }}>
                {t.name}
              </button>
            ))}
          </div>

          {/* Share */}
          <button onClick={handleShare} disabled={sharing} className="w-full py-3.5 gold-gradient text-on-primary-container font-bold uppercase tracking-[0.1em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {sharing ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" /> : <><Icon name="share" size={18} />SHARE {selectedYear} WRAPPED</>}
          </button>
        </>
      )}
    </main>
  )
}
