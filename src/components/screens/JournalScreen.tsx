import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface JournalEntry {
  id: string
  user_id: string
  fragrance_id: string | null
  title: string
  body: string
  mood: string | null
  tags: string[]
  created_at: string
  fragrance?: { name: string; brand: string; image_url: string | null } | null
}

const MOOD_ICONS: Record<string, string> = {
  love: 'favorite',
  happy: 'sentiment_satisfied',
  nostalgic: 'history',
  calm: 'spa',
  energised: 'bolt',
  thoughtful: 'psychology',
}

export function JournalScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [selectedFrag, setSelectedFrag] = useState<{ id: string; name: string; brand: string } | null>(null)
  const [fragSearch, setFragSearch] = useState('')
  const [fragResults, setFragResults] = useState<Fragrance[]>([])
  const [saving, setSaving] = useState(false)
  const [searchingFrags, setSearchingFrags] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(undefined)
  useFocusTrap(sheetRef, composing)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchEntries()
  }, [user])

  async function fetchEntries() {
    const { data } = await supabase
      .from('journal_entries')
      .select('*, fragrance:fragrances(name, brand, image_url)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setEntries((data ?? []) as unknown as JournalEntry[])
    setLoading(false)
  }

  useEffect(() => {
    if (fragSearch.length < 2) { setFragResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingFrags(true)
      const { data } = await supabase
        .from('fragrances')
        .select('id, name, brand, image_url')
        .or(`name.ilike.%${fragSearch}%,brand.ilike.%${fragSearch}%`)
        .limit(5)
      setFragResults((data ?? []) as Fragrance[])
      setSearchingFrags(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [fragSearch])

  const handleSave = async () => {
    if (!user || !body.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        fragrance_id: selectedFrag?.id ?? null,
        title: title.trim() || null,
        body: body.trim(),
        mood,
        tags: [],
      })
      if (error) throw error
      toast.showToast('Journal entry saved', 'success')
      setComposing(false)
      setTitle('')
      setBody('')
      setMood(null)
      setSelectedFrag(null)
      fetchEntries()
    } catch {
      toast.showToast('Failed to save entry', 'error')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('journal_entries').delete().eq('id', id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    toast.showToast('Entry deleted', 'success')
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="edit_note" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to write in your fragrance journal</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline text-xl">Fragrance Journal</h2>
          <p className="text-[10px] text-secondary/50">{entries.length} entries</p>
        </div>
      </section>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="edit_note" className="text-3xl text-primary/40" />
          </div>
          <h3 className="font-headline text-lg">Your journal is empty</h3>
          <p className="text-sm text-secondary/50 text-center max-w-[260px]">
            Capture your scent memories, first impressions, and fragrance thoughts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const date = new Date(entry.created_at)
            return (
              <div key={entry.id} className="bg-surface-container rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {entry.mood && MOOD_ICONS[entry.mood] && (
                      <Icon name={MOOD_ICONS[entry.mood]} className="text-primary" size={16} />
                    )}
                    <div>
                      {entry.title && <p className="text-sm font-medium text-on-surface">{entry.title}</p>}
                      <p className="text-[9px] text-secondary/40">
                        {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(entry.id)} className="p-1 rounded active:scale-90">
                    <Icon name="close" className="text-secondary/30" size={14} />
                  </button>
                </div>

                {entry.fragrance && (
                  <button
                    onClick={() => entry.fragrance_id && navigate(`/fragrance/${entry.fragrance_id}`)}
                    className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-8 h-8 rounded overflow-hidden bg-surface-container-low flex-shrink-0">
                      {entry.fragrance.image_url ? (
                        <img src={entry.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="water_drop" className="text-secondary/20" size={12} />
                        </div>
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-[9px] text-primary/60">{entry.fragrance.brand}</p>
                      <p className="text-[10px] text-on-surface font-medium truncate">{entry.fragrance.name}</p>
                    </div>
                  </button>
                )}

                <p className="text-sm text-on-surface/80 leading-relaxed whitespace-pre-wrap">{entry.body}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB — New Entry */}
      <button
        onClick={() => setComposing(true)}
        className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-full gold-gradient shadow-xl flex items-center justify-center active:scale-90 transition-all ambient-glow"
        aria-label="New journal entry"
      >
        <Icon name="edit" className="text-on-primary text-2xl" />
      </button>

      {/* Compose Sheet */}
      {composing && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setComposing(false)} />
          <div ref={sheetRef} className="relative w-full max-w-[430px] bg-surface-container-highest rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto sheet-shadow">
            <div className="w-10 h-1 bg-outline-variant/30 rounded-full mx-auto mb-5" />
            <h3 className="font-headline text-lg mb-4">New Entry</h3>

            <div className="space-y-4">
              {/* Title */}
              <input
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface placeholder-secondary/30 outline-none focus:ring-1 focus:ring-primary/30"
              />

              {/* Fragrance Link */}
              <div>
                {selectedFrag ? (
                  <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-4 py-2.5">
                    <Icon name="water_drop" className="text-primary" size={16} />
                    <span className="text-sm text-on-surface flex-1">{selectedFrag.brand} — {selectedFrag.name}</span>
                    <button onClick={() => setSelectedFrag(null)} className="p-1">
                      <Icon name="close" className="text-secondary/50" size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Link a fragrance (optional)"
                      value={fragSearch}
                      onChange={(e) => setFragSearch(e.target.value)}
                      className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface placeholder-secondary/30 outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    {fragResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-highest rounded-xl shadow-xl z-10 overflow-hidden">
                        {fragResults.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => { setSelectedFrag({ id: f.id, name: f.name, brand: f.brand }); setFragSearch(''); setFragResults([]) }}
                            className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-surface-container active:bg-surface-container"
                          >
                            <span className="text-[9px] text-secondary/50">{f.brand}</span>
                            <span className="text-sm text-on-surface">{f.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mood */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-secondary mb-2 font-bold">MOOD</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(MOOD_ICONS).map(([key, icon]) => (
                    <button
                      key={key}
                      onClick={() => setMood(mood === key ? null : key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-all active:scale-95 ${
                        mood === key ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/60'
                      }`}
                    >
                      <Icon name={icon} size={14} />
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <textarea
                placeholder="Write your thoughts..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface placeholder-secondary/30 outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed"
              />

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!body.trim() || saving}
                className="w-full gold-gradient text-on-primary-container py-3.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'SAVING...' : 'SAVE ENTRY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
