import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { captureElement, shareImage, copyToClipboard } from '@/lib/share'
import { hapticMedium } from '@/lib/haptics'
import { getIconChar } from '@/lib/iconUtils'

/* ── Card themes ─────────────────────────────────────── */
const THEMES = [
  { name: 'Noir', bg: '#191210', bgGrad: 'linear-gradient(135deg, #191210 0%, #2a1f1a 50%, #191210 100%)', text: '#f0dfdb', accent: '#e5c276', muted: '#f0dfdb60', dim: '#f0dfdb30' },
  { name: 'Ivory', bg: '#fdf8f0', bgGrad: 'linear-gradient(135deg, #fdf8f0 0%, #f5efe6 50%, #fdf8f0 100%)', text: '#191210', accent: '#c4a35a', muted: '#19121080', dim: '#19121030' },
  { name: 'Midnight', bg: '#0a0a1a', bgGrad: 'linear-gradient(135deg, #0a0a1a 0%, #15132e 50%, #0a0a1a 100%)', text: '#e0e0ff', accent: '#8b80ff', muted: '#e0e0ff60', dim: '#e0e0ff30' },
  { name: 'Rose', bg: '#1a0f14', bgGrad: 'linear-gradient(135deg, #1a0f14 0%, #2e1825 50%, #1a0f14 100%)', text: '#f0d8e8', accent: '#e878b0', muted: '#f0d8e860', dim: '#f0d8e830' },
] as const

/* ── Card layout types ───────────────────────────────── */
type CardLayout = 'top5' | 'stats' | 'grid' | 'wrapped'

interface CollectionStats {
  totalOwned: number
  totalWears: number
  totalReviews: number
  topBrands: { brand: string; count: number }[]
  topFamilies: { family: string; count: number }[]
  topRated: { name: string; brand: string; rating: number; image_url: string | null }[]
  mostWorn: { name: string; brand: string; count: number; image_url: string | null }[]
  displayName: string
  level: number
}

