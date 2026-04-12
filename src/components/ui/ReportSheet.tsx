import { useState, useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { getIconChar } from '@/lib/iconUtils'

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or misleading', icon: 'report' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'gpp_bad' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'block' },
  { id: 'fake', label: 'Fake account or review', icon: 'person_off' },
  { id: 'other', label: 'Other', icon: 'more_horiz' },
] as const

type ReportReason = typeof REPORT_REASONS[number]['id']

interface ReportSheetProps {
  isOpen: boolean
  onClose: () => void
  targetType: 'user' | 'review'
  targetId: string
  targetName: string
}

export function ReportSheet({ isOpen, onClose, targetType, targetId, targetName }: ReportSheetProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const sheetRef = useFocusTrap(isOpen, onClose)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!user || !reason) return
    setSubmitting(true)

    try {
      await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || null,
      })
      setSubmitted(true)
      showToast('Report submitted. Thank you.', 'success')
    } catch {
      showToast('Failed to submit report', 'error')
    }

    setSubmitting(false)
  }

  const handleClose = () => {
    setReason(null)
    setDetails('')
    setSubmitted(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div
        ref={sheetRef}
        className="relative w-full max-w-[430px] bg-surface-container rounded-t-3xl p-6 pb-10 animate-slide-up max-h-[85vh] overflow-y-auto"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-outline-variant/30 rounded-full mx-auto mb-6" />

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary text-3xl">✓</span>
            </div>
            <h3 className="font-headline text-xl text-on-surface mb-2">Report Submitted</h3>
            <p className="text-sm text-secondary/50 mb-6">
              We'll review this and take action if needed. Thank you for helping keep ScentFolio safe.
            </p>
            <button
              onClick={handleClose}
              className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all"
            >
              DONE
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-headline text-xl text-on-surface mb-1">
              Report {targetType === 'user' ? 'User' : 'Review'}
            </h3>
            <p className="text-xs text-secondary/50 mb-6">
              {targetType === 'user' ? `Report ${targetName}` : `Report review by ${targetName}`}
            </p>

            {/* Reason selection */}
            <div className="space-y-2 mb-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-2">
                SELECT A REASON
              </p>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left transition-all hover:opacity-80 ${
                    reason === r.id
                      ? 'bg-primary/10 ring-1 ring-primary/30'
                      : 'bg-surface-container-highest/50'
                  }`}
                >
                  <span>{getIconChar(r.icon)}</span>
                  <span className={`text-sm ${reason === r.id ? 'text-on-surface font-medium' : 'text-secondary/70'}`}>
                    {r.label}
                  </span>
                  {reason === r.id && (
                    <span className="text-primary ml-auto">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Additional details */}
            {reason && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-2">
                  ADDITIONAL DETAILS (OPTIONAL)
                </p>
                <textarea
                  ref={textareaRef}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Tell us more about the issue..."
                  rows={3}
                  maxLength={500}
                  className="w-full bg-surface-container-highest/50 rounded-sm px-4 py-3 text-sm text-on-surface placeholder:text-secondary/30 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                />
                <p className="text-[9px] text-secondary/30 text-right mt-1">{details.length}/500</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 bg-surface-container-highest/50 text-on-surface py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="flex-1 bg-error/80 text-white py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all disabled:opacity-30"
              >
                {submitting ? 'SENDING...' : 'SUBMIT REPORT'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
