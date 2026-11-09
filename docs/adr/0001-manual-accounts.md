# Cuentas creadas a mano por el administrador

ReFillr es para la familia y amigos de Luciano, no un servicio abierto. El registro público está apagado
en Supabase: nadie puede darse de alta solo. Luciano crea cada cuenta desde el panel de Supabase y arma
hogares y miembros con scripts SQL del repo. Se ingresa con email y contraseña.

## Considered Options

- **Ingresar con Google**: descartado porque exige crear y mantener un cliente OAuth en Google Cloud Console.
- **Invitaciones desde la app** (un miembro invita por email o código): descartado por ahora; dar de alta
  gente es tarea del administrador. Si algún día hace falta, va con un backend propio.
