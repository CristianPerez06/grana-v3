## Why

El mock pulido de `/shared/settings` (en `docs/design/shared-settings/`) ya tiene su layout visual implementado en web (ruta a `760px`, secciones en paneles, lista de integrantes con avatar, split más legible). Pero quedaron tres diferencias intencionales con el mock que **no** son puro reordenamiento de datos existentes y por eso se difirieron del cambio puramente visual:

1. **Confirmación de salida** — el mock trata "Salir del hogar" como zona destructiva. Pedir confirmación antes de salir es **comportamiento nuevo** (hoy la salida es de un solo click). El handoff (`docs/design/shared-settings/README.md`) lo marcó explícitamente como algo que debe pasar por OpenSpec antes de implementarse.
2. **Copy descriptivo de la zona destructiva** — el mock muestra una línea explicativa sobre qué hace salir del hogar; es copy nuevo, no existe en i18n.
3. **Captions del split por defecto** — el mock rotula a cada integrante bajo su nombre ("Primer integrante" / "Complementario"); es copy nuevo.

Esta change cierra esas tres diferencias por la vía correcta (spec + i18n en ambos catálogos), sin tocar la derivación de deuda, el invite, ni las queries de gastos compartidos.

> La cuarta diferencia del handoff —el botón destructivo sólido (rojo lleno) del mock vs. el `variant="destructive"` suave del primitivo `Button`— se **acepta como divergencia deliberada** (regla del repo: usar el primitivo existente; no se introduce un override sólido por instancia). Se documenta en `design.md`, sin delta de spec.

## What Changes

- **i18n (`@grana/i18n-messages`, ambos catálogos `es.json` + `en.json`, respetando la paridad de claves):**
  - Confirmación de salida: `shared.settings.leave_confirm_title`, `shared.settings.leave_confirm_body`. (El CTA de confirmar reutiliza `shared.settings.leave_action`; el de cancelar reutiliza `common.cancel`.)
  - Zona destructiva: `shared.settings.leave_description`.
  - Captions del split: `shared.settings.default_split_first_label`, `shared.settings.default_split_complement_label`.
- **Web (esta change), ruta `/shared/settings`:**
  - **Comportamiento nuevo:** el botón "Salir del hogar" abre un `Dialog` de confirmación (primitivo existente `@/components/ui/dialog`, patrón espejo de `AccountConfirmDialog`). La mutación `leaveHousehold` sólo se invoca al confirmar; cancelar/cerrar/Esc la descarta sin efecto. El bloqueo por deuda viva existente (server-side) se conserva y se sigue mostrando como error inline.
  - **Visual + copy:** la sección de salida muestra la línea descriptiva (`leave_description`); el split por defecto rotula a ambos integrantes con sus captions.
- **No incluye:**
  - Implementación mobile (`/shared/settings` nativo no existe; el mock mobile es referencia responsive/futura).
  - Cambios en la derivación de deuda, settlement, invite o queries de gastos compartidos.
  - Cambiar el primitivo `Button` (la divergencia del rojo sólido se acepta, no se corrige).
  - Tocar `/shared`, `/shared/settle`, `/settings` root ni categorías.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `shared`: dos requirements se amplían —
  - "El usuario puede salir del hogar solo si no hay deuda viva": en web la salida ahora exige confirmación explícita vía `Dialog` antes de invocar `leaveHousehold` (comportamiento nuevo en la capa de UI; la regla de negocio de bloqueo por deuda no cambia).
  - "El usuario puede configurar el split por defecto del hogar": la pantalla de configuración rotula a ambos integrantes (primer integrante editable + complementario derivado) — reorganización legible de datos ya disponibles.

## Impact

- **i18n:** `packages/i18n-messages/src/es.json` y `en.json` (5 claves nuevas en ambos catálogos; la spec de i18n exige paridad de claves).
- **Web:** `apps/web/app/(app)/shared/settings/_components/settings-form.tsx` (abre el Dialog en vez de invocar directo; captions; descripción) + un componente de diálogo de confirmación colocalizado (`_components/leave-household-dialog.tsx`).
- **Mobile:** sin cambios; el copy nuevo queda en la capa compartida (i18n) listo para consumir cuando se construya `/shared/settings` nativo.
- **Specs:** deltas en `shared` (dos requirements MODIFIED). Reusa el primitivo `Dialog` ya especificado en `overlay-primitives` (sin delta nuevo ahí).
- **Coordinación:** la change activa `shared-settings-web-design-parity` también toca `specs/shared/spec.md`, pero requirements distintos (dashboard del hogar + idioma). No hay solapamiento de requirements; ambas changes son independientes y pueden archivarse en cualquier orden.
