import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/services/spacetimedb", () => ({
  getConnection: vi.fn(),
  getReservationsForDate: vi.fn(),
  getSpots: vi.fn(),
  reserveSpot: vi.fn(),
  cancelReservation: vi.fn(),
}));

import { onGet, onPost, onDelete } from "./index";
import {
  getConnection,
  getReservationsForDate,
  getSpots,
  reserveSpot,
  cancelReservation,
} from "~/services/spacetimedb";

const mockGetConnection = vi.mocked(getConnection);
const mockGetReservationsForDate = vi.mocked(getReservationsForDate);
const mockGetSpots = vi.mocked(getSpots);
const mockReserveSpot = vi.mocked(reserveSpot);
const mockCancelReservation = vi.mocked(cancelReservation);

function makeGetEvent(queryParams: Record<string, string> = {}) {
  return {
    query: { get: (key: string) => queryParams[key] ?? null },
    json: vi.fn(),
  } as any;
}

function makeBodyEvent(body: any, parseError = false) {
  return {
    request: {
      json: parseError
        ? vi.fn().mockRejectedValue(new SyntaxError("bad json"))
        : vi.fn().mockResolvedValue(body),
    },
    json: vi.fn(),
  } as any;
}

describe("GET /api/v1/reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue({} as any);
  });

  it("returns 400 when date is missing", async () => {
    const event = makeGetEvent();
    await onGet(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns 400 for invalid date format", async () => {
    const event = makeGetEvent({ date: "not-a-date" });
    await onGet(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns reservations for a valid date", async () => {
    mockGetReservationsForDate.mockReturnValue([
      { spotId: 1, date: "2025-06-15", occupant: "Alice" } as any,
      { spotId: 3, date: "2025-06-15", occupant: "Bob" } as any,
    ]);
    mockGetSpots.mockReturnValue([
      { id: 1, name: "A1", sortOrder: 1 } as any,
      { id: 2, name: "A2", sortOrder: 2 } as any,
      { id: 3, name: "B1", sortOrder: 3 } as any,
    ]);

    const event = makeGetEvent({ date: "2025-06-15" });
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(200, {
      date: "2025-06-15",
      reservations: [
        { spotId: 1, spotName: "A1", occupant: "Alice" },
        { spotId: 3, spotName: "B1", occupant: "Bob" },
      ],
      count: 2,
    });
  });

  it("returns null spotName for unknown spotId", async () => {
    mockGetReservationsForDate.mockReturnValue([
      { spotId: 999, date: "2025-06-15", occupant: "Ghost" } as any,
    ]);
    mockGetSpots.mockReturnValue([]);

    const event = makeGetEvent({ date: "2025-06-15" });
    await onGet(event);

    expect(event.json).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        reservations: [{ spotId: 999, spotName: null, occupant: "Ghost" }],
      }),
    );
  });
});

describe("POST /api/v1/reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue({} as any);
  });

  it("returns 400 for invalid JSON body", async () => {
    const event = makeBodyEvent(null, true);
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(400, {
      error: "Bad Request",
      message: "Invalid JSON body",
    });
  });

  it("returns 400 when spotId is missing", async () => {
    const event = makeBodyEvent({ date: "2025-06-15", occupant: "Alice" });
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns 400 when occupant is empty", async () => {
    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "  ",
    });
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns 400 when date format is invalid", async () => {
    const event = makeBodyEvent({
      spotId: 1,
      date: "15-06-2025",
      occupant: "Alice",
    });
    await onPost(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        message: "'date' must be in YYYY-MM-DD format",
      }),
    );
  });

  it("creates reservation successfully", async () => {
    mockReserveSpot.mockResolvedValue(undefined);
    mockGetSpots.mockReturnValue([{ id: 1, name: "A1", sortOrder: 1 } as any]);

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onPost(event);

    expect(mockReserveSpot).toHaveBeenCalledWith(1, "2025-06-15", "Alice");
    expect(event.json).toHaveBeenCalledWith(201, {
      success: true,
      spotId: 1,
      spotName: "A1",
      date: "2025-06-15",
      occupant: "Alice",
    });
  });

  it("trims occupant whitespace", async () => {
    mockReserveSpot.mockResolvedValue(undefined);
    mockGetSpots.mockReturnValue([]);

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "  Alice  ",
    });
    await onPost(event);

    expect(mockReserveSpot).toHaveBeenCalledWith(1, "2025-06-15", "Alice");
  });

  it("returns 409 when spot is already reserved", async () => {
    mockReserveSpot.mockRejectedValue(new Error("Spot is already reserved"));

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(409, {
      error: "Conflict",
      message: "Spot is already reserved",
    });
  });

  it("returns 409 when spot does not exist", async () => {
    mockReserveSpot.mockRejectedValue(new Error("Spot does not exist"));

    const event = makeBodyEvent({
      spotId: 999,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(409, {
      error: "Conflict",
      message: "Spot does not exist",
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockReserveSpot.mockRejectedValue(new Error("DB down"));

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onPost(event);

    expect(event.json).toHaveBeenCalledWith(500, {
      error: "Internal Server Error",
      message: "DB down",
    });
  });
});

describe("DELETE /api/v1/reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue({} as any);
  });

  it("returns 400 for invalid JSON body", async () => {
    const event = makeBodyEvent(null, true);
    await onDelete(event);
    expect(event.json).toHaveBeenCalledWith(400, {
      error: "Bad Request",
      message: "Invalid JSON body",
    });
  });

  it("returns 400 when required fields are missing", async () => {
    const event = makeBodyEvent({ spotId: 1 });
    await onDelete(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        error: "Bad Request",
      }),
    );
  });

  it("returns 400 for invalid date format", async () => {
    const event = makeBodyEvent({
      spotId: 1,
      date: "bad-date",
      occupant: "Alice",
    });
    await onDelete(event);
    expect(event.json).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        message: "'date' must be in YYYY-MM-DD format",
      }),
    );
  });

  it("cancels reservation successfully", async () => {
    mockCancelReservation.mockResolvedValue(undefined);

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onDelete(event);

    expect(mockCancelReservation).toHaveBeenCalledWith(
      1,
      "2025-06-15",
      "Alice",
    );
    expect(event.json).toHaveBeenCalledWith(200, {
      success: true,
      spotId: 1,
      date: "2025-06-15",
    });
  });

  it("returns 409 when no reservation found", async () => {
    mockCancelReservation.mockRejectedValue(
      new Error("No reservation found for this spot"),
    );

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onDelete(event);

    expect(event.json).toHaveBeenCalledWith(409, {
      error: "Conflict",
      message: "No reservation found for this spot",
    });
  });

  it("returns 409 when occupant does not match", async () => {
    mockCancelReservation.mockRejectedValue(
      new Error("Only Alice can cancel this reservation"),
    );

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Bob",
    });
    await onDelete(event);

    expect(event.json).toHaveBeenCalledWith(409, {
      error: "Conflict",
      message: "Only Alice can cancel this reservation",
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockCancelReservation.mockRejectedValue(new Error("Timeout"));

    const event = makeBodyEvent({
      spotId: 1,
      date: "2025-06-15",
      occupant: "Alice",
    });
    await onDelete(event);

    expect(event.json).toHaveBeenCalledWith(500, {
      error: "Internal Server Error",
      message: "Timeout",
    });
  });
});
