import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { UserCollection, Fragrance } from '@/types/database'

/**
 * PromoteToOwnedSheet
 *
 * Bottom sheet shown when a keeper promotes an "in waiting" (wishlist) bottle
 * onto their owned shelves. Captures three *optional* fields — date acquired,
 * bottle size and purchase source — before committing the status change.
 *
 * The sheet itself does not touch Supabase. It calls `onConfirm` with the
 * metadata the keeper chose to supply (nulls for anything skipped) and lets
 * the parent screen handle persistence, XP and toasting. This keeps the sheet
 * reusable across WishlistScreen and CollectionScreen.
 */

type PromoteItem = UserCollection & { fragrance: Fragrance }

export interface PromoteMeta {
  date_acquired: string | null
  bottle_size: string | null
  purchase_source: string | null
}

const BOTTLE_SIZES = ['30ml', '50ml', '100ml', 'Decant', 'Other'] as const
const PURCHASE_SOURCES = ['Boutique', 'Online', 'Gift', 'Swap', 'Other'] as const

/** Format a Date as YYYY-MM-DD for the <input type="date"> default. */
function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function PromoteToOwnedSheet({
  item,
  onClose,
  onConfirm,
}: {
  item: PromoteItem
  onClose: () => void
  onConfirm: (item: PromoteItem, meta: PromoteMeta) => void | Promise<void>
}) {
  const trapRef = useFocusTrap(true, onClose)
  const [dateAcquired, setDateAcquired] = useState<string>(todayISO())
  const [bottleSize, setBottleSize] = useState<string>('')
  const [purchaseSource, setPurchaseSource] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const hairlineStyle: React.CSSProperties = {
    height: '1px',
    background:
      'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
    width: '100%',
  }

  const submit = async (withMeta: boolean) => {
    if (saving) return
    setSaving(true)
    await onConfirm(item, {
      date_acquired: withMeta && dateAcquired ? dateAcquired : null,
      bottle_size: withMeta && bottleSize ? bottleSize : null,
      purchase_source: withMeta && purchaseSource ? purchaseSource : null,
    })
    // Parent closes the sheet; no need to reset state.
  }

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Promote to the shelves"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <section
        className="relative w-full max-h-[85vh] bg-surface-container-low rounded-t-sm flex flex-col overflow-hidden"
        style={{ boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Grab bar */}
        <div className="flex justify-center py-4">
          <div className="w-12 h-px bg-primary/30" />
        </div>

        {/* Header */}
        <header className="px-8 pb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="font-label text-primary/60 text-[0.6rem] tracking-[0.3em] uppercase mb-2">
                TO THE SHELVES
              </p>
              <h2 className="font-headline italic text-2xl md:text-3xl text-on-background leading-tight truncate">
                {item.fragrance.name}
              </h2>
              <p className="font-label text-primary/70 text-[0.6rem] tracking-[0.15em] uppercase mt-1">
                {item.fragrance.brand}
              </p>
            </div>
            <button
              onClick={onClose}
              className="font-headline italic text-base text-secondary/60 hover:text-on-background transition-colors flex-shrink-0 pt-1"
            >
              close
            </button>
          </div>
          <div className="mt-6" style={hairlineStyle} />
        </header>

        {/* Optional metadata form */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
          <p className="font-headline italic text-base text-secondary/60 leading-relaxed">
            A few details for the record, if you care to. All of this is optional — nothing is required to make the bottle yours.
          </p>

          {/* Date acquired */}
          <div>
            <label className="block font-label text-primary/70 text-[0.6rem] tracking-[0.2em] uppercase mb-3">
              Date acquired
            </label>
            <input
              type="date"
              value={dateAcquired}
              onChange={(e) => setDateAcquired(e.target.value)}
              className="w-full bg-transparent font-headline italic text-lg text-on-background focus:outline-none py-2"
            />
            <div style={hairlineStyle} />
          </div>

          {/* Bottle size */}
          <div>
            <label className="block font-label text-primary/70 text-[0.6rem] tracking-[0.2em] uppercase mb-3">
              Bottle size
            </label>
            <div className="flex flex-wrap gap-2">
              {BOTTLE_SIZES.map((size) => {
                const active = bottleSize === size
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBottleSize(active ? '' : size)}
                    className="py-2 px-4 rounded-sm font-headline italic text-sm transition-colors"
                    style={{
                      border: active
                        ? '1px solid rgba(229,194,118,0.8)'
                        : '1px solid rgba(229,194,118,0.2)',
                      color: active ? '#e5c276' : 'rgba(232,223,211,0.6)',
                      background: active ? 'rgba(229,194,118,0.08)' : 'transparent',
                    }}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Purchase source */}
          <div>
            <label className="block font-label text-primary/70 text-[0.6rem] tracking-[0.2em] uppercase mb-3">
              Acquired from
            </label>
            <div className="flex flex-wrap gap-2">
              {PURCHASE_SOURCES.map((src) => {
                const active = purchaseSource === src
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setPurchaseSource(active ? '' : src)}
                    className="py-2 px-4 rounded-sm font-headline italic text-sm transition-colors"
                    style={{
                      border: active
                        ? '1px solid rgba(229,194,118,0.8)'
                        : '1px solid rgba(229,194,118,0.2)',
                      color: active ? '#e5c276' : 'rgba(232,223,211,0.6)',
                      background: active ? 'rgba(229,194,118,0.08)' : 'transparent',
                    }}
                  >
                    {src}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <footer className="px-8 pb-8 pt-4 border-t border-primary/10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={saving}
            className="font-headline italic text-base text-secondary/60 hover:text-on-background transition-colors disabled:opacity-50"
          >
            skip the details
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={saving}
            className="py-3 px-8 rounded-sm font-label text-[0.65rem] font-bold tracking-[0.2em] uppercase text-on-primary-container disabled:opacity-60"
            style={{ background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)' }}
          >
            {saving ? 'FILING…' : 'TO THE SHELVES'}
          </button>
        </footer>
      </section>
    </div>
  )
}
