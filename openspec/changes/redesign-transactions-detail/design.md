# Diseño técnico — Rediseño visual del detalle del movimiento

## Contexto

`GlobalTransactionDetail` (`apps/web/app/(app)/transactions/[txId]/_components/global-transaction-detail.tsx`) tiene hoy 348 líneas con `renderRows` por kind, manejo de cuotas hermanas, reembolsos vinculados y un layout heredado del relevamiento funcional. Este change toca la **capa visual** envolviendo esa lógica en subcomponentes nuevos. Todo lo accountable (qué campos por kind, manejo de installments, server actions de edit/delete) queda intacto.

## Decisiones técnicas

### 1. Subcomponentes nuevos, refactor del orquestador

Para no pelear con un solo archivo de 400+ líneas, parto el detalle en piezas chicas. Cada una con una responsabilidad clara:

```
[txId]/_components/
├── global-transaction-detail.tsx   ← refactor: orquesta, mantiene la lógica por kind
├── tx-hero.tsx                     ← NUEVO: hero centrado con monto display
├── tx-header.tsx                   ← NUEVO: back ícono + slot de actions
├── tx-actions-menu.tsx             ← NUEVO: kebab dropdown con Editar/Eliminar
├── tx-detail-group.tsx             ← NUEVO: card blanco con eyebrow + filas
├── tx-detail-row.tsx               ← NUEVO: fila con ícono cuadrado + label + value
└── tx-installment-rows.tsx         ← NUEVO: variant de detail row con número circular
```

`GlobalTransactionDetail` queda como orquestador: toma `transaction` + `movement` + `installmentSiblings` + `reimbursements` y decide qué subcomponentes invocar y con qué datos. La función `detailRows` actual se mantiene como helper interno que devuelve `Array<{ label, valueNode }>` y el componente la consume para alimentar `TxDetailGroup`.

### 2. `TxHero`: tono, formato de monto, decimales superscript

El monto se renderea en dos partes:

- **Currency symbol** (`$` o `US$`): a la izquierda, font-size más chico que el monto (~63% del monto), opacidad 0.6, espaciado con `margin-right: 4px`.
- **Parte entera** (`540.000`): font-size base del display (38px en mobile, 48px en desktop wider).
- **Decimales** (`,00` cuando aplica): `fontSize: 0.55em`, `verticalAlign: 0.65em`, `margin-left: 1px`, `opacity: 0.85`. Si los decimales son `00` Y el user tiene `showCents=false`, se omiten.

**Color tone**:

```ts
type Tone = 'income' | 'expense' | 'neutral' | 'pending'

const toneClass = (movement: FinancialMovement, view: MovementView): Tone => {
  if (movement.kind === 'reimbursement' && movement.state !== 'received') return 'pending'
  if (movement.kind === 'income' || movement.kind === 'reimbursement') return 'income'
  if (movement.kind === 'adjustment') return view.sign === '-' ? 'expense' : 'income'
  if (movement.kind === 'transfer' || movement.kind === 'exchange') return 'neutral'
  return 'expense'
}
```

La función `toneClass` vive en `apps/web/lib/transactions/components/tone.ts` (presentación pura, no se promueve a `@grana/money-logic` porque no es lógica contable; mobile la puede reescribir o importar con un wrapper). Tests en `apps/web/lib/transactions/__tests__/tone.test.ts` con los 8 kinds.

**Signo del monto**:

```ts
const sign = tone === 'income' ? '+' : tone === 'expense' ? '−' : ''
```

Sin signo para `neutral` ni `pending`.

### 3. `TxHeader`: back ícono solo, slot de actions

Layout: `flex justify-between items-center px-4 pt-4`. Izquierda: `<Link href={backHref}>` con ícono `ArrowLeft 20px` en `text-text`. Derecha: slot `actions` que recibe el `<TxActionsMenu>` o nada.

**Por qué Link y no botón onClick**: el back conserva el `from=` que llega por searchParams; un `<Link href={backHref}>` es Server Component-friendly y hace prefetch en hover. Botón con `router.back()` no respeta el origen explícito que la URL declara.

### 4. `TxActionsMenu`: kebab dropdown con Radix

