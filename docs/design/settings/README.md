# Propuesta visual `/settings`

## Contexto

Esta propuesta aplica `docs/design/route-ui-system.md` a la ruta root `/settings`. El alcance es solo la pantalla raiz de configuracion; no incluye `/settings/categories` ni sus hijos.

La ruta tiene paridad web/mobile ya implementada con componentes nativos separados y contratos compartidos.

## Implementacion inspeccionada

- `apps/web/app/(app)/settings/layout.tsx`
- `apps/web/app/(app)/settings/page.tsx`
- `apps/web/app/(app)/settings/loading.tsx`
- `apps/web/app/(app)/settings/_components/settings-header.tsx`
- `apps/web/app/(app)/settings/_components/settings-client.tsx`
- `apps/web/app/(app)/settings/_components/settings-section.tsx`
- `apps/web/app/(app)/settings/_components/show-cents-toggle.tsx`
- `apps/web/app/(app)/settings/_components/language-switcher.tsx`
- `apps/mobile/app/(app)/settings/index.tsx`
- `apps/mobile/components/settings/SettingsSection.tsx`
- `apps/mobile/components/settings/ShowCentsToggle.tsx`
- `apps/mobile/components/settings/LanguageSwitcher.tsx`

## Datos disponibles

- Titulo de ruta `settings.title`.
- Preferencia `showCents`.
- Locale actual.
- Locales disponibles y labels `es` / `en`.
- Link a `/settings/categories`.
- Estados pending para cambio de centavos e idioma.
- Loading skeleton por seccion.

## Direccion propuesta

- Mantener la ruta sobria y de baja densidad: no agregar hero ni resumenes.
- Alinear `SettingsSection` con las rutas pulidas: paneles de 18px, borde suave, filas de altura estable y titulos uppercase compactos.
- Tratar cada preferencia como fila de configuracion, no como card independiente.
- Mantener el switch a la derecha y la descripcion a la izquierda.
- Mantener idioma como control segmentado/radio.
- Mantener categorias como fila navegable con chevron.
- En mobile, conservar una columna con los mismos tres bloques y targets comodos.

## Recomendaciones

- Subir el radio de `SettingsSection` web de `rounded-lg` a `rounded-2xl`/18px para empatar con mobile y el sistema nuevo.
- Considerar `max-w-[760px]` para que las descripciones respiren, sin convertirlo en dashboard.
- No agregar accesos a subrutas nuevas ni preferencias nuevas.
- La implementacion debe seguir usando `Button` en `LanguageSwitcher` web y `Switch` nativo en mobile.

## Archivos del bundle

- `shared.css`
- `web/settings.html`
- `mobile/settings.html`
- `components/route-shell.html`
- `components/settings-section.html`
- `components/show-cents-toggle.html`
- `components/language-switcher.html`
- `components/categories-link-row.html`
- `components/loading-state.html`
