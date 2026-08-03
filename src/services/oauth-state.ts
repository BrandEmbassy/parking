/**
 * CSRF state for the OAuth authorization flow.
 *
 * The state parameter sent to the provider is a random nonce. The nonce plus the
 * provider id are stored in a short-lived httpOnly cookie, so the callback can
 * both verify the request originated here and tell which provider it belongs to.
 */

import { randomUUID, timingSafeEqual } from "crypto";
import { isProviderId, type ProviderId } from "./auth";

export const STATE_COOKIE_NAME = "oauth_state";
export const STATE_COOKIE_MAX_AGE = 600;

export function createState(provider: ProviderId): {
  state: string;
  cookieValue: string;
} {
  const state = randomUUID();
  return { state, cookieValue: `${state}.${provider}` };
}

export function parseState(
  cookieValue: string | undefined,
  state: string | null,
): ProviderId | null {
  if (!cookieValue || !state) {
    return null;
  }

  const separator = cookieValue.lastIndexOf(".");
  if (separator === -1) {
    return null;
  }

  const nonce = cookieValue.slice(0, separator);
  const provider = cookieValue.slice(separator + 1);

  const nonceBuf = Buffer.from(nonce);
  const stateBuf = Buffer.from(state);
  if (
    nonceBuf.length !== stateBuf.length ||
    !timingSafeEqual(nonceBuf, stateBuf)
  ) {
    return null;
  }

  return isProviderId(provider) ? provider : null;
}
