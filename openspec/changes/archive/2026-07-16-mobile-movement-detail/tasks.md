# Tasks — mobile-movement-detail

## 1. Extracción de reads a `@grana/transactions` (Decisión 1, 2)

- [x] 1.1 Mover `getTransactionDetail`, `getInstallmentFamily`, `getReimbursementsForExpense` (+ tipos de retorno) de `apps/web/lib/transactions/queries.ts` a `packages/transactions/src/queries.ts`, retipando el cliente de `DbClient` a `GranaSupabaseClient`. Reusar el `TRANSACTION_SELECT` / `attachLinkedExpenses` que ya viven en el package.
- [x] 1.2 Exportarlos desde `packages/transactions/src/index.ts`.
- [x] 1.3 Refactorizar web a consumir desde `@grana/transactions`: `apps/web/lib/transactions/queries.ts` re-exporta o se borra, `[txId]/page.tsx` importa del package. Sin cambio de comportamiento.
- [x] 1.4 `pnpm --filter web test` verde (468), `pnpm --filter web typecheck` verde, `@grana/transactions` es source-only (lo typechequean sus consumidores; web verde lo valida).

## 2. Split compartido: mirror thin en mobile (Decisión 1)

- [x] 2.1 Espejar `getMovementSharedInfo` + el tipo `MovementSharedInfo` en `apps/mobile/lib/shared/queries.ts` (mismo patrón que el household read; sin extraer al package). Sólo lo que el tile de reparto necesita.

## 3. Pantalla de detalle mobile (Decisión 3, 5)

- [x] 3.1 Read de la pantalla: hook/query nativo que arma el detalle (transacción + familia de cuotas + reintegros + shared info) vía los reads extraídos + el mirror, keyed por `txId`. (`getMovementDetail` en `apps/mobile/lib/transactions/queries.ts`.)
- [x] 3.2 `apps/mobile/app/(app)/transactions/[txId].tsx`: `PageHeader` con back que resuelve `?from=account:<id>` / `?from=card:<id>` / pop-al-feed; chrome visible desde el primer paint (Spinner debajo del header, sin taparlo).
- [x] 3.3 **Hero** tonal: banda por `Tone` (mapeo a clases NativeWind terracotta/emerald/slate), ícono de categoría (emoji o fallback lucide), monto grande con signo (`−`/`+`/sin signo) + `showCents`, línea de contexto (`flow.*`), chips (fecha · medio · categoría · subcategoría). Eyebrow "Transferencia interna" en transferencias.
- [x] 3.4 **Tiles core por tipo** en `apps/mobile/components/transactions/detail/` (RN sobre `transactions.detail.*`): medio de pago; progreso de cuotas (barra pagadas/restantes + próxima/fin); flujo transferencia/cambio (origen → destino) + callout; reintegro-neto (pagaste + reintegro = neto, gasto vinculado tappable); reparto compartido ("Te toca pagar" + "Dividido entre"); descripción.
- [x] 3.5 Degradación: para kinds cuyos tiles se difieren (recurrencia, peso-en-el-mes, composición de resumen) la pantalla omite esos tiles sin romper (rama genérica renderiza medio de pago + detalle, sin filas de composición/recurrencia).

## 4. Filas navegables (Decisión 4)

- [x] 4.1 Agregar un prop opcional de navegación (`onPress` por fila / `onPressMovement` en la lista) a `apps/mobile/components/movements/MovementRow.tsx` y enhebrarlo por `MovementList.tsx`. Default sin prop = fila flat (los panes account/card no cambian).
- [x] 4.2 La tab Movimientos (`apps/mobile/app/(app)/transactions/index.tsx`) cablea el handler para `router.push('/transactions/[id]')` (back del detalle popea al feed).

## 5. Verificación

- [x] 5.1 Typecheck web + mobile en verde (`@grana/transactions` es source-only, lo valida el typecheck de sus consumidores); `pnpm --filter web test` verde (468); lint mobile/web verde (salvo warning pre-existente `gen-icons.mjs`).
- [x] 5.2 Cero keys i18n nuevas; diff de `@grana/i18n-messages` vacío. Cambios de `apps/web` sólo el re-apuntado de imports en `lib/transactions/queries.ts` (−86/+11, sin cambio de comportamiento).
- [x] 5.3 Smoke en device: tocar una fila del feed abre el detalle; hero tonal correcto por tipo; back popea al feed; tiles correctos para gasto simple, consumo/cuotas de tarjeta, ingreso, transferencia/cambio, gasto compartido y gasto con reintegro (gasto vinculado tappable); kinds con tiles diferidos no rompen. _(validado por el usuario)_
