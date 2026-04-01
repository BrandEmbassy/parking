import { describe, it, expect } from "vitest";
import { validateApiKey } from "./api-auth";

function makeEnv(apiKeys?: string) {
  return {
    get: (key: string) => (key === "API_KEYS" ? apiKeys : undefined),
  };
}

describe("validateApiKey", () => {
  it("rejects missing Authorization header", () => {
    const result = validateApiKey(makeEnv("sk-test-key"), null);
    expect(result).toEqual({
      valid: false,
      error: "Missing Authorization header",
    });
  });

  it("rejects malformed Authorization header", () => {
    const result = validateApiKey(makeEnv("sk-test-key"), "Basic abc123");
    expect(result).toEqual({
      valid: false,
      error: "Invalid Authorization header format. Expected: Bearer <token>",
    });
  });

  it("rejects empty Bearer token", () => {
    const result = validateApiKey(makeEnv("sk-test-key"), "Bearer ");
    expect(result).toEqual({
      valid: false,
      error: "Invalid Authorization header format. Expected: Bearer <token>",
    });
  });

  it("rejects when API_KEYS env is not configured", () => {
    const result = validateApiKey(makeEnv(undefined), "Bearer sk-test-key");
    expect(result).toEqual({
      valid: false,
      error: "API keys not configured on server",
    });
  });

  it("rejects when API_KEYS env is empty string", () => {
    const result = validateApiKey(makeEnv(""), "Bearer sk-test-key");
    expect(result).toEqual({
      valid: false,
      error: "API keys not configured on server",
    });
  });

  it("rejects invalid API key", () => {
    const result = validateApiKey(makeEnv("sk-valid-key"), "Bearer sk-wrong");
    expect(result).toEqual({
      valid: false,
      error: "Invalid API key",
    });
  });

  it("accepts a valid API key", () => {
    const result = validateApiKey(makeEnv("sk-test-key"), "Bearer sk-test-key");
    expect(result).toEqual({ valid: true });
  });

  it("accepts any valid key from comma-separated list", () => {
    const env = makeEnv("sk-key-1, sk-key-2, sk-key-3");
    expect(validateApiKey(env, "Bearer sk-key-1")).toEqual({ valid: true });
    expect(validateApiKey(env, "Bearer sk-key-2")).toEqual({ valid: true });
    expect(validateApiKey(env, "Bearer sk-key-3")).toEqual({ valid: true });
    expect(validateApiKey(env, "Bearer sk-key-4")).toEqual({
      valid: false,
      error: "Invalid API key",
    });
  });

  it("handles whitespace in API_KEYS value", () => {
    const env = makeEnv("  sk-key-1 ,  sk-key-2  ");
    expect(validateApiKey(env, "Bearer sk-key-1")).toEqual({ valid: true });
    expect(validateApiKey(env, "Bearer sk-key-2")).toEqual({ valid: true });
  });

  it("rejects key that is a prefix of a valid key (timing-safe)", () => {
    const result = validateApiKey(makeEnv("sk-long-key"), "Bearer sk-long");
    expect(result).toEqual({ valid: false, error: "Invalid API key" });
  });

  it("rejects key that is a superstring of a valid key", () => {
    const result = validateApiKey(makeEnv("sk-short"), "Bearer sk-short-extra");
    expect(result).toEqual({ valid: false, error: "Invalid API key" });
  });
});
