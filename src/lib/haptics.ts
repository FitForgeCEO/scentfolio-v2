/**
 * Lightweight haptic feedback utility.
 * Uses the Vibration API where available (most Android + some iOS via PWA).
 * Silently no-ops on unsupported browsers.
 */

export function hapticLight() {
  try {
    navigator?.vibrate?.(10)
  } catch {
    // Silently ignore — not all browsers support vibration
  }
}

export function hapticMedium() {
  try {
    navigator?.vibrate?.(25)
  } catch {
    // Silently ignore
  }
}

export function hapticSuccess() {
  try {
    navigator?.vibrate?.([10, 30, 10])
  } catch {
    // Silently ignore
  }
}
