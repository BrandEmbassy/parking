import type { RequestHandler } from "@builder.io/qwik-city";
import { STATE_COOKIE_NAME } from "~/services/oauth-state";

export const onGet: RequestHandler = async ({ cookie, redirect }) => {
  cookie.delete("access_token", { path: "/" });
  cookie.delete("refresh_token", { path: "/" });
  cookie.delete("user_name", { path: "/" });
  cookie.delete("user_email", { path: "/" });
  cookie.delete(STATE_COOKIE_NAME, { path: "/" });
  throw redirect(302, "/");
};
