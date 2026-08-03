/**
 * Helpers for visualizing parking availability as a progress bar.
 *
 * The "free spots" label in the Upcoming Days view uses these values to render
 * a progress-bar background whose width reflects the ratio of free to total
 * spots, and whose color changes progressively from red (none free) through
 * yellow to green (all free).
 */

export interface AvailabilityVisual {
  /** Fill width of the progress bar, from 0 to 100 (percent). */
  percent: number;
  /** Color of the filled portion of the progress bar. */
  color: string;
}

/**
 * Clamp a number into the inclusive [min, max] range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the progress-bar fill percentage and color for a given availability.
 *
 * The color hue is interpolated across the ratio of free spots so that fuller
 * availability trends green, mid availability trends yellow, and low/zero
 * availability trends red.
 *
 * @param freeCount Number of free spots (values below 0 are treated as 0).
 * @param totalSpots Total number of spots (values below 0 are treated as 0).
 */
export function availabilityVisual(
  freeCount: number,
  totalSpots: number,
): AvailabilityVisual {
  const total = Math.max(0, totalSpots);
  const free = clamp(freeCount, 0, total);
  const ratio = total === 0 ? 0 : free / total;

  const percent = Math.round(ratio * 100);
  // Hue 0 = red, 60 = yellow, 120 = green.
  const hue = Math.round(ratio * 120);
  const color = `hsl(${hue}, 65%, 45%)`;

  return { percent, color };
}
