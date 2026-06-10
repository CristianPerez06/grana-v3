## Why

Los mocks pulidos de `/shared` y `/settings` (en `docs/design/shared/` y `docs/design/settings/`) ya tienen su layout visual implementado en web, pero falta la **paridad completa** con el diseño: el bloque de integrantes del hogar en `/shared` y la fila descriptiva de idioma en `/settings`. Estos dos elementos no son puro reordenamiento visual — extienden lo que la spec enumera que la ruta muestra y tocan el contrato compartido `@grana/ui-contracts` y los catálogos i18n. Se hacen ahora, sobre la capa compartida, para que cuando se construya mobile sea un drop-in y no una reimplementación.

## What Changes

- **Capa compartida (lista para mobile):**
  - `@grana/ui-contracts`: `LanguageSwitcherProps` gana `label?` y `description?` **opcionales**, espejando cómo `ShowCentsToggleProps` ya incluye su copy de fila. Opcional a propósito: el `LanguageSwitcher` mobile actual no pasa ninguno, así que sigue compilando y renderizando solo el control hasta que se construya mobile.
  - `@grana/i18n-messages`: nuevas claves en **ambos** catálogos (`es.json` + `en.json`), respetando la paridad de claves que ya exige la spec de i18n:
    - bloque de integrantes en `/shared`: `integrantes`, `vos`, `miembro` (bajo `shared.dashboard.*`).
    - fila de idioma en `/settings`: `label` y `description` (bajo `settings.language.*`).
    - rename de `settings.language.es` / `settings.language.en` de `"ES"`/`"EN"` a endónimos `"Español"`/`"English"` (iguales en ambos catálogos; los endónimos no se localizan).
- **Web (esta change):**
  - `/shared` (hogar activo): bloque de **Integrantes** en la columna lateral de desktop — nombre de cada miembro + rol (`Vos`/`Miembro`) + avatar cuadrado con iniciales derivadas de `fullName`. Usa datos que ya provee `getHousehold()`; sin query ni comportamiento nuevo.
  - `/settings` (sección Idioma): se pasan `label`/`description` al `LanguageSwitcher` para que renderice la fila descriptiva (copy a la izquierda, control segmentado a la derecha), simétrica con `ShowCentsToggle`.

- **No incluye:** implementación mobile (se difiere); el avatar/iniciales y el bloque de integrantes quedan web-local (un solo consumidor, mobile `/shared` no existe) — no se crea un contrato `MembersCard`/`HouseholdMember` todavía. Tampoco las rutas hijas (`/shared/settle`, `/shared/settings`, `/settings/categories`).

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `shared`: el requirement del dashboard del hogar amplía lo que la pantalla muestra para incluir el bloque de integrantes del hogar (reorganización de datos ya disponibles; sin cambio de comportamiento ni de derivación de deuda).
- `settings`: el requirement de cambio de idioma registra que la sección Idioma ahora renderiza una fila descriptiva (label + description) alrededor del `LanguageSwitcher`, con copy desde `settings.language.*`.

## Impact

- **Contrato compartido:** `packages/ui-contracts/src/index.ts` (`LanguageSwitcherProps` +`label?` +`description?`). Cambio aditivo y opcional — no rompe a los consumidores web ni mobile existentes.
- **i18n:** `packages/i18n-messages/src/es.json` y `en.json` (claves nuevas + rename de labels de locale). La spec de i18n exige que ambos catálogos cubran las mismas claves.
- **Web:** `apps/web/app/(app)/shared/(home)/page.tsx` (bloque de integrantes) y `apps/web/app/(app)/settings/_components/language-switcher.tsx` + su consumidor (`settings-client.tsx` / `page.tsx`) para pasar el copy de la fila.
- **Mobile:** sin cambios de implementación. El contrato opcional lo deja listo para consumir cuando se retome mobile; la paridad sección-a-sección de la spec de settings se mantiene (mismas secciones, mismo orden, mismo título).
- **Specs:** deltas en `shared` y `settings`. Sin cambios en `i18n` (solo cumplimiento de la paridad de claves ya especificada).
