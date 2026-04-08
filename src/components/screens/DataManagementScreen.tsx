import { useState, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { hapticMedium } from '@/lib/haptics'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/* ── Types ─────────────────────────────────────────────── */
interface ExportData {
  exported_at: string
  version: string
  collection: unknown[]
  wear_logs: unknown[]
  reviews: unknown[]
  decants: unknown[]
  boards: unknown[]
  custom_lists: unknown[]
}

/* ── Helpers ───────────────────────────────────────────── */
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dateStamp() {
  return new Date().toISOString().split('T')[0]
}

/* ── Component ─────────────────────────────────────────── */
export function DataManagementScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const [exporting, setExporting] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<ExportData | null>(null)
  const [restoreStats, setRestoreStats] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4">
        <Icon name="cloud_download" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to manage your data</p>
      </main>
    )
  }

  /* ── Export: Full JSON backup ── */
  async function handleExportJSON() {
    setExporting('json')
    try {
      const [coll, wears, reviews, decants, boards, lists] = await Promise.all([
        supabase.from('user_collections').select('*, fragrance:fragrances(name, brand, concentration, note_family, accords, gender, rating, image_url)').eq('user_id', user!.id),
        supabase.from('wear_logs').select('*, fragrance:fragrances(name, brand)').eq('user_id', user!.id),
        supabase.from('reviews').select('*').eq('user_id', user!.id),
        supabase.from('decants').select('*, fragrance:fragrances(name, brand)').eq('user_id', user!.id),
        supabase.from('scent_boards').select('*, items:scent_board_items(fragrance_id)').eq('user_id', user!.id),
        supabase.from('custom_lists').select('*, items:custom_list_items(fragrance_id)').eq('user_id', user!.id),
      ])

      const data: ExportData = {
        exported_at: new Date().toISOString(),
        version: '2.0',
        collection: coll.data ?? [],
        wear_logs: wears.data ?? [],
        reviews: reviews.data ?? [],
        decants: decants.data ?? [],
        boards: boards.data ?? [],
        custom_lists: lists.data ?? [],
      }

      downloadFile(JSON.stringify(data, null, 2), `scentfolio-backup-${dateStamp()}.json`, 'application/json')
      hapticMedium()
      toast.showToast('Full backup exported', 'success')
    } catch {
      toast.showToast('Export failed', 'error')
    }
    setExporting(null)
  }

  /* ── Export: Collection CSV ── */
  async function handleExportCollectionCSV() {
    setExporting('csv-collection')
    try {
      const { data } = await supabase
        .from('user_collections')
        .select('status, personal_rating, notes, date_added, fragrance:fragrances(name, brand, concentration, note_family, rating, gender, accords)')
        .eq('user_id', user!.id)

      if (!data || data.length === 0) {
        toast.showToast('No collection data', 'error')
        setExporting(null)
        return
      }

      const headers = ['Brand', 'Name', 'Status', 'Concentration', 'Note Family', 'Gender', 'Your Rating', 'Community Rating', 'Accords', 'Notes', 'Date Added']
      const rows = data.map((item: any) => [
        item.fragrance?.brand ?? '',
        item.fragrance?.name ?? '',
        item.status,
        item.fragrance?.concentration ?? '',
        item.fragrance?.note_family ?? '',
        item.fragrance?.gender ?? '',
        item.personal_rating ?? '',
        item.fragrance?.rating ?? '',
        (item.fragrance?.accords ?? []).join('; '),
        item.notes ?? '',
        item.date_added?.split('T')[0] ?? '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: string[]) => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      downloadFile(csv, `scentfolio-collection-${dateStamp()}.csv`, 'text/csv')
      hapticMedium()
      toast.showToast('Collection CSV exported', 'success')
    } catch {
      toast.showToast('Export failed', 'error')
    }
    setExporting(null)
  }

  /* ── Export: Wear Log CSV ── */
  async function handleExportWearsCSV() {
    setExporting('csv-wears')
    try {
      const { data } = await supabase
        .from('wear_logs')
        .select('wear_date, occasion, notes, fragrance:fragrances(name, brand)')
        .eq('user_id', user!.id)
        .order('wear_date', { ascending: false })

      if (!data || data.length === 0) {
        toast.showToast('No wear logs to export', 'error')
        setExporting(null)
        return
      }

      const headers = ['Date', 'Brand', 'Name', 'Occasion', 'Notes']
      const rows = data.map((item: any) => [
        item.wear_date ?? '',
        item.fragrance?.brand ?? '',
        item.fragrance?.name ?? '',
        item.occasion ?? '',
        item.notes ?? '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: string[]) => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      downloadFile(csv, `scentfolio-wears-${dateStamp()}.csv`, 'text/csv')
      hapticMedium()
      toast.showToast('Wear log CSV exported', 'success')
    } catch {
      toast.showToast('Export failed', 'error')
    }
    setExporting(null)
  }

  /* ── Export: Collection HTML Report ── */
  async function handleExportReport() {
    setExporting('report')
    try {
      const [collRes, wearRes, reviewRes] = await Promise.all([
        supabase.from('user_collections').select('status, personal_rating, fragrance:fragrances(name, brand, concentration, note_family, rating, image_url, accords)').eq('user_id', user!.id).eq('status', 'own'),
        supabase.from('wear_logs').select('fragrance_id, wear_date').eq('user_id', user!.id),
        supabase.from('reviews').select('fragrance_id, rating, review_text').eq('user_id', user!.id),
      ])

      const collection = (collRes.data ?? []) as any[]
      const wears = (wearRes.data ?? []) as any[]
      const reviews = (reviewRes.data ?? []) as any[]

      // Stats
      const totalOwned = collection.length
      const avgRating = collection.filter((c: any) => c.personal_rating).reduce((s: number, c: any) => s + c.personal_rating, 0) / (collection.filter((c: any) => c.personal_rating).length || 1)
      const totalWears = wears.length
      const totalReviews = reviews.length
      const families = new Map<string, number>()
      collection.forEach((c: any) => {
        const f = c.fragrance?.note_family || 'Unknown'
        families.set(f, (families.get(f) ?? 0) + 1)
      })
      const topFamilies = [...families.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      const brands = new Map<string, number>()
      collection.forEach((c: any) => {
        const b = c.fragrance?.brand || 'Unknown'
        brands.set(b, (brands.get(b) ?? 0) + 1)
      })
      const topBrands = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

      // Wear counts
      const wearCounts = new Map<string, number>()
      wears.forEach((w: any) => wearCounts.set(w.fragrance_id, (wearCounts.get(w.fragrance_id) ?? 0) + 1))

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ScentFolio Collection Report — ${dateStamp()}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #191210; color: #e8e0d8; padding: 40px 20px; max-width: 800px; margin: 0 auto; }
  h1 { color: #e5c276; font-size: 28px; margin-bottom: 8px; }
  h2 { color: #e5c276; font-size: 18px; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #2a2420; }
  .subtitle { color: #9a8e82; font-size: 13px; margin-bottom: 32px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #221c18; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: bold; color: #e5c276; }
  .stat-label { font-size: 11px; color: #9a8e82; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .bar-chart { display: flex; gap: 8px; align-items: end; height: 100px; margin: 16px 0; }
  .bar { flex: 1; background: #e5c276; border-radius: 4px 4px 0 0; min-width: 0; position: relative; }
  .bar-label { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 9px; color: #9a8e82; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #2a2420; color: #e5c276; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 10px 8px; border-bottom: 1px solid #1e1916; }
  tr:hover { background: #1e1916; }
  .rating { color: #e5c276; }
  .accords { font-size: 11px; color: #9a8e82; }
  .footer { margin-top: 40px; text-align: center; color: #5a4e42; font-size: 11px; }
  @media print { body { background: #fff; color: #333; } .stat { background: #f5f5f5; } .stat-value { color: #8b6914; } h1, h2, .rating { color: #8b6914; } th { color: #8b6914; border-bottom-color: #ddd; } td { border-bottom-color: #eee; } }
  @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
<h1>ScentFolio Collection</h1>
<p class="subtitle">Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} — ${totalOwned} fragrances</p>

<div class="stats-grid">
  <div class="stat"><div class="stat-value">${totalOwned}</div><div class="stat-label">Owned</div></div>
  <div class="stat"><div class="stat-value">${avgRating.toFixed(1)}</div><div class="stat-label">Avg Rating</div></div>
  <div class="stat"><div class="stat-value">${totalWears}</div><div class="stat-label">Total Wears</div></div>
  <div class="stat"><div class="stat-value">${totalReviews}</div><div class="stat-label">Reviews</div></div>
</div>

<h2>Top Note Families</h2>
<div class="bar-chart">
${topFamilies.map(([name, count]) => {
  const maxCount = topFamilies[0][1]
  const pct = Math.max((count / maxCount) * 100, 5)
  return `  <div class="bar" style="height:${pct}%"><span class="bar-label">${name} (${count})</span></div>`
}).join('\n')}
</div>

<h2>Top Brands</h2>
<div class="bar-chart">
${topBrands.map(([name, count]) => {
  const maxCount = topBrands[0][1]
  const pct = Math.max((count / maxCount) * 100, 5)
  return `  <div class="bar" style="height:${pct}%"><span class="bar-label">${name} (${count})</span></div>`
}).join('\n')}
</div>

<h2>Full Collection</h2>
<table>
<thead><tr><th>Brand</th><th>Name</th><th>Type</th><th>Family</th><th>Rating</th><th>Wears</th></tr></thead>
<tbody>
${collection
  .sort((a: any, b: any) => (a.fragrance?.brand ?? '').localeCompare(b.fragrance?.brand ?? ''))
  .map((c: any) => {
    const f = c.fragrance ?? {}
    const wc = wearCounts.get(c.fragrance_id ?? '') ?? 0
    return `<tr>
  <td>${f.brand ?? ''}</td>
  <td>${f.name ?? ''}</td>
  <td>${f.concentration ?? ''}</td>
  <td>${f.note_family ?? ''}</td>
  <td class="rating">${c.personal_rating ? '★'.repeat(c.personal_rating) : '—'}</td>
  <td>${wc || '—'}</td>
</tr>`
  }).join('\n')}
</tbody>
</table>

<div class="footer">
  <p>ScentFolio — Your Personal Fragrance Journal</p>
  <p>scentfolio-app.web.app</p>
</div>
</body>
</html>`

      downloadFile(html, `scentfolio-report-${dateStamp()}.html`, 'text/html')
      hapticMedium()
      toast.showToast('Collection report exported', 'success')
    } catch {
      toast.showToast('Report generation failed', 'error')
    }
    setExporting(null)
  }

  /* ── Restore from JSON backup ── */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ExportData
        if (!data.exported_at || !data.collection) {
          toast.showToast('Invalid backup file', 'error')
          return
        }
        setPendingRestore(data)
        const stats = [
          `${data.collection?.length ?? 0} collection items`,
          `${data.wear_logs?.length ?? 0} wear logs`,
          `${data.reviews?.length ?? 0} reviews`,
          `${data.decants?.length ?? 0} decants`,
        ].join(', ')
        setRestoreStats(stats)
        setRestoreConfirmOpen(true)
      } catch {
        toast.showToast('Could not parse backup file', 'error')
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  async function handleRestore() {
    if (!pendingRestore || !user) return
    setRestoring(true)
    try {
      let restored = 0

      // Restore collection — upsert to avoid duplicates
      if (pendingRestore.collection?.length) {
        for (const item of pendingRestore.collection as any[]) {
          const { error } = await supabase.from('user_collections').upsert({
            user_id: user.id,
            fragrance_id: item.fragrance_id,
            status: item.status ?? 'own',
            personal_rating: item.personal_rating,
            notes: item.notes,
            date_added: item.date_added,
          }, { onConflict: 'user_id,fragrance_id' })
          if (!error) restored++
        }
      }

      // Restore wear logs — insert (skip if duplicate date+fragrance)
      if (pendingRestore.wear_logs?.length) {
        for (const log of pendingRestore.wear_logs as any[]) {
          const { error: wearErr } = await supabase.from('wear_logs').upsert({
            user_id: user.id,
            fragrance_id: log.fragrance_id,
            wear_date: log.wear_date,
            occasion: log.occasion,
            notes: log.notes,
          }, { onConflict: 'user_id,fragrance_id,wear_date' })
          if (wearErr) { /* skip dupes */ }
        }
      }

      // Restore reviews
      if (pendingRestore.reviews?.length) {
        for (const review of pendingRestore.reviews as any[]) {
          const { error: revErr } = await supabase.from('reviews').upsert({
            user_id: user.id,
            fragrance_id: review.fragrance_id,
            rating: review.rating,
            review_text: review.review_text,
          }, { onConflict: 'user_id,fragrance_id' })
          if (revErr) { /* skip dupes */ }
        }
      }

      hapticMedium()
      toast.showToast(`Restored ${restored} items`, 'success')
    } catch {
      toast.showToast('Restore failed', 'error')
    }
    setRestoring(false)
    setRestoreConfirmOpen(false)
    setPendingRestore(null)
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-6">
      <div className="text-center mb-2">
        <h2 className="font-headline text-lg text-on-surface">Data & Export</h2>
        <p className="text-[10px] text-secondary/50">Backup, export, and restore your data</p>
      </div>

      {/* Export section */}
      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary font-bold">EXPORT</h3>

        <button
          onClick={handleExportJSON}
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="data_object" className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Full Backup (JSON)</p>
            <p className="text-[10px] text-secondary/50">Collection, wears, reviews, boards, lists</p>
          </div>
          {exporting === 'json' ? (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
            <Icon name="download" className="text-primary" />
          )}
        </button>

        <button
          onClick={handleExportCollectionCSV}
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="table_chart" className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Collection (CSV)</p>
            <p className="text-[10px] text-secondary/50">Spreadsheet-ready with all details</p>
          </div>
          {exporting === 'csv-collection' ? (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
            <Icon name="download" className="text-primary" />
          )}
        </button>

        <button
          onClick={handleExportWearsCSV}
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="calendar_month" className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Wear Log (CSV)</p>
            <p className="text-[10px] text-secondary/50">Every wear with date and details</p>
          </div>
          {exporting === 'csv-wears' ? (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
            <Icon name="download" className="text-primary" />
          )}
        </button>

        <button
          onClick={handleExportReport}
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="summarize" className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Collection Report (HTML)</p>
            <p className="text-[10px] text-secondary/50">Beautiful printable report with stats & charts</p>
          </div>
          {exporting === 'report' ? (
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
            <Icon name="download" className="text-primary" />
          )}
        </button>
      </section>

      {/* Restore section */}
      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary font-bold">RESTORE</h3>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center">
            <Icon name="upload_file" className="text-tertiary" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Restore from Backup</p>
            <p className="text-[10px] text-secondary/50">Import a ScentFolio JSON backup file</p>
          </div>
          <Icon name="upload" className="text-tertiary" />
        </button>

        <div className="px-4 py-3 bg-surface-container/50 rounded-xl">
          <div className="flex items-start gap-2">
            <Icon name="info" className="text-secondary/40 mt-0.5" size={16} />
            <p className="text-[10px] text-secondary/50 leading-relaxed">
              Restore merges data with your existing collection — it won't delete anything.
              Duplicate items are automatically skipped.
            </p>
          </div>
        </div>
      </section>

      {/* Restore confirmation dialog */}
      {restoreConfirmOpen && (
        <RestoreConfirmDialog
          stats={restoreStats}
          restoring={restoring}
          onConfirm={handleRestore}
          onCancel={() => { setRestoreConfirmOpen(false); setPendingRestore(null) }}
        />
      )}
    </main>
  )
}

/* ── Restore Confirm Dialog ── */
function RestoreConfirmDialog({ stats, restoring, onConfirm, onCancel }: {
  stats: string; restoring: boolean; onConfirm: () => void; onCancel: () => void
}) {
  const trapRef = useFocusTrap(true, onCancel)

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative mx-8 max-w-sm w-full bg-surface-container-low rounded-3xl p-8 animate-scale-in">
        <div className="w-14 h-14 rounded-full bg-tertiary/10 flex items-center justify-center mx-auto mb-4">
          <Icon name="restore" className="text-tertiary text-2xl" />
        </div>
        <h3 className="font-headline text-xl text-on-surface text-center mb-2">Restore Backup?</h3>
        <p className="text-sm text-secondary/60 text-center mb-2">This backup contains:</p>
        <p className="text-xs text-primary text-center font-medium mb-6">{stats}</p>
        <p className="text-[10px] text-secondary/50 text-center mb-6">
          Existing data will be preserved. Only new items will be added.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={restoring}
            className="flex-1 py-3 bg-surface-container rounded-xl text-sm font-medium text-secondary active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={restoring}
            className="flex-1 py-3 gold-gradient rounded-xl text-sm font-bold text-on-primary-container active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {restoring ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  )
}
