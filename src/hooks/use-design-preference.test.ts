import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_DESIGN,
  DESIGN_STORAGE_KEY,
  readStoredDesign,
  storeDesign,
} from "./use-design-preference";

/** Minimal localStorage stand-in; `throws` simulates blocked storage. */
const installStorage = (
  initial: Record<string, string> = {},
  throws = false,
) => {
  const store = new Map(Object.entries(initial));

  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem(key: string) {
      if (throws) throw new Error("storage blocked");
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key: string, value: string) {
      if (throws) throw new Error("storage blocked");
      store.set(key, value);
    },
  };

  return store;
};

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("design preference", () => {
  it("defaults to the classic grid when nothing is stored", () => {
    installStorage();
    expect(readStoredDesign()).toBe("grid");
    expect(DEFAULT_DESIGN).toBe("grid");
  });

  it("reads back a stored opt-in to the scene", () => {
    installStorage({ [DESIGN_STORAGE_KEY]: "scene" });
    expect(readStoredDesign()).toBe("scene");
  });

  it("falls back to the default for an unrecognised stored value", () => {
    installStorage({ [DESIGN_STORAGE_KEY]: "something-else" });
    expect(readStoredDesign()).toBe("grid");
  });

  it("persists the choice so the next visit reuses it", () => {
    const store = installStorage();

    storeDesign("scene");
    expect(store.get(DESIGN_STORAGE_KEY)).toBe("scene");
    expect(readStoredDesign()).toBe("scene");

    storeDesign("grid");
    expect(readStoredDesign()).toBe("grid");
  });

  it("survives storage being unavailable", () => {
    installStorage({}, true);
    expect(readStoredDesign()).toBe("grid");
    expect(() => storeDesign("scene")).not.toThrow();
  });

  it("survives there being no storage at all (server render)", () => {
    expect(readStoredDesign()).toBe("grid");
    expect(() => storeDesign("scene")).not.toThrow();
  });
});
