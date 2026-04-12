import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tagColour } from '../ui/TagInput'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { getIconChar } from '@/lib/iconUtils'

interface TagGroup {
  tag: string
  count: number
  fragrances: { id: string; name: string; brand: string; image_url: string | null }[]
}

type SortMode = 'count' | 'alpha'

export function TagManagerScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('count')
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const [renamingTag, setRenamingTag] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }

    const fetch = async () => {
      const { data } = await supabase
        .from('fragrance_tags')
        .select('tag, fragrance_id, fragrance:fragrances(id, name, brand, image_url)')
        .eq('user_id', user.id)

      if (!data) { setLoading(false); return }

      type Row = { tag: string; fragrance_id: string; fragrance: { id: string; name: string; brand: string; image_url: string | null } | null }
      const rows = data as unknown as Row[]

      const grouped: Record<string, TagGroup> = {}
      for (const row of rows) {
        if (!row.fragrance) continue
        if (!grouped[row.tag]) grouped[row.tag] = { tag: row.tag, count: 0, fragrances: [] }
        grouped[row.tag].count++
        grouped[row.tag].fragrances.push(row.fragrance)
      }

      setTagGroups(Object.values(grouped))
      setLoading(false)
    }

    fetch()
  }, [user])

  const sorted = [...tagGroups].sort((a, b) => {
    if (sortMode === 'count') return b.count - a.count
    return a.tag.localeCompare(b.tag)
  })

  const handleDeleteTag = async (tag: string) => {
    if (!user) return
    await supabase
      .from('fragrance_tags')
      .delete()
      .eq('user_id', user.id)
      .eq('tag', tag)
    setTagGroups((prev) => prev.filter((g) => g.tag !== tag))
    toast.showToast(`Removed tag "${tag}"`, 'success')
  }

  const handleRenameTag = async (oldTag: string) => {
    if (!user || !renameValue.trim()) return
    const newTag = renameValue.trim().toLowerCase()
    if (newTag === oldTag) { setRenamingTag(null); return }

    // Update all instances
    await supabase
      .from('fragrance_tags')
      .update({ tag: newTag })
      .eq('user_id', user.id)
      .eq('tag', oldTag)

    setTagGroups((prev) => prev.map((g) =>
      g.tag === oldTag ? { ...g, tag: newTag } : g
    ))
    setRenamingTag(null)
    setRenameValue('')
    toast.showToast(`Renamed to "${newTag}"`, 'success')
  }

  const totalTags = tagGroups.length
  const totalUsages = tagGroups.reduce((sum, g) => sum + g.count, 0)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <span className="text-4xl text-primary/20 mb-4">?</span>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to manage tags</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg mt-4">SIGN IN</button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Header stats */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-surface-container rounded-sm p-4 text-center">
          <p className="text-2xl font-headline text-primary font-bold">{totalTags}</p>
          <p className="text-[10px] text-secondary/50 uppercase tracking-widest">Tags</p>
        </div>
        <div className="flex-1 bg-surface-container rounded-sm p-4 text-center">
          <p className="text-2xl font-headline text-on-surface font-bold">{totalUsages}</p>
          <p className="text-[10px] text-secondary/50 uppercase tracking-widest">Usages</p>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/60">
          Sorted by {sortMode === 'count' ? 'most used' : 'A–Z'}
        </p>
        <button
          onClick={() => setSortMode(sortMode === 'count' ? 'alpha' : 'count')}
          className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-wider hover:opacity-80 transition-transform"
        >
          <span>{getIconChar(sortMode === 'count' ? 'sort_by_alpha' : 'bar_chart')}</span>
          {sortMode === 'count' ? 'A–Z' : 'By count'}
        </button>
      </div>

      {/* Tags list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-container rounded-sm p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-16 text-center">
          <span className="text-4xl text-secondary/15 mb-3 block mx-auto">?</span>
          <p className="text-sm text-secondary/40 font-medium">No tags yet</p>
          <p className="text-[11px] text-secondary/25 mt-1">Add tags from any fragrance's detail page</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((group) => (
            <div key={group.tag} className="bg-surface-container rounded-sm overflow-hidden">
              {/* Tag header */}
              <button
                onClick={() => setExpandedTag(expandedTag === group.tag ? null : group.tag)}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface-container-highest/30 transition-colors"
              >
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${tagColour(group.tag)}`}>
                  {group.tag}
                </span>
                <span className="text-[10px] text-secondary/40 font-bold">{group.count} fragrance{group.count !== 1 ? 's' : ''}</span>
                <div className="ml-auto flex items-center gap-1">
                  {/* Rename */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingTag(group.tag); setRenameValue(group.tag) }}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                    aria-label="Rename tag"
                  >
                    <span className="text-secondary/40">✎</span>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTag(group.tag) }}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-error/10 transition-colors"
                    aria-label="Delete tag"
                  >
                    <span className="text-error/40">✕</span>
                  </button>
                  <span className="text-secondary/30">{getIconChar(expandedTag === group.tag ? 'expand_less' : 'expand_more')}</span>
                </div>
              </button>

              {/* Rename inline */}
              {renamingTag === group.tag && (
                <div className="px-4 py-2 flex items-center gap-2 border-t border-outline-variant/10">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 bg-surface-container-highest text-on-surface text-xs rounded-sm px-3 py-2 border-none focus:ring-1 focus:ring-primary/30 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTag(group.tag); if (e.key === 'Escape') setRenamingTag(null) }}
                  />
                  <button onClick={() => handleRenameTag(group.tag)} className="text-[10px] text-primary font-bold uppercase hover:opacity-80">Save</button>
                  <button onClick={() => setRenamingTag(null)} className="text-[10px] text-secondary/40 font-bold uppercase hover:opacity-80">Cancel</button>
                </div>
              )}

              {/* Expanded fragrance list */}
              {expandedTag === group.tag && (
                <div className="border-t border-outline-variant/10">
                  {group.fragrances.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => navigate(`/fragrance/${f.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-surface-container-highest/30 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-md overflow-hidden bg-surface-container-highest flex-shrink-0">
                        {f.image_url ? (
                          <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><span className="text-secondary/20">?</span></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-on-surface font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-secondary/40">{f.brand}</p>
                      </div>
                      <span className="text-secondary/20">?</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
