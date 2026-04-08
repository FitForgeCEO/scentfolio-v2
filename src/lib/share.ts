/**
 * Share utilities — centralised sharing logic for ScentFolio
 */

import { hapticMedium } from './haptics'

// ── Native Web Share ─────────────────────────────────────────────

export interface ShareData {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export async function nativeShare(data: ShareData): Promise<boolean> {
  if (!navigator.share) return false
  try {
    if (data.files?.length && navigator.canShare && !navigator.canShare({ files: data.files })) {
      delete data.files
    }
    await navigator.share(data)
    hapticMedium()
    return true
  } catch {
    return false // user cancelled or unsupported
  }
}

// ── Image blob from html-to-image ────────────────────────────────

export async function captureElement(el: HTMLElement, bgColor = '#191210'): Promise<Blob | null> {
  try {
    const { toBlob } = await import('html-to-image')
    return await toBlob(el, { backgroundColor: bgColor, pixelRatio: 2 })
  } catch {
    return null
  }
}

// ── Share an image blob (native → download fallback) ─────────────

export async function shareImage(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
): Promise<'shared' | 'downloaded' | 'failed'> {
  const file = new File([blob], filename, { type: 'image/png' })

  // Try native share
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      hapticMedium()
      return 'shared'
    } catch {
      // user cancelled — fall through to download
    }
  }

  // Fallback: download
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

// ── Copy text to clipboard ───────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    hapticMedium()
    return true
  } catch {
    return false
  }
}

// ── Deep link helpers ────────────────────────────────────────────

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://scentfolio-app.web.app'

export function fragranceLink(id: string): string {
  return `${APP_URL}/fragrance/${id}`
}

export function profileLink(userId: string): string {
  return `${APP_URL}/u/${userId}`
}

export function collectionLink(userId: string): string {
  return `${APP_URL}/u/${userId}/collection`
}

export function reviewLink(reviewId: string): string {
  return `${APP_URL}/review/${reviewId}`
}
