import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/services/spacetimedb", () => ({
  getConnection: vi.fn(),
  getSpotsForDate: vi.fn(),
  quickReserve: vi.fn(),
  waitForDataSync: vi.fn(),
}));

import { onPost } from "./index";
import {
  getConnection,
  getSpotsForDate,
  quickReserve,
  waitForDataSync,
} from "~/services/spacetimedb";

const mockGetConnection = vi.mocked(getConnection);
const mockGetSpotsForDate = vi.mocked(getSpotsForDate);
const mockQuickReserve = vi.mocked(quickReserve);
const mockWaitForDataSync = vi.mocked(waitForDataSync);

function makeEvent(body: any, parseError = false) {
  return {
    request: {
      json: parseError
        ? vi.fn().mockRejectedValue(new SyntaxError("bad json"))
        : vi.fn().mockResolvedValue(body),
    },
    json: vi.fn(),
  } as any;
}

describe("POST /api/v1/reservations/quick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue({} as any);
    mockWaitForDataSync.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid JSON body", async () => {
    const event = makeEvent(null, true);
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(400, {
      error: "Bad Request",
      message: "Invalid JSON body",
    });
  });

  it("returns 400 when date is missing", async () => {
    const event = makeEvent({ occupant: "Alice" });
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns 400 when occupant is empty", async () => {
    const event = makeEvent({ date: "2025-06-15", occupant: "" });
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns 400 for invalid date format", async () => {
    const event = makeEvent({ date: "June 15", occupant: "Alice" });
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        message: "'date' must be in YYYY-MM-DD format",
      }),
    );
  });

  it("quick-reserves successfully with spot details", async () => {
    mockQuickReserve.mockResolvedValue(undefined);
    mockGetSpotsForDate.mockReturnValue([
      { spotId: 1, name: "A1", occupant: "Alice", sortOrder: 1 },
      { spotId: 2, name: "A2", occupant: "", sortOrder: 2 },
    ]);

    const event = makeEvent({ date: "2025-06-15", occupant: "Alice" });
    await onPost(event);

    expect(mockQuickReserve).toHaveBeenCalledWith("2025-06-15", "Alice");
    expect(event.json).toHaveBeenCalledWith(201, {
      success: true,
      date: "2025-06-15",
      occupant: "Alice",
      spotId: 1,
      spotName: "A1",
    });
  });

  it("returns null spot info when sync times out", async () => {
    mockQuickReserve.mockResolvedValue(undefined);
    mockWaitForDataSync.mockRejectedValue(new Error("Data sync timeout"));
    mockGetSpotsForDate.mockReturnValue([
      { spotId: 1, name: "A1", occupant: "", sortOrder: 1 },
    ]);

    const event = makeEvent({ date: "2025-06-15", occupant: "Alice" });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(201, {
      success: true,
      date: "2025-06-15",
      occupant: "Alice",
      spotId: null,
      spotName: null,
    });
  });

  it("trims occupant whitespace", async () => {
    mockQuickReserve.mockResolvedValue(undefined);
    mockGetSpotsForDate.mockReturnValue([]);

    const event = makeEvent({ date: "2025-06-15", occupant: "  Bob  " });
    await onPost(event);

    expect(mockQuickReserve).toHaveBeenCalledWith("2025-06-15", "Bob");
  });

  it("returns 409 when occupant already has a reservation", async () => {
    mockQuickReserve.mockRejectedValue(
      new Error("You already have a reservation for this date"),
    );

    const event = makeEvent({ date: "2025-06-15", occupant: "Alice" });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(409, {
      error: "Conflict",
      message: "You already have a reservation for this date",
    });
  });

  it("returns 409 when no free spots", async () => {
    mockQuickReserve.mockRejectedValue(new Error("No free spots available"));

    const event = makeEvent({ date: "2025-06-15", occupant: "Alice" });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(409, {
      error: "Conflict",
      message: "No free spots available",
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockQuickReserve.mockRejectedValue(new Error("Network error"));

    const event = makeEvent({ date: "2025-06-15", occupant: "Alice" });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(500, {
      error: "Internal Server Error",
      message: "Network error",
    });
  });
});
