## 1. OpenSpec y contrato

- [ ] 1.1 Confirmar con PO la decisión D3 (adoptar o no "última cuenta usada").
- [ ] 1.2 Documentar la partición `PRIMARY_TABS` (`expense`, `income`, `transfer`) vs `SECONDARY_TABS` (`adjustment`, `exchange`) como constante del hook.
- [ ] 1.3 Documentar que ninguna regla contable cambia (balance, signo, corte temporal, `transactions.status`).

## 2. Hook `@grana/movement-form`

- [ ] 2.1 Agregar `recentCategoryIds?` a `UseMovementFormArgs` y derivar `quickCategories` (intersección con el catálogo activo del tab, hasta N por recencia). El hook sigue I/O-free.
- [ ] 2.2 Exponer `PRIMARY_TABS` / `SECONDARY_TABS` y un derivado que indique si el tab activo es secundario.
- [ ] 2.3 Exponer `showAccountSelector` derivado de `eligibleAccounts.length > 1`.
- [ ] 2.4 Ajustar el default de `accountId` en create al orden de D3 (contexto → única elegible → última usada si se adopta → primera elegible).
- [ ] 2.5 Si se adopta D3.3: agregar `lastUsedAccountId?` a `UseMovementFormArgs`.
- [ ] 2.6 Verificar que cambiar de tab recomputa `eligibleAccounts`, `showAccountSelector`, `quickCategories` y la elegibilidad de la cuenta seleccionada sin romper las cascadas existentes.

## 3. Lectura de categorías recientes

- [ ] 3.1 Query barata de categorías distintas de los últimos N movimientos del usuario, por tipo (web RSC + equivalente mobile), inyectada como `recentCategoryIds`.

## 4. UI web (`apps/web/lib/transactions/components/movement-form.tsx`)

- [ ] 4.1 Chips de `quickCategories` (un tap → `pickCategory(id, '')`) arriba del campo de categoría; el `FieldRow` pasa a "Ver todas".
- [ ] 4.2 Confirmar que elegir categoría sin subcategoría guarda (no forzar el drill).
- [ ] 4.3 Partir el `Segmented` de tipo: solo primarios visibles + affordance "Otros" que revela `ajuste`/`cambio`.
- [ ] 4.4 Condicionar el bloque de cuenta a `showAccountSelector`; cuando es `false`, la cuenta implícita no ocupa espacio.
- [ ] 4.5 Verificar que reintegro/compartido/repetir/cuotas siguen colapsados por defecto y fuera del camino del gasto simple.
- [ ] 4.6 Edición intacta: tipo inmutable, todos los campos editables visibles.

## 5. UI mobile (`apps/mobile`)

- [ ] 5.1 Consumir `quickCategories`, la partición de tipos y `showAccountSelector` desde el hook compartido (sin lógica duplicada).
- [ ] 5.2 Chips de categoría reciente y affordance idiomática para tipos secundarios en la plataforma nativa.

## 6. i18n

- [ ] 6.1 Copy para "Ver todas" (categorías) y la affordance de tipos secundarios ("Otros movimientos") en `packages/i18n-messages` (es).

## 7. Tests

- [ ] 7.1 `quickCategories` deriva de `recentCategoryIds` intersecando el catálogo activo del tab; sin historial queda vacío.
- [ ] 7.2 Un tap sobre un chip de categoría clasifica y permite guardar sin subcategoría.
- [ ] 7.3 Con una sola cuenta elegible: `showAccountSelector === false` y el submit usa esa cuenta implícita.
- [ ] 7.4 Con dos o más elegibles: `showAccountSelector === true`.
- [ ] 7.5 El tab `transferencia` con una sola cuenta propia no habilita el flujo (elegibilidad correcta).
- [ ] 7.6 El default de cuenta en create respeta el orden de D3 (con y sin `lastUsedAccountId`).
- [ ] 7.7 **Presupuesto de taps:** el gasto simple (1 cuenta elegible + categoría reciente) se completa con abrir + 1 tap de categoría + guardar, sin abrir cuenta, drill de subcategoría ni secciones avanzadas.
- [ ] 7.8 Los tipos secundarios (`adjustment`, `exchange`) siguen alcanzables y funcionan igual que hoy.

## 8. Cierre

- [ ] 8.1 `pnpm lint` y `pnpm typecheck` en verde.
- [ ] 8.2 Suite de `@grana/movement-form` en verde con los casos nuevos.
- [ ] 8.3 `pnpm openspec:check` en verde.
- [ ] 8.4 Archivar el change antes del merge a `main` (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`, actualizar `AGENTS.md` si aplica).
