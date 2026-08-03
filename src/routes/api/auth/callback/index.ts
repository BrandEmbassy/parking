import type { RequestHandler } from "@builder.io/qwik-city";
import { PROVIDERS } from "~/services/auth";
import { parseState, STATE_COOKIE_NAME } from "~/services/oauth-state";

export const onGet: RequestHandler = async ({
  query,
  cookie,
  redirect,
  env,
}) => {
  const stateCookie = cookie.get(STATE_COOKIE_NAME)?.value;
  cookie.delete(STATE_COOKIE_NAME, { path: "/" });

  const providerId = parseState(stateCookie, query.get("state"));
  if (!providerId) {
    throw redirect(302, "/?error=invalid_state");
  }

  const code = query.get("code");
  if (!code) {
    throw redirect(302, "/?error=auth_failed");
  }

  const provider = PROVIDERS[providerId];
  const tokens = await provider.getTokensFromCode(env, code);
  if (!tokens.access_token) {
    throw redirect(302, "/?error=auth_failed");
  }

  // Get user info and check the provider allows this account to use the app
  const user = await provider.getUserInfo(env, tokens.access_token);
  if (!user) {
    throw redirect(302, "/?error=not_authorized");
  }

  // Short-lived access token (used only to fetch user name at login)
  cookie.set("access_token", tokens.access_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 3600,
  });

  // Store name (long-lived, used to identify reservations)
  cookie.set("user_name", encodeURIComponent(user.name), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  throw redirect(302, "/");
};
