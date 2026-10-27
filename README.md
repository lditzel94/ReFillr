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
```

El service worker sólo se activa en el build de producción. Para probar la instalación como app,
serví `dist/refillr/browser` por HTTPS (o `localhost`).

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

1. Supabase: esquema `households` / `household_members` / `items` con RLS, auth real y realtime
   para que varias cuentas compartan el mismo hogar.
2. Hosting con HTTPS (GitHub Pages, Netlify, Vercel…) para instalarla en los teléfonos.
3. Modo "en el súper" para ir tachando la lista.
