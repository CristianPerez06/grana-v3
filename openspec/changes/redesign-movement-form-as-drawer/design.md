# Diseño — Form de movimientos como drawer

## Arquitectura: presentación nueva, lógica reusada

El objetivo es **no duplicar** la lógica que ya vive en `apps/web/app/(app)/transactions/new/_components/movement-form.tsx` (estado del form, llamadas a server actions, `editableFields`, gating por tipo, sugerencia de categoría, aviso de saldo negativo).

Plan de reuso en tres capas:

1. **Lógica pura → `packages/`**: lo que es agnóstico de plataforma (formato de monto AR en vivo, derivaciones por tipo — color/signo/helper/labels, validación de submit, mapeo a inputs de las actions) se extrae a `@grana/money-logic` (o un módulo nuevo `packages/movement-form-logic` si crece). Hoy `MoneyAmountInput`/`parseMoneyInput` ya existen y se reusan tal cual.
2. **Estado del form → hook compartido en lógica, JSX por plataforma**: un hook `useMovementForm()` que devuelve estado + handlers, sin JSX. Web y mobile lo consumen y montan su propio árbol (HTML vs RN), respetando la Web↔Mobile policy (no se comparte JSX).
3. **Presentación → drawer (web) / drawer (mobile)**: el contenedor cambia de página a drawer usando los primitivos de `add-overlay-primitives`. Los selectores (cuenta, categoría con drill, fecha) son popovers que envuelven el primitivo `Popover`.

Las rutas `/transactions/new` y `/transactions/[txId]/edit` se mantienen y renderizan el mismo form (montado en página, no en drawer) para deep-link, no-JS y reuso mobile. En desktop, los openers (FAB, botón header, fila) abren el drawer; la navegación a la ruta queda como fallback.

## Selector de categoría con drill

Reusa el árbol de `getAllCategories` (categoría → `subcategories[]`) y el lenguaje visual del drill de `spending-by-category` (chevron `›`, "Toda la categoría", volver con `‹`). El popover mantiene estado local `catDrill` (categoría en la que se está drilleando). Click en categoría no drillable selecciona y cierra; click en drillable entra a nivel 1 sin seleccionar; en nivel 1, "Toda la categoría" selecciona sin subcat, una subcategoría selecciona `categoría + subcategoría`.

## Quinto tab: Cambio de moneda (diseño derivado)

El prototipo no trae diseño. Se deriva del layout de Transferencia:

- Fila **Desde** (cuenta origen) + monto/moneda origen (el monto hero representa el monto de origen).
- Fila **Hacia** (cuenta destino, puede ser la misma cuenta para cambio intra-cuenta) + monto/moneda destino.
- Restricción: `currency origen ≠ currency destino` (lo valida `createExchangeSchema`).
- Helper: tasa implícita `destino/origen` mostrada de forma no editable como ayuda.
- Sin categoría, sin cuotas, sin reintegro. Repetir: se evalúa con Producto (las recurrencias de exchange no son comunes; por defecto, ocultar el toggle Repetir en exchange salvo definición contraria).

## Snapping de tokens

El prototipo difiere en algunos valores; se snapean a `@grana/ui-tokens`:

| Prototipo | v3 token |
|---|---|
| verde texto `#059669` | `--emerald-deep` (`#059669`) ✓ |
| emerald-soft `#ECFDF5`/`#E4F5EE` | `--emerald-bg` / `--emerald-soft` |
| ámbar banner `#FCF5E0`/`#D9A21B` | `--warning` (`#C49A3C`) + fondo derivado |
| dots de cuenta hex arbitrarios | `AccountAvatar` / `resolveAccountAvatar` (8 colores curados) |

Fuente: Plus Jakarta Sans (ya configurada). Números `tabular-nums`. Miles `.` / decimales `,` (es-AR) vía la lógica de `MoneyAmountInput`.

## Cuentas y crédito

Las filas de cuenta usan `AccountAvatar` (color_key/icon_key resueltos), no dots hex. Las cuentas de crédito son `type='credit'` y viven en el bucket de `cards`: elegir una en un Gasto dispara el flujo de cuotas (`registerInstallments`/`registerCardPurchase`) en vez de `createExpense`, y muestra el subtexto del próximo resumen (período via `getOrCreatePeriodForDate`). Esta bifurcación ya existe en `movement-form` y se preserva.

## Riesgos

- **Extracción de lógica**: mover estado a un hook compartido debe preservar exactamente el comportamiento actual (tests de las actions y del form como red de seguridad). Hacerlo incremental: primero envolver el form existente en el drawer reusándolo tal cual; luego extraer a `packages/` para mobile.
- **Doble entrada (drawer + ruta página)**: mantener ambas sin divergencia exige que el form sea un único componente montado en dos contenedores. Evitar lógica duplicada en el page wrapper.
- **Exchange sin diseño previo**: requiere validación de Producto/Diseño antes de cerrar el tab.

## Dependencias

- `add-custom-recurrence-frequency` (freq Personalizado en el toggle Repetir).
- `add-overlay-primitives` (Drawer, Popover, Segmented, Switch en web y mobile).