Uso `@radix-ui/react-dropdown-menu` (ya está en el monorepo: `@radix-ui/react-slot` y `@radix-ui/react-alert-dialog` están instalados; dropdown-menu lo agrego). El trigger es un botón de 36×36 con `MoreHorizontal 20px`. Items del menú: "Editar" (link a `[txId]/edit`), "Eliminar" (abre AlertDialog).

El AlertDialog de confirmar eliminación usa copy contextual:

```ts
const deleteWarning = isCardPayment
  ? 'Al eliminar este pago, las cuotas del período volverán a pendientes. ¿Continuar?'
  : isParent
    ? 'Se van a eliminar la compra y todas sus cuotas. Esta acción no se puede deshacer.'
    : 'Esta acción no se puede deshacer.'
```

Idéntico a v2 (`TransactionMenuActions.tsx`).

**Sin Duplicar**: feature poco común en v2. Si en el futuro la pedimos, la sumamos como tercer item del dropdown.

**Visibilidad del kebab**: cuando `canEdit && canDelete` son false (el movimiento no es editable), el componente devuelve `null`. La lógica de `canEdit`/`canDelete` viene de `getEditableFields` (ya existe en `@grana/money-logic`).

### 5. `TxDetailGroup` y `TxDetailRow`: cards y filas

`TxDetailGroup`:

```tsx
<div>
  {title && <div className="px-5 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-[0.6px] text-text-soft">{title}</div>}
  <div className="mx-4 rounded-[18px] border border-border bg-card overflow-hidden">
    {children}
  </div>
</div>
```

`TxDetailRow`:

```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft last:border-b-0">
  <div className="size-8 shrink-0 rounded-[10px] bg-muted flex items-center justify-center text-text-soft">
    {icon}
  </div>
  <div className="flex-1 min-w-0">
    <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-text-soft mb-0.5">{label}</div>
    {valueNode ?? <div className="text-[13.5px] font-semibold text-text tracking-[-0.1px]">{value}</div>}
  </div>
</div>
```

Tipos en `apps/web/components/types.ts` o inline en el archivo del componente (no se promueve al contract package en esta iteración — son piezas chicas, específicas del módulo). Decisión a reevaluar si mobile necesita el mismo shape.

### 6. `TxInstallmentRows`: numeración circular + chip de estado

Variant de `TxDetailRow` con el ícono cuadrado reemplazado por un número circular:

```tsx
<div className={`size-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${stateClass}`}>
  {n}
</div>
```

`stateClass` se mapea según `child.status`:

- `'pending'` (cuota próxima a vencer del período activo) → `bg-warning-soft text-warning-deep`
- `'paid'` (cuota ya pagada) → `bg-income/14 text-income`
- Otra (cuotas futuras lejanas) → `bg-muted text-text-muted`

Cada fila tiene un chip de estado a la derecha del label/value, antes del monto. Reusa el patrón visual del chip `Recurrente` del listado pero con el color de cada estado.

### 7. Banner de recurrencia

Queda como está en `page.tsx`. NO se mueve al componente del detalle. El banner es opcional (solo aparece si la transacción tiene recurrencia vinculada).

### 7.5. `TxContextNote`: copy editorial in-context según kind

Componente nuevo y chico que se renderea **entre el `TxHero` y el primer `TxDetailGroup`**, solo cuando el `kind` + estado del movimiento lo justifica. Es texto plano editorial, NO un banner accionable. Variantes:

```ts
type ContextVariant = 'card-pending' | 'card-paid-installment' | 'card-payment' | 'reimbursement-pending' | 'reimbursement-cancelled' | null

function resolveContextVariant(movement: FinancialMovement, transaction: TransactionWithDetails): ContextVariant {
  // Card consumo / cuota hija en período no pagado
  if (transaction.account?.type === 'credit' && transaction.status === 'pending') return 'card-pending'
  // Cuota hija ya pagada (segunda en adelante, la primera se omite para no ruidear)
  if (transaction.parent_id && transaction.status === 'paid' && transaction.installment_number !== 1) return 'card-paid-installment'
  // Pago de resumen
  if (movement.kind === 'card_payment') return 'card-payment'
  // Reintegro pendiente
  if (movement.kind === 'reimbursement' && !transaction.received_at && !transaction.cancelled_at) return 'reimbursement-pending'
  // Reintegro cancelado
  if (movement.kind === 'reimbursement' && transaction.cancelled_at) return 'reimbursement-cancelled'
  return null
}
```

