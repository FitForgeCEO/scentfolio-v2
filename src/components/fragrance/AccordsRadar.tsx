/**
 * AccordsRadar — SVG spider/radar chart for fragrance accords.
 * Renders a hexagonal grid with gold-filled data polygon.
 */

interface Accord {
  name: string
  value: number // 0–100
}

interface AccordsRadarProps {
  accords: Accord[]
}

// Accord-family colour map for the dot markers
const ACCORD_COLORS: Record<string, string> = {
  WOODY: '#8B6914',
  FLORAL: '#C77DA3',
  CITRUS: '#D4A017',
  SPICY: '#B85C38',
  AROMATIC: '#6B8E6B',
  FRESH: '#5B9BD5',
  SWEET: '#D4848C',
  ORIENTAL: '#9B6B4A',
  POWDERY: '#C9A5C9',
  FRUITY: '#E88D67',
  GREEN: '#6B8F4E',
  AQUATIC: '#5BACB0',
  MUSKY: '#A08C7B',
  WARM_SPICY: '#B85C38',
  AMBER: '#C4903A',
  EARTHY: '#7D6B5D',
  LEATHER: '#6B4226',
  SMOKY: '#6E6E6E',
  VANILLA: '#D4B87A',
  TOBACCO: '#8B5E3C',
  GOURMAND: '#C08040',
  BALSAMIC: '#8B6B4A',
  MARINE: '#3D8CA8',
  HERBAL: '#5A7247',
  WOODY_AROMATIC: '#7A7340',
}

function getAccordColor(name: string): string {
  // Try exact match, then partial match
  const upper = name.toUpperCase().replace(/\s+/g, '_')
  if (ACCORD_COLORS[upper]) return ACCORD_COLORS[upper]
  for (const [key, col] of Object.entries(ACCORD_COLORS)) {
    if (upper.includes(key) || key.includes(upper)) return col
  }
  return '#e5c276' // default gold
}

export function AccordsRadar({ accords }: AccordsRadarProps) {
  if (accords.length === 0) return null

  const cx = 175
  const cy = 160
  const maxR = 90
  const n = accords.length
  const rings = [0.25, 0.5, 0.75, 1.0]

  // Compute points on the polygon for a given radius
  const polarToXY = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  // Grid ring polygons
  const ringPaths = rings.map((scale) => {
    const pts = Array.from({ length: n }, (_, i) => polarToXY(i, maxR * scale))
    return pts.map((p) => `${p.x},${p.y}`).join(' ')
  })

  // Spoke lines
  const spokes = Array.from({ length: n }, (_, i) => {
    const outer = polarToXY(i, maxR)
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y }
  })

  // Data polygon
  const dataPoints = accords.map((a, i) => polarToXY(i, maxR * (a.value / 100)))
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  // Label positions (pushed well outside the chart for readability)
  const labelPositions = accords.map((a, i) => {
    const pt = polarToXY(i, maxR + 28)
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    // Determine text-anchor based on position around the circle
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    if (cosA > 0.25) anchor = 'start'
    else if (cosA < -0.25) anchor = 'end'
    // Nudge Y for top/bottom labels
    const dy = sinA > 0.25 ? 14 : sinA < -0.25 ? -6 : 4
    return { ...pt, name: a.name, value: a.value, color: getAccordColor(a.name), anchor, dy }
  })

  // Screen reader description
  const srDescription = accords.map((a) => `${a.name}: ${a.value}%`).join(', ')

  return (
    <div className="flex flex-col items-center">
      {/* Screen reader fallback */}
      <div className="sr-only" role="img" aria-label={`Accords: ${srDescription}`}>
        {accords.map((a) => (
          <span key={a.name}>{a.name}: {a.value}%. </span>
        ))}
      </div>
      <svg viewBox="0 0 350 330" className="w-full max-w-[350px]" style={{ overflow: 'visible' }} aria-hidden="true">
        <defs>
          <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e5c276" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e5c276" stopOpacity="0.08" />
          </radialGradient>
          <filter id="radar-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid rings */}
        {ringPaths.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="rgba(229,194,118,0.08)"
            strokeWidth={i === rings.length - 1 ? 1.2 : 0.6}
          />
        ))}

        {/* Spokes */}
        {spokes.map((s, i) => (
          <line key={i} {...s} stroke="rgba(229,194,118,0.06)" strokeWidth={0.6} />
        ))}

        {/* Data polygon — filled */}
        <polygon
          points={dataPath}
          fill="url(#radar-fill)"
          stroke="#e5c276"
          strokeWidth={1.5}
          strokeLinejoin="round"
          filter="url(#radar-glow)"
        />

        {/* Data point dots */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={getAccordColor(accords[i].name)}
            stroke="#191210"
            strokeWidth={1.5}
          />
        ))}

        {/* Labels on the graph at each vertex */}
        {labelPositions.map((l) => {
          const xOff = l.anchor === 'start' ? 4 : l.anchor === 'end' ? -4 : 0
          return (
            <g key={l.name}>
              <text
                x={l.x + xOff}
                y={l.y + l.dy}
                textAnchor={l.anchor}
                fill={l.color}
                fontSize="9"
                fontWeight="700"
                letterSpacing="0.06em"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {l.name.toUpperCase()}
              </text>
              <text
                x={l.x + xOff}
                y={l.y + l.dy + 11}
                textAnchor={l.anchor}
                fill="rgba(139,125,107,0.6)"
                fontSize="8"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {l.value}%
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
