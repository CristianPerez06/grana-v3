## Fase A · Cuenta corriente (lectura) — B9, B12

- [x] A.1 `packages/money-logic/src/shared.ts`: función pura `deriveCurrentAccount(splits, settlements, currency, asOf, memberA, memberB)` que produce los asientos cronológicos (fecha, label, importe firmado, "qué cambia", estado, saldo corriente) + los agregados de la ecuación. Reusa el gating existente. El saldo final IGUALA `householdDebtAt`.
- [x] A.2 Tests en `packages/money-logic` (o `apps/web/lib/shared/__tests__`): el saldo final del extracto == `householdDebtAt`; signos correctos por quién pagó; reintegro reduce; orden cronológico; ecuación suma el saldo; ARS y USD por separado.
- [x] A.3 `apps/web/lib/shared/queries.ts`: `getCurrentAccount(supabase)` que arma extracto + ecuación + saldo + proyección (reusa `collectDebtInputs` y `getHouseholdOutlook`), por moneda.
- [x] A.4 Ruta `apps/web/app/(app)/shared/cuenta-corriente/` (page + componentes): cards de saldo bimoneda, ecuación colapsable, extracto con estados, divisor "Hoy", tramo "Lo que se viene", selector ARS/USD. Recrear el handoff con componentes del repo (no copiar HTML). Responsive (breakpoint 560px).
- [x] A.5 Acceso a la cuenta corriente desde la home (link/CTA).

## Fase B · Contraasiento — B2, B9

- [x] B.1 Migración `supabase/migrations/00XX_settlement_contraasiento.sql`: estado `reversed` en `settlement` (+ `reversed_at`, `reverses_settlement_id` self-ref); ajustar el CHECK de status.
- [x] B.2 Reescribir `reverse_settlement` (`SECURITY DEFINER`): en vez de borrar, marcar la original `reversed`, insertar par de patas opuestas (settlement-type) que restauran `disponible`, e insertar la fila `settlement` de contraasiento (sentido invertido, `reverses_settlement_id`). Self-check + summary.
- [x] B.3 Regenerar tipos (`supabase gen types`).
- [x] B.4 `deleteSettlement` (action): la rama "completed" sigue llamando `reverse_settlement` (ahora contraasiento); ajustar copy si aplica. La rama "pending" no cambia.
- [x] B.5 La derivación del extracto (A.1) etiqueta `Revertida` (original) y `Contraasiento` (la opuesta) por estado; verificar que original + contraasiento netean cero en la deuda.
- [x] B.6 Tests estáticos sobre el SQL de la migración (estado reversed, RPC preserva/no borra) + test de derivación con un par revertido.

## Fase C · Home rediseñada — B8, A2, A3

- [x] C.1 `apps/web/app/(app)/shared/(home)/page.tsx`: hero "Gasto del hogar · neto" (A3: neto protagonista = gastaron − reintegros recibidos; bruto/reintegros al costado). Calcular el neto devengado (extender Paso 2 con reintegros recibidos del mes).
- [x] C.2 Sacar la deuda del hero (B8): franja/tile propia fija en "hoy", con accesos Saldar + Cuenta corriente. Conservar el drill inline de "En qué gastaron" (ARS+USD del Paso 2).
- [x] C.3 A2: confirmar que el navegador de mes solo afecta el gasto/desglose; deuda y proyección a hoy (independientes). Ajustar si algo se movía con el navegador.
- [x] C.4 "Lo que se viene" como tile de proyección (reusa `getHouseholdOutlook`).

## Fase D · Saldar como drawer — B10, B11

- [x] D.1 Convertir `/shared/settle` en un `Drawer` (overlay-primitives) disparado desde home/cuenta corriente (puente como el alta de movimiento). Conservar la validación y el aviso de saldo negativo (Paso 2).
- [x] D.2 Montos rápidos (B11): botón Total + parciales; el resto queda en la cuenta corriente (copy claro del restante).
- [x] D.3 Anotación pedagógica (B10): preview del monto por persona + "la parte de {otro} se registra como deuda a tu favor", sin recargar el form.
- [x] D.4 Superficies del flujo (enviado → tarea del receptor → recibo) apoyadas en `settlement` + `confirm_settlement` (Paso 1) y los estados; reusar `PendingSettlementCard`.

## Cierre (en la rama, antes del merge)

- [x] Z.1 `pnpm typecheck` · `pnpm lint` · `pnpm test` verde en cada fase.
- [x] Z.2 QA integral del Paso 3 (+ lo pendiente de Pasos 1-2) con dos usuarios. Reportes por ID; fixes en la rama.
- [x] Z.3 Archivar el change (mover a `archive/AAAA-MM-DD-...`, aplicar deltas al master spec; este change se archiva DESPUÉS de los Pasos 1-2). Verificar higiene de spec. El merge lo hace el usuario.
