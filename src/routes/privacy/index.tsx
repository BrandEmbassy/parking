import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <div class="container">
      <div class="legal-page">
        <h1>Privacy Policy</h1>
        <p class="legal-updated">Last updated: March 19, 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Nice Parking ("the Service", "we", "us", or "our") is an internal
            tool for managing parking spot reservations. The Service is operated
            at <a href="https://nice-parking.enzy.eu">nice-parking.enzy.eu</a>.
            We are committed to protecting your privacy and being transparent
            about how we handle your data. This privacy policy explains what
            data we access, how we use it, how we protect it, and your rights
            regarding your data.
          </p>
        </section>

        <section>
          <h2>Google User Data Accessed</h2>
          <p>
            When you sign in with Google, our application requests access to the
            following specific types of Google user data through OAuth 2.0:
          </p>
          <ul>
            <li>
              <strong>Profile information</strong> (via the{" "}
              <code>userinfo.profile</code> scope): Your display name and
              profile picture URL.
            </li>
            <li>
              <strong>Email address</strong> (via the{" "}
              <code>userinfo.email</code> scope): Your Google account email
              address.
            </li>
            <li>
              <strong>Google Sheets access</strong> (via the{" "}
              <code>spreadsheets</code> scope): Read and write access to Google
              Sheets, used exclusively to interact with a single shared parking
              reservation spreadsheet.
            </li>
          </ul>
          <p>
            We do not access any other Google user data beyond the scopes listed
            above.
          </p>
        </section>

        <section>
          <h2>How We Use Your Data</h2>
          <p>
            The Google user data we access is used strictly for the following
            purposes:
          </p>
          <ul>
            <li>
              <strong>Authentication and identification:</strong> Your name and
              email address are used to identify you within the application, so
              other users can see who has reserved a parking spot. Your name is
              displayed in the application header and used as the label when you
              reserve a parking spot.
            </li>
            <li>
              <strong>Parking spot management:</strong> Your Google OAuth access
              token is used server-side to read parking spot availability from
              and write reservation data to a shared Google Spreadsheet. When
              you reserve a spot, your display name is written into the
              corresponding cell in the spreadsheet. When you release a spot,
              your name is removed from the spreadsheet.
            </li>
          </ul>
          <p>
            We do not use your Google user data for advertising, marketing,
            profiling, analytics, or any purpose unrelated to the core
            functionality of managing parking spot reservations. Your data is
            not used for training machine learning or artificial intelligence
            models.
          </p>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>
            We do not sell, trade, rent, or transfer your Google user data to
            any third parties. Specifically:
          </p>
          <ul>
            <li>
              No personal data is shared with advertisers, data brokers, or
              marketing services.
            </li>
            <li>
              No analytics or tracking services (such as Google Analytics) are
              used.
            </li>
            <li>
              Your name, as written into the shared parking reservation
              spreadsheet, is visible to other authorized users of the Service
              who have access to the same spreadsheet. This is necessary for the
              core functionality of the Service -- allowing team members to see
              which parking spots are reserved and by whom.
            </li>
            <li>
              Your Google OAuth tokens (access token and refresh token) are
              never shared with any third party and are used solely to
              authenticate API requests to Google on your behalf.
            </li>
          </ul>
        </section>

        <section>
          <h2>Data Storage and Protection</h2>
          <p>
            We take the following measures to securely store and protect your
            data:
          </p>
          <ul>
            <li>
              <strong>No server-side database:</strong> The Service does not
              operate any database. We do not persistently store your personal
              information on our servers.
            </li>
            <li>
              <strong>Cookie-based session storage:</strong> Your authentication
              data is stored exclusively in browser cookies on your device:
              <ul>
                <li>
                  <strong>Access token:</strong> Stored as an HTTP-only, secure
                  cookie (not accessible to client-side JavaScript). Expires
                  after 1 hour.
                </li>
                <li>
                  <strong>Refresh token:</strong> Stored as an HTTP-only, secure
                  cookie (not accessible to client-side JavaScript). Expires
                  after 30 days.
                </li>
                <li>
                  <strong>Display name and email:</strong> Stored in browser
                  cookies for display purposes. Expire after 30 days.
                </li>
              </ul>
            </li>
            <li>
              <strong>HTTPS encryption:</strong> All data transmitted between
              your browser and the Service is encrypted using HTTPS/TLS.
            </li>
            <li>
              <strong>Server-side token handling:</strong> OAuth tokens are
              processed server-side only. Access tokens are used in memory to
              make authenticated requests to the Google Sheets API and are not
              written to disk or logs.
            </li>
            <li>
              <strong>Parking reservation data:</strong> Reservation data (your
              display name associated with a parking spot and date) is stored in
              the shared Google Spreadsheet and is subject to Google's own
              security and data protection practices.
            </li>
          </ul>
        </section>

        <section>
          <h2>Data Retention and Deletion</h2>
          <p>
            <strong>Session data:</strong> Authentication cookies are
            automatically deleted by your browser when they expire (access token
            after 1 hour, refresh token and user info after 30 days). You can
            delete all session data at any time by logging out of the Service,
            which immediately clears all authentication cookies.
          </p>
          <p>
            <strong>Reservation data:</strong> Your display name in the shared
            Google Spreadsheet is retained for as long as you have an active
            parking spot reservation. When you release a spot, your name is
            immediately removed from that reservation entry. Historical
            reservation data may remain in the spreadsheet for past dates.
          </p>
          <p>
            <strong>Requesting data deletion:</strong> You may request the
            deletion of your personal data at any time by contacting the
            application administrator. Upon receiving your request, we will:
          </p>
          <ul>
            <li>
              Revoke any stored refresh tokens associated with your account.
            </li>
            <li>
              Remove your name from any active or historical reservation entries
              in the shared spreadsheet.
            </li>
            <li>
              Confirm completion of the deletion within a reasonable timeframe.
            </li>
          </ul>
          <p>
            You can also revoke the application's access to your Google account
            at any time by visiting your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>{" "}
            page and removing Nice Parking from the list of authorized
            applications. This will immediately invalidate all OAuth tokens.
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            We use essential cookies only to maintain your authentication
            session. The specific cookies used are described in the "Data
            Storage and Protection" section above. No tracking, analytics,
            advertising, or non-essential cookies are used.
          </p>
        </section>

        <section>
          <h2>Google API Services User Data Policy Compliance</h2>
          <p>
            Our use and transfer of information received from Google APIs
            adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We only use Google user
            data for the purposes described in this privacy policy, which are
            limited to providing and improving the parking reservation
            functionality of the Service.
          </p>
        </section>

        <section>
          <h2>Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. Any changes
            will be reflected on this page with an updated "Last updated" date.
            Continued use of the Service after changes constitutes acceptance of
            the updated policy.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, wish to request
            data deletion, or have any privacy-related concerns, please contact
            the application administrator at the organization operating this
            Service.
          </p>
        </section>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Privacy Policy - Parking",
};
