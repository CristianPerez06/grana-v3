## 1. Causas raíz transversales

- [x] 1.1 `app-shell.tsx` (~:89): cambiar el padding del `<div>` hijo de `<main>` de `px-8 py-8` fijo a responsive (`px-4 py-5 md:px-8 md:py-8` o equivalente). Verificar a 360px y ≥768px.
- [x] 1.2 `components/ui/dropdown-menu.tsx` (~:63): agregar `maxWidth` efectivo `min(valorDeseado, calc(100vw - margen))` para que el menú no desborde en mobile.
- [x] 1.3 `components/ui/popover.tsx` (~:31) y `components/ui/date-picker.tsx`: clampar `minWidth`/`maxWidth` a `min(..., calc(100vw - margen))` para no desbordar a 320px.
- [x] 1.4 Padding interno de forms en drawers/modales: `accounts/new/_components/create-account-form.tsx` (:280/:301/:310), `accounts/[id]/edit/_components/edit-account-form.tsx` (:255/:277/:286) y `transactions/recurring/_components/create-recurrence-modal.tsx` (:446/:467): `px-7` → responsive (`px-5 sm:px-7`).

## 2. Cuentas (detalle — el más visible)

- [x] 2.1 `accounts/[id]/_components/account-detail-header.tsx` (:116): saldo ARS `text-[42px] ... sm:text-[42px]` → `text-[28px] sm:text-[42px]`; ajustar `min-h-[238px]`/`p-6` del hero si el alto cambia (`:19`).
- [x] 2.2 `accounts/_components/account-form-ui.tsx` (:164): input de monto `w-[132px]` fijo → fluido (`w-full` / `flex-1`, con tope en `sm:`). Revisar preview `px-[22px]` (:84).
- [x] 2.3 Verificar el listado de cuentas y el form completo a 360px (el row ya es responsive — solo confirmar sin regresión). [Verificado leyendo el markup, NO en navegador: `account-row` ya es fluido y el form quedó cubierto por 1.4 / 2.2 / 9.3.]

## 3. Compartido (cuenta corriente + heros)

- [x] 3.1 `shared/cuenta-corriente/.../current-account-view.tsx` (:283): grid `grid-cols-[58px_1fr_auto]` → presentación legible en mobile (apilar filas o reducir columnas con `sm:`). Quitar/ajustar anchos fijos `w-[88px]` (:403) y `w-[104px]`. [El GRID ya colapsa a 3 cols en mobile (change/amount `hidden sm:block`); foco fue la fila de proyección con varios `shrink-0` → ahora `flex-wrap`.]
- [x] 3.2 `current-account-view.tsx` (:183): label absoluto con `whitespace-nowrap` que se sale → permitir wrap o reposicionar en mobile. Revisar `p-6` (:160) y equation boxes (:308). [Label acotado `max-w-[80vw]` + wrap en mobile; `p-6`→`p-5 sm:p-6`; saldo `text-[40px]`→escala. Equation boxes `grid-cols-2` quedan OK en mobile.]
- [x] 3.3 `shared/(home)/page.tsx` (:224/:231/:235/:279): montos hero `text-[38px]`/`text-[26px]` y `w-[104px]` fijos → escalar tamaño y volver fluido el ancho. Revisar `p-6`/`p-5`. [Neto `text-[38px]`→escala; hero `p-6`→`p-5 sm:p-6`; `w-[104px]` viven en bloque `flex-wrap` que no desborda; debtTile 26px centrado, OK.]
- [x] 3.4 `shared/settle/.../settle-form.tsx` (:153): input `max-w-[240px]` + `text-[42px]` → escalar en mobile; grid de botones `grid-cols-2` (:159) revisar truncado. [Monto y `$` escalan; input ya clampa a 240px; 2 botones quick caben en mobile.]

## 4. Tarjetas (grids fijos + sidebars)

