import { useState } from 'react'

/* ─── Note family → glyph + gradient mapping ─── */
const FAMILY_STYLES: Record<string, { glyph: string; from: string; to: string }> = {
  woody:    { glyph: '◆', from: '#4a3728', to: '#2d1f14' },
  oriental: { glyph: '✦', from: '#5c3a1e', to: '#2e1d0e' },
  floral:   { glyph: '❋', from: '#4a2040', to: '#2a1028' },
  fresh:    { glyph: '◇', from: '#1a3a2a', to: '#0e2018' },
  citrus:   { glyph: '◈', from: '#4a4020', to: '#2e2810' },
  aquatic:  { glyph: '≈', from: '#1a2a3a', to: '#0e1828' },
  aromatic: { glyph: '※', from: '#2a3a20', to: '#182810' },
  gourmand: { glyph: '●', from: '#3a2020', to: '#281010' },
  fruity:   { glyph: '◉', from: '#4a2a30', to: '#2e1820' },
  spicy:    { glyph: '✧', from: '#4a2018', to: '#2e1008' },
  powdery:  { glyph: '○', from: '#3a2a3a', to: '#201820' },
  leather:  { glyph: '▪', from: '#3a2a1a', to: '#201808' },
  musk:     { glyph: '◦', from: '#2a2028', to: '#181018' },
  amber:    { glyph: '◆', from: '#4a3018', to: '#2e1c08' },
  green:    { glyph: '❖', from: '#1a3020', to: '#0e2010' },
  oud:      { glyph: '◈', from: '#3a2818', to: '#201408' },
  vanilla:  { glyph: '◇', from: '#3a3020', to: '#201c10' },
  rose:     { glyph: '❋', from: '#3a1830', to: '#200818' },
  tobacco:  { glyph: '◆', from: '#3a2a18', to: '#201808' },
  marine:   { glyph: '≈', from: '#183040', to: '#081828' },
}

const DEFAULT_STYLE = { glyph: '✦', from: '#2a2018', to: '#1a1008' }

function getFamilyStyle(noteFamily: string | null | undefined) {
  if (!noteFamily) return DEFAULT_STYLE
  const key = noteFamily.toLowerCase().trim()
  // Try exact match first, then partial
  if (FAMILY_STYLES[key]) return FAMILY_STYLES[key]
  for (const [k, v] of Object.entries(FAMILY_STYLES)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return DEFAULT_STYLE
}

interface FragranceImageProps {
  src: string | null | undefined
  alt: string
  noteFamily?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function FragranceImage({ src, alt, noteFamily, className = '', size = 'md' }: FragranceImageProps) {
  const [failed, setFailed] = useState(!src)
  const style = getFamilyStyle(noteFamily)

  const emojiSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-4xl' : 'text-2xl'
  const labelSize = size === 'sm' ? 'hidden' : size === 'lg' ? 'text-[9px]' : 'text-[8px]'

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 ${className}`}
        style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
        role="img"
        aria-label={alt}
      >
        <span className={`${emojiSize} text-primary/40`}>{style.glyph}</span>
        {noteFamily && (
          <span className={`${labelSize} text-white/30 uppercase tracking-wider font-medium`}>
            {noteFamily}
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src={src!}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}
