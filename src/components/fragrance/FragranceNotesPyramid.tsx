import { getNoteIconPath, getNoteFamilyColors, getNoteFamily, type NoteFamily } from '@/lib/noteIconMap'

interface FragranceNotesPyramidProps {
  notesTop?: string[]
  notesHeart?: string[]
  notesBase?: string[]
}

const TIERS = [
  { key: 'top' as const, label: 'TOP NOTES' },
  { key: 'heart' as const, label: 'MIDDLE NOTES' },
  { key: 'base' as const, label: 'BASE NOTES' },
] as const

/**
 * Note icon — large, clear, no decoration. Fragrantica-style.
 */
function NoteIcon({ note }: { note: string }) {
  const colors = getNoteFamilyColors(note)
  const iconPath = getNoteIconPath(note)

  return (
    <div className="flex flex-col items-center gap-1 cursor-default">
      {/* Large icon — no rings, no glow, just the image */}
      <div className="w-16 h-16 flex items-center justify-center">
        <img
          src={iconPath}
          alt={note}
          className="w-14 h-14 object-contain"
          style={{
            filter: 'brightness(1.2) contrast(1.15)',
          }}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/note-icons/water-drop.png'
          }}
        />
      </div>
      {/* Note name — family-coloured */}
      <span
        className="text-[10px] font-semibold tracking-wide text-center leading-tight max-w-[80px]"
        style={{ color: colors.text }}
      >
        {note}
      </span>
    </div>
  )
}

export function FragranceNotesPyramid({ notesTop, notesHeart, notesBase }: FragranceNotesPyramidProps) {
  const hasNotes = (notesTop && notesTop.length > 0) ||
                   (notesHeart && notesHeart.length > 0) ||
                   (notesBase && notesBase.length > 0)

  if (!hasNotes) return null

  // Collect unique families for legend
  const allNotes = [...(notesTop || []), ...(notesHeart || []), ...(notesBase || [])]
  const familiesPresent = new Map<NoteFamily, string>()
  for (const note of allNotes) {
    const family = getNoteFamily(note)
    if (!familiesPresent.has(family)) {
      familiesPresent.set(family, getNoteFamilyColors(note).text)
    }
  }

  const tiers = [
    { ...TIERS[0], notes: notesTop },
    { ...TIERS[1], notes: notesHeart },
    { ...TIERS[2], notes: notesBase },
  ]

  return (
    <section className="py-6">
      {/* Header */}
      <h3 className="font-headline text-base tracking-[0.15em] text-primary uppercase text-center mb-8">
        Perfume Pyramid
      </h3>

      {/* Tiers */}
      <div className="flex flex-col items-center gap-6">
        {tiers.map(({ key, label, notes }) => {
          if (!notes || notes.length === 0) return null

          return (
            <div key={key} className="w-full flex flex-col items-center">
              {/* Tier label — simple, centered, with subtle flanking lines */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-8" style={{ background: 'rgba(229, 194, 118, 0.15)' }} />
                <span className="text-[10px] tracking-[0.2em] font-bold text-secondary/50 uppercase">
                  {label}
                </span>
                <div className="h-px w-8" style={{ background: 'rgba(229, 194, 118, 0.15)' }} />
              </div>

              {/* Note icons — large and clear */}
              <div className="flex gap-5 flex-wrap justify-center">
                {notes.map((note) => (
                  <NoteIcon key={note} note={note} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Family legend */}
      {familiesPresent.size > 1 && (
        <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 px-4">
          {Array.from(familiesPresent.entries()).map(([family, color]) => (
            <div key={family} className="inline-flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[8px] tracking-[0.1em] text-secondary/60 uppercase">{family}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
