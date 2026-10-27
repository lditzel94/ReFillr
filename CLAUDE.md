# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What the app does

Household stock tracker. Each item records how much is used per month and how much is on hand; the
app computes what to buy to get back to the monthly level:
`needToBuy = max(0, monthlyUsage - currentQty)` (see `src/app/core/stock.ts`).

The UI is in Spanish (rioplatense voseo: "Agregá", "Vos"). The user writes in Spanish.

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
```

## Layout

| Path | Role |
|---|---|
| `src/app/core/` | Models, pure stock rules, signal-based services (auth, household, inventory, toast, clock, connectivity), route guards |
| `src/app/auth/` | Sign in, sign up, household setup (join by invite code or create) |
| `src/app/stock/` | Main screen: to-buy cards, per-category rows with steppers, add/edit and household bottom sheets |
| `src/app/shared/` | Bottom sheet, toast host, logo, field error |
| `src/styles.css` | Design tokens and shared classes (`.btn`, `.input`, `.tag`, `.card`, `.rule`) |
| `ngsw-config.json`, `public/manifest.webmanifest` | PWA |

## Design source

Screens follow the Claude Design prototype at https://claude.ai/artifact/Qd7aRsKUUM5CUeu2rDqRoW
("Nocturne" dark theme, Inter, accent `#9184d9`). Keep new UI consistent with its tokens in
`src/styles.css`. Layout is a phone-width column (max 480px); there is no desktop design.

## Data and backend

Today everything persists to `localStorage` through `core/local-store.ts`, and passwords are not
checked. This is a placeholder: the planned backend is **Supabase** (auth, Postgres with Row Level
Security, realtime sync between household members). Keep persistence behind `core/` services so the
swap does not touch components.

Planned schema (items belong to a household, never to a user):

```sql
households (id, name, invite_code, cycle_start)
household_members (household_id, user_id)
items (id, household_id, name, category, unit, monthly_usage, current_qty, updated_by, updated_at)
```

## Leave room for: biometric unlock

A future Face ID / fingerprint gate in front of an existing session (likely WebAuthn in the PWA).
Keep "who is signed in" (`AuthService`) separate from "is the app unlocked".
