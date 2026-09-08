## 1. Cálculo

- [x] 1.1 `netAfterCredits(total, credits)` en `@grana/money-logic/category-breakdown.ts`, con `Money` y no resta de floats.
- [x] 1.2 Tests: el caso de agosto 2026, sin créditos, varios créditos, centavos exactos, neto negativo.

## 2. Presentación

- [x] 2.1 Web: línea de cierre dentro del bloque de créditos, con `labels.netTotalLabel`; el container pasa la key.
- [x] 2.2 Nativo: la misma línea en `CategorySpendingOverview`.
- [x] 2.3 i18n `es` ("Te costó") y `en` ("Actually spent").

## 3. Verificación

- [ ] 3.1 Agosto 2026 de Julieta: la card cierra en 2.064.327,84, igual que "Gastaste" del Inicio.
- [ ] 3.2 Un mes sin créditos (julio): la línea no aparece.
- [ ] 3.3 Nativo: misma card, mismo número.
- [x] 3.4 Lint, typecheck y tests en web y nativo; archivar la change; `pnpm openspec:check`.
