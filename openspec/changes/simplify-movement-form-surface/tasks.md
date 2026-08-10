## 1. OpenSpec y contrato

- [ ] 1.1 Confirmar con PO la decisión D3 (adoptar o no "última cuenta usada").
- [ ] 1.2 Documentar la partición `PRIMARY_TABS` (`expense`, `income`, `transfer`) vs `SECONDARY_TABS` (`adjustment`, `exchange`) como constante del hook.
- [ ] 1.3 Documentar que ninguna regla contable cambia (balance, signo, corte temporal, `transactions.status`).

## 2. Hook `@grana/movement-form`

- [ ] 2.1 Exponer `PRIMARY_TABS` / `SECONDARY_TABS` y un derivado que indique si el tab activo es secundario.
- [ ] 2.2 Exponer `showAccountSelector` derivado de `eligibleAccounts.length > 1`.
- [ ] 2.3 Ajustar el default de `accountId` en create al orden de D3 (contexto → única elegible → última usada si se adopta → primera elegible).
- [ ] 2.4 Si se adopta D3.3: agregar `lastUsedAccountId?` a `UseMovementFormArgs` (el caller lo inyecta; el hook sigue I/O-free).
- [ ] 2.5 Verificar que cambiar de tab recomputa `eligibleAccounts`, `showAccountSelector` y la elegibilidad de la cuenta seleccionada sin romper las cascadas existentes.

## 3. UI web (`apps/web/lib/transactions/components/movement-form.tsx`)

- [ ] 3.1 Partir el `Segmented` de tipo: solo primarios visibles + affordance "Otros" que revela `ajuste`/`cambio`.
- [ ] 3.2 Condicionar el bloque de cuenta a `showAccountSelector`; cuando es `false`, la cuenta implícita no ocupa espacio.
- [ ] 3.3 Verificar que reintegro/compartido/repetir/cuotas siguen colapsados por defecto y fuera del camino del gasto simple.
- [ ] 3.4 Edición intacta: tipo inmutable, todos los campos editables visibles.

## 4. UI mobile (`apps/mobile`)

- [ ] 4.1 Consumir la misma partición de tipos y `showAccountSelector` desde el hook compartido (sin lógica duplicada).
- [ ] 4.2 Affordance idiomática para tipos secundarios en la plataforma nativa.

## 5. i18n

- [ ] 5.1 Copy para la affordance de tipos secundarios ("Otros movimientos") en `packages/i18n-messages` (es).

## 6. Tests

- [ ] 6.1 Con una sola cuenta elegible: `showAccountSelector === false` y el submit usa esa cuenta implícita.
- [ ] 6.2 Con dos o más elegibles: `showAccountSelector === true`.
- [ ] 6.3 El tab `transferencia` con una sola cuenta propia no habilita el flujo (elegibilidad correcta).
- [ ] 6.4 El default de cuenta en create respeta el orden de D3 (con y sin `lastUsedAccountId`).
- [ ] 6.5 Cargar un gasto simple no requiere abrir ninguna sección avanzada (camino mínimo: monto → cuenta si aplica → categoría → fecha → guardar).
- [ ] 6.6 Los tipos secundarios (`adjustment`, `exchange`) siguen alcanzables y funcionan igual que hoy.

## 7. Cierre

- [ ] 7.1 `pnpm lint` y `pnpm typecheck` en verde.
- [ ] 7.2 Suite de `@grana/movement-form` en verde con los casos nuevos.
- [ ] 7.3 `pnpm openspec:check` en verde.
- [ ] 7.4 Archivar el change antes del merge a `main` (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`, actualizar `AGENTS.md` si aplica).
