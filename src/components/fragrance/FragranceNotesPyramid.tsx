import { getNoteIconPath, getNoteFamilyColors, getNoteFamily, type NoteFamily } from '@/lib/noteIconMap'

interface FragranceNotesPyramidProps {
  notesTop?: string[]
  notesHeart?: string[]
  notesBase?: string[]
}

/** Tier configuration with visual identity */
const TIERS = [
  { key: 'top' as const, label: 'TOP', sublabel: 'First Impression', icon: '✦', glowColor: 'rgba(229, 194, 118, 0.12)' },
  { key: 'heart' as const, label: 'HEART', sublabel: 'The Character', icon: '♡', glowColor: 'rgba(229, 194, 118, 0.08)' },
  { key: 'base' as const, label: 'BASE', sublabel: 'The Foundation', icon: '◇', glowColor: 'rgba(229, 194, 118, 0.05)' },
] as const

/**
 * Note medallion — icon floats directly on a family-coloured glow disc,
 * no white background. Icons now have transparent backgrounds.
 */
function NoteMedallion({ note }: { note: string }) {
  const colors = getNoteFamilyColors(note)
  const iconPath = getNoteIconPath(note)

  return (
    <div className="flex flex-col items-center gap-1.5 group cursor-default">
      {/* Glowing disc — family colour tint, no white */}
      <div
        className="relative w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
        style={{
          background: `radial-gradient(circle, ${colors.bg} 40%, transparent 70%)`,
          boxShadow: `0 0 16px ${colors.bg}, 0 0 4px ${colors.border}`,
        }}
      >
        {/* Subtle gold ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid ${colors.border}`,
            opacity: 0.4,
          }}
        />
        <img
          src={iconPath}
          alt={note}
          className="w-7 h-7 object-contain relative z-10 drop-shadow-sm"
          style={{
            filter: 'brightness(1.15) contrast(1.1)',
          }}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/note-icons/water-drop.png'
          }}
        />
      </div>
      {/* Note name */}
      <span
        className="text-[10px] font-semibold tracking-wide text-center leading-tight max-w-[72px]"
        style={{ color: colors.text }}
      >
        {note}
      </span>
    </div>
  )
}

/**
 * Vertical gold connector between tiers.
 */
function TierConnector() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-3" style={{ background: 'rgba(229, 194, 118, 0.2)' }} />
      <div
        className="w-1.5 h-1.5 rounded-full my-1"
        style={{ background: 'rgba(229, 194, 118, 0.35)' }}
      />
      <div className="w-px h-3" style={{ background: 'rgba(229, 194, 118, 0.2)' }} />
    </div>
  )
}

/**
 * Family legend pill.
 */
function FamilyPill({ family, color }: { family: string; color: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: `${color}12` }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
      />
      <span className="text-[8px] tracking-[0.12em] font-semibold uppercase" style={{ color }}>{family}</span>
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

  // Progressive widths for pyramid shape
  const tierWidths = ['max-w-[240px]', 'max-w-[300px]', 'max-w-[340px]']

  return (
    <section className="py-6">
      {/* Section header */}
      <div className="flex flex-col items-center mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-10" style={{ background: 'linear-gradient(to right, transparent, rgba(229, 194, 118, 0.3))' }} />
          <span className="text-primary text-xs">✦</span>
          <div className="h-px w-10" style={{ background: 'linear-gradient(to left, transparent, rgba(229, 194, 118, 0.3))' }} />
        </div>
        <h3 className="font-headline text-base tracking-[0.15em] text-primary uppercase mb-1">
          Fragrance Pyramid
        </h3>
        <p className="text-[10px] text-secondary/30 tracking-widest italic">
          How this scent evolves on skin
        </p>
      </div>

      {/* Pyramid tiers */}
      <div className="flex flex-col items-center">
        {tiers.map(({ key, label, sublabel, icon, glowColor, notes }, index) => {
          if (!notes || notes.length === 0) return null

          return (
            <div key={key} className="flex flex-col items-center w-full">
              {/* Connector from previous tier */}
              {index > 0 && <TierConnector />}

              {/* Tier card */}
              <div className={`w-full ${tierWidths[index]} mx-auto`}>
                <div
                  className="relative rounded-2xl px-5 py-5 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, rgba(38, 30, 27, 0.8), rgba(38, 30, 27, 0.4))`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: `inset 0 1px 0 rgba(229, 194, 118, 0.08), 0 4px 24px rgba(0,0,0,0.2)`,
                  }}
                >
                  {/* Subtle radial glow behind the card */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
                    }}
                    aria-hidden="true"
                  />

                  {/* Tier label row */}
                  <div className="relative flex items-center justify-center gap-2 mb-4">
                    <span className="text-primary/40 text-[10px]">{icon}</span>
                    <div className="flex flex-col items-center">
                      <span className="font-headline text-[13px] tracking-[0.25em] text-primary/90 uppercase">
                        {label}
                      </span>
                      <span className="text-[8px] tracking-[0.15em] text-secondary/30 uppercase mt-0.5">
                        {sublabel}
                      </span>
                    </div>
                    <span className="text-primary/40 text-[10px]">{icon}</span>
                  </div>

                  {/* Note medallions */}
                  <div className="relative flex gap-4 flex-wrap justify-center">
                    {notes.map((note) => (
                      <NoteMedallion key={note} note={note} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Family colour legend */}
      {familiesPresent.size > 1 && (
        <div className="mt-10 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-6" style={{ background: 'linear-gradient(to right, transparent, rgba(229, 194, 118, 0.12))' }} />
            <span className="text-[7px] tracking-[0.25em] text-secondary/20 uppercase font-bold">Note Families</span>
            <div className="h-px w-6" style={{ background: 'linear-gradient(to left, transparent, rgba(229, 194, 118, 0.12))' }} />
          </div>
          <div className="flex flex-wrap justify-center gap-2 px-4">
            {Array.from(familiesPresent.entries()).map(([family, color]) => (
              <FamilyPill key={family} family={family} color={color} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
