/**
 * Parking spot data for a single spot on a given date.
 * Replaces the old SpotData which had spreadsheet-specific fields (colIndex, isDivider).
 */
export interface SpotData {
  /** SpacetimeDB spot ID */
  spotId: number;
  /** Spot name (e.g. "A1", "B2") */
  name: string;
  /** Person who reserved (empty string = free) */
  occupant: string;
}

/**
 * A day's worth of parking data.
 * Replaces the old DayData which had spreadsheet-specific fields (rowIndex).
 */
export interface DayData {
  /** Date string in YYYY-MM-DD format */
  date: string;
  /** Day name (e.g. "Monday") */
  day: string;
  /** All spots with their reservation status for this day */
  spots: SpotData[];
}

/**
 * Result of a reservation action (reserve, cancel, quick-reserve).
 */
export interface ReserveResult {
  success: boolean;
  error?: string;
  spotName?: string;
  /** ID of the spot that failed (for highlighting) */
  failedSpotId?: number;
}
