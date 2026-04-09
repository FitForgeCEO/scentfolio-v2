import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useTopShelf, useTopShelfSearch } from '@/hooks/useTopShelf'

export function TopShelfScreen() {
  const navigate = useNavigate()
  const { items, loading, saving, addToShelf, removeFromShelf, moveItem, maxSlots } = useTopShelf()
  const { query, setQuery, results, searching } = useTopShelfSearch()
  const [addMode, setAddMode] = useState(false)

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  const existingIds = new Set(items.map(i => i.fragrance_id))

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Top Shelf</h1>
        <p className="text-xs text-secondary/50">
          Your {maxSlots} all-time favourites · {items.length}/{maxSlots} filled
        </p>
      </section>

      {/* Trophy case grid */}
      {items.length === 0 && !addMode ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="emoji_events" className="text-primary/40 text-4xl" />
          </div>
          <p className="text-sm text-secondary/50 text-center max-w-[260px]">
            Your top shelf is empty. Add your all-time favourite fragrances to showcase them.
          </p>
          <button
            onClick={() => setAddMode(true)}
            className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all"
          >
            Add fragrances
          </button>
        </div>
      ) : (
        <>
          {/* Shelf display */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {items.map((item, index) => (
              <div
                key={item.fragrance_id}
                className="relative bg-surface-container rounded-2xl p-3 group"
              >
                {/* Position badge */}
                <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                  <span className="text-[10px] font-bold text-on-primary">#{index + 1}</span>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFromShelf(item.fragrance_id)}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-error/80 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                >
                  <Icon name="close" size={12} className="text-white" />
                </button>

                {/* Fragrance image */}
                <button
                  onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
                  className="w-full aspect-square rounded-xl overflow-hidden bg-surface-container-highest mb-2 active:scale-95 transition-transform"
                >
                  {item.fragrance.image_url ? (
                    <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="water_drop" className="text-primary/20 text-2xl" />
                    </div>
                  )}
                </button>

                {/* Info */}
                <p className="text-xs text-on-surface font-medium truncate">{item.fragrance.name}</p>
                <p className="text-[9px] text-secondary/50 truncate">{item.fragrance.brand}</p>

                {/* Move buttons */}
                <div className="flex gap-1 mt-2">
                  {index > 0 && (
                    <button
                      onClick={() => moveItem(index, index - 1)}
                      className="flex-1 flex items-center justify-center py-1 rounded-lg bg-surface-container-highest/60 active:bg-surface-container-highest"
                    >
                      <Icon name="arrow_back" size={12} className="text-secondary/40" />
                    </button>
                  )}
                  {index < items.length - 1 && (
                    <button
                      onClick={() => moveItem(index, index + 1)}
                      className="flex-1 flex items-center justify-center py-1 rounded-lg bg-surface-container-highest/60 active:bg-surface-container-highest"
                    >
                      <Icon name="arrow_forward" size={12} className="text-secondary/40" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {items.length < maxSlots && (
              <button
                onClick={() => setAddMode(true)}
                className="aspect-[3/4] rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 active:border-primary/40 transition-colors"
              >
                <Icon name="add" className="text-primary/30 text-2xl" />
                <span className="text-[9px] text-secondary/40 uppercase tracking-wider">Add</span>
              </button>
            )}
          </div>

          {/* Add button when not in add mode */}
          {!addMode && items.length < maxSlots && (
            <button
              onClick={() => setAddMode(true)}
              className="w-full bg-surface-container rounded-xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mb-4"
            >
              <Icon name="add_circle" className="text-primary" size={18} />
              <span className="text-sm text-primary font-medium">Add to shelf</span>
            </button>
          )}
        </>
      )}

      {/* Add mode search */}
      {addMode && (
        <section className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">ADD FROM COLLECTION</h3>
            <button onClick={() => { setAddMode(false); setQuery('') }} className="text-xs text-primary">
              Done
            </button>
          </div>

          <div className="relative mb-3">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
            <input
              type="text"
              placeholder="Search your collection…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full bg-surface-container rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-secondary/30 outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {searching && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((f) => {
                const already = existingIds.has(f.id)
                return (
                  <button
                    key={f.id}
                    onClick={() => { if (!already) addToShelf(f) }}
                    disabled={already}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      already ? 'opacity-40' : 'bg-surface-container active:bg-surface-container-highest'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
                      {f.image_url ? (
                        <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="water_drop" className="text-secondary/20" size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface truncate">{f.name}</p>
                      <p className="text-[10px] text-secondary/50">{f.brand}</p>
                    </div>
                    {already ? (
                      <Icon name="check_circle" className="text-primary/40" size={18} />
                    ) : (
                      <Icon name="add_circle_outline" className="text-primary" size={18} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {query.length >= 2 && !searching && results.length === 0 && (
            <p className="text-sm text-secondary/40 text-center py-6">No matches in your collection</p>
          )}
        </section>
      )}

      {saving && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-surface-container-highest px-4 py-2 rounded-full shadow-lg">
          <span className="text-[10px] text-secondary/60">Saving…</span>
        </div>
      )}
    </main>
  )
}
