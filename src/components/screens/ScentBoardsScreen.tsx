import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useScentBoards, createBoard, deleteBoard, addToBoard, removeFromBoard } from '@/hooks/useScentBoards'
import type { ScentBoardItem } from '@/hooks/useScentBoards'
import type { Fragrance } from '@/types/database'
import { InlineError } from '../ui/InlineError'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const COVER_COLOURS = [
  'linear-gradient(135deg, #1a1a2e, #16213e)',
  'linear-gradient(135deg, #2d1b36, #1a1a2e)',
  'linear-gradient(135deg, #1a2e1a, #0d1b2a)',
  'linear-gradient(135deg, #2e1a1a, #1a1a2e)',
  'linear-gradient(135deg, #1a2e2e, #1a1a2e)',
]

export function ScentBoardsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { boards, loading, error, retry, setBoards } = useScentBoards(user?.id)
  const [createOpen, setCreateOpen] = useState(false)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
          <span className="text-2xl text-secondary/40">⊘</span>
        </div>
        <p className="text-secondary/60 text-sm">Sign in to create scent boards</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest">
          SIGN IN
        </button>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="pt-24 pb-32 px-6">
        <InlineError message="Couldn't load boards" onRetry={retry} />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-2xl font-bold">Your Boards</h2>
        <button onClick={() => setCreateOpen(true)} className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:opacity-80 transition-transform">
          <span className="text-primary">+</span>
        </button>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center pt-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
            <span className="text-2xl text-secondary/40">?</span>
          </div>
          <h3 className="font-headline text-lg text-on-surface">No boards yet</h3>
          <p className="text-secondary/60 text-sm max-w-[260px]">Create themed collections — date night picks, summer rotation, holy grails</p>
          <button onClick={() => setCreateOpen(true)} className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest">
            CREATE YOUR FIRST BOARD
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {boards.map((board, i) => (
            <button key={board.id} onClick={() => navigate(`/boards/${board.id}`)} className="w-full rounded-sm overflow-hidden hover:opacity-80 transition-transform text-left">
              <div className="p-5 min-h-[100px] flex flex-col justify-end" style={{ background: COVER_COLOURS[i % COVER_COLOURS.length] }}>
                <h3 className="font-headline text-lg text-on-surface">{board.title}</h3>
                {board.description && <p className="text-xs text-secondary/60 mt-1 line-clamp-2">{board.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] text-secondary/40 uppercase tracking-widest">
                    {new Date(board.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {board.is_public && (
                    <>
                      <span className="text-[9px] text-secondary/30">&middot;</span>
                      <span className="text-primary/50 text-xs">?</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateBoardSheet
          onClose={() => setCreateOpen(false)}
          onCreate={async (title, description) => {
            const board = await createBoard(user.id, title, description)
            if (board) {
              setBoards((prev) => [board, ...prev])
              setCreateOpen(false)
            }
          }}
        />
      )}
    </main>
  )
}

/* ── Create Board Sheet ── */
function CreateBoardSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, desc: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const trapRef = useFocusTrap(true, onClose)

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Create board">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-start">
          <h1 className="text-2xl font-headline font-bold text-on-surface">New Board</h1>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:opacity-80 transition-transform">
            <span>✕</span>
          </button>
        </header>
        <div className="px-8 space-y-6 pb-10">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">TITLE</label>
            <input className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm p-4 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none" placeholder="e.g. Date Night, Summer Rotation..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">DESCRIPTION (OPTIONAL)</label>
            <textarea className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm p-4 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none" placeholder="What's this board about?" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button
            onClick={async () => { if (!title.trim()) return; setSaving(true); await onCreate(title.trim(), description.trim()); setSaving(false) }}
            disabled={!title.trim() || saving}
            className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm ambient-glow hover:opacity-80 transition-all disabled:opacity-50"
          >
            {saving ? 'CREATING...' : 'CREATE BOARD'}
          </button>
        </div>
      </section>
    </div>
  )
}

/* ── Board Detail Screen ── */
export function BoardDetailScreen() {
  const navigate = useNavigate()
  useAuth() // ensure authenticated context
  const { id: boardId = '' } = useParams()
  const [items, setItems] = useState<ScentBoardItem[]>([])
  const [board, setBoard] = useState<{ title: string; description: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fetchItems = useCallback(() => {
    if (!boardId) return
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('scent_boards').select('title, description').eq('id', boardId).single(),
      supabase.from('scent_board_items').select('*, fragrance:fragrances(*)').eq('board_id', boardId).order('position', { ascending: true, nullsFirst: false }).order('added_at', { ascending: false }),
    ]).then(([boardRes, itemsRes]) => {
      if (boardRes.data) setBoard(boardRes.data)
      if (itemsRes.error) setError(itemsRes.error.message)
      else if (itemsRes.data) setItems(itemsRes.data as ScentBoardItem[])
      setLoading(false)
    })
  }, [boardId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleRemoveItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    await removeFromBoard(itemId)
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="pt-24 pb-32 px-6">
        <InlineError message="Couldn't load board" onRetry={fetchItems} />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 space-y-6">
      <div>
        <h2 className="font-headline text-2xl font-bold">{board?.title ?? 'Board'}</h2>
        {board?.description && <p className="text-sm text-secondary/60 mt-1">{board.description}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={() => setAddSheetOpen(true)} className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full hover:opacity-80 transition-transform">
            <span className="text-primary text-sm">+</span>
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">ADD</span>
          </button>
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 bg-error/10 px-4 py-2 rounded-full hover:opacity-80 transition-transform">
            <span className="text-error/70 text-sm">✕</span>
            <span className="text-[10px] font-bold tracking-widest text-error/70 uppercase">DELETE</span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center pt-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
            <span className="text-2xl text-secondary/40">?</span>
          </div>
          <p className="text-secondary/60 text-sm max-w-[240px]">This board is empty — add fragrances to start curating</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2 group cursor-pointer" role="link" tabIndex={0} onClick={() => navigate(`/fragrance/${item.fragrance.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/fragrance/${item.fragrance.id}`) } }}>
              <div className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low shadow-sm relative">
                {item.fragrance.image_url ? (
                  <img src={item.fragrance.image_url} alt={item.fragrance.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-secondary/50"><span>?</span></div>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id) }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-80 transition-opacity hover:opacity-80" aria-label="Remove from board">
                  <span className="text-white text-xs">✕</span>
                </button>
              </div>
              <div className="px-1">
                <span className="text-[9px] uppercase tracking-[0.1em] font-label text-secondary">{item.fragrance.brand}</span>
                <h4 className="text-sm font-semibold truncate">{item.fragrance.name}</h4>
                {item.note && <p className="text-[10px] text-secondary/40 italic truncate">{item.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {addSheetOpen && <AddToBoardSheet boardId={boardId} onClose={() => setAddSheetOpen(false)} onAdded={() => { setAddSheetOpen(false); fetchItems() }} />}

      {confirmDelete && (
        <DeleteConfirmDialog boardTitle={board?.title ?? 'this board'} onCancel={() => setConfirmDelete(false)} onConfirm={async () => { await deleteBoard(boardId); navigate('/boards') }} />
      )}
    </main>
  )
}

/* ── Add to Board Sheet ── */
function AddToBoardSheet({ boardId, onClose, onAdded }: { boardId: string; onClose: () => void; onAdded: () => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const trapRef = useFocusTrap(true, onClose)

  useEffect(() => {
    if (searchQuery.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%`)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(8)
        .then(({ data }) => {
          if (data) setResults(data as Fragrance[])
          setSearching(false)
        })
    }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [searchQuery])

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add fragrance to board">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4"><h1 className="text-xl font-headline font-bold text-on-surface">Add Fragrance</h1></header>
        <div className="px-8 pb-8 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center bg-surface-container rounded-sm px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all">
            <span className="text-secondary/50 mr-3">⌕</span>
            <input className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm" placeholder="Search fragrances..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
          </div>
          {searching ? (
            <div className="flex items-center justify-center py-8"><span className="text-[9px] uppercase tracking-wider text-primary animate-pulse">Loading…</span></div>
          ) : results.length === 0 && searchQuery.length >= 2 ? (
            <p className="text-sm text-secondary/50 text-center py-8">No fragrances found</p>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {results.map((f) => (
                <button key={f.id} onClick={async () => { setSaving(true); await addToBoard(boardId, f.id); setSaving(false); onAdded() }} disabled={saving} className="w-full flex items-center gap-3 p-3 hover:bg-surface-container-highest active:bg-surface-container-highest transition-colors text-left disabled:opacity-50">
                  <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                    {f.image_url ? <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-secondary/30">?</span></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{f.brand}</p>
                    <p className="text-sm text-on-surface truncate">{f.name}</p>
                  </div>
                  <span className="text-primary/60">⊕</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/* ── Delete Confirm Dialog ── */
function DeleteConfirmDialog({ boardTitle, onCancel, onConfirm }: { boardTitle: string; onCancel: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const trapRef = useFocusTrap(true, onCancel)

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-8" role="alertdialog" aria-modal="true" aria-label="Delete board">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-surface-container-low rounded-sm p-6 max-w-[320px] w-full space-y-4">
        <h3 className="font-headline text-lg text-on-surface">Delete board?</h3>
        <p className="text-sm text-secondary/60">&ldquo;{boardTitle}&rdquo; and all its items will be permanently removed.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-sm bg-surface-container text-sm font-medium text-on-surface hover:opacity-80 transition-transform">Cancel</button>
          <button onClick={async () => { setDeleting(true); await onConfirm() }} disabled={deleting} className="flex-1 py-3 rounded-sm bg-error/20 text-sm font-medium text-error hover:opacity-80 transition-transform disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
