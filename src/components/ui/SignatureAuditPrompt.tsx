/**
 * SignatureAuditPrompt — the behaviour-milestone auto-prompt.
 *
 * Letterboxd Wrapped triggers around usage milestones; ours fires once the
 * user has logged >= 10 wears and has never generated a Signature Audit.
 * Shown once (localStorage-guarded), dismissible, mounted on HomeScreen.
 *
 * Self-contained: does its own eligibility queries so HomeScreen's diff is
 * two lines. v1 simplification (flagged in the build report): eligibility is
 * checked on Home mount rather than at the exact moment the 10th wear is
 * logged — same milestone, one surface, far smaller blast radius.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { generateSignatureAudit } from '@/hooks/useSignatureAudit'

const DISMISS_FLAG = 'scentfolio.signature-audit-prompt.v1'
const MILESTONE_WEARS = 10

const NOIR = '#191210'
const GOLD = '#e5c276'

export function SignatureAuditPrompt() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [eligible, setEligible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(DISMISS_FLAG)) return
    let cancelled = false
    void (async () => {
      const [wearRes, profRes] = await Promise.all([
        supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('profiles').select('signature_slug').eq('id', user.id).single(),
      ])
      if (cancelled) return
      const wears = wearRes.count ?? 0
      const hasAudit = !!profRes.data?.signature_slug
      if (wears >= MILESTONE_WEARS && !hasAudit) setEligible(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!eligible || !user) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_FLAG, '1')
    setEligible(false)
  }

  const generate = async () => {
    if (busy) return
    setBusy(true)
    try {
      const row = await generateSignatureAudit(user.id)
      window.localStorage.setItem(DISMISS_FLAG, '1')
      navigate(`/signature/${row.slug}`)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Dismiss" onClick={dismiss} className="absolute inset-0" style={{ background: 'rgba(12,8,7,0.7)' }} />
      <div
        className="relative w-full max-w-[400px] mx-4 mb-8 rounded-sm p-6 animate-slide-up"
        style={{ backgroundColor: NOIR, border: `1px solid ${GOLD}4d` }}
      >
        <p className="font-label text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>
          Ten wears on record
        </p>
        <h3 className="font-headline italic text-2xl mb-2" style={{ color: '#e8dfd3' }}>
          Your Signature is legible now.
        </h3>
        <p className="font-headline italic text-sm mb-6" style={{ color: 'rgba(232,223,211,0.6)' }}>
          Enough entries in the ledger to read what your wardrobe says about you.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => void generate()}
            disabled={busy}
            className="flex-1 py-3.5 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest"
            style={{ background: GOLD, color: NOIR, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Reading…' : 'Read my Signature'}
          </button>
          <button
            onClick={dismiss}
            className="px-5 py-3.5 rounded-sm font-label text-[10px] uppercase tracking-widest"
            style={{ border: `1px solid ${GOLD}33`, color: 'rgba(232,223,211,0.6)' }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
