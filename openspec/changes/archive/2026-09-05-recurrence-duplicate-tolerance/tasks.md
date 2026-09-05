## 1. Paquete

- [x] 1.1 `duplicates.ts`: `closeAmounts` con tolerancia del 1 % inclusive, `findDuplicateRules` la usa, `groupDuplicateRules` agrupa por (cuenta, moneda, tipo) encadenando montos vecinos.
- [x] 1.2 Tests: par 48.733,92 / 48.723,04 señalado; 2 % afuera; borde 1 % inclusive; strings numéricos; agrupación por vecinos.
- [x] 1.3 i18n `es` y `en`: aviso y marca dicen "monto igual o casi igual".

## 2. Nativo

- [x] 2.1 `getDuplicateRules` en `apps/mobile/lib/recurrences/queries.ts`.
- [x] 2.2 `RecurrenceForm`: consulta antes de crear, aviso con la regla existente, segundo submit crea igual.
- [x] 2.3 Hub: `duplicateRuleIds` sobre las activas y marca "Duplicada" en `RecurrenceRuleCard`.

## 3. Verificación

- [ ] 3.1 Web: crear una regla de gasto con un monto 0,5 % distinto de una activa en la misma cuenta muestra el aviso; con 2 % no.
- [ ] 3.2 Nativo: lo mismo, y el hub marca el par.
- [ ] 3.3 Dato: pausar desde el hub la regla sin título del préstamo (queda "Prestamo Anses"); Compromisos deja de sumarla dos veces.
- [x] 3.4 Lint, typecheck y tests en web y nativo; archivar la change; `pnpm openspec:check`.
