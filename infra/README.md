# Infra de ReFillr (Pulumi, TypeScript)

Este programa declara lo que tiene que existir para que ReFillr funcione:

| Recurso | Qué es |
|---|---|
| `cloudflare.PagesProject` `refillr` | El proyecto de Pages (Direct Upload) donde el CI publica cada build |
| `supabase.Project` `refillr` | La base y la auth, en `sa-east-1` (San Pablo). Protegido: Pulumi no lo borra |
| `supabase.Settings` `refillr` | URL del sitio y redirects permitidos para los mails de auth |

Lo que **no** está acá: el esquema de la base (va en migraciones de Supabase) y los deploys de la
app (los hace `.github/workflows/ci.yml` con wrangler).

El estado vive en Pulumi Cloud, en el proyecto `refillr-infra`, stack `prod`. El backend está fijado
en `Pulumi.yaml` (`backend.url`), así que este proyecto usa Pulumi Cloud aunque la CLI esté logueada
en otro backend (por ejemplo, un bucket S3 de otro proyecto). La primera vez, guardá el token de
Pulumi Cloud sin cambiar el login de los otros proyectos:

1. Anotá el backend actual: es el valor de `"current"` en `%USERPROFILE%\.pulumi\credentials.json`.
2. Logueate en Pulumi Cloud y volvé a dejar el anterior como actual:

   ```sh
   pulumi login https://api.pulumi.com   # abre el navegador; guarda el token de Pulumi Cloud
   pulumi login <backend-anotado>        # el resto de tus proyectos sigue como antes
   ```

## Primera vez

Desde esta carpeta (`infra/`), siempre: así Pulumi usa este `Pulumi.yaml` y no el de otro proyecto.

1. Cuentas y credenciales:
   - **Cloudflare**: Account ID y un API token con *Account → Cloudflare Pages → Edit*.
   - **Supabase**: creá la organización (plan Free), copiá su ID desde *Organization settings*, y
     generá un token en *Account preferences → Access Tokens*. No crees el proyecto a mano: el plan
     Free permite 2 proyectos activos por usuario (sumando todas tus orgs), y uno creado por fuera de
     Pulumi no queda en el estado.
     El token tiene que tener alcance **Organization** (con *Project* solo opera sobre proyectos que
     ya existen, y crear uno da 403) y estos permisos: *Organization Projects* Read-Write,
     *Projects* Read, *Auth Config* Read-Write, *Project Settings* Read-Write y *Organizations* Read.
2. Dependencias. `pulumi install` baja los plugins, genera el SDK de Supabase en `sdks/`
   (ignorado por git) y corre `npm install`:

   ```sh
   pulumi install
   ```

   Commiteá el `package-lock.json` que queda: fija las versiones de las dependencias.

3. Stack y configuración. Los `--secret` quedan cifrados en `Pulumi.prod.yaml`, que se commitea:

   ```sh
   pulumi whoami -v                  # tiene que decir Backend URL: https://app.pulumi.com/...
   pulumi stack init prod
   pulumi config set cloudflareAccountId <account-id>
   pulumi config set supabaseOrgId <org-id>
   pulumi config set --secret dbPassword          # una contraseña larga para Postgres
   pulumi config set --secret cloudflare:apiToken
   pulumi config set --secret supabase:accessToken
   ```

   Los tokens van en la config del stack, no en variables de entorno, para que este proyecto no
   use por accidente credenciales de otro.

   En Git Bash, el prompt oculto de `--secret` puede guardar un valor vacío. Si pasa, copiá el valor
   y cargalo desde el portapapeles (no queda en el historial), y verificá el largo:

   ```sh
   pulumi config set --secret supabase:accessToken "$(cat /dev/clipboard)"
   pulumi config get supabase:accessToken | wc -c   # mayor a 1
   ```

   Para comprobar que el token de Supabase ve la org (tiene que listarla, no devolver `[]`):

   ```sh
   curl -s -H "Authorization: Bearer $(pulumi config get supabase:accessToken)" https://api.supabase.com/v1/organizations
   ```

4. Revisá el plan y aplicalo:

   ```sh
   pulumi preview    # tienen que aparecer 4 para crear (+): stack, Pages, Project y Settings
   pulumi up
   pulumi stack output   # siteUrl y supabaseUrl
   ```

5. Recién ahora cargá `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en los secrets de GitHub
   Actions: el deploy del CI necesita que el proyecto de Pages ya exista.

## Si el proyecto de Pages ya existe

Si se creó antes por otro lado (por ejemplo, a mano), `pulumi up` falla porque el nombre está
tomado. Adoptalo en vez de crearlo: agregá `{ import: '<account-id>/refillr' }` como opciones del
`PagesProject`, corré `pulumi up` hasta que el preview no muestre diferencias, y
después sacá esa opción.

## Comandos de todos los días

```sh
pulumi preview     # qué cambiaría, sin tocar nada
pulumi up          # aplicar
pulumi refresh     # traer el estado real (por si alguien cambió algo en un panel)
```

`pulumi destroy` no puede borrar el proyecto de Supabase mientras tenga `protect: true`.
