# Tasks — Deshacer el pago de un resumen

Branch sugerida: `fix/revert-card-statement-payment`

## 1. Base de datos (migración 0050)

- [x] 1.1 Agregar `period_payments.stamp_tax_transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL` + índice parcial.
- [x] 1.2 Sin backfill: los pagos existentes quedan en `NULL` a propósito (ver design, Decisión 3). **Refinamiento**: se agregó `stamp_tax_link_known` (default `true`, `false` para las filas preexistentes) para que un `NULL` en un pago nuevo signifique "no hubo sello" y no habilite la heurística.
- [x] 1.3 Crear la RPC `revert_card_period_payment(p_period_id UUID)` `SECURITY INVOKER`, con el orden del design (Decisión 4): verificar propiedad → guarda cronológica → borrar `period_payments` → `paid → pending` del período → borrar sello → borrar gasto-débito.
- [x] 1.4 Guarda de orden cronológico: si existe un período de la misma tarjeta con `start_date` mayor y con fila en `period_payments`, lanzar `SQLSTATE 'GRN02'` con el dato del período bloqueante. El cierre del período bloqueante viaja en `DETAIL` para que la app lo nombre sin parsear el mensaje.
- [x] 1.5 Resolución del sello dentro de la RPC: por `stamp_tax_transaction_id` si está seteado; si no, fallback heurístico (mismo `card_period_id`, subcategoría `impuesto-de-sellos`) que borra **solo si hay exactamente un candidato**. Devolver una señal de "sello ambiguo, no borrado" para que la UI la comunique.
- [x] 1.6 Definir el valor de retorno de la RPC (monto revertido, cantidad de movimientos vueltos a pendiente, sello borrado / ambiguo / inexistente) para alimentar el feedback. → `jsonb` con `reverted_amount`, `payment_account_name`, `movements_reverted`, `stamp_tax`.
- [x] 1.7 `GRANT EXECUTE` a `authenticated` y verificar que la RLS del invoker efectivamente restringe (probar con la tarjeta de otro usuario). *(GRANT + chequeo explícito de propiedad hechos; la prueba cross-user va en QA 6.x.)*
- [x] 1.8 Tipos de `period_payments` (2 columnas nuevas + FK) y de la RPC en `packages/supabase/src/types.ts`. Se escribieron a mano para desbloquear el código (la 0050 todavía no estaba aplicada) y **se verificaron contra `supabase gen types` una vez aplicada**: coinciden exactamente, incluido el nombre `period_payments_stamp_tax_transaction_id_fkey` y `Returns: Json` de la RPC. No se pisó el archivo con la salida cruda para no arrastrar drift preexistente ajeno al change (ver nota en 7.2).

- [x] 1.9 *(no estaba en el plan)* Test estático de la migración en `apps/web/lib/cards/__tests__/revert-payment-migration.test.ts`, siguiendo la convención de 0043/0048/0049: asserts sobre `SECURITY INVOKER`, orden de los deletes, guarda `GRN02` + `DETAIL`, sello no ambiguo, y que la RPC **no toca el calendario** (`card_periods`, `is_estimated`, `stamp_tax_rate`).

## 2. Paquete `@grana/cards`

- [x] 2.1 `pay-card-period.ts`: al insertar el sello, persistir `stamp_tax_transaction_id` en el `INSERT` de `period_payments` (paso 3). Cuidar el rollback existente. *(El insert ya es el último paso: si falla, el rollback existente borra sello y gasto — nada que ajustar.)*
- [x] 2.2 Nueva mutación `revertCardPeriodPayment({ supabase, periodId })` en `packages/cards/src/revert-card-period-payment.ts`, que invoca la RPC y mapea errores a `messageKey`/`errorCode` neutros. *(Sin `userId`: la RPC lo toma de `auth.uid()` y verifica propiedad server-side, así que pasarlo sería decorativo.)*
- [x] 2.3 Mapear `GRN02` a `cards.errors.revert_later_period_paid` con `messageParams` del período bloqueante (leído de `error.details`).
- [x] 2.4 Exportar desde `packages/cards/src/index.ts` — no desde `mutations.ts`: se siguió el patrón de `payCardPeriod` (archivo propio + export en el índice), que es el vecino más parecido.
- [x] 2.5 Tests unitarios de la mutación con cliente mockeado: éxito, `GRN02` (con y sin detalle), período sin pago, tarjeta ajena, sello ambiguo, error desconocido, payload nulo. **8 tests; suite del paquete 73/73 verde.**

