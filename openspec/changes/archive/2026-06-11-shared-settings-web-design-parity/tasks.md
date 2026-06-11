## 1. Capa compartida — contrato i18n

- [x] 1.1 Agregar a `packages/i18n-messages/src/es.json` y `en.json` las claves `shared.dashboard.integrantes` (es "Integrantes" / en "Members"), `shared.dashboard.vos` (es "Vos" / en "You"), `shared.dashboard.miembro` (es "Miembro" / en "Member")
- [x] 1.2 Agregar `settings.language.row_label` (es "Idioma de la aplicación" / en "App language") y `settings.language.description` (es "Se aplica a textos y formatos disponibles." / en "Applies to available texts and formats.") en ambos catálogos. (Nota: `settings.language.label` ya existe como título de la sección — "Idioma" — por eso el título de la fila usa una clave nueva `row_label`.)
- [x] 1.3 Renombrar los valores de `settings.language.es` → "Español" y `settings.language.en` → "English" en ambos catálogos (idénticos en `es.json` y `en.json`)
- [x] 1.4 Verificar paridad de claves entre `es.json` y `en.json` (1189/1189, sin diferencias)

## 2. Capa compartida — contrato de componente

- [x] 2.1 Extender `LanguageSwitcherProps` en `packages/ui-contracts/src/index.ts` con `label?: string` y `description?: string` opcionales, documentando que `label` es el título de la fila y `renderLabel(locale)` la etiqueta por-locale del botón

## 3. Web — /settings sección Idioma

- [x] 3.1 Actualizar `apps/web/app/(app)/settings/_components/language-switcher.tsx` para renderizar la fila descriptiva (label + description a la izquierda, control a la derecha) cuando se reciben `label`/`description`, manteniendo el comportamiento control-only cuando no se pasan
- [x] 3.2 Pasar `label={t('settings.language.row_label')}` y `description={t('settings.language.description')}` desde el consumidor (`settings-client.tsx` ← `page.tsx`)
- [x] 3.3 Confirmar que los botones de locale muestran los endónimos ("Español"/"English") vía `renderLabel` (automático: `localeLabels` lee `settings.language.es`/`.en` renombrados)

## 4. Web — /shared bloque de Integrantes

- [x] 4.1 En `apps/web/app/(app)/shared/(home)/page.tsx` (estado de hogar activo), agregar el bloque de Integrantes en la columna lateral de desktop: por cada `household.members`, avatar cuadrado con iniciales derivadas de `fullName`, nombre, y rol ("Vos" si `userId` propio, si no "Miembro")
- [x] 4.2 El bloque vive en el `aside` del grid de desktop (ahora siempre dos columnas en hogar activo) y apila limpio en narrow; sin query ni dato nuevo (solo `household.members` + `userId` ya disponibles)

## 5. Verificación

- [x] 5.1 `pnpm --filter web lint` y `pnpm --filter web typecheck` en verde
- [x] 5.2 `pnpm --filter web test` en verde (345/345); no hay test dedicado de paridad de catálogos — verificado por script
- [x] 5.3 `openspec validate shared-settings-web-design-parity --strict` en verde
- [x] 5.4 Revisión visual contra `docs/design/shared/web/shared.html` y `docs/design/settings/web/settings.html`: Integrantes (avatar+nombre+rol) y fila de idioma (copy izquierda / control derecha) coinciden con el mock. Diferencia intencional: el control de idioma mantiene su look basado en `Button` (no el pill-segmented del mock) por la restricción de no cambiar el selector.
