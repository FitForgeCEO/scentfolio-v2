import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { captureElement, shareImage } from '@/lib/share'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface MonthStats {
  totalWears: number
  uniqueFragrances: number
  newAdditions: number
  topWorn: { name: string; brand: string; count: number; image_url: string | null }[]
  topFamily: string | null
  topBrand: string | null
  streakDays: number
  reviewsWritten: number
}

const THEMES = [
  { name: 'Noir', bg: '#191210', bgGrad: 'linear-gradient(135deg, #191210 0%, #2a1f1a 50%, #191210 100%)', text: '#f0dfdb', accent: '#e5c276', muted: '#f0dfdb60', dim: '#f0dfdb30' },
  { name: 'Ivory', bg: '#fdf8f0', bgGrad: 'linear-gradient(135deg, #fdf8f0 0%, #f5efe6 50%, #fdf8f0 100%)', text: '#191210', accent: '#c4a35a', muted: '#19121080', dim: '#19121030' },
  { name: 'Rose', bg: '#1a0f14', bgGrad: 'linear-gradient(135deg, #1a0f14 0%, #2e1825 50%, #1a0f14 100%)', text: '#f0d8e8', accent: '#e878b0', muted: '#f0d8e860', dim: '#f0d8e830' },
]

export function MonthInFragranceScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<MonthStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [themeIdx, setThemeIdx] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0) // 0 = last month, 1 = two months ago, etc.

  const theme = THEMES[themeIdx]

  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() - 1 - monthOffset)
  const year = targetDate.getFullYear()
  const month = targetDate.getMonth() // 0-indexed
  const monthName = MONTH_NAMES[month]
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endMonth = month === 11 ? 0 : month + 1
  const endYear = month === 11 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchMonthStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthOffset])

  async function fetchMonthStats() {
    setLoading(true)

    const [wearsRes, additionsRes, reviewsRes] = await Promise.all([
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

    wears.forEach(w => {
      if (!w.fragrance) return
      const key = w.fragrance_id
      const existing = wearMap.get(key)
      if (existing) existing.count++
      else wearMap.set(key, { name: w.fragrance.name, brand: w.fragrance.brand, count: 1, image_url: w.fragrance.image_url })
      if (w.fragrance.note_family) familyMap.set(w.fragrance.note_family, (familyMap.get(w.fragrance.note_family) ?? 0) + 1)
      brandMap.set(w.fragrance.brand, (brandMap.get(w.fragrance.brand) ?? 0) + 1)
    })

    const topWorn = [...wearMap.values()].sort((a, b) => b.count - a.count).slice(0, 3)
    const topFamily = [...familyMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const topBrand = [...brandMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // Streak — consecutive days with wears
    const wearDates = new Set(wears.map(w => w.wear_date))
    let maxStreak = 0
    let currentStreak = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (wearDates.has(dateStr)) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
      else currentStreak = 0
    }

    setStats({
      totalWears: wears.length,
      uniqueFragrances: uniqueIds.size,
      newAdditions: additionsRes.count ?? 0,
      topWorn,
      topFamily,
      topBrand,
      streakDays: maxStreak,
      reviewsWritten: reviewsRes.count ?? 0,
    })
    setLoading(false)
  }

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)
    const blob = await captureElement(cardRef.current, theme.bg)
    if (!blob) { showToast('Failed to generate image', 'error'); setSharing(false); return }
    const result = await shareImage(blob, `scentfolio-${monthName.toLowerCase()}-${year}.png`, `My ${monthName} in Fragrance`, `My fragrance month in review — ${stats?.totalWears} wears, ${stats?.uniqueFragrances} fragrances`)
    if (result === 'downloaded') showToast('Image saved!', 'success')
    else if (result === 'shared') showToast('Shared!', 'success')
    else showToast('Could not share', 'error')
    setSharing(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="calendar_month" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see your monthly summary</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-5">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMonthOffset(prev => prev + 1)} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform">
          <Icon name="chevron_left" size={20} />
        </button>
        <div className="text-center">
          <p className="font-headline text-lg text-on-surface">{monthName} {year}</p>
          <p className="text-[10px] text-on-surface-variant">Monthly Summary</p>
        </div>
        <button
          onClick={() => setMonthOffset(prev => Math.max(0, prev - 1))}
          disabled={monthOffset === 0}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
        >
          <Icon name="chevron_right" size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !stats || stats.totalWears === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Icon name="event_busy" className="text-4xl text-primary/20" />
          <p className="text-sm text-on-surface-variant">No wears logged in {monthName}</p>
        </div>
      ) : (
        <>
          {/* Shareable card */}
          <div ref={cardRef} className="rounded-2xl overflow-hidden" style={{ background: theme.bgGrad }}>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: theme.accent, fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>YOUR MONTH IN FRAGRANCE</p>
                <p style={{ color: theme.text, fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{monthName} {year}</p>
              </div>

              {/* Big stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { value: stats.totalWears, label: 'Wears' },
                  { value: stats.uniqueFragrances, label: 'Unique' },
                  { value: stats.newAdditions, label: 'New' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '12px 0', borderRadius: '12px', backgroundColor: `${theme.accent}10` }}>
                    <p style={{ color: theme.accent, fontSize: '24px', fontWeight: 700 }}>{s.value}</p>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Most worn */}
              {stats.topWorn.length > 0 && (
                <div>
                  <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>MOST WORN</p>
                  {stats.topWorn.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ color: theme.accent, fontSize: '16px', fontWeight: 700, width: '20px', textAlign: 'center' }}>{i + 1}</span>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: `${theme.accent}15` }}>
                        {f.image_url ? <img src={f.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: theme.dim }}>✦</span></div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: theme.text, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                        <p style={{ color: theme.muted, fontSize: '9px' }}>{f.brand}</p>
                      </div>
                      <span style={{ color: theme.accent, fontSize: '11px', fontWeight: 700 }}>{f.count}×</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {stats.topFamily && (
                  <div style={{ backgroundColor: `${theme.accent}10`, padding: '10px', borderRadius: '10px' }}>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TOP FAMILY</p>
                    <p style={{ color: theme.text, fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{stats.topFamily}</p>
                  </div>
                )}
                {stats.topBrand && (
                  <div style={{ backgroundColor: `${theme.accent}10`, padding: '10px', borderRadius: '10px' }}>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TOP BRAND</p>
                    <p style={{ color: theme.text, fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{stats.topBrand}</p>
                  </div>
                )}
                {stats.streakDays > 0 && (
                  <div style={{ backgroundColor: `${theme.accent}10`, padding: '10px', borderRadius: '10px' }}>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>BEST STREAK</p>
                    <p style={{ color: theme.text, fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{stats.streakDays} days</p>
                  </div>
                )}
                {stats.reviewsWritten > 0 && (
                  <div style={{ backgroundColor: `${theme.accent}10`, padding: '10px', borderRadius: '10px' }}>
                    <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>REVIEWS</p>
                    <p style={{ color: theme.text, fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{stats.reviewsWritten} written</p>
                  </div>
                )}
              </div>

              {/* Watermark */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', paddingTop: '8px', borderTop: `1px solid ${theme.dim}` }}>
                <span style={{ color: theme.dim, fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>scentfolio.app</span>
              </div>
            </div>
          </div>

          {/* Theme picker */}
          <div className="flex gap-3">
            {THEMES.map((t, i) => (
              <button
                key={t.name}
                onClick={() => setThemeIdx(i)}
                className={`flex-1 py-3 rounded-xl text-center text-xs font-medium transition-all ${i === themeIdx ? 'ring-2 ring-primary' : ''}`}
                style={{ backgroundColor: t.bg, color: t.text, border: `1px solid ${t.dim}` }}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full py-3.5 gold-gradient text-on-primary-container font-bold uppercase tracking-[0.1em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sharing ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" /> : <><Icon name="share" size={18} />SHARE {monthName.toUpperCase()}</>}
          </button>
        </>
      )}
    </main>
  )
}
