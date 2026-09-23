import { component$ } from "@builder.io/qwik";
import {
  storeDesign,
  useDesignPreference,
  type DesignVariant,
} from "~/hooks/use-design-preference";

/**
 * Header switch between the classic spot grid (off, the default) and the new
 * garage scene (on). The choice is remembered per device.
 */
export const DesignToggle = component$(() => {
  const design = useDesignPreference();
  const isNew = design.value === "scene";

  return (
    <label
      class="design-toggle"
      title={
        isNew
          ? "New design on — switch back to the classic spot grid"
          : "New design off — switch to the garage view"
      }
    >
      <input
        type="checkbox"
        class="design-toggle__input"
        checked={isNew}
        aria-label="New design"
        onChange$={(_, el) => {
          const next: DesignVariant = el.checked ? "scene" : "grid";
          design.value = next;
          storeDesign(next);
        }}
      />
      <span class="design-toggle__track" aria-hidden="true">
        <span class="design-toggle__knob" />
      </span>
      <span class="design-toggle__label">New design</span>
    </label>
  );
});
