import { describe, it, expect } from "vitest";
import { createState, parseState } from "./oauth-state";

describe("createState", () => {
  it("puts the provider in the cookie value and only the nonce in the state", () => {
    const { state, cookieValue } = createState("github");

    expect(cookieValue).toBe(`${state}.github`);
    expect(state).not.toContain("github");
  });

  it("generates a different nonce every call", () => {
    expect(createState("google").state).not.toBe(createState("google").state);
  });
});

describe("parseState", () => {
  it("returns the provider for a matching nonce", () => {
    const { state, cookieValue } = createState("github");

    expect(parseState(cookieValue, state)).toBe("github");
  });

  it("rejects a mismatched nonce", () => {
    const { cookieValue } = createState("github");

    expect(parseState(cookieValue, "not-the-nonce")).toBeNull();
  });

  it("rejects a missing cookie or missing state", () => {
    const { state, cookieValue } = createState("google");

    expect(parseState(undefined, state)).toBeNull();
    expect(parseState(cookieValue, null)).toBeNull();
  });

  it("rejects a cookie without a provider suffix", () => {
    const { state } = createState("google");

    expect(parseState(state, state)).toBeNull();
  });

  it("rejects an unknown provider", () => {
    const { state } = createState("google");

    expect(parseState(`${state}.facebook`, state)).toBeNull();
  });
});
