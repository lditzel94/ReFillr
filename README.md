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
```

El service worker sólo se activa en el build de producción. Para probar la instalación como app,
serví `dist/refillr/browser` por HTTPS (o `localhost`).

## Deploy (Cloudflare Pages)

El workflow `.github/workflows/ci.yml` corre los tests y el build en cada push y PR, y después
publica en Cloudflare Pages con `wrangler pages deploy`:

- push a `main` → producción (`https://<proyecto>.pages.dev`)
- PR → preview en una URL propia, que el workflow comenta en el PR

Configuración, una sola vez:

1. Creá una cuenta en Cloudflare (el plan Free alcanza).
2. Copiá tu **Account ID** (en el dashboard, *Workers & Pages* → panel derecho, o en la URL).
3. Creá un **API token** en *My Profile → API Tokens → Create Token → Custom token* con el permiso
   *Account → Cloudflare Pages → Edit*, limitado a tu cuenta.
4. En GitHub: *Settings → Secrets and variables → Actions* → agregá `CLOUDFLARE_API_TOKEN` y
   `CLOUDFLARE_ACCOUNT_ID`. Opcional: la variable `CLOUDFLARE_PAGES_PROJECT` si no querés que el
   proyecto se llame `refillr`.

El primer deploy crea el proyecto de Pages solo. Sin los secrets, el job de deploy se saltea.

## Estructura

```
src/app/
  core/      dominio y estado: modelos, reglas de stock, servicios con signals, guards
  auth/      ingresar, crear cuenta, crear/unirse a un hogar
  stock/     pantalla principal, tarjetas "para comprar", filas con stepper, hojas de edición
  shared/    piezas reutilizables (bottom sheet, toast, logo, errores de formulario)
```

## Estado actual

- Las pantallas siguen el prototipo de diseño (tema oscuro "Nocturne", mobile-first).
- **Los datos viven en `localStorage`**: cuentas, hogares e ítems quedan en el dispositivo y la
  contraseña todavía no se valida. Todo el acceso pasa por `core/` para poder cambiarlo por
  Supabase sin tocar los componentes.
- El indicador "Sincronizado / Sin conexión" refleja la conectividad real; los cambios hechos sin
  conexión quedan marcados como *pendiente* hasta volver a estar online.

## Próximos pasos

1. Supabase (decisión tomada): esquema `households` / `household_members` / `items` con RLS, auth real y realtime
   para que varias cuentas compartan el mismo hogar.
2. Modo "en el súper" para ir tachando la lista.
