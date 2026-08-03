import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";

export interface UserSession {
  isLoggedIn: boolean;
  name: string;
}

const AUTH_ERRORS: Record<string, string> = {
  not_authorized:
    "That account is not an active member of the organization allowed to use this app.",
  provider_not_configured:
    "That sign-in method is not configured on this server.",
  invalid_state: "Sign-in failed, please try again.",
  auth_failed: "Sign-in failed, please try again.",
};

export const useSession = routeLoader$<UserSession>(async ({ cookie }) => {
  const rawName = cookie.get("user_name")?.value;

  return {
    isLoggedIn: !!rawName,
    name: rawName ? decodeURIComponent(rawName) : "",
  };
});

export default component$(() => {
  const session = useSession();
  const loc = useLocation();
  const authError = AUTH_ERRORS[loc.url.searchParams.get("error") || ""];

  return (
    <div class="app">
      <header class="app-header">
        <div class="header-content">
          <a href="/" class="logo" title="NiCE Prague Parking">
            <img
              src="/logo.svg"
              alt="NiCE Prague Parking"
              width="28"
              height="28"
            />
          </a>
          <nav class="nav">
            <a href="/" class="nav-link">
              Today
            </a>
            <a href="/future" class="nav-link">
              Upcoming
            </a>
          </nav>
          <div class="user-section">
            {session.value.isLoggedIn ? (
              <div class="user-info">
                <span class="user-name">{session.value.name}</span>
                <a href="/api/auth/logout" class="btn btn-small btn-outline">
                  Sign out
                </a>
              </div>
            ) : (
              <div class="sign-in-actions">
                <a
                  href="/api/auth?provider=google"
                  class="btn btn-small btn-primary"
                >
                  Sign in with Google
                </a>
                <a
                  href="/api/auth?provider=github"
                  class="btn btn-small btn-outline"
                >
                  Sign in with GitHub
                </a>
              </div>
            )}
          </div>
        </div>
      </header>
      <main class="main-content">
        {authError && (
          <div class="container">
            <div class="auth-error-banner">{authError}</div>
          </div>
        )}
        <Slot />
      </main>
      <footer class="app-footer">
        <a href="/privacy/">Privacy Policy</a>
        <a href="/terms/">Terms of Service</a>
      </footer>
    </div>
  );
});
