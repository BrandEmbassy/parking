import type { RequestEventBase } from "@builder.io/qwik-city";

export type Env = RequestEventBase["env"];

export type ProviderId = "google" | "github";

export interface OAuthUser {
  name: string;
  picture: string;
}

export interface OAuthProvider {
  id: ProviderId;
  label: string;
  getAuthUrl(env: Env, state: string): string;
  getTokensFromCode(env: Env, code: string): Promise<{ access_token?: string }>;
  /** Resolves to null when the account exists but is not allowed to use the app. */
  getUserInfo(env: Env, accessToken: string): Promise<OAuthUser | null>;
}

const DEFAULT_REDIRECT_URI = "http://localhost:5173/api/auth/callback";

/** GitHub rejects API requests without a User-Agent. */
const GITHUB_USER_AGENT = "nice-prague-parking";

const google: OAuthProvider = {
  id: "google",
  label: "Google",

  getAuthUrl(env, state) {
    const params = new URLSearchParams({
      client_id: env.get("GOOGLE_CLIENT_ID")!,
      redirect_uri: env.get("GOOGLE_REDIRECT_URI") || DEFAULT_REDIRECT_URI,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/userinfo.profile",
      access_type: "online",
      prompt: "consent",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async getTokensFromCode(env, code) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.get("GOOGLE_CLIENT_ID")!,
        client_secret: env.get("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: env.get("GOOGLE_REDIRECT_URI") || DEFAULT_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();
    return { access_token: data.access_token };
  },

  async getUserInfo(_env, accessToken) {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return {
      name: (data.name as string) || "Unknown",
      picture: (data.picture as string) || "",
    };
  },
};

const github: OAuthProvider = {
  id: "github",
  label: "GitHub",

  getAuthUrl(env, state) {
    const params = new URLSearchParams({
      client_id: env.get("GITHUB_CLIENT_ID")!,
      redirect_uri: env.get("GITHUB_REDIRECT_URI") || DEFAULT_REDIRECT_URI,
      scope: "read:user read:org",
      allow_signup: "false",
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  async getTokensFromCode(env, code) {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: env.get("GITHUB_CLIENT_ID")!,
        client_secret: env.get("GITHUB_CLIENT_SECRET")!,
        redirect_uri: env.get("GITHUB_REDIRECT_URI") || DEFAULT_REDIRECT_URI,
      }),
    });

    // GitHub answers with HTTP 200 and an `error` field when the code is bad.
    const data = await res.json();
    return { access_token: data.access_token };
  },

  async getUserInfo(env, accessToken) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": GITHUB_USER_AGENT,
    };

    const org = env.get("GITHUB_ORG") || "BrandEmbassy";
    const membershipRes = await fetch(
      `https://api.github.com/user/memberships/orgs/${org}`,
      { headers },
    );
    if (!membershipRes.ok) {
      return null;
    }
    const membership = await membershipRes.json();
    if (membership.state !== "active") {
      return null;
    }

    const res = await fetch("https://api.github.com/user", { headers });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();

    return {
      name: (data.name as string) || (data.login as string) || "Unknown",
      picture: (data.avatar_url as string) || "",
    };
  },
};

export const PROVIDERS: Record<ProviderId, OAuthProvider> = { google, github };

export function isProviderId(
  value: string | undefined | null,
): value is ProviderId {
  return value === "google" || value === "github";
}
