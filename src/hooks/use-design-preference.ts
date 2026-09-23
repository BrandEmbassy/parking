/**
 * Per-device preference for which parking layout to render.
 *
 * The choice is kept in localStorage so it survives across visits on the same
 * device. localStorage is client-only, so the server always renders
 * DEFAULT_DESIGN and the remembered choice is applied as soon as the app
 * hydrates.
 */
import {
  createContextId,
  useContext,
  useContextProvider,
  useSignal,
  useVisibleTask$,
  type Signal,
} from "@builder.io/qwik";

/** "grid" = classic square spot cards, "scene" = garage illustration. */
export type DesignVariant = "grid" | "scene";

export const DESIGN_STORAGE_KEY = "parking:design";

/** Shipped default — the new scene is opt-in. */
export const DEFAULT_DESIGN: DesignVariant = "grid";

export const DesignPreferenceContext = createContextId<Signal<DesignVariant>>(
  "parking.design-preference",
);

export const readStoredDesign = (): DesignVariant =>
  safeStorage(
    () =>
      localStorage.getItem(DESIGN_STORAGE_KEY) === "scene"
        ? "scene"
        : DEFAULT_DESIGN,
    DEFAULT_DESIGN,
  );

export const storeDesign = (design: DesignVariant): void => {
  safeStorage(
    () => localStorage.setItem(DESIGN_STORAGE_KEY, design),
    undefined,
  );
};

/**
 * Storage can be unavailable or throw (private browsing, blocked cookies).
 * A missing preference is not worth breaking the page over.
 */
const safeStorage = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

/** Call once, in the root layout, to make the preference available app-wide. */
export const useDesignPreferenceProvider = (): Signal<DesignVariant> => {
  const design = useSignal<DesignVariant>(DEFAULT_DESIGN);

  // Eager on purpose: the sooner the stored choice is applied, the shorter the
  // flash of the default layout for someone who opted into the new design.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    design.value = readStoredDesign();
  });

  useContextProvider(DesignPreferenceContext, design);

  return design;
};

export const useDesignPreference = (): Signal<DesignVariant> =>
  useContext(DesignPreferenceContext);
