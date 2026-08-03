import type { RequestHandler } from "@builder.io/qwik-city";
import { isProviderId, PROVIDERS } from "~/services/auth";
import {
  createState,
  STATE_COOKIE_MAX_AGE,
  STATE_COOKIE_NAME,
} from "~/services/oauth-state";

export const onGet: RequestHandler = async ({
  query,
  cookie,
  redirect,
  env,
}) => {
  const requested = query.get("provider");
  const providerId = isProviderId(requested) ? requested : "google";

  const { state, cookieValue } = createState(providerId);
  cookie.set(STATE_COOKIE_NAME, cookieValue, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE,
  });

  throw redirect(302, PROVIDERS[providerId].getAuthUrl(env, state));
};
