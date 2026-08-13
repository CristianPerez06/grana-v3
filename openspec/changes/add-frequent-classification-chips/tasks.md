> **Alcance:** ítem #1 del epic **#31** (chips de clasificación frecuente). La memoria categoría→cuenta (#2) y la sugerencia→cuenta (#3) NO entran acá.
>
> **Defaults cerrados con PO:** ventana **60 días**, top **4** hojas.

## 1. Contrato en `@grana/movement-form`

- [ ] 1.1 Agregar el tipo `FrequentClassification { categoryId: string; subcategoryId: string | null }`.
- [ ] 1.2 Agregar `frequentClassifications?: FrequentClassification[]` a `UseMovementFormArgs`.
- [ ] 1.3 Derivar `frequentChips`: mapear cada `FrequentClassification` contra el catálogo vigente (`categories`), resolviendo icono + label de la hoja y compatibilidad con el tab activo; descartar hojas archivadas/inexistentes; solo en create.
- [ ] 1.4 Exponer un handler que aplique un chip vía `pickCategory(categoryId, subcategoryId ?? '')`, y un flag/valor para marcar el chip activo (coincide con la selección actual).
- [ ] 1.5 Exportar los nuevos tipos desde el índice del paquete.

## 2. Query web

- [ ] 2.1 Server action de lectura `frequentClassifications(type)` en `apps/web` que agrupe `transactions` por `(category_id, subcategory_id)`, `is_parent=false`, ventana 60 días, `user_id` del auth, top 4, compatibilidad de tipo, excluyendo taxonomía archivada. Mirrorear estilo/RLS de las agregaciones existentes.
- [ ] 2.2 Inyectar la lista resuelta en los `UseMovementFormArgs` del drawer (TanStack query + wiring), sin bloquear la apertura del form (carga optimista/no-crítica).

## 3. Query mobile

- [ ] 3.1 Equivalente nativo de `frequentClassifications(type)` en `apps/mobile`.
- [ ] 3.2 Inyectar en los args del formulario nativo, en el mismo lugar donde hoy se cargan categorías/cuentas.

## 4. UI web (gateada por breakpoint)

- [ ] 4.1 Fila de chips sobre el selector de categoría, gateada por `isMobile`; icono de categoría + label de hoja; tap aplica; chip activo marcado; sin datos → no se renderiza. Desktop intacto.

## 5. UI mobile (nativa)

- [ ] 5.1 Fila de chips equivalente sobre el campo de categoría en el formulario nativo.

## 6. i18n

- [ ] 6.1 Copy si hace falta (p. ej. rótulo "Frecuentes") en `packages/i18n-messages` (es + en, paridad).

## 7. Tests

- [ ] 7.1 `frequentChips` filtra por tipo (una hoja `expense` no aparece en `ingreso`).
- [ ] 7.2 `frequentChips` excluye hojas cuya categoría/subcategoría no está en el catálogo vigente (archivada).
- [ ] 7.3 Aplicar un chip asigna categoría + subcategoría (reusa `pickCategory`) y permite guardar.
- [ ] 7.4 En modo edición no se ofrecen chips.
- [ ] 7.5 Sin `frequentClassifications` (o lista vacía) el form no muestra chips y funciona igual que hoy.

## 8. Cierre

- [ ] 8.1 `pnpm lint` y `pnpm typecheck` en verde (web + mobile).
- [ ] 8.2 Suite de `@grana/movement-form` en verde con los casos nuevos.
- [ ] 8.3 `pnpm openspec:check` en verde.
- [ ] 8.4 Commits convencionales, slice por slice; push a `feature/movement-form-frequent-chips`. Sin PR salvo pedido.
- [ ] 8.5 Al mergear: archivar el change e integrar el delta en `openspec/specs/transactions/spec.md`; marcar el ítem #1 en el epic #31.
