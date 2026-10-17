# Aarunya Admin

Admin panel for **Aarunya Jewels by Veena**, an anti-tarnish jewellery brand from Kerala
selling pan-India. Built from the prototype in `design_handoff_aarunya_admin/`, which stays in
the repo as the design and behaviour reference: its inline styles are the source of truth for
every colour, size and spacing, and the `Component` class at the bottom of
`Aarunya Admin.dc.html` is the source of truth for the business rules.

Companion repos: `aarunya-web` (storefront) and `aarunya-backend` (the Node.js/Express + PostgreSQL
API this app runs against).

## Running it

Start the API first — see `../aarunya-backend/README.md`; it needs Docker for PostgreSQL:

```bash
cd ../aarunya-backend && docker compose up -d && npm install && npm run db:reset && npm run dev
```

Then, in this repo:

```bash
npm install
npm run dev          # http://localhost:5174
npm run build        # typecheck + production bundle into dist/
npm run preview      # serve the built bundle
npm run typecheck
```

Sign in with the seeded account: **veena@aarunyajewels.in** / **aarunya123**.

The store starts empty — no products, categories or colours. Add them here, in this order:
**Settings → colours**, then **Categories**, then **Products**. A product needs a category
and at least one colour to exist first. Photos upload to the API and are stored as files;
only the URL is kept in the database.

`npm run dev` proxies `/api` to `http://localhost:4000`, so the admin and the API share an
origin in development and the session cookie is first-party. Set `VITE_API_PROXY` to point the
proxy somewhere else, or `VITE_API_BASE` to call an absolute URL instead.

### Environment

| Variable | Default | Used for |
|---|---|---|
| `VITE_API_BASE` | `/api` | API base path; absolute URL to skip the dev proxy |
| `VITE_API_PROXY` | `http://localhost:4000` | Where `npm run dev` proxies `/api` and `/uploads` |
| `VITE_STORE_URL` | `http://localhost:5173` | "View store" links and product previews |

## Stack

- **Vite + React 18 + TypeScript**
- **React Router** — real paths, the same structure as the prototype's hash routes
- **TanStack Query** for server state, **Zustand** for filters and UI state only
- **CSS Modules + CSS custom properties** — tokens in `src/styles/tokens.css`

Same stack and the same conventions as `aarunya-web`, so both apps read alike. The prototype
expressed everything as inline styles, including hover states its runtime synthesised. Here,
anything with a `:hover`, `:focus-visible` or `prefers-reduced-motion` variant lives in a CSS
Module so it is real CSS; values that depend on viewport width or component state stay inline,
computed from `useViewport()`.

## Layout

```
src/
  api/          the only place the UI reads or writes data, one module per resource
    client.ts   fetch wrapper: session cookie, CSRF header, error mapping
  data/         entity types and the seed catalogue, orders, returns and stock ledger
  lib/          format, sku, csv, badges, image, invoice
  hooks/        useViewport
  store/        useAuth, useUi (toast + confirm dialog)
  components/
    layout/     Layout (icon rail, nav panel, mobile bar), PageHeader
    ui/         Card, Drawer, Modal, ConfirmDialog, Toast, controls, icons
  features/     auth, dashboard, orders, pos, returns, products, categories,
                inventory, storefront, customers, settings
```

## Screens

Login (with forgot password) · Dashboard · Orders + detail drawer · Offline sale (POS) ·
Returns & exchanges + detail drawer · Products · Product editor (with the AI photo studio) ·
Categories · Inventory (stock levels and stock history) · Banners & homepage · Customers ·
Settings.

## Data layer

`src/api/` is the only module the UI talks to, one file per resource, all of them going through
`src/api/client.ts`. That wrapper sends the session cookie, echoes the CSRF token back as a
header on every mutating request, and turns the API's `{ error, message, fields }` responses
into the error classes each screen already catches (`ValidationError`, `ConflictError`,
`RuleError`, `ReturnRuleError`, `SettingsValidationError`).

The browser-side mock this app was built against is gone — `src/api/mock/` was deleted when the
API landed, and no screen changed. Nothing is cached in `localStorage` any more; the session is
an HTTP-only cookie the browser manages.

**No store data is hard-coded here.** The demo catalogue that used to sit in `src/data/seed/`
now lives with the database in `aarunya-backend/seed-src/`, and the fixed vocabularies —
adjustment reasons, return reasons, refund methods, payment modes, the order and return flow
labels, offer link targets, default artwork, photo slots, return windows, dispatch cut-offs,
category tints and the SKU code maps — come from `GET /api/admin/meta/reference` through
`useReference()`, which caches them for the session. The backend defines them in one module
that its own rules read, so a dropdown and the rule behind it cannot drift apart.

What deliberately stays in the frontend is presentation, not data: the badge colours in
`lib/badges.ts`, and the filter/sort labels on each screen, which name query-string values the
API's own schemas already type-check.

The rules the prototype implemented client-side are now enforced by the API, which is the
authority on all of them:

| Rule | Where |
|---|---|
| Sequential order numbers, `AJ1001…` online and `OS…` offline | `aarunya-backend` `routes/orders.js` |
| No advance while payment is pending; no "shipped" without courier + AWB | `routes/orders.js` |
| Cancel restores stock and marks a paid order refunded | `routes/orders.js` |
| Offline sale re-checks live stock per line before writing | `routes/orders.js` |
| Stock never below 0, exactly one ledger row per movement | `lib/stock.js` → `applyStock()` |
| Adjustment modes (add / remove / set) and reason labels | `routes/inventory.js` |
| Return eligibility: window, category, unboxing video | `routes/returns.js` |
| Restock, replacement and refund stock and payment effects | `routes/returns.js` |
| Product validation, auto SKU, duplicate-as-draft | `routes/products.js`, `lib/format.js` |
| Category delete guard and pairing cleanup | `routes/categories.js` |
| Settings validation, colour-in-use guard | `routes/settings.js` |

`npm test` in `aarunya-backend` exercises all of the above against the real API and database.
It is the former `npm run check:rules`, moved where the rules now live.

## Still to wire up

- **The backend.** Each `src/api/*` module swaps to HTTP; `src/api/mock/` is then deleted.
  Auth becomes an HTTP-only session cookie, so `session` in the mock store goes too.
- **Image uploads** currently downscale in the browser and keep a data URL. With the API they
  become a signed upload, with the 1600px and 400px renditions made server-side
  (`api/media.ts`).
- **AI photo studio** composes the looks from your photo in the browser, as the prototype did,
  and marks the on-model look as pending. It becomes a server call to an image provider.
- **"Write with AI"** returns a plain fallback sentence rather than pretending a model wrote it;
  it becomes a server call to Claude with the prompt in `api/media.ts`.
- **Storefront content.** `api/storefront.ts` saves the banners, offers and announcements the
  store needs; `aarunya-web` still has that content hard-coded and should read it from
  `GET /api/storefront`.
