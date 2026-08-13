> **Alcance:** solo superficie. Las funcionalidades data-driven (chips de clasificación frecuente, memoria categoría→cuenta / última usada, sugerencia→cuenta) están en el epic **#31** y NO se implementan acá.
>
> **Diseño visual:** `docs/design/movement-form/README.md` (mockups + decisiones de UI cerradas con el PO).
>
> **Nota de cierre:** el refinamiento de "ocultar cuenta por **moneda** activa" (Billetera ARS + cuenta USD) quedó **diferido** —requiere que el toggle de moneda maneje la selección de cuenta, un cambio en la cascada— y está anotado en `use-movement-form.ts` y en `design.md` (D2). La elegibilidad implementada es **por tipo**.

## 1. OpenSpec y contrato

- [x] 1.1 Cerrar con PO el alcance: superficie en este change; funcionalidad data-driven a #31.
- [x] 1.2 Documentar la partición de tipos **por elegibilidad** (`expense`/`income` anclados; tercer slot secundario elegible entre `transfer`/`exchange`; `adjustment` siempre secundario; "Otros" solo si hay secundario elegible).
- [x] 1.3 Documentar el orden invertido (categoría antes que cuenta, D7) y que ninguna regla contable cambia.

## 2. Hook `@grana/movement-form`

- [x] 2.1 Exponer la partición de tipos: `PRIMARY_TABS = [expense, income]` (fijo); `transfer`/`adjustment`/`exchange` en "Otros", gateados por elegibilidad. Derivado `secondaryTabs` (elegibles) y flag `isSecondaryTab`. Sin ranking dinámico.
- [x] 2.2 Exponer `showAccountSelector` derivado de "una sola cuenta elegible para el tipo activo". (El refinamiento por **moneda** quedó diferido — ver nota de cierre.)
- [x] 2.3 Preselección de `accountId` en create con datos existentes: contexto (`preselect`) → única elegible → primera elegible (`firstFor`). (La memoria categoría→cuenta y "última usada" son #31.)
- [x] 2.4 Verificar que cambiar de tab recomputa `eligibleAccounts`, `showAccountSelector`, la partición de tipos y la elegibilidad de la cuenta seleccionada sin romper las cascadas existentes.

## 3. UI web (`apps/web/lib/transactions/components/movement-form.tsx`) — gateado por breakpoint

- [x] 3.1 Orden invertido: el bloque de categoría queda **arriba** del de cuenta.
- [x] 3.2 En el selector de categoría eliminar el drill obligatorio: tocar el nombre de la categoría la asigna a secas; un chevron aparte expande las subcategorías. Confirmar que se guarda sin subcategoría.
- [x] 3.3 Tabs Gasto · Ingreso · Otros; "Otros" abre un popover con `transfer`/`ajuste`/`cambio` gateados por elegibilidad.
- [x] 3.4 Selector de cuenta por familia Débito/Crédito (`accountFamilyRow`): oculto con 1 elegible; toggle de familia; chips con avatar de marca (`resolveAccountAvatar`); con muchas cuentas cae a popover compacto. Elegir Crédito revela cuotas. _(El drilldown fino de D10 con muchísimas cuentas queda como refinamiento menor.)_
- [x] 3.5 Monto recortado (número ~34px, con ancho dinámico centrado) y filas secundarias (fecha, descripción) a una sola línea. Solo bajo breakpoint móvil; desktop intacto.
- [x] 3.6 Capa 1: reemplazar el `togglesGroup` por una **fila slim de chips de activación** (`AdvChip`: reintegro/compartir/repetir); tocar un chip activa la funcionalidad y despliega sus params inline; tocar de nuevo desactiva. Cuotas fuera de la fila, pegada a la cuenta.
- [x] 3.7 Verificar que reintegro/compartido/repetir/cuotas siguen sin activar por defecto y fuera del camino del gasto simple.
- [x] 3.8 Edición intacta: tipo inmutable, todos los campos editables visibles, sin reordenar (rama `!isMobile` byte-idéntica; edición sin cambios).

## 4. UI mobile (`apps/mobile`)

- [x] 4.1 Consumir la partición de tipos por elegibilidad y `showAccountSelector` desde el hook compartido (sin lógica duplicada).
- [x] 4.2 Orden invertido (categoría antes que cuenta), picker sin drill obligatorio, affordance idiomática para "Otros" (SelectSheet) y filas secundarias livianas (chips Hoy/Ayer).
- [x] 4.3 Capa 1: fila de chips de activación (`AdvChip`) con params inline, y cuotas pegada a la cuenta.

## 5. i18n

- [x] 5.1 Copy para la affordance de tipos secundarios ("Otros"), chips avanzados cortos (`reimbursement.chip`, `labels.recurrent`) y labels de fecha/familia, en `packages/i18n-messages` (es + en, paridad verificada).

## 6. Tests

- [x] 6.1 (UI, validado en navegador) El selector de categoría asigna una categoría con subcategorías sin forzar el drill; la subcategoría queda como refinamiento opcional; guarda sin subcategoría.
- [x] 6.2 (hook) La partición de tipos por elegibilidad: `expense`/`income` primarios; `adjustment` nunca primario; sin secundarios elegibles no hay "Otros".
- [x] 6.3 (hook) `showAccountSelector === false` con una sola cuenta elegible para el tipo activo; `true` con dos o más. (Refinamiento por moneda: diferido.)
- [x] 6.4 (hook) La preselección de cuenta respeta contexto → única elegible → primera elegible, y nunca elige una no elegible.
- [x] 6.5 (UI, validado en navegador) El gasto simple se completa sin abrir cuenta (cuando hay una sola elegible), drill de subcategoría ni secciones avanzadas.
- [x] 6.6 (UI, validado en navegador) Capa 1: el conjunto de chips de activación es contextual (income → solo repetir; compartir solo con hogar de 2; repetir off en cuotas; ninguno en ajuste/cambio); activar un chip revela sus params; cuotas se ofrece junto a la cuenta de crédito.
- [x] 6.7 (hook + navegador) Los tipos secundarios (`adjustment`, `exchange`, `transfer`) siguen alcanzables vía "Otros" y funcionan igual que hoy.

## 7. Cierre

- [x] 7.1 `pnpm lint` y `pnpm typecheck` en verde.
- [x] 7.2 Suite de `@grana/movement-form` en verde con los casos nuevos.
- [x] 7.3 `pnpm openspec:check` en verde.
- [ ] 7.4 Archivar el change antes del merge a `main` (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`).
- [x] 7.5 Confirmar que el epic #31 (aceleradores data-driven) queda listo para atacarse después del merge.