El componente recibe la variant + las strings i18n resueltas (porque vive en client component) y renderea:

```tsx
<p className="px-5 text-[13px] text-text-muted leading-relaxed text-center max-w-[420px] mx-auto">
  {copy}
</p>
```

Espaciado vertical: gap del orquestador (`flex flex-col gap-6` o similar) — sin border, sin bg, sin ícono. Lectura como un toque editorial breve, no como widget.

i18n keys nuevas bajo `transactions.detail.context.*`:

```json
"context": {
  "card_pending": "Este consumo no afecta tu disponible hasta que pagues el resumen del {periodo}.",
  "card_paid_installment": "Esta cuota ya está incluida en el resumen del {periodo} que pagaste.",
  "card_payment": "Con este pago, las cuotas del período {periodo} quedaron en estado pagado.",
  "reimbursement_pending": "Esperás que te lo devuelvan. Cuando llegue, marcalo como recibido y se va a sumar a tu disponible.",
  "reimbursement_cancelled": "Marcaste este reintegro como cancelado. Si finalmente lo recibís, podés reabrirlo."
}
```

`{periodo}` se reemplaza desde el lado del orquestador con el rango del período (ej. "Mayo 2026" o "del 1 al 31 de mayo").

### 8. i18n keys nuevas

Bajo `transactions.detail.*`:

```json
"detail": {
  "actions": {
    "menu_label": "Opciones",
    "edit": "Editar",
    "delete": "Eliminar",
    "delete_confirm": "Sí, eliminar",
    "cancel": "Cancelar",
    "delete_warning_default": "Esta acción no se puede deshacer.",
    "delete_warning_parent": "Se van a eliminar la compra y todas sus cuotas. Esta acción no se puede deshacer.",
    "delete_warning_card_payment": "Al eliminar este pago, las cuotas del período volverán a pendientes. ¿Continuar?"
  },
  "groups": {
    "details": "Detalles",
    "installments": "Cuotas",
    "reimbursements": "Reintegros"
  },
  "labels": {
    "date": "Fecha",
    "account": "Cuenta",
    "category": "Categoría",
    "card": "Tarjeta",
    "period": "Período",
    "installment_position": "Cuota",
    "first_payment": "Primer pago"
  }
}
```

Mantengo las claves existentes del namespace `transactions` (no las renombro).

## Alternativas consideradas y descartadas

### Artboard 04 puro (lo que diseñé originalmente)

Type chips + monto horizontal + meta grid 2x2 + botones planos. Descartado por el owner — prefiere la jerarquía editorial de v2. Mantenemos solo el patrón de **numeración circular para cuotas** porque es genuinamente mejor que la fila plana de v2.

### Promover `TxDetailRow` al contract package

Tentador para forzar paridad con mobile. Descartado en esta iteración porque:
- El shape es muy simple (`icon, label, value`).
- Hasta que mobile no implemente, no sabemos si necesita props extra (haptic feedback en tap, swipe to action, etc.).
- Promover prematuro genera fricción de evolución.

Reevaluamos cuando el tech lead haga la pasada mobile.

### Migrar inline styles de v2 a CSS modules

v2 usa `style={{}}` mezclado con className. Descartado: v3 va todo Tailwind v4 + tokens del change anterior. El esfuerzo de portear v2 → Tailwind es trivial y deja el código consistente con el resto del repo.

### Mantener el botón Duplicar del artboard 04

Descartado: v2 no lo tenía. Es feature poco usada. Si surge la necesidad, se agrega como item del dropdown sin tocar el layout.

### Banner de recurrencia movido al hero

Tentador (lo hace más prominente). Descartado: el banner lleva una acción ("Ver regla") que abre otra ruta. Que viva afuera del hero respeta la jerarquía "monto = héroe, banner = avisador secundario".
