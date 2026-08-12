# Implementación — Alta de movimientos (Fase 1, superficie)

Notas del pase de implementación autónomo. Branch: `feature/simplify-movement-form-surface`. Scope: **solo superficie (Fase 1)**; lo data-driven es #31.

## Hecho y en verde

Cada tajada quedó commiteada con `lint` + `typecheck` + tests pasando.

| Área | Qué | Commit |
|---|---|---|
| Hook `@grana/movement-form` | `PRIMARY_TABS`/`SECONDARY_TABS`, `secondaryTabs` (elegibles), `isSecondaryTab`, `showAccountSelector` — con tests (37/37) | `feat(movement-form): add tab partition and account-selector derivations` |
| Mobile | Tabs **Gasto · Ingreso · Otros** (hoja para transfer/ajuste/cambio elegibles); ocultar cuenta con una sola elegible; picker **sin drill obligatorio** (tap = elige categoría, chevron = subcategorías) | `feat(mobile): tabs Gasto/Ingreso/Otros, hide single account, no forced category drill` |
| Mobile | **Orden invertido** (categoría antes que cuenta); **chips Fecha Hoy/Ayer** + calendario | `feat(mobile): invert order (category before account) and add Hoy/Ayer date chips` |
| i18n | `category_drill`, `other_types`, `date_today`, `date_yesterday` (es + en, paridad OK) | (en los commits mobile) |

**Verificado:** `@grana/movement-form` tests 37/37; `apps/mobile` typecheck 0 errores; eslint limpio en los archivos tocados; paridad de claves es/en 0 diferencias.

## Decisiones que tomé (ante ambigüedad, la conservadora)

- **`showAccountSelector` se basa en "una sola cuenta elegible para el tipo"**, no por moneda. El refinamiento por moneda (Billetera ARS + cuenta USD → ocultar y que el toggle de moneda desambigüe) **quedó diferido**: hacerlo bien requiere que el toggle de moneda maneje la selección de cuenta (cambio en la cascada de moneda), riesgoso para este pase. Está comentado en `use-movement-form.ts`.
- **Transferencia/Cambio siempre muestran el selector de cuenta** (necesitan elegir entre ≥2 por su semántica), aunque `showAccountSelector` sea false por otra razón.

## Diferido a propósito (necesita tu revisión / es más grande)

- **Selector de cuenta por familia Débito/Crédito (D10)** — el componente nuevo grande (toggle → familia+chips → drilldown). El hook ya expone lo necesario (`showAccountSelector`, `eligibleAccounts`); falta la UI. Lo dejé para hacerlo con vos mirando, es lo más nuevo.
- **Avanzadas symbol-forward (D9)** en mobile — hoy siguen como cards con switch (funcionan). Pasarlas a la fila de chips livianos es un restyle de reintegro/compartir/repetir; lo dejé para no arriesgar el flujo de reintegro/cuotas overnight.
- **Monto centrado + compacto** en mobile — tweak menor, pendiente.
- **Web (`apps/web/.../movement-form.tsx`) — TODO diferido.** El componente sirve **desktop y mobile-web**; cada cambio debe ir **gateado por breakpoint** (Tailwind `md:`) para no tocar desktop. Es pesado y de riesgo alto; lo dejé entero para una pasada revisada. El hook nuevo **no** cambia el render de web (web todavía no consume los derivados nuevos), así que web quedó intacto y seguro.

## No hice (por regla)

- **No abrí PR** (esperá tu "abrí el PR"). **No mergeé a main.** La branch queda lista y en verde.

## Próximos pasos sugeridos (para revisar juntos)

1. Selector de cuenta por familia en mobile (D10) — el más jugoso.
2. Web mobile-web gateado por breakpoint (la mitad del scope todavía).
3. Avanzadas como chips (D9) + monto centrado en mobile.
