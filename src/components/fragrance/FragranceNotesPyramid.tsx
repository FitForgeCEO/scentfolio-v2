import { getNoteIconPath, getNoteFamilyColors, getNoteFamily, type NoteFamily } from '@/lib/noteIconMap'

interface FragranceNotesPyramidProps {
  notesTop?: string[]
  notesHeart?: string[]
  notesBase?: string[]
}

/* ── Single note: floating icon with radial family-coloured glow ── */
function NoteIcon({ note, size = 56 }: { note: string; size?: number }) {
  const colors = getNoteFamilyColors(note)
  const iconPath = getNoteIconPath(note)

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-default">
      {/* Floating icon — NO box, NO border. Just the icon + radial glow */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Family-coloured radial glow behind the icon */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${colors.border} 0%, transparent 70%)`,
            opacity: 0.5,
            transform: 'scale(1.6)',
          }}
        />
        <img
          src={iconPath}
          alt={note}
          className="object-contain relative z-10"
          style={{
            width: size - 8,
            height: size - 8,
            filter: 'brightness(0.92) saturate(1.15)',
          }}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/note-icons/water-drop.png'
          }}
        />
      </div>
      {/* Note name — family-coloured */}
      <span
        className="text-[8px] font-label font-semibold tracking-[0.12em] uppercase text-center leading-tight"
        style={{ color: colors.text, maxWidth: size + 20, opacity: 0.9 }}
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

  /* How many notes across the widest tier — drives the pyramid width */
  const maxNotesInRow = Math.max(
    notesTop?.length ?? 0,
    notesHeart?.length ?? 0,
    notesBase?.length ?? 0,
  )
  /* Clamp icon size: fewer notes = larger icons, many notes = slightly smaller */
  const iconSize = maxNotesInRow <= 3 ? 60 : maxNotesInRow <= 5 ? 52 : 44

  return (
    <section className="relative mx-4 my-6 overflow-hidden rounded-sm">
      {/* ── Dark panel background with subtle warm gradient ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #1a1410 0%, #151010 40%, #120e0c 100%)',
        }}
      />

      {/* ── SVG pyramid silhouette behind everything ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 400 500"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pyramidStroke" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#e5c276" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#e5c276" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#e5c276" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="pyramidFill" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#e5c276" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#e5c276" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* The triangle — apex at top centre, base stretches wide */}
        <path
          d="M200 40 L360 440 L40 440 Z"
          fill="url(#pyramidFill)"
          stroke="url(#pyramidStroke)"
          strokeWidth="1"
        />
        {/* Horizontal tier dividers */}
        <line x1="120" y1="190" x2="280" y2="190" stroke="#e5c276" strokeOpacity="0.06" strokeWidth="0.5" />
        <line x1="80" y1="310" x2="320" y2="310" stroke="#e5c276" strokeOpacity="0.06" strokeWidth="0.5" />
      </svg>

      {/* ── Ambient corner glows ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -40, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(229,194,118,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 px-5 pt-7 pb-6">

        {/* Header — compact, elegant */}
        <div className="text-center mb-7">
          <p className="text-[8px] tracking-[0.35em] font-label font-bold uppercase" style={{ color: 'rgba(229,194,118,0.45)' }}>
            Fragrance
          </p>
          <h3
            className="font-headline italic text-2xl tracking-wide mt-0.5"
            style={{ color: '#e5c276' }}
          >
            Perfume Pyramid
          </h3>
        </div>

        {/* ── TOP NOTES ── */}
        {notesTop && notesTop.length > 0 && (
          <div className="flex flex-col items-center mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-5" style={{ background: 'linear-gradient(to right, transparent, rgba(229,194,118,0.2))' }} />
              <span className="text-[7px] tracking-[0.3em] font-label font-bold uppercase" style={{ color: 'rgba(229,194,118,0.4)' }}>
                Top Notes
              </span>
              <div className="h-px w-5" style={{ background: 'linear-gradient(to left, transparent, rgba(229,194,118,0.2))' }} />
            </div>
            <div className="flex gap-5 flex-wrap justify-center">
              {notesTop.map((note) => (
                <NoteIcon key={note} note={note} size={iconSize} />
              ))}
            </div>
          </div>
        )}

        {/* ── Connector ── */}
        {notesTop && notesTop.length > 0 && (notesHeart?.length || notesBase?.length) ? (
          <div className="flex justify-center my-2">
            <div className="w-px h-5" style={{ background: 'linear-gradient(to bottom, rgba(229,194,118,0.15), transparent)' }} />
          </div>
        ) : null}

        {/* ── HEART NOTES ── */}
        {notesHeart && notesHeart.length > 0 && (
          <div className="flex flex-col items-center mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8" style={{ background: 'linear-gradient(to right, transparent, rgba(229,194,118,0.2))' }} />
              <span className="text-[7px] tracking-[0.3em] font-label font-bold uppercase" style={{ color: 'rgba(229,194,118,0.4)' }}>
                Heart Notes
              </span>
              <div className="h-px w-8" style={{ background: 'linear-gradient(to left, transparent, rgba(229,194,118,0.2))' }} />
            </div>
            <div className="flex gap-5 flex-wrap justify-center" style={{ maxWidth: '90%' }}>
              {notesHeart.map((note) => (
                <NoteIcon key={note} note={note} size={iconSize} />
              ))}
            </div>
          </div>
        )}

        {/* ── Connector ── */}
        {notesHeart && notesHeart.length > 0 && notesBase?.length ? (
          <div className="flex justify-center my-2">
            <div className="w-px h-5" style={{ background: 'linear-gradient(to bottom, rgba(229,194,118,0.15), transparent)' }} />
          </div>
        ) : null}

        {/* ── BASE NOTES ── */}
        {notesBase && notesBase.length > 0 && (
          <div className="flex flex-col items-center mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-12" style={{ background: 'linear-gradient(to right, transparent, rgba(229,194,118,0.2))' }} />
              <span className="text-[7px] tracking-[0.3em] font-label font-bold uppercase" style={{ color: 'rgba(229,194,118,0.4)' }}>
                Base Notes
              </span>
              <div className="h-px w-12" style={{ background: 'linear-gradient(to left, transparent, rgba(229,194,118,0.2))' }} />
            </div>
            <div className="flex gap-5 flex-wrap justify-center">
              {notesBase.map((note) => (
                <NoteIcon key={note} note={note} size={iconSize} />
              ))}
            </div>
          </div>
        )}

        {/* ── Family legend ── */}
        {familiesPresent.size > 1 && (
          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {Array.from(familiesPresent.entries()).map(([family, color]) => (
              <div key={family} className="inline-flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color, opacity: 0.6 }}
                />
                <span className="text-[7px] tracking-[0.12em] uppercase font-label" style={{ color: 'rgba(168,154,145,0.45)' }}>
                  {family}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Watermark — subtle, bottom-right ── */}
        <div className="mt-4 flex justify-center">
          <span
            className="text-[7px] tracking-[0.4em] font-label uppercase"
            style={{ color: 'rgba(229,194,118,0.15)' }}
          >
            ScentFolio
          </span>
        </div>
      </div>
    </section>
  )
}
