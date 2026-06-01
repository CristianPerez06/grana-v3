# Tareas — Pickers de ícono y color para categorías

## 1 · Componentes

- [x] 1.1. `icon-picker.tsx`: trigger + `Popover` con grilla curada de emojis + "Sin ícono". Controlado (`value`/`onChange`).
- [x] 1.2. `color-picker.tsx`: swatches de paleta preset (`#RRGGBB`) + color nativo (`<input type="color">`) + "Sin color". Controlado.

## 2 · Integración

- [x] 2.1. `create-category-form.tsx`: reemplazar los `FormField` de icon/color por los pickers vía `Controller`.
- [x] 2.2. `edit-category-form.tsx`: idem, precargando el valor actual.
- [x] 2.3. Strings i18n `icon_pick`, `icon_none`, `color_none`, `color_custom` (es/en).

## 3 · Spec + verificación

- [x] 3.1. AGREGAR requirement de selección por picker en `openspec/specs/categories/spec.md` (web).
- [x] 3.2. Web typecheck, web lint, JSON i18n — verdes.
- [x] 3.3. Verificación visual: crear categoría eligiendo ícono y color (confirmado por el usuario 2026-06-01).
- [x] 3.4. Archivar la change y sincronizar el spec maestro antes del merge.
