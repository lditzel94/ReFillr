# ReFillr

El stock de tu casa, siempre al día. Cada ítem guarda cuánto se usa por mes y cuánto hay en casa;
la app calcula cuánto comprar para volver al nivel mensual:

```
comprar = max(0, uso por mes − en casa)      // 12 cartones/mes, 2 en casa → comprar 10
```

Ir al súper se reduce a abrir la lista "Para comprar", tomar esas unidades y marcar cada ítem
como comprado.

Es una **PWA mobile** hecha con **Angular 22** (zoneless, signals, Signal Forms y el control flow
nuevo de templates). Se instala desde el navegador, incluido iPhone ("Compartir → Agregar a
inicio"), sin tiendas ni costos de distribución.

## Correr el proyecto

Requiere Node 22.22.3+ o 24.15+.

```bash
npm install
npm start                      # http://localhost:4200
npx ng test --watch=false      # tests unitarios (Vitest)
npx ng build                   # build de producción en dist/refillr/browser
npm run preview                # build de producción servido con wrangler, igual que en Cloudflare
npm run db:start               # Supabase local en Docker, con las migraciones aplicadas
npm run db:test                # tests de acceso (pgTAP) contra esa base
npm run start:local            # la app contra el Supabase local (npm start usa el de producción)
```

La base, las reglas de acceso y los scripts de administración están en
[`supabase/`](supabase/README.md).

El service worker sólo se activa en el build de producción. Para probar la instalación como app,
serví `dist/refillr/browser` por HTTPS (o `localhost`).

## Deploy (Cloudflare Pages)

El workflow `.github/workflows/ci.yml` corre los tests, el build y los tests de la base en cada push
y PR. En `main`, además, aplica las migraciones nuevas a Supabase (`supabase db push`) y después
publica en Cloudflare Pages con `wrangler pages deploy` (`https://refillr.pages.dev`). Los PRs no se
publican ([ADR 0002](docs/adr/0002-no-preview-deploys.md)).

El proyecto de Pages (y el de Supabase) los crea el programa de Pulumi en [`infra/`](infra/README.md),
escrito en TypeScript. El CI sólo publica builds en un proyecto que ya existe.

Configuración, una sola vez:

1. Seguí [`infra/README.md`](infra/README.md) hasta el `pulumi up`.
2. En GitHub: *Settings → Environments → production* (con *Deployment branches* limitado a `main`),
   agregá los secrets:
   - `CLOUDFLARE_API_TOKEN` (con *Account → Cloudflare Pages → Edit*) y `CLOUDFLARE_ACCOUNT_ID`.
   - `SUPABASE_ACCESS_TOKEN` (*Account preferences → Access Tokens* en Supabase) y
     `SUPABASE_DB_PASSWORD` (la misma que `pulumi config get dbPassword`).

Sin los secrets, los jobs de migraciones y de deploy se saltean.

## Estructura

```
src/app/
  core/      dominio y estado: modelos, reglas de stock, servicios con signals, guards
  auth/      ingresar, olvidé mi contraseña, elegir contraseña, sin hogar
  stock/     pantalla principal, tarjetas "para comprar", filas con stepper, hojas de edición
  shared/    piezas reutilizables (bottom sheet, toast, logo, errores de formulario)
```

## Estado actual

- Las pantallas siguen el prototipo de diseño (tema oscuro "Nocturne", mobile-first).
- Las cuentas y los hogares son reales (Supabase). Nadie se registra solo: el administrador invita
  desde el panel de Supabase y arma los hogares con los scripts de [`supabase/`](supabase/README.md).
- **Los ítems todavía viven en `localStorage`** de cada dispositivo; pasan a Supabase en el próximo
  paso. Todo el acceso pasa por `core/`, así los componentes no tocan Supabase.
- El indicador "Sincronizado / Sin conexión" refleja la conectividad real; los cambios hechos sin
  conexión quedan marcados como *pendiente* hasta volver a estar online.

## Próximos pasos

1. Supabase (decisión tomada): esquema `households` / `household_members` / `items` con RLS, auth real y realtime
   para que varias cuentas compartan el mismo hogar.
2. Modo "en el súper" para ir tachando la lista.
