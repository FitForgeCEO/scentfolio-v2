import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'

interface ParsedRow {
  brand: string
  name: string
  status: 'own' | 'wishlist' | 'sampled' | 'sold'
  rating: number | null
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

export function ImportScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<ImportStep>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [imported, setImported] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []

    const headerLine = lines[0].toLowerCase()
    const headers = parseCSVLine(headerLine)

    const brandIdx = headers.findIndex((h) => h.includes('brand'))
    const nameIdx = headers.findIndex((h) => h.includes('name') && !h.includes('brand'))
    const statusIdx = headers.findIndex((h) => h.includes('status'))
    const ratingIdx = headers.findIndex((h) => h.includes('rating') && (h.includes('your') || h.includes('personal')))

    if (brandIdx === -1 || nameIdx === -1) {
      setError('CSV must have at least "Brand" and "Name" columns')
      return []
    }

    const parsed: ParsedRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const brand = cols[brandIdx]?.trim()
      const name = cols[nameIdx]?.trim()
      if (!brand || !name) continue

      let status: ParsedRow['status'] = 'own'
      if (statusIdx >= 0) {
        const s = cols[statusIdx]?.trim().toLowerCase()
        if (s === 'wishlist' || s === 'wish') status = 'wishlist'
        else if (s === 'sampled' || s === 'sample') status = 'sampled'
        else if (s === 'sold') status = 'sold'
      }

      let rating: number | null = null
      if (ratingIdx >= 0) {
        const r = parseFloat(cols[ratingIdx])
        if (!isNaN(r) && r >= 0 && r <= 5) rating = r
      }

      parsed.push({ brand, name, status, rating })
    }
    return parsed
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length > 0) {
        setRows(parsed)
        setStep('preview')
      } else if (!error) {
        setError('No valid rows found. Ensure your CSV has Brand and Name columns.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!user || rows.length === 0) return
    setStep('importing')
    setTotal(rows.length)
    let importedCount = 0
    let skippedCount = 0

    for (const row of rows) {
      // Find fragrance by brand + name (case-insensitive)
      const { data: matches } = await supabase
        .from('fragrances')
        .select('id')
        .ilike('brand', row.brand)
        .ilike('name', row.name)
        .limit(1)

      if (matches && matches.length > 0) {
        // Check if already in collection
        const { data: existing } = await supabase
          .from('user_collections')
          .select('id')
          .eq('user_id', user.id)
          .eq('fragrance_id', matches[0].id)
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabase.from('user_collections').insert({
            user_id: user.id,
            fragrance_id: matches[0].id,
            status: row.status,
            personal_rating: row.rating,
          })
          importedCount++
        } else {
          skippedCount++
        }
      } else {
        skippedCount++
      }

      setImported(importedCount)
      setSkipped(skippedCount)
    }

    setStep('done')
    toast.showToast(`Imported ${importedCount} fragrances`, 'success')
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to import fragrances</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {step === 'upload' && (
        <section className="flex flex-col items-center gap-6 mt-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-4xl text-primary">?</span>
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-headline text-2xl">Import Collection</h2>
            <p className="text-sm text-secondary/60 max-w-[300px]">
              Upload a CSV file with your fragrance collection. We'll match each entry to our database.
            </p>
          </div>

          <div className="w-full space-y-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-outline-variant/40 rounded-sm p-8 flex flex-col items-center gap-3 hover:opacity-80 transition-all hover:border-primary/40"
            >
              <span className="text-3xl text-primary/60">?</span>
              <p className="text-sm text-on-surface font-medium">Choose CSV file</p>
              <p className="text-[10px] text-secondary/50">or drag and drop</p>
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

            {error && (
              <div className="bg-error/10 rounded-sm p-4 flex items-start gap-3">
                <span className="text-error">⚠</span>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="bg-surface-container rounded-sm p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold">EXPECTED FORMAT</p>
              <div className="overflow-x-auto">
                <table className="text-[10px] text-secondary/70 w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/20">
                      <th className="text-left py-1 pr-3 text-primary">Brand</th>
                      <th className="text-left py-1 pr-3 text-primary">Name</th>
                      <th className="text-left py-1 pr-3">Status</th>
                      <th className="text-left py-1">Your Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1 pr-3">Dior</td>
                      <td className="py-1 pr-3">Sauvage</td>
                      <td className="py-1 pr-3">own</td>
                      <td className="py-1">4.5</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3">Chanel</td>
                      <td className="py-1 pr-3">Bleu de Chanel</td>
                      <td className="py-1 pr-3">wishlist</td>
                      <td className="py-1" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-secondary/40">Brand and Name columns are required. Status defaults to "own".</p>
            </div>
          </div>
        </section>
      )}

      {step === 'preview' && (
        <section className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-xl">Preview</h2>
              <p className="text-[10px] text-secondary/60">{rows.length} fragrances found</p>
            </div>
            <button
              onClick={() => { setStep('upload'); setRows([]); setError(null) }}
              className="text-[10px] uppercase tracking-widest text-secondary font-bold px-3 py-2 rounded-sm hover:opacity-80"
            >
              CHANGE FILE
            </button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {rows.slice(0, 50).map((row, i) => (
              <div key={i} className="bg-surface-container rounded-sm px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{row.brand}</p>
                  <p className="text-sm text-on-surface font-medium truncate">{row.name}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-[8px] uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {row.status}
                  </span>
                  {row.rating && (
                    <span className="text-[10px] text-primary font-semibold">{row.rating}</span>
                  )}
                </div>
              </div>
            ))}
            {rows.length > 50 && (
              <p className="text-[10px] text-secondary/50 text-center py-2">
                ...and {rows.length - 50} more
              </p>
            )}
          </div>

          <button
            onClick={handleImport}
            className="w-full gold-gradient text-on-primary-container py-4 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg"
          >
            IMPORT {rows.length} FRAGRANCES
          </button>
        </section>
      )}

      {step === 'importing' && (
        <section className="flex flex-col items-center gap-6 mt-16">
          <div className="flex flex-col items-center gap-2">{[1,2,3,4].map(i => <div key={i} className="h-1.5 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${80 - i * 14}px` }} />)}</div>
          <div className="text-center space-y-2">
            <h2 className="font-headline text-xl">Importing...</h2>
            <p className="text-sm text-secondary/60">{imported + skipped} / {total}</p>
          </div>
          <div className="w-full bg-surface-container-low rounded-full h-2 overflow-hidden">
            <div
              className="h-full gold-gradient transition-all duration-300"
              style={{ width: `${total > 0 ? ((imported + skipped) / total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="font-headline text-lg text-primary">{imported}</p>
              <p className="text-[9px] text-secondary/50 uppercase">Imported</p>
            </div>
            <div>
              <p className="font-headline text-lg text-secondary/60">{skipped}</p>
              <p className="text-[9px] text-secondary/50 uppercase">Skipped</p>
            </div>
          </div>
        </section>
      )}

      {step === 'done' && (
        <section className="flex flex-col items-center gap-6 mt-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-4xl text-primary">✓</span>
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-headline text-2xl">Import Complete</h2>
            <p className="text-sm text-secondary/60">
              {imported} added, {skipped} skipped (duplicates or not found)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/collection')}
              className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80"
            >
              VIEW COLLECTION
            </button>
            <button
              onClick={() => { setStep('upload'); setRows([]); setImported(0); setSkipped(0); setError(null) }}
              className="bg-surface-container text-on-surface px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80"
            >
              IMPORT MORE
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