- [x] 4.1 `cards/_components/cuotas-en-curso-pane.tsx` (:86): `grid grid-cols-3` → `grid-cols-2 sm:grid-cols-3` (2 cols en mobile; 1 sola dejaba 3 stats muy altos).
- [x] 4.2 `cards/_components/create-card-form.tsx` (:323): `grid grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
- [x] 4.3 `cards/_components/card-detail-header.tsx` (:40): `pl-[70px]` → `pl-0 sm:pl-[70px] md:pl-0` + `flex-wrap` (quita el indent solo en el rango que desbordaba).
- [x] 4.4 Columnas laterales `md:`→`lg:`: `cards-month-hero.tsx` (:28/:74/:77) y `en-curso-card.tsx` (:55); + `p-7`→`p-5 sm:p-7` en esas zonas.

## 5. Movimientos

- [x] 5.1 `transactions/[txId]/_components/detail/detail-hero.tsx`: ya era responsive (monto con `clamp()`, breakpoints `sm:`); solo agregué `break-words` al título por seguridad.
- [x] 5.2 `transactions/recurring/_components/create-recurrence-modal.tsx`: título tiene `truncate` y el monto es `w-full min-w-0` (no desbordan); el `px-7`→`px-5 sm:px-7` ya cubre el apriete. Sin cambio extra.
- [x] 5.3 `lib/transactions/components/movement-row.tsx` (:198): chips → `flex-wrap` + `min-w-0` en título para no spillover sobre el monto. `upcoming-recurrences.tsx`: ya responsive; `shrink-0` a la columna de monto.
- [x] 5.4 `lib/transactions/components/movement-row.tsx`: las filas sin running balance apilaban el monto debajo del título en mobile; pasan a grilla `[título | monto]` inline en todo ancho (paridad con web), título trunca. Aplica a `/transactions`, inicio de Compartido y resumen de tarjeta. `route-ui-system.md` aclarado: en mobile se ocultan columnas auxiliares (running balance), no el monto.
- [x] 5.5 Bloques de alerta de `/transactions` (`pending-reimbursements-block.tsx` + `recurrences/.../pending-recurrences-block.tsx`): header sobrecargado en mobile (ícono/título grandes + subtítulo + pill + chevron en una fila → wrap feo). Mobile: ícono `size-10`, título `text-[15px] leading-tight`, subtítulo `hidden sm:block`, pill compacto, padding `px-4 sm:px-6`. Fila de recurrencia: gap/monto/indent de botones reducidos en mobile; form de reintegro: inputs 50/50 en mobile (`basis-[calc(50%-0.25rem)] sm:flex-none`).

## 6. Ajustes

- [x] 6.1 `settings/categories/.../icon-picker.tsx` (:53): verificado-OK. `grid-cols-6` de botones `w-9` ≈ 244px entra en el Popover (clampado a ~280–296px); no desborda. Sin cambio.
- [x] 6.2 `settings/categories/_components/color-picker.tsx`: verificado-OK. `flex-wrap` de swatches `w-7` envuelve a varias filas sin desbordar (comportamiento esperado). Sin cambio.

## 7. Dashboard (pulido)

- [x] 7.1 Los 4 CardHeader `flex-row` → `flex-col items-start ... sm:flex-row sm:items-center sm:justify-between`: `spent-this-month-section.tsx` (:52), `hero-skeleton.tsx` (:34), `month-balance-skeleton.tsx` (:42), `spending-skeleton.tsx` (:32). Matchean a los reales (`month-balance-section`/`spending-section`/`accounts-card`) que ya apilan.
- [x] 7.2 `dashboard/_components/month-navigator.tsx` (:51): verificado-OK. Vive en fila propia en mobile (`dashboard-header` es `flex-col sm:flex-row`, wrapper `flex-1`); el contenido `nowrap` (~180px) entra en ~240px. `whitespace-nowrap` es correcto (no cortar el mes). Sin cambio.

## 8. Barrido de cobertura y verificación

- [x] 8.1 Recorrer cada ruta autenticada a 320/360/390px y anotar/arreglar cualquier overflow no listado. [**Sin barrido visual en vivo**: cobertura por lectura de markup ruta por ruta (secciones 1–7) más la auditoría multi-agente de la sección 9. Decisión explícita del usuario de cerrar sin devtools.]
- [x] 8.2 Re-chequear las mismas rutas a ≥768px para confirmar cero regresiones de desktop. [**Sin confirmación visual**: garantía estructural — todos los cambios son mobile-first y reinyectan el valor desktop previo en `sm:`/`md:`/`lg:`; ningún cambio altera el render ≥768px salvo 4.4 (sidebars `md:`→`lg:`, intencional).]
- [x] 8.3 Correr `pnpm typecheck` y `pnpm lint` y dejar el build verde. ✅ ambos verdes.
- [x] 8.4 Archivar el change (OpenSpec) y sincronizar specs. [El código ya viajó a `main` en `8302fe8`; el archive/sync va en commit propio.]

## 9. Auditoría multi-agente (2ª pasada, a 360px)

Fan-out de 6 agentes (1 por módulo: cuentas, tarjetas, transactions, compartido, dashboard+settings, ui+chrome). Falsos positivos descartados tras verificar contra el código: grid de cuenta-corriente (ya colapsa a 3 cols en mobile; el "394px" es el breakpoint `sm:`), icon-picker (entra en popover clampado), `button` nowrap (intencional), month-navigator (ver 7.2), settle-form input (ya gateado `text-[32px] sm:text-[42px]`), filas de settings `px-[18px]` (18px es padding mobile razonable, no churn).

- [x] 9.1 Padding de drawers `px-7` → `px-5 sm:px-7` (header/body/footer) en los que faltaban: `movement-form`, `create-card-form`, `edit-card-form`, `create-category-form`, `edit-category-form`, `create-subcategory-form`, `name-edit-drawer`, `default-split-edit-drawer`. (Cuentas y `create-recurrence-modal` ya estaban.)
- [x] 9.2 Cards de overview `px-7 py-6` → `px-5 py-6 sm:px-7`: `category-spending-overview.tsx` + `category-spending-overview-container.tsx`.
- [x] 9.3 Títulos de drawer `text-[25px]` → `text-[20px] sm:text-[25px]` (todos con `truncate`): los 8 drawers de 9.1 + cuentas (×2) + `create-recurrence-modal`.
- [x] 9.4 Montos/heros sin escalar: `recurrence-detail` (`text-[32px]`→`text-[24px] sm:`), shared home tile de deuda (`text-[26px]`→`text-[22px] sm:`) y `gap-x-8`→`gap-x-4 sm:gap-x-8`, `account-form-ui` preview (`text-[26px]`→`text-[20px] sm:`), `account-detail-header` nombre (`text-[25px]`→`text-[20px] sm:`).
- [x] 9.5 Skeletons de saldo `w-56` → `w-40 sm:w-56`: `account-detail-header` + `accounts/[id]/loading`.
- [x] 9.6 `recurring-tabs.tsx`: las 3 pills (`inline-flex w-fit`) podían empujar el ancho de página → envueltas en `overflow-x-auto` + botones `shrink-0` (scroll horizontal de fallback).
