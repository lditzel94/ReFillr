# Infra de ReFillr (Pulumi, Go)

Este programa declara lo que tiene que existir para que ReFillr funcione:

| Recurso | Qué es |
|---|---|
| `cloudflare.PagesProject` `refillr` | El proyecto de Pages (Direct Upload) donde el CI publica cada build |
| `supabase.Project` `refillr` | La base y la auth, en `sa-east-1` (San Pablo). Protegido: Pulumi no lo borra |
| `supabase.Settings` `refillr` | URL del sitio y redirects permitidos para los mails de auth |

Lo que **no** está acá: el esquema de la base (va en migraciones de Supabase) y los deploys de la
app (los hace `.github/workflows/ci.yml` con wrangler).

El estado vive en Pulumi Cloud, en el proyecto `refillr-infra`, stack `prod`. No comparte nada con
otros proyectos de la misma cuenta de Pulumi: cada proyecto y stack tiene su propio estado.

## Primera vez

Desde esta carpeta (`infra/`), siempre: así Pulumi usa este `Pulumi.yaml` y no el de otro proyecto.

1. Cuentas y credenciales:
   - **Cloudflare**: Account ID y un API token con *Account → Cloudflare Pages → Edit*.
   - **Supabase**: creá la organización (plan Free), copiá su ID desde *Organization settings*, y
     generá un token en *Account preferences → Access Tokens*. No crees el proyecto a mano.
2. Dependencias. `pulumi install` baja los plugins y genera el SDK de Supabase en `sdks/`
   (ignorado por git):

   ```sh
   pulumi install
   go mod tidy
   ```

3. Stack y configuración. Los `--secret` quedan cifrados en `Pulumi.prod.yaml`, que se commitea:

   ```sh
   pulumi whoami -v                  # confirmá la cuenta / organización
   pulumi stack init prod
   pulumi config set cloudflareAccountId <account-id>
   pulumi config set supabaseOrgId <org-id>
   pulumi config set --secret dbPassword          # una contraseña larga para Postgres
   pulumi config set --secret cloudflare:apiToken
   pulumi config set --secret supabase:accessToken
   ```

   Los tokens van en la config del stack, no en variables de entorno, para que este proyecto no
   use por accidente credenciales de otro.

4. Revisá el plan y aplicalo:

   ```sh
   pulumi preview    # tienen que aparecer 3 recursos para crear (+)
   pulumi up
   pulumi stack output   # siteUrl y supabaseUrl
   ```

5. Recién ahora cargá `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en los secrets de GitHub
   Actions: el deploy del CI necesita que el proyecto de Pages ya exista.

## Si el proyecto de Pages ya existe

Si se creó antes por otro lado (por ejemplo, a mano), `pulumi up` falla porque el nombre está
tomado. Adoptalo en vez de crearlo: agregá `pulumi.Import(pulumi.ID("<account-id>/refillr"))` a
las opciones de `NewPagesProject`, corré `pulumi up` hasta que el preview no muestre diferencias, y
después sacá esa opción.

## Comandos de todos los días

```sh
pulumi preview     # qué cambiaría, sin tocar nada
pulumi up          # aplicar
pulumi refresh     # traer el estado real (por si alguien cambió algo en un panel)
```

`pulumi destroy` no puede borrar el proyecto de Supabase mientras tenga `Protect(true)`.
