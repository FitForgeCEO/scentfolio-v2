import { getNoteIconPath, getNoteFamilyColors, getNoteFamily, type NoteFamily } from '@/lib/noteIconMap'

interface FragranceNotesPyramidProps {
  notesTop?: string[]
  notesHeart?: string[]
  notesBase?: string[]
}

const TIERS = [
  { key: 'top' as const, label: 'TOP', roman: 'I' },
  { key: 'heart' as const, label: 'HEART', roman: 'II' },
  { key: 'base' as const, label: 'BASE', roman: 'III' },
] as const

/**
 * Single note icon with family-tinted glow and elegant label.
 * Designed to be large, clear, and visually rich — screenshot-worthy.
 */
function NoteIcon({ note }: { note: string }) {
  const colors = getNoteFamilyColors(note)
  const iconPath = getNoteIconPath(note)

  return (
    <div className="flex flex-col items-center gap-2 group cursor-default">
      {/* Icon container with family-tinted ambient glow */}
      <div
        className="relative w-[72px] h-[72px] flex items-center justify-center rounded-sm overflow-hidden transition-transform duration-300 group-hover:scale-105"
        style={{
          background: colors.bg,
          boxShadow: `0 0 24px 4px ${colors.border}`,
        }}
      >
        {/* Subtle inner border */}
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{ border: `1px solid ${colors.border}` }}
        />
        <img
          src={iconPath}
          alt={note}
          className="w-14 h-14 object-contain relative z-10 drop-shadow-sm"
          style={{ filter: 'brightness(1.15) contrast(1.1)' }}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/note-icons/water-drop.png'
          }}
        />
      </div>
      {/* Note name — family-coloured, editorial caps */}
      <span
        className="text-[9px] font-label font-bold tracking-[0.15em] uppercase text-center leading-tight max-w-[80px]"
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
    <section className="px-6 py-8 relative">
      {/* Header */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <div
          className="h-px flex-1 max-w-[60px]"
          style={{ background: 'linear-gradient(to right, transparent, rgba(229,194,118,0.3))' }}
        />
        <h3 className="font-headline italic text-lg tracking-wide text-primary">
          Perfume Pyramid
        </h3>
        <div
          className="h-px flex-1 max-w-[60px]"
          style={{ background: 'linear-gradient(to left, transparent, rgba(229,194,118,0.3))' }}
        />
      </div>

      {/* Pyramid tiers — progressively wider to form visual pyramid shape */}
      <div className="flex flex-col items-center gap-8">
        {tiers.map(({ key, label, roman, notes }, tierIndex) => {
          if (!notes || notes.length === 0) return null

          // Progressive width: top is narrowest, base is widest
          const maxWidth = tierIndex === 0 ? 'max-w-[280px]'
            : tierIndex === 1 ? 'max-w-[360px]'
            : 'max-w-[440px]'

          return (
            <div key={key} className={`w-full ${maxWidth} flex flex-col items-center`}>
              {/* Tier label — roman numeral + name with flanking gradient lines */}
              <div className="flex items-center gap-3 mb-5 w-full">
                <div
                  className="h-px flex-1"
                  style={{ background: 'linear-gradient(to right, transparent, rgba(229,194,118,0.12))' }}
                />
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-headline italic text-sm text-primary/40"
                  >
                    {roman}.
                  </span>
                  <span className="text-[10px] tracking-[0.25em] font-label font-bold text-secondary/50 uppercase">
                    {label}
                  </span>
                </div>
                <div
                  className="h-px flex-1"
                  style={{ background: 'linear-gradient(to left, transparent, rgba(229,194,118,0.12))' }}
                />
              </div>

              {/* Note icons — centred grid, generously spaced */}
              <div className="flex gap-4 flex-wrap justify-center">
                {notes.map((note) => (
                  <NoteIcon key={note} note={note} />
                ))}
              </div>

              {/* Subtle connector line between tiers */}
              {tierIndex < 2 && (
                <div
                  className="mt-6 w-px h-6"
                  style={{ background: 'linear-gradient(to bottom, rgba(229,194,118,0.2), transparent)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Family colour legend — only when multiple families present */}
      {familiesPresent.size > 1 && (
        <div className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 px-4">
          {Array.from(familiesPresent.entries()).map(([family, color]) => (
            <div key={family} className="inline-flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: color, opacity: 0.7 }}
              />
              <span className="text-[8px] tracking-[0.15em] text-secondary/50 uppercase font-label font-bold">{family}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
