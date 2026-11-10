# Base de datos (Supabase)

| Carpeta | Qué hay |
|---|---|
| `migrations/` | El esquema: tablas, reglas de acceso (RLS), triggers y funciones (RPC). El CI las aplica a producción al mergear a `main`. |
| `tests/` | Tests de pgTAP: quién ve y edita qué, la protección del administrador y los cambios de cantidad. |
| `scripts/` | Scripts para el administrador, para pegar en el editor SQL del panel de Supabase. |
| `templates/` | Los mails de invitación y de recuperar contraseña. Solo los usa el Supabase local: en producción el plan gratis no permite plantillas sin SMTP propio. |

## Probar en local

Hace falta Docker Desktop.

```bash
npm run db:start   # levanta Postgres y aplica las migraciones
npm run db:test    # corre los tests
npm run db:stop
```

Un cambio de esquema va siempre en una migración nueva (`npx supabase migration new <nombre>`),
nunca editando una que ya se aplicó, y con su test.

## Administrar cuentas y hogares

Nadie puede registrarse solo: el registro público está apagado. Para sumar a alguien:

1. En el panel de Supabase, *Authentication → Users → Invite user*, con su email. Le llega el mail
   "Te sumaron a ReFillr" y elige su nombre y su contraseña en la app.
2. En *SQL Editor*, pegá el script que corresponda, completá los valores de arriba y ejecutalo:

| Script | Para qué |
|---|---|
| `make-admin.sql` | Marcarte como administrador. Una sola vez. |
| `create-household.sql` | Crear un hogar con su primer miembro. |
| `add-member.sql` | Sumar a alguien al hogar de otra persona. |
| `move-member.sql` | Pasar a alguien de un hogar a otro. |
| `remove-member.sql` | Sacar a alguien de su hogar (sirve también para el administrador). |

Si el que se va era el último miembro, el hogar se borra con sus categorías e ítems, igual que
cuando alguien sale desde la app.
