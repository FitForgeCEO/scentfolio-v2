/**
 * Haptic feedback utility — routes through @capacitor/haptics on native
 * (proper iOS Taptic Engine + Android haptics), falls back to the browser
 * Vibration API on web. All callers get the right feedback for their runtime
 * automatically — no call-site changes required.
 */

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export function hapticLight() {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
      // Native plugin unavailable — silently ignore
    })
    return
  }
  try {
    navigator?.vibrate?.(10)
  } catch {
    // Silently ignore — not all browsers support vibration
  }
}

export function hapticMedium() {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {
      // Native plugin unavailable — silently ignore
    })
    return
  }
  try {
    navigator?.vibrate?.(25)
  } catch {
    // Silently ignore
  }
}

export function hapticSuccess() {
  if (Capacitor.isNativePlatform()) {
    Haptics.notification({ type: NotificationType.Success }).catch(() => {
      // Native plugin unavailable — silently ignore
    })
    return
  }
  try {
    navigator?.vibrate?.([10, 30, 10])
  } catch {
    // Silently ignore
  }
}
