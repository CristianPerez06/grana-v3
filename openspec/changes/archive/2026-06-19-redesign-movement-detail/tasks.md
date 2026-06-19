## 1. Tono y base de estilos

- [x] 1.1 Definir el contenedor raíz del detalle con `data-tone` y las CSS vars `--tone/--tone-soft/--tone-deep` mapeadas a tokens existentes de `@grana/ui-tokens` (gasto→terracotta, ingreso→emerald-deep, transfer→slate)
- [x] 1.2 Auditar `panel.css` vs `@grana/ui-tokens`: listar tokens del handoff sin equivalente (amber-soft, plum, field, faint, etc.) y agregarlos a `ui-tokens` si faltan (sin inline hex sueltos)
- [x] 1.3 Helper de medio de pago: `account.type` (cash/bank/credit) → { label, badge color, sub } sin exponer número de tarjeta

## 2. Bloques de anatomía

- [x] 2.1 `detail-topbar`: botón Volver (resuelve `from`) + slot de acciones; desktop Editar (sólido navy) + Eliminar (icon button)
- [x] 2.2 Topbar mobile: sticky, acciones secundarias en menú "···", Editar en barra inferior fija full-width (safe-area)
- [x] 2.3 Integrar la lógica de editar/eliminar (drawer + AlertDialog contextual + invalidación) en el nuevo layout sin cambiar su comportamiento
- [x] 2.4 `detail-hero`: banda con `radial-gradient` tonal, ícono de categoría (88/72px) con emoji o lucide por kind, monto tonal con símbolo opaco + decimales por `showCents`, eyebrow (transfer), título, línea de contexto
- [x] 2.5 `hero-chips`: fecha · medio de pago (chip tonal) · categoría · subcategoría
- [x] 2.6 `glance-grid` + `tile` base (card, eyebrow, aside, span-2) con paddings/radios exactos de panel.css

## 3. Tiles por tipo

- [x] 3.1 `tile-payment-method` ("Pagado con"): badge + nombre + sub (tipo) + meta opcional
- [x] 3.2 `tile-detail` ("Detalle"): filas clave/valor (fecha, total, valor cuota, origen, estado, etc.) según kind
- [x] 3.3 `tile-description` ("Descripción"): texto libre; edición vía acción global "Editar"
- [x] 3.4 `tile-month-weight` ("Peso en el mes"): ring SVG + % + rank + copy; calcula desde el breakdown mensual
- [x] 3.5 `tile-installments` ("En cuotas"): barra pagadas/restantes, valor por cuota, próxima fecha, fecha fin (deriva de `getInstallmentFamily`)
- [x] 3.6 `tile-shared` ("Te toca pagar" + "Dividido entre"): ownShare + personas con su parte, SIN badge de estado (TODO marcado)
- [x] 3.7 `tile-reimbursement-net` ("Resultado neto"): pagaste + reintegro = costo neto + movimiento(s) vinculado(s) clickeable(s)
- [x] 3.8 `tile-recurrence` ("Recurrencia" + "Historial de cobros"): próximo/desde/nº cobros/acumulado + barras 6 meses (deriva de `getRecurrenceDetail`)
- [x] 3.9 `tile-transfer-flow` ("Movimiento de dinero" + callout): origen→destino + aclaración "no cuenta como gasto ni ingreso" (reusa `Alert`)

## 4. Orquestación y datos

- [x] 4.1 Reescribir `GlobalTransactionDetail` como orquestador: resuelve tipo→tone y arma la lista de tiles por kind (incluye fallback genérico para exchange/adjustment/settlement/card_payment)
- [x] 4.2 `page.tsx`: sumar fetch del breakdown mensual (`getMonthCategoryBreakdown`/`getMonthIncomeBreakdown`) para el mes del movimiento (solo gasto/ingreso/cuotas categorizado)
- [x] 4.3 `page.tsx`: sumar `getRecurrenceDetail` cuando hay `recurrenceLink`; mantener el banner de recurrencia arriba del hero
- [x] 4.4 Mantener back-navigation (`from`), cuotas hermanas, reintegros vinculados y edit-context intactos

## 5. i18n

- [x] 5.1 Agregar/mapear claves `transactions.detail` (es + en) para los nuevos rótulos y copys, reusando claves existentes donde ya las había

## 6. Verificación

- [x] 6.1 Revisar visualmente los tipos (desktop y cel): QA del usuario en sesión — se ajustó ancho web (panel 760px), back duplicado, Editar icon-only y `{periodo}` del consumo de tarjeta
- [x] 6.2 Verificar kinds no-mockeados (exchange, adjustment, settlement, card_payment) usando el camino genérico sin romper
- [x] 6.3 Probar acciones: Editar (drawer y `/edit`), Eliminar (default, parent de cuotas, card payment) — QA del usuario en sesión
- [x] 6.4 Verificar que NO se muestra ningún número de tarjeta en ningún tipo (no existe en el modelo; el medio de pago solo muestra nombre + tipo)
- [x] 6.5 Correr build + lint + typecheck; cero regresiones de compilación en lista, alta (drawer) y dashboard
