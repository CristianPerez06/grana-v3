## 1 · i18n (es.json + en.json)

- [x] 1.1 Reusar la clave existente `shared.dashboard.your_share` ("Tu parte: {amount}") para la línea secundaria. (No se agrega clave nueva; la iteración a total-protagonista dejó sin uso el `of_total` que se había probado.)
- [x] 1.2 Eliminar las claves ya sin uso: `shared.dashboard.your_part`, `shared.dashboard.partner_part`, `shared.dashboard.total_label`, `shared.dashboard.reimbursement_label`. (Verificado: solo se usaban en `shared/(home)/page.tsx`; mobile no las referencia.)
- [x] 1.3 Mantener paridad de keys entre es.json y en.json.

## 2 · Render de la fila (`apps/web/app/(app)/shared/(home)/page.tsx`)

- [x] 2.1 Reemplazar el cálculo de `perspectiveAmount`/`perspectiveLabel` por dos cifras fijas: total protagonista + parte propia secundaria; sin label dependiente del pagador.
- [x] 2.2 Reintegro: total del reintegro como protagonista (tono verde/pending, signo `+`/'' según `reimbursementState`), "Tu parte" debajo.
- [x] 2.3 Monto grande = `sign + fmtMoney(e.amount, currency)` (el total), tono por tipo.
- [x] 2.4 Leyenda secundaria = `your_share` con `e.ownShare`, **solo** cuando `ownShare ≠ amount` (hubo reparto real).
- [x] 2.5 Confirmar que el subtítulo izquierdo ("Pagaste" / "Pagó {nombre}") queda intacto.

## 3 · Verificación

- [x] 3.1 `pnpm typecheck` y `pnpm lint` (o los scripts del repo) verdes.
- [x] 3.2 `openspec validate shared-recent-mi-consumo` sin errores.
- [ ] 3.3 **Evaluación en la app** (el objetivo del usuario): con un hogar de dos miembros, revisar en `/shared` los cuatro casos — gasto pagado por vos, gasto pagado por el otro, reintegro recibido, y (si aplica) un split 100/0. Confirmar que todas las filas leen "cuánto me costó a mí" de forma consistente y que la suma cuadra con el desglose.

## 4 · Cierre

- [ ] 4.1 Archivar el change (mover a `openspec/changes/archive/`) y sincronizar el spec base `openspec/specs/shared/spec.md` **en la branch, antes del merge**.
