// Harish Pulse, the activity indicator: the HC monogram itself, lit by a wave
// that travels left to right through its strokes — H stems, crossbar, then the
// C — as though the mark were being typed. One keyframe set, one negative delay
// per stroke, so every spinner on screen stays in phase.

/** Seconds per loop at 1×. */
export const harishLoop = 1.5

/** Resting opacity of an unlit stroke. */
const dim = 0.18

// The mark on its 24-unit grid: H is two stems and a crossbar, C a spine and two
// arms. Same geometry as the app icon, so the spinner and the logo agree.
const strokes = [
  { x: 4, y: 6, w: 2, h: 12, at: 0 }, // H left stem
  { x: 6, y: 10.5, w: 4, h: 3, at: 0.06 }, // H crossbar
  { x: 10, y: 6, w: 2, h: 12, at: 0.12 }, // H right stem
  { x: 15, y: 6, w: 3, h: 12, at: 0.3 }, // C spine
  { x: 18, y: 6, w: 4, h: 3, at: 0.42 }, // C top arm
  { x: 18, y: 15, w: 4, h: 3, at: 0.42 }, // C bottom arm
] as const

export type HarishStroke = {
  x: number
  y: number
  w: number
  h: number
  /** Where in the loop the stroke lights, 0–1. */
  at: number
  /** Opacity for reduced motion. */
  still: number
}

/** The mark's strokes, positioned on the 24-unit grid. */
export function harishStrokes(): HarishStroke[] {
  return strokes.map((stroke) => ({ ...stroke, still: 0.5 }))
}

/** Opacity keyframes shared by every stroke; only the delay differs. */
export function harishKeyframes(name: string) {
  return `@keyframes ${name} {
    0% { opacity: ${dim}; }
    9% { opacity: 1; }
    34% { opacity: ${dim}; }
    100% { opacity: ${dim}; }
  }`
}
