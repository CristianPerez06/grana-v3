# Pickers de ícono y color para categorías

## Why

Al crear o editar una categoría, `icon` y `color` eran inputs de texto crudos: el usuario tenía que **escribir un emoji a mano** y **tipear un código hex** (`#FF6B6B`). No había forma visual de elegir, así que en la práctica los campos quedaban vacíos. Es una fricción innecesaria para algo que debería ser un par de clicks.

## What Changes

- **Picker de ícono (web):** un control que abre un `Popover` con una grilla curada de emojis relevantes para categorías; al elegir uno se setea el valor. Incluye opción "Sin ícono".
- **Picker de color (web):** una fila de swatches de una paleta preset (todos `#RRGGBB`, válidos contra el schema) + un selector de color nativo para color personalizado, con opción "Sin color".
- Ambos pickers se integran en los formularios de **alta** (`/settings/categories/new`) y **edición** (`/settings/categories/[id]/edit`) vía `Controller` de react-hook-form, reemplazando los `FormField` de texto.
- Strings i18n nuevas (es/en): `icon_pick`, `icon_none`, `color_none`, `color_custom`.

Sin cambios de backend: `icon` sigue siendo un string emoji y `color` un hex `#RRGGBB`; el `createCategorySchema`/`updateCategorySchema` y los server actions no cambian. Las categorías existentes con cualquier emoji/color siguen renderizando igual.

## Capabilities

### New Capabilities

(ninguna — ajusta la UX de la capacidad existente `categories`)

### Modified Capabilities

- `categories`: se documenta que la selección de `icon` y `color` en los formularios web es por picker (grilla de emojis + swatches/color nativo), no por entrada de texto.

## Impact

- Affected specs: `categories`.
- Affected code:
  - `apps/web/app/(app)/settings/categories/_components/icon-picker.tsx` — nuevo.
  - `apps/web/app/(app)/settings/categories/_components/color-picker.tsx` — nuevo.
  - `apps/web/app/(app)/settings/categories/new/_components/create-category-form.tsx` — usa los pickers.
  - `apps/web/app/(app)/settings/categories/[id]/edit/_components/edit-category-form.tsx` — usa los pickers.
  - `packages/i18n-messages/src/{es,en}.json` — strings nuevas.
- **Paridad mobile DIFERIDA:** mobile usa los mismos campos (`icon`/`color`) pero su form de categorías es trabajo aparte; queda como follow-up.
