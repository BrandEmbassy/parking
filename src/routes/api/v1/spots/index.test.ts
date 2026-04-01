import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/services/spacetimedb", () => ({
  getConnection: vi.fn(),
  getSpotsForDate: vi.fn(),
  getFreeCount: vi.fn(),
}));

import { onGet } from "./index";
import {
  getConnection,
  getSpotsForDate,
  getFreeCount,
} from "~/services/spacetimedb";

const mockGetConnection = vi.mocked(getConnection);
const mockGetSpotsForDate = vi.mocked(getSpotsForDate);
const mockGetFreeCount = vi.mocked(getFreeCount);

function makeEvent(queryParams: Record<string, string> = {}) {
  const event: any = {
    query: {
      get: (key: string) => queryParams[key] ?? null,
    },
    json: vi.fn(),
  };
  return event;
}

describe("GET /api/v1/spots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue({} as any);
  });

  it("returns 400 when date is missing", async () => {
    const event = makeEvent();
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(400, {
      error: "Bad Request",
      message: "Query parameter 'date' is required (YYYY-MM-DD)",
    });
  });

  it("returns 400 when date format is invalid", async () => {
    const event = makeEvent({ date: "01-01-2025" });
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(400, {
      error: "Bad Request",
      message: "Query parameter 'date' is required (YYYY-MM-DD)",
    });
  });

  it("returns 400 for partial date format", async () => {
    const event = makeEvent({ date: "2025-1-1" });
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns spots with availability info", async () => {
    mockGetSpotsForDate.mockReturnValue([
      { spotId: 1, name: "A1", occupant: "Alice", sortOrder: 1 },
      { spotId: 2, name: "A2", occupant: "", sortOrder: 2 },
    ]);
    mockGetFreeCount.mockReturnValue(1);

    const event = makeEvent({ date: "2025-06-15" });
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(200, {
      date: "2025-06-15",
      spots: [
        { spotId: 1, name: "A1", occupant: "Alice", available: false },
        { spotId: 2, name: "A2", occupant: null, available: true },
      ],
      total: 2,
      available: 1,
    });
  });

  it("returns 500 on connection error", async () => {
    mockGetConnection.mockRejectedValue(new Error("Connection failed"));

    const event = makeEvent({ date: "2025-06-15" });
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(500, {
      error: "Internal Server Error",
      message: "Connection failed",
    });
  });
});
