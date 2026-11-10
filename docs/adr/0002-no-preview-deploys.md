# Sin previews de PRs

Los PRs solo compilan y corren los tests; no se publican. Una preview necesitaría su propia base de
Supabase para no tocar los datos reales, y no vale la pena mantener un segundo proyecto solo para eso.
Las migraciones de la base se aplican desde el CI únicamente al mergear a `main`.