## 3. Web — acción y UI

- [x] 3.1 Server action `revertCardPeriodPayment` en `apps/web/app/_actions/credit-cards.ts`, thin wrapper sobre la mutación + `revalidateAfterMovementMutation()` (cubre dashboard, transactions, accounts, cards y shared).
- [x] 3.2 En el detalle de período (`/cards/[id]/periods/[periodId]`), acción "Deshacer pago" junto a la info del pago, solo si `has_payment`. Componente `_components/revert-payment-action.tsx`.
- [x] 3.3 Diálogo de confirmación que enumera efectos con números reales: monto + nombre de la cuenta, cantidad de movimientos que vuelven a pendiente (plural i18n), sello si existe, y la aclaración de que las fechas confirmadas del ciclo se mantienen. **Requirió extender `getCardPeriodDetail`/`getCardPeriods`** con `paymentAmount`, `paymentAccountName` y `paymentHasStampTax` (el detalle solo traía la fecha del pago).
- [x] 3.4 Feedback del caso "sello ambiguo": aviso persistente bajo la acción tras una reversión que dejó el sello sin borrar.
- [x] 3.5 La acción vive en la page del route-group `(overview)`, no en el layout — `/pay` no la hereda.

## 4. Web — guarda en el borrado de movimientos

- [x] 4.1 En `deleteTransaction` (`apps/web/app/_actions/transactions.ts`), guarda que detecta la fila de `period_payments` con ese `transaction_id` y rechaza con mensaje que redirige al período, junto a las guardas de cuota hija / consumo pagado / settlement. *(Sin `redirectTo`: `ActionResult` no lo soporta y agregarlo por un solo caso no se justifica — el mensaje nombra el destino.)*
- [x] 4.2 En el detalle del movimiento, el diálogo de un pago de resumen explica **dónde** se deshace y NO ofrece confirmación destructiva (el botón "Sí, eliminar" no se renderiza; "Cancelar" pasa a "Entendido").
- [x] 4.3 Copy `delete_warning_card_payment` eliminado (es/en) y reemplazado por `delete_blocked_card_payment`. Cero usos restantes.
- [x] 4.4 `DetailActions` es el único host del borrado: la page `/transactions/[txId]` y el drawer (`global-transaction-detail.tsx`, que ya pasa `isCardPayment`) comparten el componente, así que la guarda vale en ambos.

## 5. i18n

- [x] 5.1 Mensajes nuevos en `es.json` y `en.json`: `cards.actions.revert_payment`, bloque `cards.revert.*` (título, intro, 3 efectos con plural, aclaración de fechas, confirmación, aviso de sello ambiguo), `cards.errors.{period_not_paid,revert_failed,revert_later_period_paid}`, y `transactions.detail.actions.{delete_blocked_card_payment,got_it}`.
- [ ] 5.2 Reiniciar `pnpm dev` al probar claves nuevas (el JSON del paquete no recompila con HMR). *(Al hacer el QA del bloque 6.)*

## 6. QA con data real

> **DIFERIDO al cierre (2026-07-27).** El código está completo y verde (typecheck +
> `pnpm test` 484/484 + `@grana/cards` 73/73 + self-check de la migración 0050 en la
> base remota). El QA con 2 usuarios y data real lo corre el usuario antes del merge
> ff-only; ninguno de estos 8 casos está verificado en vivo todavía. Reiniciar
> `pnpm dev` antes de probar (claves i18n nuevas, sin HMR).

