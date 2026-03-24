import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

export interface UserSession {
  isLoggedIn: boolean;
  name: string;
}

export const useSession = routeLoader$<UserSession>(async ({ cookie }) => {
  const rawName = cookie.get("user_name")?.value;

  return {
    isLoggedIn: !!rawName,
    name: rawName ? decodeURIComponent(rawName) : "",
  };
});

export default component$(() => {
  const session = useSession();

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
              <a href="/api/auth" class="btn btn-small btn-primary">
                Sign in with Google
              </a>
            )}
          </div>
        </div>
      </header>
      <main class="main-content">
        <Slot />
      </main>
      <footer class="app-footer">
        <a href="/privacy/">Privacy Policy</a>
        <a href="/terms/">Terms of Service</a>
      </footer>
    </div>
  );
});
