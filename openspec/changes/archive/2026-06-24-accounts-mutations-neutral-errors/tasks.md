## 1. Catálogo i18n (keys faltantes)

- [x] 1.1 Agregar bajo `accounts.errors` en `packages/i18n-messages/src/es.json`: `account_not_found` ("Cuenta no encontrada."), `currency_not_found` ("Moneda no encontrada en la cuenta."), `pending_debt` (texto del guard de deuda de tarjeta).
- [x] 1.2 Agregar las mismas 3 keys en `packages/i18n-messages/src/en.json` con su traducción.
- [x] 1.3 Verificar paridad de catálogos: 1500/1500 keys, sin huérfanas en ningún lado.

## 2. Contrato del paquete

- [x] 2.1 En `packages/accounts/src/mutations.ts`, `AccountMutationResult<T>`: `formError?: string` → `messageKey?: string`. Conservados `fieldErrors?`, `errorCode?`, `reason?`.
- [x] 2.2 JSDoc del tipo actualizado: `messageKey` = path completo del catálogo; `errorCode` = código PG crudo; `reason` = slug estructurado de UX; cada plataforma traduce con su motor.
- [x] 2.3 El tipo se reexporta desde `src/index.ts` (sin cambios al export; ya no queda `formError` en la superficie pública).

## 3. Return sites de las mutations

- [x] 3.1 `createAccount`: los dos `formError: *.message` → `messageKey: 'accounts.errors.create_failed'`.
- [x] 3.2 `archiveAccount` (deuda de tarjeta): → `messageKey: 'accounts.errors.pending_debt'`; **conservado** `reason: 'pending_debt'`.
- [x] 3.3 `deleteAccount`: `txError.message` → `'accounts.errors.delete_failed'`; literal de movimientos → `'accounts.errors.delete_has_transactions'`.
- [x] 3.4 `updateAccount`: (no tenía check "no encontrada"; sin cambios). N/A.
- [x] 3.5 `addCurrencyToAccount` / `deactivateCurrencyFromAccount` (no encontrada) → `'accounts.errors.account_not_found'`.
- [x] 3.6 `deactivateCurrencyFromAccount`: `fetchError.message` → `'accounts.errors.save_failed'`; última moneda → `'accounts.errors.deactivate_last_currency'`; moneda no existe → `'accounts.errors.currency_not_found'`; saldo ≠ 0 → `'accounts.errors.deactivate_non_zero_balance'`.
- [x] 3.7 Verificado: ningún return site devuelve literal español ni `*.message` crudo (grep solo deja `messageKey`/`errorCode`/`reason`/`fieldErrors`).

## 4. Wrapper web (thin)

- [x] 4.1 `finish()` (`apps/web/app/_actions/accounts.ts`): resuelve `messageKey` vía translator de nivel raíz (`getTranslations()` + `t(messageKey)`); mantiene `translatePostgresError` para `errorCode`.
- [x] 4.2 Precedencia: `messageKey` → `t`; si no, `errorCode` → `translatePostgresError`; se conserva el paso de `fieldErrors` y `reason`.
- [x] 4.3 `ActionResult` (web) sin cambios de forma pública — solo cambia de dónde sale el `formError` mapeado.

## 5. Detalle a confirmar (ver design)

- [x] 5.1 Inspeccionado: `fieldErrors` salen de yup (`@grana/validation`), gobernados por `setLocale`/`translateFieldError` (keys resueltas en render o strings localizadas por catálogo). Es un concern de la capa de validación con su propio mecanismo cross-platform (`setYupLocale`), **no** del contrato de resultado de mutación. **Decisión: diferir** — mobile maneja `setYupLocale` con su locale en `mobile-accounts-route` (#3). No se toca acá.

## 6. Verificación

- [x] 6.1 No hay script `typecheck` por-paquete; los tipos del paquete compilan vía el typecheck de web (lo importa). OK.
- [x] 6.2 `pnpm --filter web typecheck` pasa.
- [x] 6.3 `pnpm --filter web lint` pasa.
- [x] 6.4 `pnpm --filter web test` pasa: 43 files, 466 tests. Sin tests en `@grana/accounts` que mover.
- [ ] 6.5 Pase manual de flujos de error (output idéntico en español): eliminar cuenta con movimientos, desactivar última moneda, desactivar moneda con saldo ≠ 0. **Pendiente de pase con la app corriendo.**
- [x] 6.6 `openspec validate accounts-mutations-neutral-errors --strict` OK.
