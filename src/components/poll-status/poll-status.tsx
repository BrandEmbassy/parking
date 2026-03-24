import { component$, type Signal } from "@builder.io/qwik";

interface ConnectionStatusProps {
  connected: Signal<boolean>;
  error?: Signal<string | null>;
}

export const ConnectionStatus = component$<ConnectionStatusProps>((props) => {
  if (props.error?.value) {
    return (
      <div class="poll-status">
        <span class="last-updated" style="color: var(--color-danger, #dc3545)">
          Disconnected: {props.error.value}
        </span>
      </div>
    );
  }

  return (
    <div class="poll-status">
      <span class="last-updated">
        {props.connected.value ? "Connected — real-time" : "Connecting…"}
      </span>
    </div>
  );
});
