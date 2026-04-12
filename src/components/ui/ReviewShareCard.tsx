import { useRef, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { captureElement, shareImage, copyToClipboard } from '@/lib/share'

interface ReviewShareProps {
  reviewerName: string
  fragranceName: string
  fragranceBrand: string
  fragranceImage: string | null
  rating: number
  reviewText: string | null
  seasonTags?: string[] | null
  onClose: () => void
}

const THEMES = [
  { name: 'Noir', bg: '#191210', text: '#f0dfdb', accent: '#e5c276', muted: '#f0dfdb60', dim: '#f0dfdb30', quoteMark: '#e5c27640' },
  { name: 'Ivory', bg: '#fdf8f0', text: '#191210', accent: '#c4a35a', muted: '#19121080', dim: '#19121030', quoteMark: '#c4a35a40' },
  { name: 'Midnight', bg: '#0a0a1a', text: '#e0e0ff', accent: '#8b80ff', muted: '#e0e0ff60', dim: '#e0e0ff30', quoteMark: '#8b80ff40' },
]

export function ReviewShareCard({ reviewerName, fragranceName, fragranceBrand, fragranceImage, rating, reviewText, seasonTags, onClose }: ReviewShareProps) {
  const trapRef = useFocusTrap(true, onClose)
  const { showToast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [themeIdx, setThemeIdx] = useState(0)
  const [sharing, setSharing] = useState(false)
  const theme = THEMES[themeIdx]

  const truncatedReview = reviewText
    ? reviewText.length > 200 ? reviewText.slice(0, 197) + '...' : reviewText
    : null

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)
    const blob = await captureElement(cardRef.current, theme.bg)
    if (!blob) { showToast('Failed to generate image', 'error'); setSharing(false); return }
    const result = await shareImage(blob, `review-${fragranceName.toLowerCase().replace(/\s+/g, '-')}.png`, `Review: ${fragranceBrand} ${fragranceName}`, `${rating}/5 — ${truncatedReview ?? 'Check it out on ScentFolio!'}`)
    if (result === 'downloaded') showToast('Image saved!', 'success')
    else if (result === 'shared') showToast('Shared!', 'success')
    else showToast('Could not share', 'error')
    setSharing(false)
  }

  const handleCopy = async () => {
    const text = `${fragranceBrand} — ${fragranceName}\nRating: ${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))} (${rating}/5)\n${truncatedReview ? `\n"${truncatedReview}"\n` : ''}\nReviewed by ${reviewerName} on ScentFolio`
    const ok = await copyToClipboard(text)
    showToast(ok ? 'Copied!' : 'Copy failed', ok ? 'success' : 'error')
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-modal)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Share review">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section className="relative w-full max-h-[90vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <h2 className="text-xl font-headline font-bold text-on-surface">Share Review</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:opacity-80 transition-transform">
            <span>✕</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
          {/* Card Preview */}
          <div ref={cardRef} className="rounded-sm overflow-hidden p-6" style={{ backgroundColor: theme.bg }}>
            {/* Fragrance header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '56px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, backgroundColor: `${theme.accent}15` }}>
                {fragranceImage ? (
                  <img src={fragranceImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: `${theme.accent}40`, fontSize: '20px' }}>✦</span>
                  </div>
                )}
              </div>
              <div>
                <p style={{ color: theme.accent, fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>{fragranceBrand}</p>
                <p style={{ color: theme.text, fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>{fragranceName}</p>
              </div>
            </div>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '12px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: i < Math.round(rating) ? theme.accent : theme.dim, fontSize: '18px' }}>★</span>
              ))}
              <span style={{ color: theme.accent, fontSize: '14px', fontWeight: 700, marginLeft: '6px' }}>{rating.toFixed(1)}</span>
            </div>

            {/* Review text */}
            {truncatedReview && (
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <span style={{ color: theme.quoteMark, fontSize: '40px', fontWeight: 700, position: 'absolute', top: '-10px', left: '-4px', lineHeight: 1 }}>"</span>
                <p style={{ color: theme.text, fontSize: '13px', lineHeight: 1.6, paddingLeft: '20px', fontStyle: 'italic' }}>
                  {truncatedReview}
                </p>
              </div>
            )}

            {/* Season tags */}
            {seasonTags && seasonTags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {seasonTags.map(tag => (
                  <span key={tag} style={{ backgroundColor: `${theme.accent}15`, color: theme.accent, fontSize: '9px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${theme.dim}`, paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: theme.muted, fontSize: '10px' }}>— {reviewerName}</span>
              <span style={{ color: theme.accent, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em' }}>SCENTFOLIO</span>
            </div>
          </div>

          {/* Theme picker */}
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

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 py-3.5 gold-gradient text-on-primary font-bold uppercase tracking-[0.1em] rounded-sm ambient-glow hover:opacity-80 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
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
        </div>
      </section>
    </div>
  )
}
