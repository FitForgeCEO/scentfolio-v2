import { useRef, useState, useCallback } from 'react'
import { Icon } from '../ui/Icon'

interface ShareStackCardProps {
  isOpen: boolean
  onClose: () => void
  vibeStatement: string
  bodyPrep: { product: string; brand: string }
  baseFragrance: { name: string; brand: string; image_url?: string | null }
  topLayer: { name: string; brand: string; fromCollection?: boolean }
  whyItWorks: string
}

/**
 * Branded shareable card (390×700) for layering stacks.
 * Renders as a modal overlay with export-to-image functionality.
 */
export function ShareStackCard({
  isOpen,
  onClose,
  vibeStatement,
  bodyPrep,
  baseFragrance,
  topLayer,
  whyItWorks,
}: ShareStackCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleExport = useCallback(async () => {
    if (!cardRef.current) return
    setExporting(true)

    try {
      // Dynamic import — html-to-image is only loaded when user shares
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(cardRef.current, {
        width: 390,
        height: 700,
        pixelRatio: 2,
        backgroundColor: '#191210',
      })

      // Try native share with image if available
      if (navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const file = new File([blob], 'scentfolio-stack.png', { type: 'image/png' })

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Layering Stack',
            files: [file],
          })
          setExporting(false)
          return
        }
      }

      // Fallback: download the image
      const link = document.createElement('a')
      link.download = 'scentfolio-stack.png'
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export error:', err)
    }
    setExporting(false)
  }, [])

  const handleCopyText = useCallback(async () => {
    const text = `🧴 ${vibeStatement}\n\n1. ${bodyPrep.product} — ${bodyPrep.brand}\n2. ${baseFragrance.name} — ${baseFragrance.brand}\n3. ${topLayer.name} — ${topLayer.brand}\n\nCrafted with ScentFolio AI ✨`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [vibeStatement, bodyPrep, baseFragrance, topLayer])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal container */}
      <div className="relative z-10 flex flex-col items-center gap-5 animate-slide-up">
        {/* The shareable card */}
        <div
          ref={cardRef}
          className="w-[390px] h-[700px] rounded-2xl overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(180deg, #191210 0%, #261e1b 50%, #191210 100%)' }}
        >
          {/* Card inner */}
          <div className="h-full flex flex-col px-7 py-8">
            {/* Logo / Brand */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Icon name="auto_awesome" filled className="text-primary text-sm" />
              <span className="text-[10px] font-bold tracking-[0.3em] text-primary uppercase">
                SCENTFOLIO AI
              </span>
              <Icon name="auto_awesome" filled className="text-primary text-sm" />
            </div>
            <p className="text-[8px] tracking-[0.2em] text-secondary/30 text-center uppercase mb-6">
              LAYERING STACK
            </p>

            {/* Vibe statement */}
            <div className="flex-shrink-0 mb-8">
              <div className="w-8 h-[1px] bg-primary/30 mx-auto mb-4" />
              <p
                className="font-headline italic text-lg text-primary leading-relaxed text-center px-2"
                style={{ fontFamily: '"Noto Serif", Georgia, serif' }}
              >
                "{vibeStatement}"
              </p>
              <div className="w-8 h-[1px] bg-primary/30 mx-auto mt-4" />
            </div>

            {/* Stack steps */}
            <div className="flex-1 flex flex-col justify-center gap-4">
              {/* Step 1: Body Prep */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">1</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] tracking-[0.15em] text-secondary/40 uppercase">BODY PREP</p>
                  <p className="text-sm font-semibold text-on-surface truncate">{bodyPrep.product}</p>
                  <p className="text-[10px] text-secondary/50 uppercase tracking-wider">{bodyPrep.brand}</p>
                </div>
              </div>

              {/* Connector line */}
              <div className="ml-4 w-[1px] h-3 bg-primary/20" />

              {/* Step 2: Base Layer */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {baseFragrance.image_url ? (
                    <img src={baseFragrance.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-primary">2</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] tracking-[0.15em] text-secondary/40 uppercase">BASE LAYER</p>
                  <p className="text-sm font-semibold text-on-surface truncate">{baseFragrance.name}</p>
                  <p className="text-[10px] text-secondary/50 uppercase tracking-wider">{baseFragrance.brand}</p>
                </div>
              </div>

              {/* Connector line */}
              <div className="ml-4 w-[1px] h-3 bg-primary/20" />

              {/* Step 3: Top Layer */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">3</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[8px] tracking-[0.15em] text-secondary/40 uppercase">TOP LAYER</p>
                    {topLayer.fromCollection && (
                      <span className="text-[7px] bg-primary/15 text-primary px-1.5 py-0.5 rounded tracking-tight uppercase">
                        YOURS
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-on-surface truncate">{topLayer.name}</p>
                  <p className="text-[10px] text-secondary/50 uppercase tracking-wider">{topLayer.brand}</p>
                </div>
              </div>
            </div>

            {/* Why it works (abbreviated) */}
            <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(229, 194, 118, 0.1)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="lightbulb" className="text-primary text-xs" />
                <span className="text-[8px] font-bold tracking-[0.2em] text-primary uppercase">WHY THIS WORKS</span>
              </div>
              <p className="text-[11px] text-secondary/60 leading-relaxed line-clamp-3 italic">
                {whyItWorks}
              </p>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-5 flex items-center justify-center gap-1.5">
              <Icon name="water_drop" filled className="text-primary text-xs" />
              <span className="text-[9px] font-bold tracking-[0.2em] text-primary/60 uppercase">
                scentfolio-app.web.app
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons below the card */}
        <div className="flex gap-3 w-full max-w-[390px]">
          <button
            onClick={handleCopyText}
            className="flex-1 h-12 bg-surface-container rounded-xl text-[11px] font-bold tracking-widest uppercase text-on-surface active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={16} />
            {copied ? 'Copied' : 'Copy Text'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 h-12 gold-gradient rounded-xl text-[11px] font-bold tracking-widest uppercase text-on-primary active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Icon name={exporting ? 'hourglass_empty' : 'download'} size={16} />
            {exporting ? 'Saving...' : 'Save Image'}
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center active:scale-90 transition-transform"
        >
          <Icon name="close" className="text-secondary" size={20} />
        </button>
      </div>
    </div>
  )
}
