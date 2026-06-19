## 1. Helper compartido

- [x] 1.1 Promover `computeConcentration` (+ tipos) a `packages/dashboard/src/concentration.ts` y exportar desde `@grana/dashboard`.
- [x] 1.2 Repuntar web (`accounts-card.tsx`) y el test a `@grana/dashboard`; borrar `apps/web/lib/dashboard/concentration.ts`.

## 2. "Dónde está" (mobile)

- [x] 2.1 Reescribir `AccountsCard` nativo: callout de concentración + barra proporcional + grilla compacta 2-col + fila "En dólares" (reusa `computeConcentration`).
- [x] 2.2 Actualizar `AccountsCardSkeleton` al shape nuevo (callout + barra + grilla).

## 3. "Comprometido" (mobile)

- [x] 3.1 Hook `useCommittedOutlook` en `lib/dashboard/queries.ts` sobre `getCommittedOutlook`.
- [x] 3.2 `CommittedSection` nativo: total + dos tiles de egreso; estado con ingreso recurrente (sub-label "YA SALE" + tile "Ya entra" + banda de cierre neto via split de `<amount>`); strip USD; estados empty/error/skeleton.
- [x] 3.3 `CommittedSkeleton` nativo (total + dos tiles + strip).

## 4. "Gastaste este mes" (mobile)

- [x] 4.1 `SpentThisMonthSection` nativo: reusa hooks balance + breakdown; bandas caja/tarjeta apiladas; caption con split de `<b>`; render solo si `financiado > 0`.

## 5. Deltas menores (mobile)

- [x] 5.1 Chip "SIN REGISTRAR" en la fila Ajustes de `MonthBalanceSection`.
- [x] 5.2 Barra proporcional bajo cada fila de leyenda en `SpendingSection` (no en filas de crédito).

## 6. Composición

- [x] 6.1 Wirear `CommittedSection` + `SpentThisMonthSection` en `dashboard.tsx` en orden: Hero → Dónde está → Balance → Comprometido → Gastaste este mes → ¿En qué gasté?.
- [x] 6.2 Dejar comentado el por qué la tira "Compartido" no se monta en mobile (datos de Hogar diferidos).

## 7. Verificación

- [x] 7.1 `pnpm --filter mobile typecheck` y `lint` sin errores nuevos (2 warnings preexistentes ajenas).
- [x] 7.2 `pnpm --filter web` typecheck + lint + tests (394/394) verdes tras la promoción del helper.
- [ ] 7.3 QA visual nativa (Expo): concentración, los 2 estados de Comprometido, Gastaste, chip Ajustes, barras de leyenda, eye-mask — pendiente (lo hace el tech lead/usuario).
- [ ] 7.4 Archivar el change en la branch antes del merge (`openspec archive`, sync de `openspec/specs/dashboard/spec.md`, gate de TBD) — pendiente tras la revisión. El merge squash lo hace el usuario.

## 8. Follow-up diferido

- [ ] 8.1 Tira "Compartido" en mobile (requiere capa de datos de Hogar nativa; va con la paridad mobile del módulo `shared`).
