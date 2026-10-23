// Ambient animation (screens, belts, lights) respects the player's reduced-motion setting.

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when the player asked their device for reduced motion. */
export const prefersReducedMotion = (): boolean => reduced;

/** The clock for purely decorative animation: frozen at 0 under reduced motion. */
export const ambientTime = (t: number): number => (reduced ? 0 : t);
