> **Alcance:** solo superficie. Las funcionalidades data-driven (chips de clasificación frecuente, memoria categoría→cuenta / última usada, ranking del tercer tab por frecuencia, sugerencia→cuenta) están en el epic **#31** y NO se implementan acá.

## 1. OpenSpec y contrato

- [x] 1.1 Cerrar con PO el alcance: superficie en este change; funcionalidad data-driven a #31.
- [x] 1.2 Documentar la partición de tipos **por elegibilidad** (`expense`/`income` anclados; tercer slot secundario elegible entre `transfer`/`exchange`; `adjustment` siempre secundario; "Otros" solo si hay secundario elegible).
- [x] 1.3 Documentar el orden invertido (categoría antes que cuenta, D7) y que ninguna regla contable cambia.

## 2. Hook `@grana/movement-form`

- [ ] 2.1 Exponer la partición de tipos por elegibilidad: `PRIMARY_TABS` ancla `expense`/`income`; tercer slot = secundario elegible (default estable `transfer` si ambos elegibles — el ranking por uso es #31); `adjustment` siempre secundario; derivado `secondaryTabs` y flag de si el tab activo es secundario. "Otros" solo si hay ≥1 secundario elegible.
- [ ] 2.2 Exponer `showAccountSelector` derivado de "una sola cuenta elegible para el tipo **y la moneda** activos".
- [ ] 2.3 Preselección de `accountId` en create con datos existentes: contexto (`preselectAccountId`) → única elegible → primera elegible (`firstFor`). (La memoria categoría→cuenta y "última usada" son #31.)
- [ ] 2.4 Verificar que cambiar de tab/moneda recomputa `eligibleAccounts`, `showAccountSelector`, la partición de tipos y la elegibilidad de la cuenta seleccionada sin romper las cascadas existentes.

## 3. UI web (`apps/web/lib/transactions/components/movement-form.tsx`) — gateado por breakpoint

- [ ] 3.1 Orden invertido: el bloque de categoría queda **arriba** del de cuenta.
- [ ] 3.2 En el selector de categoría eliminar el drill obligatorio: tocar el nombre de la categoría la asigna a secas; un chevron aparte expande las subcategorías. Confirmar que se guarda sin subcategoría.
- [ ] 3.3 Partición de tipos por elegibilidad + affordance "Otros" (solo si hay secundario elegible) que revela `transfer`/`exchange`/`adjustment` según corresponda.
- [ ] 3.4 Condicionar el bloque de cuenta a `showAccountSelector`; cuando aparece, chips de cuenta inline (pocas) o fila+popover con secciones crédito/débito (muchas).
- [ ] 3.5 Monto recortado (padding + número ~34–38px) y filas secundarias (fecha, descripción) a una sola línea, sin recuadro de icono ni label en mayúsculas. Solo bajo breakpoint móvil; desktop intacto.
- [ ] 3.6 Capa 1: reemplazar el `togglesGroup` por una **fila slim de chips de activación** gateados por contexto (reintegro/compartir/repetir); tocar un chip activa la funcionalidad y despliega sus params inline; tocar de nuevo desactiva. Sin "Más opciones". Cuotas fuera de la fila, pegada a la cuenta.
- [ ] 3.7 Verificar que reintegro/compartido/repetir/cuotas siguen sin activar por defecto y fuera del camino del gasto simple.
- [ ] 3.8 Edición intacta: tipo inmutable, todos los campos editables visibles, sin reordenar.

## 4. UI mobile (`apps/mobile`)

- [ ] 4.1 Consumir la partición de tipos por elegibilidad y `showAccountSelector` desde el hook compartido (sin lógica duplicada).
- [ ] 4.2 Orden invertido (categoría antes que cuenta), picker sin drill obligatorio, affordance idiomática para "Otros" y filas secundarias livianas.
- [ ] 4.3 Capa 1: fila de chips de activación gateados por contexto con params inline, y cuotas pegada a la cuenta.

## 5. i18n

- [ ] 5.1 Copy para la affordance de tipos secundarios ("Otros movimientos") y el placeholder de descripción ("Agregá una nota") en `packages/i18n-messages` (es).

## 6. Tests

- [ ] 6.1 El selector de categoría asigna una categoría con subcategorías sin forzar el drill; la subcategoría queda como refinamiento opcional; guarda sin subcategoría.
- [ ] 6.2 La partición de tipos por elegibilidad: `expense`/`income` primarios; `adjustment` nunca primario; sin secundarios elegibles no hay "Otros".
- [ ] 6.3 `showAccountSelector === false` con una sola cuenta elegible para el tipo y la moneda activos (incl. Billetera ARS + cuenta USD por moneda); `true` con dos o más.
- [ ] 6.4 La preselección de cuenta respeta contexto → única elegible → primera elegible, y nunca elige una no elegible.
- [ ] 6.5 El gasto simple se completa sin abrir cuenta (cuando hay una sola elegible), drill de subcategoría ni secciones avanzadas.
- [ ] 6.6 Capa 1: el conjunto de chips de activación es contextual (income → solo repetir; compartir solo con hogar de 2; repetir off en cuotas; ninguno en ajuste/cambio); activar un chip revela sus params; cuotas se ofrece junto a la cuenta de crédito.
- [ ] 6.7 Los tipos secundarios (`adjustment`, `exchange`, `transfer`) siguen alcanzables vía "Otros" y funcionan igual que hoy.

## 7. Cierre

- [ ] 7.1 `pnpm lint` y `pnpm typecheck` en verde.
- [ ] 7.2 Suite de `@grana/movement-form` en verde con los casos nuevos.
- [ ] 7.3 `pnpm openspec:check` en verde.
- [ ] 7.4 Archivar el change antes del merge a `main` (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`, actualizar `AGENTS.md` si aplica).
- [ ] 7.5 Confirmar que el epic #31 (aceleradores data-driven) queda listo para atacarse después del merge.
