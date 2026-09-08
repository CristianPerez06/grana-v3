## 1. Cálculo

- [x] 1.1 `EntroParts` y `SeFueParts` en `@grana/dashboard/month-summary.ts`; los totales pasan a ser la suma de sus partes.
- [x] 1.2 Tests: las dos aperturas, el lado de cada balde con signo, "otros" en cero, y que cada total sea la suma exacta de sus partes con centavos.

## 2. Card de saldo

- [x] 2.1 Web: los rótulos de "Entró" y "Se fué" se vuelven botones con chevron; panel debajo de la tira, uno abierto por vez, filas en cero omitidas.
- [x] 2.2 Nativo: lo mismo, con el panel debajo de su propia fila.
- [x] 2.3 i18n `es` y `en` de los rótulos.
- [x] 2.4 "Ingresos financieros": `totalFinancialIncome` en la serie, la categoría del movimiento en la lectura del mes, y la fila que sale de "Ingresos".

## 3. Verificación

- [ ] 3.1 Agosto 2026 de Julieta: abrir "Se fué" da Gastos + Pago de tarjetas = 2.560.653,23; abrir "Entró" da Ingresos + Devoluciones = 3.375.113,34.
- [ ] 3.2 Un mes sin liquidaciones ni cambios: no aparece la fila "Otros".
- [ ] 3.3 Nativo: misma apertura, mismos números.
- [x] 3.4 Lint, typecheck y tests en web y nativo; archivar la change; `pnpm openspec:check`.
