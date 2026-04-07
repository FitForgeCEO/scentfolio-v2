import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { useToast } from '@/contexts/ToastContext'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance } from '@/types/database'

interface ShareCardProps {
  fragrance: Fragrance
  personalRating?: number | null
  onClose: () => void
}

const CARD_STYLES = [
  { name: 'Noir', bg: '#191210', text: '#f0dfdb', accent: '#e5c276', border: '#e5c27640' },
  { name: 'Ivory', bg: '#fdf8f0', text: '#191210', accent: '#c4a35a', border: '#c4a35a40' },
  { name: 'Midnight', bg: '#0a0a1a', text: '#e0e0ff', accent: '#8b80ff', border: '#8b80ff40' },
  { name: 'Sage', bg: '#0f1f14', text: '#d0e8d6', accent: '#6bb578', border: '#6bb57840' },
]

export function ShareCardSheet({ fragrance, personalRating, onClose }: ShareCardProps) {
  const trapRef = useFocusTrap(true, onClose)
  const { showToast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [styleIdx, setStyleIdx] = useState(0)
  const [sharing, setSharing] = useState(false)
  const style = CARD_STYLES[styleIdx]

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)

    try {
      // Use canvas to capture the card
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvas = (await import('html2canvas' as any)).default as any
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: style.bg,
        scale: 2,
        useCORS: true,
        logging: false,
      }) as HTMLCanvasElement

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) { showToast('Failed to generate image', 'error'); setSharing(false); return }

        // Try native share API first
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `${fragrance.name}-scentfolio.png`, { type: 'image/png' })
          const shareData = { files: [file], title: `${fragrance.brand} ${fragrance.name}`, text: `Check out ${fragrance.name} by ${fragrance.brand} on ScentFolio` }
          if (navigator.canShare(shareData)) {
            try {
              await navigator.share(shareData)
              showToast('Shared!', 'success')
              setSharing(false)
              return
            } catch { /* user cancelled, fall through to download */ }
          }
        }

        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fragrance.name}-scentfolio.png`
        a.click()
        URL.revokeObjectURL(url)
        showToast('Image saved!', 'success', 'download')
        setSharing(false)
      }, 'image/png')
    } catch {
      // html2canvas not available — fallback to clipboard text
      const text = `${fragrance.brand} — ${fragrance.name}\n${fragrance.rating ? `Rating: ${Number(fragrance.rating).toFixed(1)}/5` : ''}\n${fragrance.note_family ? `Family: ${fragrance.note_family}` : ''}\n\nShared via ScentFolio`
      try {
        await navigator.clipboard.writeText(text)
        showToast('Copied to clipboard!', 'success', 'content_copy')
      } catch {
        showToast('Share not available', 'error')
      }
      setSharing(false)
    }
  }

  const handleCopyText = async () => {
    const text = `${fragrance.brand} — ${fragrance.name}\n${fragrance.rating ? `Rating: ${Number(fragrance.rating).toFixed(1)}/5` : ''}\n${fragrance.note_family ? `Family: ${fragrance.note_family}` : ''}\n\nShared via ScentFolio`
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied!', 'success', 'content_copy')
    } catch {
      showToast('Copy failed', 'error')
    }
  }

  const rating = personalRating ?? Number(fragrance.rating)
  const topAccords = fragrance.main_accords_percentage
    ? Object.entries(fragrance.main_accords_percentage)
        .sort(([, a], [, b]) => parseFloat(b as string) - parseFloat(a as string))
        .slice(0, 4)
        .map(([name]) => name)
    : []

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-modal)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Share fragrance">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section className="relative w-full max-h-[90vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <h2 className="text-xl font-headline font-bold text-on-surface">Share Card</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform">
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Card Preview */}
        <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
          <div
            ref={cardRef}
            className="rounded-2xl overflow-hidden p-6"
            style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
          >
            {/* Card Content */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-20 h-24 rounded-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: `${style.accent}15` }}>
                {fragrance.image_url ? (
                  <img src={fragrance.image_url} alt={fragrance.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span style={{ color: `${style.accent}40`, fontSize: '28px' }}>✦</span>
                  </div>
                )}
              </div>
              <div>
                <p style={{ color: style.accent, fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>{fragrance.brand}</p>
                <h3 style={{ color: style.text, fontSize: '18px', fontWeight: 700, lineHeight: 1.2, marginTop: '2px' }}>{fragrance.name}</h3>
                {fragrance.concentration && (
                  <p style={{ color: `${style.text}80`, fontSize: '11px', marginTop: '4px' }}>{fragrance.concentration}</p>
                )}
              </div>
            </div>

            {/* Rating */}
            {rating > 0 && (
              <div className="flex items-center gap-2 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ color: i < Math.round(rating) ? style.accent : `${style.text}20`, fontSize: '18px' }}>★</span>
                ))}
                <span style={{ color: style.accent, fontSize: '14px', fontWeight: 700, marginLeft: '4px' }}>{rating.toFixed(1)}</span>
              </div>
            )}

            {/* Accords */}
            {topAccords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {topAccords.map((accord) => (
                  <span
                    key={accord}
                    style={{
                      backgroundColor: `${style.accent}15`,
                      color: style.accent,
                      fontSize: '10px',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontWeight: 600,
                    }}
                  >
                    {accord}
                  </span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${style.border}`, paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: style.accent, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}>SCENTFOLIO</span>
              {fragrance.note_family && (
                <span style={{ color: `${style.text}60`, fontSize: '10px' }}>{fragrance.note_family}</span>
              )}
            </div>
          </div>

          {/* Style Picker */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary/50 font-bold mb-3">CARD STYLE</p>
            <div className="flex gap-3">
              {CARD_STYLES.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setStyleIdx(i)}
                  className={`flex-1 py-3 rounded-xl text-center text-xs font-medium transition-all ${
                    i === styleIdx ? 'ring-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 py-3.5 gold-gradient text-on-primary font-bold uppercase tracking-[0.1em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
            >
              {sharing ? (
                <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Icon name="share" size={18} />
                  SHARE
                </>
              )}
            </button>
            <button
              onClick={handleCopyText}
              className="py-3.5 px-5 bg-surface-container rounded-xl active:scale-95 transition-transform flex items-center gap-2"
            >
              <Icon name="content_copy" className="text-primary" size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
