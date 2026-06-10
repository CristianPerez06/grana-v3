## Context

El layout visual de `/shared` (hero navy de balance, grid de dos columnas) y `/settings` (radio/borde de `SettingsSection`) ya está implementado en web. Faltan dos elementos para paridad completa con los mocks que **no** son puro reordenamiento: el bloque de Integrantes en `/shared` y la fila descriptiva de idioma en `/settings`. Ambos tocan capa compartida (i18n y/o `@grana/ui-contracts`), por lo que conviene resolverlos sobre esa capa ahora, con mobile diferido pero "drop-in ready".

Restricciones vigentes: mobile no se implementa todavía; la spec de i18n exige paridad de claves `es.json`/`en.json`; la spec de settings define paridad web↔mobile a nivel de sección (no de copy interno de fila); regla del repo de no extraer wrappers compartidos hasta ≥2 consumidores reales.

## Goals / Non-Goals

**Goals:**
- Paridad completa de los mocks de `/shared` y `/settings` (root) en web.
- Dejar la fila de idioma como pieza reutilizable en el contrato compartido para que mobile sea drop-in.
- Mantener todos los textos nuevos en ambos catálogos i18n.

**Non-Goals:**
- Implementar nada en mobile (solo dejar el contrato listo).
- Crear un contrato compartido para el bloque de Integrantes (un solo consumidor, mobile `/shared` no existe).
- Tocar rutas hijas (`/shared/settle`, `/shared/settings`, `/settings/categories`).
- Cambiar derivación de deuda, settlement, invite o queries de gastos compartidos.

## Decisions

### Decisión 1 — Copy de la fila de idioma vive en el contrato (`LanguageSwitcherProps`), no en el consumidor

Se extiende `LanguageSwitcherProps` con `label?` y `description?` opcionales, espejando `ShowCentsToggleProps` que ya incluye su copy de fila. El `LanguageSwitcher` renderiza la fila completa (copy + control).

- **Alternativa considerada:** dejar `LanguageSwitcher` control-only y poner el copy en el consumidor (`settings-client`/`page`). Rechazada: mobile tendría que reimplementar la fila por su cuenta; pierde la simetría con `ShowCentsToggle`.
- **Por qué opcional y no requerido:** props requeridas romperían el typecheck del `LanguageSwitcher` mobile (que hoy no pasa copy) y forzarían trabajo mobile que estamos difiriendo. Opcional = web las pasa hoy, mobile las pasa cuando se construya, y todo compila en el ínterin.

### Decisión 2 — El bloque de Integrantes queda web-local (sin contrato compartido)

Se renderiza en `apps/web/app/(app)/shared/(home)/page.tsx` usando `household.members` (ya cargado) y el `userId` actual (ya resuelto). Las iniciales del avatar se computan inline (no hay helper compartido existente).

- **Alternativa considerada:** crear un contrato `MembersCard`/`HouseholdMember` en `@grana/ui-contracts`. Rechazada por la regla de ≥2 consumidores: hoy hay uno solo (web) y la forma del `/shared` mobile es desconocida. Se revisita cuando mobile aterrice.
- Lo reutilizable (el copy `integrantes`/`vos`/`miembro`) sí va a la capa compartida (i18n), así que mobile hereda los textos automáticamente.

### Decisión 3 — Rename de labels de locale a endónimos

`settings.language.es`/`.en` pasan de `"ES"`/`"EN"` a `"Español"`/`"English"`, iguales en ambos catálogos (los endónimos no se localizan). La spec de settings mantiene su escenario de cambio de idioma refiriéndose al **código** de locale (`en`), no a la etiqueta del botón.

### Decisión 4 — Una sola change para dos capabilities

`shared` y `settings` se modifican en la misma change porque el esfuerzo es cohesivo ("paridad de diseño web root") y la paridad de claves i18n los une. Cada capability tiene su delta separado.

## Risks / Trade-offs

- **[El `LanguageSwitcher` mobile diverge visualmente hasta que se construya mobile]** → Aceptado y explícito: la paridad de la spec de settings es a nivel de sección (mismo título/secciones/orden), que se mantiene; el copy de fila es opcional. Se documenta en el delta de settings.
- **[`label` vs `renderLabel` en `LanguageSwitcherProps` pueden confundirse]** → Mitigación: documentar en el contrato que `label` es el título de la fila y `renderLabel(locale)` es la etiqueta por-locale del botón segmentado.
- **[Bloque de Integrantes percibido como bajo valor]** (el nombre del par ya aparece en las líneas de balance) → Es decisión de diseño del usuario (paridad completa con el mock); sin costo de datos ni comportamiento.
- **[Drift de claves i18n]** → Mitigación: agregar cada clave nueva a `es.json` y `en.json` en el mismo commit; el check "Ambos catálogos cubren las mismas claves" lo verifica.