export function CollectionShareScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [themeIdx, setThemeIdx] = useState(0)
  const [layout, setLayout] = useState<CardLayout>('top5')

  const theme = THEMES[themeIdx]

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchStats() {
    const [profileRes, collRes, wearsRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('display_name, level').eq('id', user!.id).single(),
      supabase.from('user_collections').select('personal_rating, fragrance:fragrances(name, brand, image_url, note_family)').eq('user_id', user!.id).eq('status', 'own'),
      supabase.from('wear_logs').select('fragrance_id, fragrance:fragrances(name, brand, image_url)').eq('user_id', user!.id),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    ])

    type CollRow = { personal_rating: number | null; fragrance: { name: string; brand: string; image_url: string | null; note_family: string | null } | null }
    type WearRow = { fragrance_id: string; fragrance: { name: string; brand: string; image_url: string | null } | null }

    const coll = (collRes.data ?? []) as unknown as CollRow[]
    const wears = (wearsRes.data ?? []) as unknown as WearRow[]

    // Top brands & families
    const brandMap = new Map<string, number>()
    const familyMap = new Map<string, number>()
    coll.forEach(c => {
      if (c.fragrance?.brand) brandMap.set(c.fragrance.brand, (brandMap.get(c.fragrance.brand) ?? 0) + 1)
      if (c.fragrance?.note_family) familyMap.set(c.fragrance.note_family, (familyMap.get(c.fragrance.note_family) ?? 0) + 1)
    })

    // Top rated
    const topRated = coll
      .filter(c => c.personal_rating && c.fragrance)
      .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0))
      .slice(0, 5)
      .map(c => ({ name: c.fragrance!.name, brand: c.fragrance!.brand, rating: c.personal_rating!, image_url: c.fragrance!.image_url }))

    // Most worn
    const wearCount = new Map<string, { name: string; brand: string; count: number; image_url: string | null }>()
    wears.forEach(w => {
      if (!w.fragrance) return
      const key = w.fragrance_id
      const existing = wearCount.get(key)
      if (existing) existing.count++
      else wearCount.set(key, { name: w.fragrance.name, brand: w.fragrance.brand, count: 1, image_url: w.fragrance.image_url })
    })
    const mostWorn = [...wearCount.values()].sort((a, b) => b.count - a.count).slice(0, 5)

    setStats({
      totalOwned: coll.length,
      totalWears: wears.length,
      totalReviews: reviewsRes.count ?? 0,
      topBrands: [...brandMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([brand, count]) => ({ brand, count })),
      topFamilies: [...familyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([family, count]) => ({ family, count })),
      topRated,
      mostWorn,
      displayName: profileRes.data?.display_name ?? 'Fragrance Lover',
      level: profileRes.data?.level ?? 1,
    })
    setLoading(false)
  }

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)
    const blob = await captureElement(cardRef.current, theme.bg)
    if (!blob) { showToast('Failed to generate image', 'error'); setSharing(false); return }
    const result = await shareImage(blob, 'scentfolio-collection.png', 'My ScentFolio Collection', `Check out my fragrance collection on ScentFolio!`)
    if (result === 'downloaded') showToast('Image saved!', 'success')
    else if (result === 'shared') showToast('Shared!', 'success')
    else showToast('Could not share', 'error')
    setSharing(false)
  }

  const handleCopy = async () => {
    if (!stats) return
    const text = `🧴 My ScentFolio Collection\n${stats.totalOwned} fragrances · ${stats.totalWears} wears\nTop: ${stats.topRated.slice(0, 3).map(f => `${f.brand} ${f.name}`).join(', ')}\n\nscentfolio.app`
    const ok = await copyToClipboard(text)
    showToast(ok ? 'Copied!' : 'Copy failed', ok ? 'success' : 'error')
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">↗</span>
        <p className="text-secondary/60 text-sm">Sign in to share your collection</p>
      </main>
    )
  }

  if (loading || !stats) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-5">
      {/* Layout picker */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {([
          { key: 'top5' as const, icon: 'trophy', label: 'Top 5' },
          { key: 'stats' as const, icon: 'analytics', label: 'Stats' },
          { key: 'grid' as const, icon: 'grid_view', label: 'Grid' },
          { key: 'wrapped' as const, icon: 'auto_awesome', label: 'Wrapped' },
        ]).map(l => (
          <button
            key={l.key}
            onClick={() => { setLayout(l.key); hapticMedium() }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              layout === l.key ? 'gold-gradient text-on-primary-container' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span>{getIconChar(l.icon)}</span>
            {l.label}
          </button>
        ))}
      </div>

      {/* Card preview */}
      <div
        ref={cardRef}
        className="rounded-sm overflow-hidden"
        style={{ background: theme.bgGrad }}
      >
        <div className="p-6 space-y-5">
          {/* Header — always shown */}
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: theme.accent, fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>SCENTFOLIO</p>
              <p style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{stats.displayName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: theme.accent, fontSize: '24px', fontWeight: 700 }}>{stats.totalOwned}</p>
              <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>fragrances</p>
            </div>
          </div>

          {/* Layout-specific content */}
          {layout === 'top5' && <Top5Card stats={stats} theme={theme} />}
          {layout === 'stats' && <StatsCard stats={stats} theme={theme} />}
          {layout === 'grid' && <GridCard stats={stats} theme={theme} />}
          {layout === 'wrapped' && <WrappedCard stats={stats} theme={theme} />}

          {/* Watermark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', paddingTop: '8px', borderTop: `1px solid ${theme.dim}` }}>
            <span style={{ color: theme.dim, fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>scentfolio.app</span>
          </div>
        </div>
      </div>

      {/* Theme picker */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-secondary/50 font-bold mb-3">CARD STYLE</p>
        <div className="flex gap-3">
          {THEMES.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setThemeIdx(i)}
              className={`flex-1 py-3 rounded-sm text-center text-xs font-medium transition-all ${i === themeIdx ? 'ring-2 ring-primary' : ''}`}
              style={{ backgroundColor: t.bg, color: t.text, border: `1px solid ${t.dim}` }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 py-3.5 gold-gradient text-on-primary-container font-bold uppercase tracking-[0.1em] rounded-sm ambient-glow hover:opacity-80 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {sharing ? <span className="text-[9px] uppercase tracking-wider animate-pulse">…</span> : <><span>↗</span>SHARE</>}
        </button>
        <button
          onClick={handleCopy}
          className="py-3.5 px-5 bg-surface-container rounded-sm hover:opacity-80 transition-transform flex items-center gap-2"
        >
          <span className="text-primary">?</span>
        </button>
      </div>
    </main>
  )
}

/* ── Layout: Top 5 Rated ──────────────────────────────── */
function Top5Card({ stats, theme }: { stats: CollectionStats; theme: typeof THEMES[number] }) {
  const items = stats.topRated.length > 0 ? stats.topRated : stats.mostWorn.map(w => ({ ...w, rating: 0 }))
  if (items.length === 0) return <p style={{ color: theme.muted, fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>Add ratings to see your Top 5</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>
        {stats.topRated.length > 0 ? 'TOP RATED' : 'MOST WORN'}
      </p>
      {items.slice(0, 5).map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: theme.accent, fontSize: '20px', fontWeight: 700, width: '24px', textAlign: 'center' }}>{i + 1}</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: `${theme.accent}15` }}>
            {f.image_url ? <img src={f.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: theme.dim, fontSize: '14px' }}>✦</span></div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: theme.text, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
            <p style={{ color: theme.muted, fontSize: '10px' }}>{f.brand}</p>
          </div>
          {'rating' in f && f.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: theme.accent, fontSize: '13px' }}>★</span>
              <span style={{ color: theme.accent, fontSize: '12px', fontWeight: 700 }}>{f.rating.toFixed(1)}</span>
            </div>
          )}
          {'count' in f && (f as { count: number }).count > 0 && (
            <span style={{ color: theme.accent, fontSize: '11px', fontWeight: 700 }}>{(f as { count: number }).count}×</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Layout: Stats Overview ───────────────────────────── */
function StatsCard({ stats, theme }: { stats: CollectionStats; theme: typeof THEMES[number] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Big numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Owned', value: stats.totalOwned },
          { label: 'Wears', value: stats.totalWears },
          { label: 'Reviews', value: stats.totalReviews },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '12px 0', borderRadius: '12px', backgroundColor: `${theme.accent}10` }}>
            <p style={{ color: theme.accent, fontSize: '22px', fontWeight: 700 }}>{s.value}</p>
            <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Top brands + families side by side */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {stats.topBrands.length > 0 && (
          <div style={{ flex: 1 }}>
            <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '6px' }}>TOP BRANDS</p>
            {stats.topBrands.slice(0, 3).map((b, i) => (
              <div key={b.brand} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ color: theme.text, fontSize: '11px' }}>{i + 1}. {b.brand}</span>
                <span style={{ color: theme.accent, fontSize: '10px', fontWeight: 700 }}>{b.count}</span>
              </div>
            ))}
          </div>
        )}
        {stats.topFamilies.length > 0 && (
          <div style={{ flex: 1 }}>
            <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '6px' }}>TOP FAMILIES</p>
            {stats.topFamilies.slice(0, 3).map((f, i) => (
              <div key={f.family} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ color: theme.text, fontSize: '11px' }}>{i + 1}. {f.family}</span>
                <span style={{ color: theme.accent, fontSize: '10px', fontWeight: 700 }}>{f.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Layout: Grid (album art style) ───────────────────── */
function GridCard({ stats, theme }: { stats: CollectionStats; theme: typeof THEMES[number] }) {
  const items = stats.topRated.slice(0, 9)
  if (items.length === 0) return <p style={{ color: theme.muted, fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>Rate fragrances to build your grid</p>

  const cols = items.length <= 4 ? 2 : 3
  return (
    <div>
      <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>MY COLLECTION</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', borderRadius: '12px', overflow: 'hidden' }}>
        {items.map((f, i) => (
          <div key={i} style={{ aspectRatio: '1', backgroundColor: `${theme.accent}10`, position: 'relative', overflow: 'hidden' }}>
            {f.image_url ? (
              <img src={f.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '4px' }}>
                <span style={{ color: theme.accent, fontSize: '16px' }}>✦</span>
                <span style={{ color: theme.muted, fontSize: '7px', textAlign: 'center', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{f.name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Layout: Wrapped (Spotify-style) ──────────────────── */
function WrappedCard({ stats, theme }: { stats: CollectionStats; theme: typeof THEMES[number] }) {
  const topFrag = stats.topRated[0] || stats.mostWorn[0]
  const topBrand = stats.topBrands[0]
  const topFamily = stats.topFamilies[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Hero stat */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <p style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>YOUR SCENT JOURNEY</p>
        <p style={{ color: theme.accent, fontSize: '48px', fontWeight: 700, lineHeight: 1.1, marginTop: '4px' }}>{stats.totalOwned}</p>
        <p style={{ color: theme.text, fontSize: '13px', fontWeight: 500 }}>fragrances discovered</p>
      </div>

      {/* Highlights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {topFrag && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: `${theme.accent}10`, padding: '12px', borderRadius: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, backgroundColor: `${theme.accent}20` }}>
              {topFrag.image_url ? <img src={topFrag.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: theme.accent, fontSize: '16px' }}>★</span></div>}
            </div>
            <div>
              <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>#1 FRAGRANCE</p>
              <p style={{ color: theme.text, fontSize: '13px', fontWeight: 600 }}>{topFrag.name}</p>
              <p style={{ color: theme.muted, fontSize: '10px' }}>{topFrag.brand}</p>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {topBrand && (
            <div style={{ backgroundColor: `${theme.accent}10`, padding: '12px', borderRadius: '12px' }}>
              <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>TOP BRAND</p>
              <p style={{ color: theme.text, fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>{topBrand.brand}</p>
              <p style={{ color: theme.accent, fontSize: '10px' }}>{topBrand.count} fragrances</p>
            </div>
          )}
          {topFamily && (
            <div style={{ backgroundColor: `${theme.accent}10`, padding: '12px', borderRadius: '12px' }}>
              <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>TOP FAMILY</p>
              <p style={{ color: theme.text, fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>{topFamily.family}</p>
              <p style={{ color: theme.accent, fontSize: '10px' }}>{topFamily.count} fragrances</p>
            </div>
          )}
        </div>

        {/* Mini stats row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
          {[
            { value: stats.totalWears, label: 'wears' },
            { value: stats.totalReviews, label: 'reviews' },
            { value: stats.topBrands.length, label: 'brands' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ color: theme.accent, fontSize: '18px', fontWeight: 700 }}>{s.value}</p>
              <p style={{ color: theme.muted, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
