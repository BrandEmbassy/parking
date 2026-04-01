import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/services/api-auth", () => ({
  validateApiKey: vi.fn(),
}));

import { onRequest } from "./layout";
import { validateApiKey } from "~/services/api-auth";

const mockValidateApiKey = vi.mocked(validateApiKey);

function makeRequestEvent(authHeader: string | null) {
  const headers = new Map<string, string | null>();
  if (authHeader !== null) {
    headers.set("authorization", authHeader);
  }

  const event: any = {
    request: {
      headers: {
        get: (name: string) =>
          name === "Authorization" ? (authHeader ?? null) : null,
      },
    },
    env: {
      get: (key: string) => (key === "API_KEYS" ? "sk-test-key" : undefined),
    },
    json: vi.fn(),
    next: vi.fn(),
  };
  return event;
}

describe("API v1 auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when validation fails", async () => {
    mockValidateApiKey.mockReturnValue({
      valid: false,
      error: "Missing Authorization header",
    });

    const event = makeRequestEvent(null);
    await onRequest(event);

    expect(event.json).toHaveBeenCalledWith(401, {
      error: "Unauthorized",
      message: "Missing Authorization header",
    });
    expect(event.next).not.toHaveBeenCalled();
  });

  it("calls next() when validation succeeds", async () => {
    mockValidateApiKey.mockReturnValue({ valid: true });

    const event = makeRequestEvent("Bearer sk-test-key");
    await onRequest(event);

    expect(event.json).not.toHaveBeenCalled();
    expect(event.next).toHaveBeenCalled();
  });

  it("passes env and auth header to validateApiKey", async () => {
    mockValidateApiKey.mockReturnValue({ valid: true });

    const event = makeRequestEvent("Bearer my-key");
    await onRequest(event);

    expect(mockValidateApiKey).toHaveBeenCalledWith(event.env, "Bearer my-key");
  });
});
