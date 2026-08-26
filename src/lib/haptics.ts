/** Best-effort tactile acknowledgement for touch controls. Unsupported browsers ignore it. */
export function haptic(kind: 'tap' | 'confirm' = 'tap'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(kind === 'confirm' ? [10, 35, 12] : 10);
}
