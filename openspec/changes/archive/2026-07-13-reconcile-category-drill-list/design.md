# Design — reconcile-category-drill-list

## Contexto y decisión central

El donut de "En qué se fue" y la lista drilleada hoy salen de **dos fuentes distintas** con **dos lentes contables distintas**:

```
   DONUT  getMonthCategoryBreakdown         LISTA  get_movements_page (RPC)
   ─────  CONSUMO / devengado               ─────  CAJA / ledger
   · cuota por mes de vencimiento           · madre por fecha de compra
   · is_parent excluido                     · hijas ocultas (parent_id is null)
   · TU PARTE de compartidos                · monto ENTERO
   · parte 0 excluida                       · parte 0 se muestra
   · reintegros netean en la categoría      · reintegros como filas recibidas
```

Un click-para-filtrar **promete igualdad** ("estos movimientos forman ese número"). La doctrina general del producto (`spending-accrual-and-lenses`) es "las lentes difieren a propósito, se rotula no se iguala" — pero esa doctrina nació para **cards que conviven** y no se prometen nada. Un drill sí promete. Por eso acá la decisión es **reconciliar**.

**Habilitador clave (verificado en `register-installments.ts:155-178`):** las cuotas hijas ya son transacciones reales (`date` = vencimiento, `amount` = cuota, `category_id` heredado, `installment_n`/`installments_total`, y su propio `shared_expense_split`). Es decir: la lista devengada no fabrica filas sintéticas — muestra filas reales que hoy están **ocultas** por `parent_id is null`. El detalle al clickear funciona sin costurón.

## Opciones consideradas

| Opción | Qué hace | Por qué NO |
|---|---|---|
| **A. Fork de `get_movements_page`** | Nueva variante de la RPC en "modo devengado por categoría" | Duplica una RPC general grande (paginación, búsqueda, filtros de cuenta, toggle compartidos); dos caminos SQL a mantener; riesgo de drift entre ambos. |
| **B. Rotular sin reconciliar** | Etiqueta "el gráfico usa consumo devengado, la lista muestra tus movimientos reales" | El número sigue sin sumar; el rótulo justifica una promesa rota en vez de cumplirla. Descartada por el usuario. |
| **C (elegida). Lista devengada desde la misma fuente que el donut** | Query hermana que retiene las líneas del breakdown; la lista drilleada la consume | Una sola fuente de verdad para el número **y** sus piezas → imposible que desincronicen. No toca la RPC general. Sin migración. |

## Arquitectura (Opción C)

```
   packages/dashboard/src/queries.ts
   ┌─────────────────────────────────────────────────────────┐
   │  helper de agregación compartido                        │
   │  (reglas de la lente CONSUMO: cuota por vencimiento,    │
   │   tu parte, parte 0 fuera, pago de resumen fuera,       │
   │   reintegro linkeado a su categoría)                    │
   └───────────────┬─────────────────────────┬───────────────┘
                   │                         │
        getMonthCategoryBreakdown     getMonthCategoryLines  ← NUEVA
        → SUMA por categoría          → LÍNEAS por categoría
        → alimenta el DONUT           → alimenta la LISTA drilleada
```

La clave de la no-regresión es que **ambas derivan del mismo cómputo de `aggRows`**. Hoy `getMonthCategoryBreakdown` construye `aggRows` (línea ~285) y luego `computeCategoryNet` los suma. La query nueva construye los mismos `aggRows` filtrados a una categoría y los **proyecta a líneas de UI** en vez de sumarlos. Idealmente se extrae el armado de `aggRows` a un helper reusado por ambas, para que una sola definición de "qué compone una categoría" gobierne el donut y la lista.

### Firma propuesta

```
getMonthCategoryLines(
  supabase,
  month: string,          // 'YYYY-MM'
  categoryId: string,     // categoría activa (UNCATEGORIZED_ID válido)
  currency: 'ARS' | 'USD',
  subcategoryId?: string, // opcional: drill a subcategoría
): Promise<CategoryLine[]>
```

```
type CategoryLine = {
  txId: string            // transacción REAL (cuota hija, gasto, o reintegro)
  kind: 'expense' | 'reimbursement'
  title: string
  date: string            // fecha contable/devengada (de la cuota hija en cuotas)
  displayAmount: number   // TU PARTE en compartidos; negativo en reintegros
  currency: 'ARS' | 'USD'
  installment?: { n: number; total: number }  // badge "3/6"
  isShared: boolean
}
```

