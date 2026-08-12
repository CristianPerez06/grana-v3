## 1. OpenSpec y contrato

- [x] 1.1 Confirmar con PO el orden de preselección de cuenta, incl. "última cuenta usada" y la memoria clasificación→cuenta (D3).
- [x] 1.2 Documentar que el tercer tipo primario es **dinámico** (más usado y elegible entre `transfer`/`exchange`; `adjustment` siempre secundario; `Gasto`/`Ingreso` anclados) — reemplaza la partición estática (D1).
- [x] 1.3 Documentar el orden invertido (categoría antes que cuenta, D7) y que ninguna regla contable cambia (balance, signo, corte temporal, `transactions.status`).

## 2. Hook `@grana/movement-form`

- [ ] 2.1 Agregar `frequentClassifications?` a `UseMovementFormArgs` (hojas `(category_id, subcategory_id)` por recencia/frecuencia) y derivar `quickClassifications` (intersección con el catálogo activo del tab; hojas archivadas/ausentes descartadas; label = subcategoría si existe, si no categoría; fallback a "Cat › Sub" ante ambigüedad). El hook sigue I/O-free.
- [ ] 2.2 Exponer el **tercer tab dinámico**: `PRIMARY_TABS` ancla `expense`/`income`; el tercer slot es el más usado y elegible entre `transfer`/`exchange`; `adjustment` siempre secundario; derivado `secondaryTabs` y flag de si el tab activo es secundario. La affordance "Otros" solo existe si hay ≥1 secundario elegible.
- [ ] 2.3 Exponer `showAccountSelector` derivado de "una sola cuenta elegible para el tipo **y la moneda** activos".
- [ ] 2.4 Agregar `classificationAccountId?` (mapa clasificación → cuenta-más-usada) y `lastUsedAccountId?` a `UseMovementFormArgs`; ajustar el default de `accountId` en create al orden de D3 (contexto → memoria de la clasificación → única elegible → última usada → primera elegible).
- [ ] 2.5 Al elegir una clasificación (chip o picker), aplicar la cuenta de la memoria si existe y es elegible; la cuenta resultante queda expuesta para que la UI la muestre y permita override.
- [ ] 2.6 Verificar que cambiar de tab/moneda/clasificación recomputa `eligibleAccounts`, `showAccountSelector`, `quickClassifications`, el tercer tab y la elegibilidad de la cuenta seleccionada sin romper las cascadas existentes.

## 3. Lectura de datos derivados (inyectados por el caller)

- [ ] 3.1 Query barata de hojas `(category_id, subcategory_id)` frecuentes en ventana (~30–60 días) por tipo (web RSC + equivalente mobile).
- [ ] 3.2 Query barata del mapa clasificación → cuenta-más-usada, y de la frecuencia de tipos secundarios (para el tercer slot). Cadencia lenta (por sesión/día) para no titilar.

## 4. UI web (`apps/web/lib/transactions/components/movement-form.tsx`) — gateado por breakpoint

- [ ] 4.1 Orden invertido: chips de `quickClassifications` (un tap → `pickCategory(catId, subId)`) **arriba** del campo de categoría; la cuenta baja debajo de la categoría.
- [ ] 4.2 En "Ver todas" eliminar el drill obligatorio: tocar el nombre de la categoría la asigna a secas; un chevron aparte expande las subcategorías.
- [ ] 4.3 Tercer tab dinámico + affordance "Otros" (solo si hay secundario elegible) que revela `transfer`/`exchange`/`adjustment` según corresponda.
- [ ] 4.4 Condicionar el bloque de cuenta a `showAccountSelector`; cuando aparece, chips de cuenta inline (pocas) o fila+popover con secciones crédito/débito (muchas); mostrar la cuenta inferida como override liviano ("Se debita de · …").
- [ ] 4.5 Monto recortado (padding + número ~34–38px) y filas secundarias (fecha, descripción) a una sola línea, sin recuadro de icono ni label en mayúsculas. Solo bajo breakpoint móvil; desktop intacto.
- [ ] 4.6 Verificar que reintegro/compartido/repetir/cuotas siguen colapsados por defecto y fuera del camino del gasto simple.
- [ ] 4.7 Edición intacta: tipo inmutable, todos los campos editables visibles, sin reordenar.

## 5. UI mobile (`apps/mobile`)

- [ ] 5.1 Consumir `quickClassifications`, el tercer tab dinámico, `showAccountSelector` y la cuenta inferida desde el hook compartido (sin lógica duplicada).
- [ ] 5.2 Chips de clasificación, orden invertido (categoría antes que cuenta), affordance idiomática para "Otros", picker sin drill obligatorio y filas secundarias livianas en la plataforma nativa.

## 6. i18n

- [ ] 6.1 Copy para "Ver todas" (categorías), la affordance de tipos secundarios ("Otros movimientos"), el placeholder de descripción ("Agregá una nota") y la línea de cuenta inferida ("Se debita de …") en `packages/i18n-messages` (es).

## 7. Tests

- [ ] 7.1 `quickClassifications` deriva de `frequentClassifications` intersecando el catálogo activo; hojas archivadas excluidas; label correcto (sub o categoría); sin historial queda vacío.
- [ ] 7.2 Un tap sobre un chip clasifica (categoría + subcategoría si aplica) y permite guardar sin abrir el picker ni el drill.
- [ ] 7.3 El picker completo asigna una categoría con subcategorías sin forzar el drill; la subcategoría queda como refinamiento opcional.
- [ ] 7.4 El tercer tab primario es el más usado y elegible entre `transfer`/`exchange`; `adjustment` nunca es primario; sin secundarios elegibles no hay "Otros".
- [ ] 7.5 `showAccountSelector === false` con una sola cuenta elegible para el tipo y la moneda activos (incl. el caso Billetera ARS + cuenta USD por moneda); `true` con dos o más.
- [ ] 7.6 Elegir una clasificación con memoria aplica su cuenta habitual (elegible); la cuenta queda expuesta para override.
- [ ] 7.7 El default de cuenta en create respeta el orden de D3 (contexto → memoria → única → última usada → primera).
- [ ] 7.8 **Presupuesto de taps:** el gasto simple (1 cuenta elegible + clasificación frecuente) se completa con abrir + 1 tap de chip + guardar, sin abrir cuenta, drill de subcategoría ni secciones avanzadas.
- [ ] 7.9 Los tipos secundarios (`adjustment`, `exchange`, `transfer`) siguen alcanzables vía "Otros" y funcionan igual que hoy.

## 8. Cierre

- [ ] 8.1 `pnpm lint` y `pnpm typecheck` en verde.
- [ ] 8.2 Suite de `@grana/movement-form` en verde con los casos nuevos.
- [ ] 8.3 `pnpm openspec:check` en verde.
- [ ] 8.4 Archivar el change antes del merge a `main` (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`, actualizar `AGENTS.md` si aplica).
