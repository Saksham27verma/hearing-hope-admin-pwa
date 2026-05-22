# Hope Admin PWA

Centralized control panel for the **Hearing Hope** ecosystem — a single, installable Progressive Web App that monitors and manages everything that happens across the main CRM and the staff PWAs in real time.

## What's inside

- **Global Dashboard** — system-wide activity at a glance (sales, calls, appointments, audit events)
- **Sales & Financials** — total sales, invoices, receipts, outstanding amounts
- **Call Management** — telecaller leaderboard, funnel, follow-up tracking
- **Appointments & Bookings** — daily tracker with status management (Completed / Cancelled / Rescheduled / No-show)
- **User Activity Tracking** — detailed audit logs with per-user grouping
- **CRM Reports** — Phase 1 ships Sales Report and Executive Analysis; remaining reports follow in Phase 2

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | MUI 7 + `@mui/x-data-grid` + `@mui/x-date-pickers` |
| Charts | Recharts |
| PWA | Serwist (`@serwist/next`) |
| Auth & Data | Firebase Web SDK 11 (same project as CRM) |
| Privileged ops | HTTPS to CRM's existing `/api/admin/*` routes with Firebase ID token |

## Architecture

The Admin PWA shares the existing Firebase project with the CRM and the two staff PWAs.

- **Direct Firestore reads** for most collections (`sales`, `enquiries`, `appointments`, `activityLogs`, …)
- **Privileged operations** (Activity Logs full trail, Profit summary) are proxied via the CRM's existing `/api/admin/*` and `/api/profit/summary` routes, called with the user's Firebase ID token in `Authorization: Bearer …`
- **Auth gate**: only Firestore `users/{uid}` documents with `role === 'admin'` (or `isSuperAdmin === true`) can sign in

## Quick start

```bash
cp .env.sample .env.local
# fill in your Firebase project values + NEXT_PUBLIC_CRM_API_BASE_URL
npm install
npm run dev
```

Dev server runs on **http://localhost:3010** (the CRM uses 3000; staff PWAs use 5173/5174).

## Project layout

```
app/
  layout.tsx               # root layout, providers, SW registration
  manifest.ts              # PWA manifest (orange theme, 192/512 icons)
  sw.ts                    # Serwist service worker entry
  login/page.tsx           # sign-in (email + Google)
  offline/page.tsx         # fallback when offline
  (protected)/
    layout.tsx             # auth + role gate + AdminAppShell
    dashboard/page.tsx     # global overview
    sales/page.tsx         # sales & financials
    calls/page.tsx         # call management
    appointments/page.tsx  # today's bookings + status mgmt
    activity/page.tsx      # user audit log
    reports/page.tsx       # CRM reports (tabs)
src/
  firebase/config.ts       # Firebase client init
  theme/                   # MUI theme (orange #EE6417 primary)
  context/AuthContext.tsx  # admin-only role gate
  lib/
    api/adminApi.ts        # ID-token authenticated fetch to CRM admin APIs
    firestore/             # typed query helpers
    tenant/centerScope.ts  # multi-center filtering helpers
    hooks/                 # useAuth, useCenterScope, useCollection
    utils/dateRanges.ts    # date-range presets used by all reports
  components/
    shell/                 # AdminAppShell, SidebarNav, NotificationsBell, InstallPwaButton
    dashboard/             # KPI cards, charts, live activity feed
    sales/                 # SalesFinancialsView
    calls/                 # CallManagementView
    appointments/          # TodayAppointmentsView (status workflow)
    activity/              # ActivityLogsView
    reports/               # Reports tab shell + Phase 1 ports
public/
  icons/                   # PWA icons (orange tiles, maskable)
```

## Roles

| Role | Access |
|---|---|
| `admin` (any center) | All modules except super-admin tabs |
| `admin` + `isSuperAdmin: true` | Everything, including Profit and Operational Reset |
| Anything else | Rejected at the role gate; shown "Not authorized" |

## Roadmap (Phase 2+)

- Port remaining 5 reports (In-process & Follow-up, Booked, Assign-To, Telecallers Analysis, Profit Analysis)
- Push notifications via FCM (reuse staff-telecalling-pwa pattern)
- Offline write queue for appointment status updates
- Tighten Firestore rules to admin-only paths