**Invariante de reconciliación:** `Σ line.displayAmount` (para una categoría/moneda) `===` el `value` de esa categoría en `getMonthCategoryBreakdown` para el mismo mes/moneda. Esto se cubre con un test.

## Reglas por caso (confirmadas con el usuario)

### Cuotas
La lista muestra la **cuota hija del mes** ("Notebook 3/6 · $100.000"), no la compra madre. La hija ya tiene `date` = vencimiento, `amount` = cuota, `installment_n/total`. La madre (`is_parent`) nunca aparece (igual que en el donut).

### Compartido — tu parte
`displayAmount` = `shared_expense_split.amount_assigned` del usuario (mismo criterio que el donut, filtrando por su `user_id` porque la RLS expone ambos miembros). En cuotas compartidas, cada hija tiene su split → la cuota del mes ya trae tu parte.

### Compartido parte 0 (100% del otro)
No aparece en el drill (el usuario no tiene split → `ownPortion` null → se omite), consistente con el donut. En la lista **general** sí seguiría apareciendo (es tu transacción) — pero la lista general no cambia.

### Reintegros — dos filas que netean
El gasto y el reintegro recibido se muestran como **filas separadas**; el reintegro con `displayAmount` negativo. Su suma iguala el peso del donut:

```
SALUD  (donut: $7.000)
─────────────────────────────
🏥 Consulta médica      $10.000
↩️ Reintegro obra social  −$3.000
─────────────────────────────
Σ displayAmount:         $7.000   ← == valor de la slice
```

Decisión: **dos filas**, no una fila ya neteada — es más transparente (se ve el gasto original y la devolución por separado). El reintegro hereda la categoría del gasto linkeado (igual que en el donut).

**Categorías en crédito:** si el neto de la categoría es negativo (reintegros > gasto del mes), hoy el donut la saca de la dona y la muestra como "te devolvieron". El drill a una categoría-crédito queda fuera del camino principal de este change (no es una slice clickeable de la dona); si se accede vía ranking, la lista igualmente sumará el neto negativo de forma consistente. Se documenta como comportamiento derivado, sin UI dedicada en este change.

## Detalle / drawer al clickear una fila

Como cada `CategoryLine.txId` es una transacción real:
- Cuota 3/6 → el detalle muestra esa cuota ($100.000). Coincide con la fila.
- Súper compartido → el detalle muestra el total ($10.000) + "tu parte $5.000". El detalle **explica** la diferencia entre `displayAmount` (tu parte) y el `amount` crudo; no la contradice.
- Reintegro → el detalle del reintegro recibido, como hoy.

No se introduce un costurón fila-vs-detalle: el detalle es la verdad cruda, la fila drilleada es la lente devengada, y la relación entre ambas es legible.

## Consideraciones de UI

- La lista drilleada **reusa la fila de movimiento existente** apuntando al `txId` real, con dos overrides: monto mostrado (`displayAmount`) y badge de cuota. No es una lista "paralela" con su propio detalle.
- En el drill probablemente **no se necesita** paginación/búsqueda/filtros de cuenta (una categoría-mes tiene pocas filas). Si el volumen lo exige, se pagina en cliente sobre el array; no se replica el aparato de `get_movements_page`.
- Al limpiar la categoría (breadcrumb / "‹ Volver" / click en el donut drilleado), la lista vuelve a `get_movements_page` (comportamiento general de siempre).

## Riesgos

- **Drift de lente** entre la query nueva y el donut: se mitiga con el helper de `aggRows` compartido + un test de invariante de reconciliación.
- **Multimoneda**: la lista drilleada es por moneda (igual que el donut); el click ya fija la moneda visualizada (`onSelectCategory` dispatch `setCurrency`).
- **Cache**: `@grana/dashboard` requiere restart del dev server al QA-ear (memoria `spending-accrual-and-lenses`), no alcanza un hard reload.

## Fuera de alcance

Listado general (sin cambios), `apps/mobile`, dashboard, agregar reintegro a gasto existente (#3), UI dedicada de drill a categorías-crédito.
