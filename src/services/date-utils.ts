/**
 * Format a date to match the spreadsheet format (YYYY-MM-DD).
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a date for display in the UI (e.g. "3/11/2026").
 */
export function formatDateDisplay(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

/**
 * Get day name from date.
 */
export function getDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Parse a YYYY-MM-DD date string into a local Date object.
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Return a new Date offset by the given number of days.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
