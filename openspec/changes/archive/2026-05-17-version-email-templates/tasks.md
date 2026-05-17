## 1. Verificar archivos ya creados

- [x] 1.1 Confirmar que `supabase/templates/confirm-signup.html` existe y contiene `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
- [x] 1.2 Confirmar que `supabase/templates/reset-password.html` existe y contiene `{{ .SiteURL }}/auth/callback?code={{ .Token }}&next=/reset-password`

## 2. Actualizar README

- [x] 2.1 Reescribir la sección 4.3 ("Templates de email") del `README.md`: cambiar las instrucciones de "cambiar el enlace a X" por "abrir `supabase/templates/<nombre>.html`, copiar el contenido completo y pegarlo en el campo del template correspondiente en el dashboard de Supabase"
- [x] 2.2 Mantener documentadas las formas de URL esperadas como doble check (debajo de las instrucciones de copy-paste)
- [x] 2.3 Agregar una nota corta: "El repo es la source of truth. Si el dashboard y el repo divergen, sobrescribí el dashboard con el contenido del repo, no al revés."

## 3. Actualizar CLAUDE.md

- [x] 3.1 Agregar una sección breve "Email templates" en `CLAUDE.md` (en inglés, por la excepción declarada) explicando: (a) los templates viven en `supabase/templates/`, (b) son source of truth, (c) el sync con el dashboard es manual hasta que se adopte el CLI de Supabase, (d) editar templates implica también pegarlos al dashboard
- [x] 3.2 Confirmar que la nueva sección no rompe la estructura existente del archivo

## 4. Verificación final

- [x] 4.1 Correr `openspec status --change version-email-templates` y confirmar `4/4 artifacts complete`
- [x] 4.2 Correr `openspec instructions specs --change version-email-templates --json` y confirmar que los 2 nuevos requirements son detectados
- [x] 4.3 Grep manual de las URLs en los templates: `grep -h "auth/callback" supabase/templates/*.html` debe mostrar las dos formas (token_hash+type=signup y code+next=/reset-password)
- [x] 4.4 Releer el README y confirmar que la sección 4.3 actualizada es coherente con el resto del flujo de setup
