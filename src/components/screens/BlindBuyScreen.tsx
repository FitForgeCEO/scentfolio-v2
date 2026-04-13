import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBlindBuys, useBlindBuySearch } from '@/hooks/useBlindBuys'
import type { BlindBuy, BlindBuyOutcome } from '@/hooks/useBlindBuys'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

const OUTCOMES: { value: BlindBuyOutcome; label: string; icon: string; color: string }[] = [
  { value: 'love', label: 'Love it', icon: 'favorite', color: 'text-red-400' },
  { value: 'like', label: 'Like it', icon: 'thumb_up', color: 'text-green-400' },
  { value: 'neutral', label: 'Meh', icon: 'sentiment_neutral', color: 'text-yellow-400' },
  { value: 'dislike', label: 'Nope', icon: 'thumb_down', color: 'text-orange-400' },
  { value: 'sold', label: 'Sold it', icon: 'sell', color: 'text-secondary/60' },
]

export function BlindBuyScreen() {
  const navigate = useNavigate()
  const { buys, loading, addBlindBuy, updateOutcome, removeBuy, stats } = useBlindBuys()
  const { query, setQuery, results, searching } = useBlindBuySearch()
  const [addMode, setAddMode] = useState(false)
  const [pricePaid, setPricePaid] = useState('')
  const [ratingBuyId, setRatingBuyId] = useState<string | null>(null)

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  const handleAddFragrance = (f: Fragrance) => {
    let price: number | null = null
    if (pricePaid) {
      const parsed = parseFloat(pricePaid)
      if (!Number.isFinite(parsed) || parsed < 0) return
      price = parsed
    }
    addBlindBuy(f.id, f, price)
    setAddMode(false)
    setQuery('')
    setPricePaid('')
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Blind Buys</h1>
        <p className="text-xs text-secondary/50">Track fragrances you bought without trying first</p>
      </section>

      {/* Stats row */}
      {stats.total > 0 && (
        <section className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-surface-container rounded-sm p-3 text-center">
            <p className="font-headline text-xl text-primary">{stats.successRate}%</p>
            <p className="text-[8px] text-secondary/40 uppercase tracking-wider">Success rate</p>
          </div>
          <div className="bg-surface-container rounded-sm p-3 text-center">
            <p className="font-headline text-xl text-on-surface">{stats.total}</p>
            <p className="text-[8px] text-secondary/40 uppercase tracking-wider">Blind buys</p>
          </div>
          <div className="bg-surface-container rounded-sm p-3 text-center">
            <p className="font-headline text-xl text-on-surface">
              {stats.totalSpent > 0 ? `£${stats.totalSpent}` : '—'}
            </p>
            <p className="text-[8px] text-secondary/40 uppercase tracking-wider">Total spent</p>
          </div>
        </section>
      )}

      {/* Outcome breakdown */}
      {stats.rated > 0 && (
        <section className="bg-surface-container rounded-sm p-4 mb-6">
          <p className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-3">OUTCOME BREAKDOWN</p>
          <div className="flex gap-3 justify-center">
            {OUTCOMES.map(o => {
              const count = o.value === 'love' ? stats.loves :
                o.value === 'like' ? stats.likes :
                o.value === 'neutral' ? stats.neutrals :
                o.value === 'dislike' ? stats.dislikes : stats.sold
              return (
                <div key={o.value} className="flex flex-col items-center gap-1">
                  <span>{getIconChar(o.icon)}</span>
                  <span className="text-xs font-bold text-on-surface">{count}</span>
                  <span className="text-[8px] text-secondary/40">{o.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Add button */}
      <button
        onClick={() => setAddMode(!addMode)}
        className="w-full gold-gradient text-on-primary-container py-3.5 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all flex items-center justify-center gap-2 mb-6"
      >
        <span>{getIconChar(addMode ? 'close' : 'add')}</span>
        {addMode ? 'CANCEL' : 'LOG BLIND BUY'}
      </button>

      {/* Add mode */}
      {addMode && (
        <section className="bg-surface-container rounded-sm p-4 mb-6">
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40">⌕</span>
            <input
              type="text"
              placeholder="Search fragrance…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full bg-surface-container-highest rounded-sm pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-secondary/30 outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="text-[10px] text-secondary/50 mb-1 block">Price paid (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="£0.00"
              value={pricePaid}
              onChange={(e) => {
                const v = e.target.value
                // Only allow non-negative numbers (or empty)
                if (v === '' || parseFloat(v) >= 0) setPricePaid(v)
              }}
              className="w-full bg-surface-container-highest rounded-sm px-4 py-2.5 text-sm text-on-surface placeholder:text-secondary/30 outline-none"
            />
          </div>

          {searching && (
            <div className="flex justify-center py-4">
              <span className="text-[9px] uppercase tracking-wider text-primary animate-pulse">Loading…</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleAddFragrance(f)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-sm bg-surface-container-highest/60 active:bg-surface-container-highest text-left"
                >
                  <div className="w-9 h-9 rounded-sm overflow-hidden bg-surface-container flex-shrink-0">
                    {f.image_url ? (
                      <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-secondary/20">?</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-on-surface truncate">{f.name}</p>
                    <p className="text-[9px] text-secondary/40">{f.brand}</p>
                  </div>
                  <span className="text-primary">?</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Buy list */}
      {buys.length === 0 && !addMode ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary/40 text-4xl">?</span>
          </div>
          <p className="text-sm text-secondary/50 text-center max-w-[260px]">
            No blind buys logged yet. Track fragrances you bought without trying first and see how they turn out!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {buys.map(buy => (
            <BlindBuyCard
              key={buy.id}
              buy={buy}
              isRating={ratingBuyId === buy.id}
              onToggleRating={() => setRatingBuyId(ratingBuyId === buy.id ? null : buy.id)}
              onRate={(outcome) => { updateOutcome(buy.id, outcome, null); setRatingBuyId(null) }}
              onRemove={() => removeBuy(buy.id)}
              onNavigate={() => navigate(`/fragrance/${buy.fragrance_id}`)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function BlindBuyCard({
  buy,
  isRating,
  onToggleRating,
  onRate,
  onRemove,
  onNavigate,
}: {
  buy: BlindBuy
  isRating: boolean
  onToggleRating: () => void
  onRate: (outcome: BlindBuyOutcome) => void
  onRemove: () => void
  onNavigate: () => void
}) {
  const outcomeInfo = buy.outcome ? OUTCOMES.find(o => o.value === buy.outcome) : null

  return (
    <div className="bg-surface-container rounded-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {/* Image */}
        <button onClick={onNavigate} className="w-12 h-12 rounded-sm overflow-hidden bg-surface-container-highest flex-shrink-0 hover:opacity-80 transition-transform">
          {buy.fragrance?.image_url ? (
            <img src={buy.fragrance.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-secondary/20">?</span>
            </div>
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface font-medium truncate">{buy.fragrance?.name ?? 'Unknown'}</p>
          <p className="text-[10px] text-secondary/50">{buy.fragrance?.brand ?? ''}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {buy.price_paid !== null && (
              <span className="text-[9px] text-secondary/40">£{buy.price_paid}</span>
            )}
            <span className="text-[9px] text-secondary/30">{buy.purchase_date}</span>
          </div>
        </div>

        {/* Outcome badge or rate button */}
        {outcomeInfo ? (
          <button onClick={onToggleRating} className="flex flex-col items-center gap-0.5">
            <span>{getIconChar(outcomeInfo.icon)}</span>
            <span className="text-[8px] text-secondary/40">{outcomeInfo.label}</span>
          </button>
        ) : (
          <button
            onClick={onToggleRating}
            className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium active:bg-primary/20"
          >
            Rate
          </button>
        )}

        {/* Remove */}
        <button onClick={onRemove} className="text-secondary/30 active:text-error/60">
          <span>✕</span>
        </button>
      </div>

      {/* Rating row */}
      {isRating && (
        <div className="flex justify-around px-4 pb-3 pt-1 border-t border-outline-variant/10">
          {OUTCOMES.map(o => (
            <button
              key={o.value}
              onClick={() => onRate(o.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-sm active:bg-surface-container-highest transition-colors ${
                buy.outcome === o.value ? 'bg-surface-container-highest' : ''
              }`}
            >
              <span>{getIconChar(o.icon)}</span>
              <span className="text-[8px] text-secondary/50">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
