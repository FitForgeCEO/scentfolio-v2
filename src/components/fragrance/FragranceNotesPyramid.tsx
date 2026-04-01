import { getNoteIconPath, getNoteFamilyColors, getNoteFamily, type NoteFamily } from '@/lib/noteIconMap'

interface FragranceNotesPyramidProps {
  notesTop?: string[]
  notesHeart?: string[]
  notesBase?: string[]
}

/** Tier config — label, description, max-width class for pyramid shape */
const TIERS = [
  { key: 'top' as const, label: 'TOP', sublabel: 'First Impression', icon: 'expand_less' },
  { key: 'heart' as const, label: 'HEART', sublabel: 'The Character', icon: 'favorite' },
  { key: 'base' as const, label: 'BASE', sublabel: 'The Foundation', icon: 'expand_more' },
] as const

/**
 * Note chip with custom PNG icon + colour-coded by family.
 * The chip uses a subtle tinted background from the note's family palette.
 */
function NoteChip({ note }: { note: string }) {
  const colors = getNoteFamilyColors(note)
  const iconPath = getNoteIconPath(note)

  return (
    <div
      className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full transition-all duration-300 hover:scale-105 cursor-default"
      style={{
        background: colors.bg,
        boxShadow: `inset 0 0 0 1px ${colors.border}`,
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
        style={{ background: colors.bg }}
      >
        <img
          src={iconPath}
          alt={note}
          className="w-5 h-5 object-contain"
          loading="lazy"
          onError={(e) => {
            // Fallback to water-drop if icon fails
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
 * Decorative pyramid tier divider — a thin tapered line between tiers.
 */
function TierDivider() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" style={{ width: '60%' }} />
    </div>
  )
}

/**
 * Family legend dot — small colour indicator shown in the legend.
 */
function FamilyDot({ family, color }: { family: string; color: string }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
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
  const widthClasses = ['max-w-[75%]', 'max-w-[90%]', 'max-w-full']

  return (
    <section>
      {/* Section header */}
      <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-2 text-center">
        FRAGRANCE NOTES
      </h3>
      <p className="text-[10px] text-secondary/40 text-center mb-8 tracking-wide">
        How this scent unfolds
      </p>

      {/* Pyramid container */}
      <div className="relative">
        {/* Subtle background pyramid shape */}
        <div className="absolute inset-0 flex flex-col items-center pointer-events-none" aria-hidden="true">
          <div
            className="w-full h-full"
            style={{
              clipPath: 'polygon(50% 0%, 8% 100%, 92% 100%)',
              background: 'linear-gradient(180deg, rgba(229, 194, 118, 0.03) 0%, rgba(229, 194, 118, 0.06) 100%)',
            }}
          />
        </div>

        {/* Note tiers */}
        <div className="relative flex flex-col items-center gap-6 py-4">
          {tiers.map(({ key, label, sublabel, notes }, index) =>
            notes && notes.length > 0 ? (
              <div key={key} className={`flex flex-col items-center gap-3 ${widthClasses[index]}`}>
                {/* Tier label */}
                <div className="flex items-center gap-2">
                  <div className="h-px w-6 bg-primary/15" />
                  <span className="text-[9px] tracking-[0.25em] font-bold text-primary/60 uppercase">
                    {label}
                  </span>
                  <div className="h-px w-6 bg-primary/15" />
                </div>
                <span className="text-[8px] tracking-[0.15em] text-secondary/30 uppercase -mt-2">
                  {sublabel}
                </span>

                {/* Note chips */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {notes.map((note) => (
                    <NoteChip key={note} note={note} />
                  ))}
                </div>

                {/* Divider between tiers (not after last) */}
                {index < 2 && <TierDivider />}
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Family colour legend */}
      {familiesPresent.size > 1 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-8 px-4">
          {Array.from(familiesPresent.entries()).map(([family, color]) => (
            <FamilyDot key={family} family={family} color={color} />
          ))}
        </div>
      )}
    </section>
  )
}
