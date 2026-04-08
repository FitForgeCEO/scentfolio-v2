import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface DuplicateGroup {
  reason: string
  items: { collectionId: string; fragrance: Fragrance; status: string }[]
  severity: 'exact' | 'similar' | 'variant'
}

export function DuplicateDetectorScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function detect() {
      const { data } = await supabase
        .from('user_collections')
        .select('id, status, fragrance:fragrances(*)')
        .eq('user_id', user!.id)

      type Row = { id: string; status: string; fragrance: Fragrance | null }
      const rows = ((data ?? []) as unknown as Row[])
        .filter((r) => r.fragrance !== null)
        .map((r) => ({ collectionId: r.id, fragrance: r.fragrance!, status: r.status }))

      const duplicateGroups: DuplicateGroup[] = []
      const usedIds = new Set<string>()

      // 1. Exact duplicates — same fragrance_id
      const byFragId = new Map<string, typeof rows>()
      for (const row of rows) {
        const existing = byFragId.get(row.fragrance.id) ?? []
        existing.push(row)
        byFragId.set(row.fragrance.id, existing)
      }
      for (const [, group] of byFragId) {
        if (group.length > 1) {
          duplicateGroups.push({
            reason: 'Exact duplicate — same fragrance added multiple times',
            items: group,
            severity: 'exact',
          })
          group.forEach((g) => usedIds.add(g.collectionId))
        }
      }

      // 2. Same name variants — same brand + similar name (e.g. "Sauvage" vs "Sauvage EDP")
      const remaining = rows.filter((r) => !usedIds.has(r.collectionId))
      for (let i = 0; i < remaining.length; i++) {
        for (let j = i + 1; j < remaining.length; j++) {
          const a = remaining[i]
          const b = remaining[j]
          if (usedIds.has(a.collectionId) || usedIds.has(b.collectionId)) continue

          if (
            a.fragrance.brand.toLowerCase() === b.fragrance.brand.toLowerCase() &&
            nameSimilarity(a.fragrance.name, b.fragrance.name) > 0.7
          ) {
            const isVariant = a.fragrance.concentration !== b.fragrance.concentration
            duplicateGroups.push({
              reason: isVariant
                ? `Variant — same line, different concentrations (${a.fragrance.concentration ?? '?'} vs ${b.fragrance.concentration ?? '?'})`
                : 'Very similar — same brand with near-identical names',
              items: [a, b],
              severity: isVariant ? 'variant' : 'similar',
            })
          }
        }
      }

      // 3. Potential overlaps — same accords profile (>80% overlap)
      const rest = rows.filter((r) => !usedIds.has(r.collectionId))
      for (let i = 0; i < rest.length; i++) {
        for (let j = i + 1; j < rest.length; j++) {
          const a = rest[i]
          const b = rest[j]
          if (a.fragrance.brand === b.fragrance.brand) continue // already caught above
          if (!a.fragrance.accords || !b.fragrance.accords) continue
          if (a.fragrance.accords.length < 3 || b.fragrance.accords.length < 3) continue

          const aSet = new Set(a.fragrance.accords.map((s) => s.toLowerCase()))
          const bSet = new Set(b.fragrance.accords.map((s) => s.toLowerCase()))
          const intersection = [...aSet].filter((x) => bSet.has(x))
          const overlap = intersection.length / Math.min(aSet.size, bSet.size)

          if (overlap >= 0.8 && intersection.length >= 4) {
            duplicateGroups.push({
              reason: `Similar scent profile — ${intersection.length} shared accords (${intersection.slice(0, 3).join(', ')})`,
              items: [a, b],
              severity: 'similar',
            })
          }
        }
      }

      // Sort: exact first, then similar, then variant
      const order: Record<string, number> = { exact: 0, similar: 1, variant: 2 }
      duplicateGroups.sort((a, b) => order[a.severity] - order[b.severity])
      setGroups(duplicateGroups)
      setLoading(false)
    }

    detect()
  }, [user])

  function nameSimilarity(a: string, b: string): number {
    const aLower = a.toLowerCase().trim()
    const bLower = b.toLowerCase().trim()
    if (aLower === bLower) return 1

    // Check if one contains the other
    if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.9

    // Simple word overlap
    const aWords = new Set(aLower.split(/\s+/))
    const bWords = new Set(bLower.split(/\s+/))
    const overlap = [...aWords].filter((w) => bWords.has(w)).length
    return overlap / Math.max(aWords.size, bWords.size)
  }

  const handleRemove = async (collectionId: string) => {
    if (!user || removing) return
    setRemoving(collectionId)

    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', user.id)

    if (error) {
      toast.showToast('Failed to remove', 'error')
    } else {
      toast.showToast('Removed from collection', 'success')
      // Remove from local state
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            items: g.items.filter((i) => i.collectionId !== collectionId),
          }))
          .filter((g) => g.items.length > 1)
      )
    }
    setRemoving(null)
  }

  const severityConfig = {
    exact: { icon: 'error', color: '#C75B39', label: 'Exact Duplicate' },
    similar: { icon: 'warning', color: '#D4845A', label: 'Very Similar' },
    variant: { icon: 'info', color: '#5BA3C9', label: 'Concentration Variant' },
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="find_replace" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to detect duplicates</p>
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
          <Icon name="find_replace" filled className="text-3xl text-primary" />
        </div>
        <h2 className="font-headline text-xl mb-1">Duplicate Detector</h2>
        <p className="text-[10px] text-secondary/50">Find duplicates and overlapping fragrances in your collection</p>
      </section>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="check_circle" filled className="text-3xl text-primary" />
          </div>
          <p className="text-sm text-secondary/60 text-center">
            No duplicates found — your collection is clean!
          </p>
        </div>
      ) : (
        <>
          <div className="bg-surface-container rounded-xl p-3 mb-6 flex items-center gap-3">
            <Icon name="info" className="text-primary" size={18} />
            <p className="text-xs text-secondary/60">
              Found {groups.length} potential {groups.length === 1 ? 'issue' : 'issues'} in your collection
            </p>
          </div>

          <div className="space-y-4">
            {groups.map((group, idx) => {
              const cfg = severityConfig[group.severity]
              return (
                <div key={idx} className="bg-surface-container rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: `${cfg.color}15` }}>
                    <Icon name={cfg.icon} size={14} style={{ color: cfg.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    <p className="text-xs text-secondary/50 mb-2">{group.reason}</p>

                    {group.items.map((item) => (
                      <div
                        key={item.collectionId}
                        className="flex items-center gap-3 bg-surface-container-low rounded-lg p-2.5"
                      >
                        <button
                          onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
                          className="flex items-center gap-3 flex-1 min-w-0 active:scale-[0.98] transition-transform"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex-shrink-0">
                            {item.fragrance.image_url ? (
                              <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon name="water_drop" className="text-secondary/20" size={14} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-on-surface font-medium truncate">{item.fragrance.name}</p>
                            <p className="text-[9px] text-secondary/40">
                              {item.fragrance.brand} · {item.fragrance.concentration ?? 'N/A'} · {item.status}
                            </p>
                          </div>
                        </button>

                        {group.severity === 'exact' && (
                          <button
                            onClick={() => handleRemove(item.collectionId)}
                            disabled={removing === item.collectionId}
                            className="p-2 rounded-lg bg-error/10 text-error active:scale-95 transition-all disabled:opacity-50 flex-shrink-0"
                          >
                            <Icon name="delete" size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
