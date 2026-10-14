# Aarunya Admin

Admin panel for **Aarunya Jewels by Veena**, an anti-tarnish jewellery brand from Kerala
selling pan-India. Built from the prototype in `design_handoff_aarunya_admin/`, which stays in
the repo as the design and behaviour reference: its inline styles are the source of truth for
every colour, size and spacing, and the `Component` class at the bottom of
`Aarunya Admin.dc.html` is the source of truth for the business rules.

Companion repos: `aarunya-web` (storefront) and `aarunya-api` (Spring Boot backend, to come).

## Running it

```bash
npm install
npm run dev          # http://localhost:5174
npm run build        # typecheck + production bundle into dist/
npm run preview      # serve the built bundle
npm run typecheck
npm run check:rules  # business-rule checks against the data layer
```

Sign in with the seeded account: **veena@aarunyajewels.in** / **aarunya123**.

### Environment

| Variable | Default | Used for |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8080/api` | Backend, once `src/api/*` talks HTTP |
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
    mock/       DEV-ONLY browser-side store that stands in for the backend
  data/         entity types and the seed catalogue, orders, returns and stock ledger
  lib/          format, sku, csv, badges, image, invoice
  hooks/        useViewport
  store/        useAuth, useUi (toast + confirm dialog)
  components/
    layout/     Layout (icon rail, nav panel, mobile bar), PageHeader
    ui/         Card, Drawer, Modal, ConfirmDialog, Toast, controls, icons
  features/     auth, dashboard, orders, pos, returns, products, categories,
                inventory, storefront, customers, settings
scripts/        check-rules.mjs — runs the business-rule checks in Node
```

## Screens

Login (with forgot password) · Dashboard · Orders + detail drawer · Offline sale (POS) ·
Returns & exchanges + detail drawer · Products · Product editor (with the AI photo studio) ·
Categories · Inventory (stock levels and stock history) · Banners & homepage · Customers ·
Settings.

## Data layer

`src/api/` is the only module the UI talks to. It currently runs against
`src/api/mock/store.ts`, a browser-side dataset seeded from the prototype's demo data and
persisted to `localStorage` under `aj_admin_mock_db` — clearly marked dev-only. Every screen is
written against the shapes the backend will serve, so connecting the API means swapping each
module's body for a `fetch` call and deleting `src/api/mock/`. No screen changes.

The rules that belong on the server are implemented in one place each, so they are easy to port:

| Rule | Where |
|---|---|
| Sequential order numbers, `AJ1001…` online and `OS…` offline | `api/orders.ts` |
| No advance while payment is pending; no "shipped" without courier + AWB | `api/orders.ts` |
| Cancel restores stock and marks a paid order refunded | `api/orders.ts` |
| Offline sale re-checks live stock per line before writing | `api/orders.ts` |
| Stock never below 0, exactly one ledger row per movement | `api/mock/store.ts` → `moveStock()` |
| Adjustment modes (add / remove / set) and reason labels | `api/inventory.ts` |
| Return eligibility: window, category, unboxing video | `api/returns.ts` |
| Restock, replacement and refund stock and payment effects | `api/returns.ts` |
| Product validation, auto SKU, duplicate-as-draft | `api/products.ts`, `lib/sku.ts` |
| Category delete guard and pairing cleanup | `api/categories.ts` |
| Settings validation, colour-in-use guard | `api/settings.ts` |

`npm run check:rules` exercises all of the above headlessly. Those checks move to the backend's
test suite once it exists.

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