- [ ] 6.1 Pago simple sin sello: deshacer → movimientos a pendiente, saldo de la cuenta recuperado, resumen impago, pendiente de la tarjeta correcto.
- [ ] 6.2 Pago con sello (vinculado): deshacer → el sello desaparece del período.
- [ ] 6.3 Pago con cuotas en el período: las cuotas vuelven a pendiente y la madre no se altera.
- [ ] 6.4 Deshacer y volver a pagar: el flujo de pago pre-carga las fechas ya confirmadas y la alícuota de sellos aprendida.
- [ ] 6.5 Guarda cronológica: pagar dos resúmenes seguidos e intentar deshacer el más viejo → mensaje que nombra el resumen a deshacer primero.
- [ ] 6.6 Pago viejo (pre-migración) con sello: verificar el fallback heurístico y el caso ambiguo con un sello cargado a mano.
- [ ] 6.7 Detalle del movimiento: "Eliminar" sobre el pago redirige y no rompe; el copy viejo ya no aparece.
- [ ] 6.8 Verificar que el resumen deshecho vuelve a contarse en el bloque "Comprometido" del dashboard.

## 7. Cierre

- [x] 7.1 `pnpm typecheck` limpio + `pnpm test` **484/484** (44 archivos; incluye los 16 asserts estáticos sobre la migración 0050) + `@grana/cards` **73/73**.
- [x] 7.2 Migración 0050 aplicada en el proyecto remoto (`✓ 0050 revert card period payment applied`, self-check pasado).

  **Drift preexistente detectado al diffear `gen types`** (ajeno a este change, NO se toca acá): el `types.ts` versionado difiere del remoto en `user_guidance_events.created_at/updated_at` (el remoto los tiene nullable) y le falta la RPC `shares_household_with`. Candidato a una limpieza propia.
- [x] 7.3 Archivar el change (OpenSpec) y sincronizar las master specs `cards` y `transactions` **en la branch**, antes del merge. → 4 requirements ADDED a `cards`, 1 MODIFIED en `transactions`; `openspec validate --specs` 25/25 verde; change movido a `archive/2026-07-27-revert-card-statement-payment/`.
- [ ] 7.4 Squash commit + merge ff-only (lo hace el usuario). *(Commit squasheado creado en la branch el 2026-07-27; el merge ff-only lo hace el usuario tras el QA del bloque 6.)*

## 8. Handoff mobile (no se implementa acá)

- [x] 8.1 Contrato documentado acá para el tech lead. Lo lleva él; web no toca `apps/mobile`.

**Qué queda listo para consumir desde mobile**

```ts
import { revertCardPeriodPayment, type RevertPaymentSummary } from '@grana/cards'

const result = await revertCardPeriodPayment({ supabase, periodId })
// ok:    { ok: true, summary: { revertedAmount, paymentAccountName, movementsReverted, stampTax } }
// error: { ok: false, messageKey, messageParams?, errorCode? }   ← sin texto traducido
```

- **Sin `userId`**: la RPC lo toma de `auth.uid()` y verifica propiedad server-side.
- **Toda la atomicidad es de la base**: no hay que orquestar ni hacer rollback en el cliente.
- **`messageKey`** resuelve contra `@grana/i18n-messages` (`cards.errors.*`), ya con las 3 claves nuevas en es/en. `revert_later_period_paid` viene con `messageParams.date` ya formateado `dd/mm/yyyy`.
- **`summary.stampTax === 'ambiguous'`** obliga a avisar al usuario que quedó un movimiento de sello sin borrar (copy `cards.revert.stamp_tax_ambiguous`).
- Los datos para la confirmación (`paymentAmount`, `paymentAccountName`, `paymentHasStampTax`) ya viajan en `CardPeriodDetail`, que mobile ya consume.
- Falta solo la UI nativa: acción en el detalle de período + diálogo que enumere efectos (el bloque i18n `cards.revert.*` está completo).
