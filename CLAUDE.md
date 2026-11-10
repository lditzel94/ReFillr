# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What the app does

Household stock tracker. Each item records how much is used per month and how much is on hand; the
app computes what to buy to get back to the monthly level:
`needToBuy = max(0, monthlyUsage - currentQty)` (see `src/app/core/stock.ts`).

The UI is in Spanish (rioplatense voseo: "Agregá", "Vos"). The user writes in Spanish. Code, file
names, script names and URL routes are in English; only what the person sees (UI text, emails) is
Spanish. Domain names in code follow `GLOSSARY.md`.

## Project intent

A **mobile-only PWA** in the latest Angular, partly as a way to learn the modern Angular feature set.
Prefer the current idioms and explain them when they are the point of a change:

- Zoneless change detection (no zone.js) and OnPush by default (Angular 22).
- Signals for all state: `signal`, `computed`, `linkedSignal`, `effect`; services expose signals,
  not observables.
- Signal Forms (`@angular/forms/signals`: `form`, `[formField]`, `[formRoot]`, schema validators).
  Do not add Reactive Forms or `ngModel`.
- Built-in control flow (`@if`, `@for`, `@switch`, `@let`), `input()` / `output()`, `inject()`.
- Standalone components only; lazy routes via `loadComponent`.

History: the repo started as a Kotlin Multiplatform app. It was dropped (too heavy for the need, and
iOS distribution has a cost a PWA avoids). Nothing from the KMP tree remains.

## Commands

Node 22.22.3+ or 24.15+ (the Angular 22 CLI refuses older versions).

```bash
npm start                    # dev server, http://localhost:4200
npx ng test --watch=false    # Vitest unit tests
npx ng build                 # production build -> dist/refillr/browser (service worker included)
npm run preview              # production build served by wrangler, like Cloudflare Pages does
npm run db:start             # local Supabase (Docker) with the migrations applied
npm run db:test              # pgTAP access tests in supabase/tests against it
```

## Deploy

Hosted on **Cloudflare Pages** (Direct Upload, not Pages' Git integration). `.github/workflows/ci.yml`
tests and builds every push and PR and runs the database tests on a throwaway Supabase in Docker. On
`main` it then applies new migrations (`supabase db push --remote`) and runs `wrangler pages deploy`
to production. PRs are not deployed (docs/adr/0002). Secrets `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` live in the GitHub
environment `production` (main only). Without them the migrate and deploy jobs are skipped, not
failed.

Infrastructure is code: `infra/` is a **Pulumi program in TypeScript** (Luciano tried Go and chose
TypeScript, since the language changes nothing in the result) that owns the Pages project `refillr`,
the Supabase project and its auth settings. State is in Pulumi Cloud (project `refillr-infra`, stack
`prod`); the same Pulumi account also holds another product of Luciano's, so never run Pulumi
commands against it from a session, and keep provider tokens in the stack config rather than
environment variables. `pulumi up` is run by hand; CI only type-checks the program. The Supabase
provider is the Terraform one, bridged: `pulumi install` generates its SDK into `infra/sdks/`
(git-ignored) and links it as `@pulumi/supabase`. Database schema and RLS go in Supabase migrations,
not Pulumi.

- SPA routing relies on Pages' default: with no top-level `404.html`, unknown paths serve
  `index.html`. Do not add a `404.html` or a `/* /index.html 200` redirect.
- `public/_headers` keeps the service worker files revalidated and caches hashed bundles forever.
- `core/app-update.ts` + `shared/update-banner.ts` offer the new version when a deploy lands.

## Layout

| Path | Role |
|---|---|
| `src/app/core/` | Models, pure stock rules, signal-based services (auth, household, inventory, toast, clock, connectivity), route guards |
| `src/app/auth/` | Sign in, sign up, household setup (join by invite code or create) |
| `src/app/stock/` | Main screen: to-buy cards, per-category rows with steppers, add/edit and household bottom sheets |
| `src/app/shared/` | Bottom sheet, toast host, logo, field error |
| `src/styles.css` | Design tokens and shared classes (`.btn`, `.input`, `.tag`, `.card`, `.rule`) |
| `ngsw-config.json`, `public/manifest.webmanifest` | PWA |
| `public/_headers`, `.github/workflows/ci.yml` | Cloudflare Pages caching rules, CI and deploy |
| `infra/` | Pulumi (TypeScript): Pages project, Supabase project and auth settings |
| `supabase/` | Migrations (schema, RLS, RPC), pgTAP tests, admin SQL scripts, auth email templates |
| `GLOSSARY.md`, `docs/adr/` | Domain vocabulary and decision records |

## Design source

Screens follow the Claude Design prototype at https://claude.ai/artifact/Qd7aRsKUUM5CUeu2rDqRoW
("Nocturne" dark theme, Inter, accent `#9184d9`). Keep new UI consistent with its tokens in
`src/styles.css`. Layout is a phone-width column (max 480px); there is no desktop design.

## Locked technical decisions

Settled; do not re-open or propose alternatives. They carry over from the KMP era, only the client
stack changed.

- **Client**: Angular PWA, mobile only. Installable on Android and iOS from the browser, so family
  and friends can use it without app stores or iOS distribution costs.
- **Backend/data**: Supabase via `@supabase/supabase-js`. Not a custom server, not local-only
  storage. Chosen for minimal server maintenance, real Postgres, built-in auth and Row Level Security.
- **Sync**: cross-device real-time (or near-real-time) sync is a requirement. This is a shared
  household app: two accounts in the same household must both see and edit the same data.
- **Development happens on Windows.** Never propose a workflow that needs a Mac or Xcode.

## Data model and access control

Multi-user household model: each person has their own Supabase Auth account, and a household groups
them.

The schema is in `supabase/migrations/`: `households`, `household_members` (one household per
person), `profiles`, `app_admins`, `categories` (three base ones per household plus its own) and
`items`. Items belong to a **household**, never to an individual user. Row Level Security is the
access-control mechanism: a person reads and writes only rows of the household they are a member
of. Quantity changes (`adjust_qty`, `restock`) and membership changes (`remove_member`,
`leave_household`) are RPCs; the quantity ones are idempotent through a client `change_id`.

Nobody signs up alone (signup is disabled): the admin invites accounts from the Supabase dashboard
and manages households with `supabase/scripts/*.sql` (docs/adr/0001). Every schema or RLS change
needs a pgTAP test in `supabase/tests/`.

## Current state: placeholder persistence

Today everything persists to `localStorage` through `core/local-store.ts`, passwords are not checked,
and joining by invite code only finds households created on the same device. Keep persistence
behind the `core/` services (`AuthService`, `HouseholdService`, `InventoryStore`) so the Supabase
swap does not touch components.

## Roadmap

1. ~~Scaffold the PWA and build the screens from the design~~ (done).
2. Create the Supabase schema with RLS, replace the local auth/household/item persistence, and add
   realtime subscriptions so household members see each other's changes.
3. ~~Host it over HTTPS~~ (Cloudflare Pages, deployed from GitHub Actions).
4. "Shopping mode" list to tick off in-store, and category-level totals (from the design notes).

## Leave room for: biometric unlock

A future Face ID / fingerprint gate in front of an existing session (likely WebAuthn in the PWA).
Keep "who is signed in" (`AuthService`) separate from "is the app unlocked".
