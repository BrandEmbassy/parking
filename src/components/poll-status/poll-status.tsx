import { component$, type Signal } from "@builder.io/qwik";

interface ConnectionStatusProps {
  connected: Signal<boolean>;
  error?: Signal<string | null>;
}

export const ConnectionStatus = component$<ConnectionStatusProps>((props) => {
  if (props.error?.value) {
    return (
      <div class="poll-status">
        <span class="status-dot status-dot-error" />
        <span class="last-updated" style="color: var(--color-danger)">
          Disconnected: {props.error.value}
        </span>
      </div>
    );
  }

  return (
    <div class="poll-status">
      <span
        class={`status-dot ${props.connected.value ? "status-dot-ok" : "status-dot-connecting"}`}
      />
      <span class="last-updated">
        {props.connected.value ? "Connected" : "Connecting\u2026"}
      </span>
    </div>
  );
});
