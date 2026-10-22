# Gold’s Gym India · Club Console

A functional gym management showcase for a fictional Indiranagar club. Responsive React interface for phones, tablets and desktops, with a Node/Express API and persistent SQLite database. Seeded with 48 fictional members and illustrative INR pricing.

Screenshots: [Desktop dashboard](docs/desktop.png) · [Mobile dashboard](docs/mobile.png).

## Run

Requires **Node.js 24+** and npm. No API keys, external database or messaging account is required.

```sh
npm ci
npm run dev
```

Vite listens on port **5173**, proxying API requests to **3000**. For a production-style demo on a single port:

```sh
npm run build
npm start
```

The server listens on `0.0.0.0:3000`. `PORT` can override the production port. To test on a real phone, use a reachable deployment or the machine’s LAN address on the same network, with the firewall allowing that port. The mobile app is a responsive, installable **PWA**, rather than an Android/iOS store binary. Installation and service workers require HTTPS (or localhost on the same device). On iPhone, use Safari → Share → Add to Home Screen. On supported Android/desktop browsers, use the browser’s install app action. App data needs a connection to the server; the service worker only caches the interface shell.

## What works

- Dashboard with live member counts, expiry attention list, recorded demo revenue, six-month membership trend and activity.
- Search/filter members; add and edit a member; renew monthly, quarterly or annually. Renewing early preserves the remaining period; expired memberships restart today. Prices: ₹3,000 / ₹7,500 / ₹24,000.
- New enrolments can start today or earlier; future-dated enrolments are outside this prototype’s scope.
- Automatic expiry scans at startup and every 60 seconds while the server runs. Reminders are queued at 7 days, 3 days and on expiry; duplicate reminders for the same member/expiry/offset are prevented. Pause automation, select email/WhatsApp for future reminders, run checks and simulate dispatch.
- Basic FAQ assistant with supported membership, plan, timing, renewal and support answers. Unrecognised questions offer escalation.
- Raise an IT query, receive a reference, review the central IT queue and move tickets from Open to In progress to Resolved.
- Member, payment, reminder, ticket and setting changes survive page reloads and server restarts.

## Showcase flow (about three minutes)

1. Open Dashboard. Explain the total, active and expiring membership cards; active includes members expiring in the next seven days.
2. Open Members, search for **Priya Mehta** and review her expiry. Renew her membership to show the new date and the dashboard updating. A renewal records a **demo payment**, without charging a card.
3. Add a member with a fictional email/phone. Search the member and edit their details.
4. Open Renewals. Preview a reminder and select **Simulate dispatch**. The outbox is labelled simulated; no external messages are sent. Checks run on exact day offsets while the server is running, without retrospective catch-up after downtime.
5. Ask the assistant “What are the membership plans?” and then an unsupported question. Use Raise query, enter the issue and show its GGIT reference in the IT queue. Change the query to In progress, then Resolved.
6. Resize to a phone viewport or open a hosted copy on a phone to show the mobile navigation and forms.

This is a single-club, single-user **demo workspace with no authentication**. Do not expose it to the public internet with real member data. Names, contact details, transactions, prices and branch hours are fictional. Branding is illustrative and does not represent an approved Gold’s Gym deployment.

## Integration boundaries

The assistant is a deterministic FAQ bot, not a connected generative AI model. Renewal dispatch is simulated; it does not send WhatsApp, SMS or email. “Gold’s Gym IT” is a local support queue; no company IT mailbox or helpdesk has been contacted. Live delivery needs an approved provider, verified templates/opt-in, credentials, delivery webhooks and an agreed company IT destination. Payment collection is also simulated by recording the selected plan price.

Before production, a separate implementation should add authentication and staff roles, real membership/payment reconciliation, approved tax/pricing/policy rules, external messaging/helpdesk integrations, privacy controls, backups and deployment monitoring. The prototype intentionally does not invent company credentials or destinations.

## Data and verification

The database is created at `.data/gym.sqlite`, including SQLite WAL/SHM files while in use. Keep `.data` private and back it up with the app stopped. `GYM_DB_PATH` optionally selects another database path. Demo data is inserted only when the members table is empty; relative expiry dates are calculated at first seed using India’s date. Reusing a snapshot retains those dates, so counts change naturally over time.

```sh
npm test           # API workflows and database persistence, isolated from demo data
npm run build     # React production bundle
npm run test:e2e  # Desktop/mobile browser workflows, isolated temporary database
```

Browser checks use Playwright. Set `CHROMIUM_PATH` to a system Chromium binary (the cloud image uses `/usr/bin/chromium`), or run `npx playwright install chromium` to install Playwright’s browser. Tests use port 4173 by default and start their own app with an isolated temporary database; stop any process occupying that port first.

To create a fresh demo, stop the server and move `.data` to a private backup location, then restart. This removes demo edits from the new workspace; never do it with real data. Do not delete or overwrite an existing database just to refresh sample counts.

Validated in the cloud environment: production build, 8 API/persistence tests and 10 Chromium browser tests across desktop and mobile viewports. The dashboard and add-member form were also checked at 360px width. Physical Android/iPhone installation and live integrations have not been tested.

DM Sans and Manrope fonts are bundled locally, with their SIL Open Font License files in `src/fonts/`. Rendering does not depend on a Google Fonts request.
