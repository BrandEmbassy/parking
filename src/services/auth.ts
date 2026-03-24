import type { RequestEventBase } from "@builder.io/qwik-city";

/**
 * Build the Google OAuth 2.0 authorization URL.
 * After migration, only the profile scope is required (no spreadsheets).
 */
export function getAuthUrl(env: RequestEventBase["env"]): string {
  const clientId = env.get("GOOGLE_CLIENT_ID");
  const redirectUri =
    env.get("GOOGLE_REDIRECT_URI") || "http://localhost:5173/api/auth/callback";

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/userinfo.profile",
    access_type: "online",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens using the Google OAuth2 token endpoint.
 * Uses fetch directly — no googleapis dependency needed.
 */
export async function getTokensFromCode(
  env: RequestEventBase["env"],
  code: string,
): Promise<{ access_token?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.get("GOOGLE_CLIENT_ID")!,
      client_secret: env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri:
        env.get("GOOGLE_REDIRECT_URI") ||
        "http://localhost:5173/api/auth/callback",
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();
  return { access_token: data.access_token };
}

/**
 * Fetch user profile info from Google.
 * Only name and picture are available with the profile-only scope.
 */
export async function getUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return {
    name: (data.name as string) || "Unknown",
    picture: (data.picture as string) || "",
  };
}
