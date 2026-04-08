import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'

interface DNAAxis {
  label: string
  value: number // 0-100
  count: number
}

const AXIS_COLORS = ['#e5c276', '#C77DB5', '#5BA3C9', '#6B8F71', '#D4845A', '#C75B39', '#4A90B8', '#8B6914']

export function DNAProfileScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [axes, setAxes] = useState<DNAAxis[]>([])
  const [loading, setLoading] = useState(true)
  const [totalOwned, setTotalOwned] = useState(0)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function compute() {
      const { data } = await supabase
        .from('user_collections')
        .select('fragrance:fragrances(accords)')
        .eq('user_id', user!.id)
        .eq('status', 'own')

      type Row = { fragrance: { accords: string[] | null } | null }
      const rows = (data ?? []) as unknown as Row[]
      setTotalOwned(rows.length)

      // Count accords
      const accordMap = new Map<string, number>()
      for (const row of rows) {
        if (!row.fragrance?.accords) continue
        for (const accord of row.fragrance.accords) {
          accordMap.set(accord, (accordMap.get(accord) ?? 0) + 1)
        }
      }

      // Take top 8 accords as DNA axes
      const sorted = [...accordMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)

      const maxCount = sorted.length > 0 ? sorted[0][1] : 1
      const dnaAxes: DNAAxis[] = sorted.map(([label, count]) => ({
        label,
        value: Math.round((count / maxCount) * 100),
        count,
      }))

      setAxes(dnaAxes)
      setLoading(false)
    }

    compute()
  }, [user])

  // Draw radar chart on canvas
  useEffect(() => {
    if (!canvasRef.current || axes.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 300
    const dpr = window.devicePixelRatio || 2
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.38
    const n = axes.length
    const angleStep = (Math.PI * 2) / n

    // Clear
    ctx.clearRect(0, 0, size, size)

    // Draw grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (radius * ring) / 4
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const angle = i * angleStep - Math.PI / 2
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = 'rgba(229, 194, 118, 0.08)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw axis lines
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
      ctx.strokeStyle = 'rgba(229, 194, 118, 0.12)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw filled area
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2
      const r = (axes[i].value / 100) * radius
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(229, 194, 118, 0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(229, 194, 118, 0.6)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw dots + labels
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2
      const r = (axes[i].value / 100) * radius
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r

      // Dot
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#e5c276'
      ctx.fill()

      // Label
      const labelR = radius + 20
      const lx = cx + Math.cos(angle) * labelR
      const ly = cy + Math.sin(angle) * labelR
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(axes[i].label, lx, ly)
    }
  }, [axes])

  const handleShare = async () => {
    if (!canvasRef.current) return
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvasRef.current!.toBlob(resolve, 'image/png'))
      if (!blob) return
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'dna.png')] })) {
        await navigator.share({
          files: [new File([blob], 'scentfolio-dna.png', { type: 'image/png' })],
          title: 'My Fragrance DNA',
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'scentfolio-dna.png'
        a.click()
        URL.revokeObjectURL(url)
        toast.showToast('DNA chart saved', 'success')
      }
    } catch {
      toast.showToast('Could not share', 'error')
    }
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="fingerprint" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see your fragrance DNA</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon name="fingerprint" filled className="text-3xl text-primary" />
        </div>
        <h2 className="font-headline text-xl mb-1">Your Fragrance DNA</h2>
        <p className="text-[10px] text-secondary/50">Based on {totalOwned} fragrances in your collection</p>
      </section>

      {axes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name="science" className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50">Add fragrances to generate your DNA profile</p>
        </div>
      ) : (
        <>
          {/* Radar Chart */}
          <div className="flex justify-center mb-6">
            <canvas ref={canvasRef} className="w-[300px] h-[300px]" />
          </div>

          {/* Breakdown Bars */}
          <section className="space-y-3 mb-6">
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold">YOUR ACCORD BREAKDOWN</h3>
            {axes.map((axis, i) => (
              <div key={axis.label} className="flex items-center gap-3">
                <span className="text-xs text-on-surface w-20 truncate capitalize">{axis.label}</span>
                <div className="flex-1 h-2 bg-surface-container-low rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${axis.value}%`,
                      backgroundColor: AXIS_COLORS[i % AXIS_COLORS.length],
                    }}
                  />
                </div>
                <span className="text-[10px] text-secondary/50 w-8 text-right">{axis.count}</span>
              </div>
            ))}
          </section>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="w-full gold-gradient text-on-primary-container py-3.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="share" size={16} />
            SHARE YOUR DNA
          </button>
        </>
      )}
    </main>
  )
}
