import { describe, it, expect, vi, afterEach } from "vitest";
import { PROVIDERS, isProviderId, type Env } from "./auth";

function makeEnv(values: Record<string, string> = {}): Env {
  return {
    get: (key: string) => values[key],
  } as Env;
}

const githubEnv = makeEnv({
  GITHUB_CLIENT_ID: "gh-client",
  GITHUB_CLIENT_SECRET: "gh-secret",
  GITHUB_REDIRECT_URI: "https://parking.test/api/auth/callback",
  GITHUB_ORG: "BrandEmbassy",
});

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 404) {
  return { ok, status, json: async () => body } as Response;
}

/** Answers the membership call first, then the /user call. */
function mockGithubFetch(membership: Response, user?: Response) {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce(membership);
  if (user) {
    fetchMock.mockResolvedValueOnce(user);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isProviderId", () => {
  it("accepts known providers", () => {
    expect(isProviderId("google")).toBe(true);
    expect(isProviderId("github")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isProviderId("facebook")).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
    expect(isProviderId(null)).toBe(false);
  });
});

describe("google.getAuthUrl", () => {
  it("targets Google with the profile scope and the state", () => {
    const url = new URL(
      PROVIDERS.google.getAuthUrl(
        makeEnv({ GOOGLE_CLIENT_ID: "g-client" }),
        "nonce-1",
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("g-client");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/userinfo.profile",
    );
    expect(url.searchParams.get("state")).toBe("nonce-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/api/auth/callback",
    );
  });
});

describe("github.getAuthUrl", () => {
  it("targets GitHub with the read:user read:org scope and the state", () => {
    const url = new URL(PROVIDERS.github.getAuthUrl(githubEnv, "nonce-2"));

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("gh-client");
    expect(url.searchParams.get("scope")).toBe("read:user read:org");
    expect(url.searchParams.get("state")).toBe("nonce-2");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://parking.test/api/auth/callback",
    );
  });
});

describe("github.getTokensFromCode", () => {
  it("asks for a JSON response and returns the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: "gho_token" }));
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await PROVIDERS.github.getTokensFromCode(
      githubEnv,
      "code-1",
    );

    expect(tokens).toEqual({ access_token: "gho_token" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(init.headers.Accept).toBe("application/json");
    expect(String(init.body)).toContain("code=code-1");
  });

  it("returns no token when GitHub answers with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: "bad_verification_code" })),
    );

    const tokens = await PROVIDERS.github.getTokensFromCode(
      githubEnv,
      "code-1",
    );

    expect(tokens.access_token).toBeUndefined();
  });
});

describe("github.getUserInfo", () => {
  it("returns the profile name for an active org member", async () => {
    const fetchMock = mockGithubFetch(
      jsonResponse({ state: "active" }),
      jsonResponse({
        name: "Martin Kolaci",
        login: "kolaczek",
        avatar_url: "https://avatars.test/1",
      }),
    );

    const user = await PROVIDERS.github.getUserInfo(githubEnv, "gho_token");

    expect(user).toEqual({
      name: "Martin Kolaci",
      picture: "https://avatars.test/1",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.github.com/user/memberships/orgs/BrandEmbassy",
    );
    expect(fetchMock.mock.calls[0][1].headers["User-Agent"]).toBeTruthy();
  });

  it("falls back to the login when the profile name is not set", async () => {
    mockGithubFetch(
      jsonResponse({ state: "active" }),
      jsonResponse({ name: null, login: "kolaczek", avatar_url: null }),
    );

    const user = await PROVIDERS.github.getUserInfo(githubEnv, "gho_token");

    expect(user).toEqual({ name: "kolaczek", picture: "" });
  });

  it("rejects an account that is not a member of the org", async () => {
    mockGithubFetch(jsonResponse({ message: "Not Found" }, false, 404));

    expect(
      await PROVIDERS.github.getUserInfo(githubEnv, "gho_token"),
    ).toBeNull();
  });

  it("rejects a membership that is not active yet", async () => {
    mockGithubFetch(jsonResponse({ state: "pending" }));

    expect(
      await PROVIDERS.github.getUserInfo(githubEnv, "gho_token"),
    ).toBeNull();
  });

  it("rejects when the profile call fails", async () => {
    mockGithubFetch(
      jsonResponse({ state: "active" }),
      jsonResponse({ message: "Bad credentials" }, false, 401),
    );

    expect(
      await PROVIDERS.github.getUserInfo(githubEnv, "gho_token"),
    ).toBeNull();
  });

  it("defaults the org to BrandEmbassy", async () => {
    const fetchMock = mockGithubFetch(
      jsonResponse({ state: "active" }),
      jsonResponse({ name: "Someone", login: "someone" }),
    );

    await PROVIDERS.github.getUserInfo(
      makeEnv({ GITHUB_CLIENT_ID: "gh-client" }),
      "gho_token",
    );

    expect(fetchMock.mock.calls[0][0]).toContain("/orgs/BrandEmbassy");
  });
});
