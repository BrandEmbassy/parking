import {
  $,
  component$,
  useComputed$,
  useOnDocument,
  useSignal,
} from "@builder.io/qwik";
import { CAR_COLOR_PRESETS } from "~/components/parking-scene/scene-data";
import { useCarColor } from "~/hooks/use-spacetimedb";
import { getCarColor, setCarColor } from "~/services/spacetimedb";

/** What the native picker opens on before a colour is picked: MINE_HUE's blue. */
const UNPICKED_COLOR = "#0080ff";

interface CarColorPickerProps {
  userName: string;
}

/**
 * Footer control for the colour your car is drawn in on the garage scene: a
 * row of preset swatches plus the browser's own colour picker for anything
 * else. The choice is stored against your name in SpacetimeDB, so everyone
 * sees your car in it; "Auto" goes back to the default colour.
 */
export const CarColorPicker = component$<CarColorPickerProps>((props) => {
  const name = useComputed$(() => props.userName);
  const color = useCarColor(name);
  const open = useSignal(false);
  const error = useSignal<string | null>(null);
  const root = useSignal<HTMLElement>();
  const trigger = useSignal<HTMLButtonElement>();

  const pick = $(async (next: string) => {
    color.value = next;
    error.value = null;
    open.value = false;
    try {
      await setCarColor(props.userName, next);
    } catch (err) {
      // Unless a later pick has replaced this one, fall back to what the server
      // has: an earlier value may itself have failed or been overwritten since
      if (color.value === next) {
        color.value = getCarColor(props.userName) ?? "";
      }
      error.value =
        err instanceof Error ? err.message : "Could not save the colour";
    }
  });

  useOnDocument(
    "keydown",
    $((event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open.value) return;
      open.value = false;
      trigger.value?.focus();
    }),
  );

  useOnDocument(
    "click",
    $((event: MouseEvent) => {
      if (!open.value) return;
      if (root.value?.contains(event.target as Node)) return;
      open.value = false;
    }),
  );

  const isPreset = CAR_COLOR_PRESETS.some((p) => p.color === color.value);

  return (
    <div class="car-color" ref={root}>
      <button
        ref={trigger}
        type="button"
        class="car-color__trigger"
        aria-expanded={open.value}
        // The panel is only in the DOM while open
        aria-controls={open.value ? "car-color-panel" : undefined}
        onClick$={() => {
          open.value = !open.value;
        }}
      >
        <span
          class={`car-color__dot ${color.value ? "" : "car-color__dot--auto"}`}
          style={color.value ? { background: color.value } : undefined}
          aria-hidden="true"
        />
        Car colour
      </button>

      {open.value && (
        <div
          id="car-color-panel"
          class="car-color__panel"
          role="group"
          aria-label="Car colour"
        >
          <div class="car-color__swatches">
            <button
              type="button"
              class="car-color__swatch car-color__swatch--auto"
              title="Auto — the default colour"
              aria-label="Auto"
              aria-pressed={!color.value}
              onClick$={() => pick("")}
            />
            {CAR_COLOR_PRESETS.map((p) => (
              <button
                key={p.color}
                type="button"
                class="car-color__swatch"
                style={{ background: p.color }}
                title={p.name}
                aria-label={p.name}
                aria-pressed={color.value === p.color}
                onClick$={() => pick(p.color)}
              />
            ))}
            <label
              class={`car-color__custom ${color.value && !isPreset ? "car-color__custom--active" : ""}`}
              title="Pick any colour"
            >
              <input
                type="color"
                class="car-color__input"
                aria-label="Custom colour"
                value={color.value || UNPICKED_COLOR}
                // change, not input: it fires once the picker closes, rather
                // than calling the reducer for every step of a drag
                onChange$={(_, el) => pick(el.value.toLowerCase())}
              />
            </label>
          </div>
          {error.value && <p class="car-color__error">{error.value}</p>}
        </div>
      )}
    </div>
  );
});
