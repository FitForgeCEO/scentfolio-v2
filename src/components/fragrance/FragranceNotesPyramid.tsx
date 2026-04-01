import { getNoteIconPath, getNoteFamilyColors, getNoteFamily, type NoteFamily } from '@/lib/noteIconMap'

interface FragranceNotesPyramidProps {
  notesTop?: string[]
  notesHeart?: string[]
  notesBase?: string[]
}

/** Tier config */
const TIERS = [
  { key: 'top' as const, label: 'TOP', sublabel: 'First Impression', emoji: '✧' },
  { key: 'heart' as const, label: 'HEART', sublabel: 'The Character', emoji: '♡' },
  { key: 'base' as const, label: 'BASE', sublabel: 'The Foundation', emoji: '◆' },
] as const

/**
 * Premium note chip — icon in a soft glow circle + colour-coded label.
 * Each chip has a subtle coloured shadow matching its family.
 */
function NoteChip({ note, delay }: { note: string; delay: number }) {
  const colors = getNoteFamilyColors(note)
  const iconPath = getNoteIconPath(note)

  return (
    <div
      className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-all duration-500 hover:scale-105 cursor-default"
      style={{
        background: colors.bg,
        boxShadow: `inset 0 0 0 1px ${colors.border}, 0 2px 8px ${colors.bg}`,
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Icon container with subtle glow ring */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.92)',
          boxShadow: `0 0 6px ${colors.border}`,
        }}
      >
        <img
          src={iconPath}
          alt={note}
          className="w-[18px] h-[18px] object-contain"
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/note-icons/water-drop.png'
          }}
        />
      </div>
      <span
        className="text-[11px] font-semibold tracking-wide whitespace-nowrap"
        style={{ color: colors.text }}
      >
        {note}
      </span>
    </div>
  )
}

/**
 * Tier divider — elegant gradient line with a small diamond in the centre.
 */
function TierDivider() {
  return (
    <div className="flex items-center justify-center py-2 gap-3 w-full" style={{ maxWidth: '70%', margin: '0 auto' }}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-primary/20" />
      <div
        className="w-1.5 h-1.5 rotate-45 shrink-0"
        style={{ background: 'rgba(229, 194, 118, 0.25)' }}
      />
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-primary/20" />
    </div>
  )
}

/**
 * Family legend dot.
 */
function FamilyDot({ family, color }: { family: string; color: string }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}40` }}
      />
      <span className="text-[9px] tracking-wide text-secondary/50 uppercase">{family}</span>
    </div>
  )
}

export function FragranceNotesPyramid({ notesTop, notesHeart, notesBase }: FragranceNotesPyramidProps) {
  const hasNotes = (notesTop && notesTop.length > 0) ||
                   (notesHeart && notesHeart.length > 0) ||
                   (notesBase && notesBase.length > 0)

  if (!hasNotes) return null

  // Collect all unique families present for the legend
  const allNotes = [...(notesTop || []), ...(notesHeart || []), ...(notesBase || [])]
  const familiesPresent = new Map<NoteFamily, string>()
  for (const note of allNotes) {
    const family = getNoteFamily(note)
    if (!familiesPresent.has(family)) {
      const colors = getNoteFamilyColors(note)
      familiesPresent.set(family, colors.text)
    }
  }

  const tiers = [
    { ...TIERS[0], notes: notesTop },
    { ...TIERS[1], notes: notesHeart },
    { ...TIERS[2], notes: notesBase },
  ]

  // Pyramid width percentages — top is narrowest, base is widest
  const widthClasses = ['max-w-[72%]', 'max-w-[88%]', 'max-w-full']

  // Running chip index for staggered animation delays
  let chipIndex = 0

  return (
    <section className="py-2">
      {/* Section header */}
      <div className="flex items-center justify-center gap-3 mb-1.5">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/30" />
        <h3 className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
          FRAGRANCE NOTES
        </h3>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/30" />
      </div>
      <p className="text-[10px] text-secondary/35 text-center mb-8 tracking-wide italic">
        How this scent unfolds over time
      </p>

      {/* Pyramid container */}
      <div className="relative">
        {/* Subtle background pyramid glow */}
        <div className="absolute inset-0 flex flex-col items-center pointer-events-none" aria-hidden="true">
          <div
            className="w-full h-full"
            style={{
              clipPath: 'polygon(50% 2%, 10% 98%, 90% 98%)',
              background: 'linear-gradient(180deg, rgba(229, 194, 118, 0.04) 0%, rgba(229, 194, 118, 0.07) 60%, rgba(229, 194, 118, 0.03) 100%)',
            }}
          />
        </div>

        {/* Faint vertical centre line behind everything */}
        <div
          className="absolute left-1/2 top-[10%] bottom-[10%] w-px -translate-x-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(229, 194, 118, 0.08) 30%, rgba(229, 194, 118, 0.08) 70%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        {/* Note tiers */}
        <div className="relative flex flex-col items-center gap-5 py-4">
          {tiers.map(({ key, label, sublabel, emoji, notes }, index) => {
            if (!notes || notes.length === 0) return null

            const tierContent = (
              <div key={key} className={`flex flex-col items-center gap-3 ${widthClasses[index]}`}>
                {/* Tier label */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-primary/30">{emoji}</span>
                  <span className="text-[9px] tracking-[0.3em] font-bold text-primary/70 uppercase">
                    {label}
                  </span>
                  <span className="text-[8px] tracking-[0.15em] text-secondary/25 uppercase">
                    {sublabel}
                  </span>
                </div>

                {/* Note chips */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {notes.map((note) => {
                    const currentIndex = chipIndex++
                    return <NoteChip key={note} note={note} delay={currentIndex * 40} />
                  })}
                </div>

                {/* Divider between tiers (not after last) */}
                {index < 2 && <TierDivider />}
              </div>
            )

            return tierContent
          })}
        </div>
      </div>

      {/* Family colour legend */}
      {familiesPresent.size > 1 && (
        <div className="mt-8 pt-4" style={{ borderTop: '1px solid rgba(229, 194, 118, 0.06)' }}>
          <p className="text-[8px] tracking-[0.2em] text-secondary/25 uppercase text-center mb-3">NOTE FAMILIES</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-4">
            {Array.from(familiesPresent.entries()).map(([family, color]) => (
              <FamilyDot key={family} family={family} color={color} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
