# Implementación — Alta de movimientos (Fase 1, superficie)

Notas del pase de implementación autónomo. Branch: `feature/simplify-movement-form-surface`. Scope: **solo superficie (Fase 1)**; lo data-driven es #31.

## Hecho y en verde

Cada tajada quedó commiteada con `lint` + `typecheck` + tests pasando.

| Área | Qué | Commit |
|---|---|---|
| Hook `@grana/movement-form` | `PRIMARY_TABS`/`SECONDARY_TABS`, `secondaryTabs` (elegibles), `isSecondaryTab`, `showAccountSelector` — con tests (37/37) | `feat(movement-form): add tab partition and account-selector derivations` |
| Mobile | Tabs **Gasto · Ingreso · Otros** (hoja para transfer/ajuste/cambio elegibles); ocultar cuenta con una sola elegible; picker **sin drill obligatorio** (tap = elige categoría, chevron = subcategorías) | `feat(mobile): tabs Gasto/Ingreso/Otros, hide single account, no forced category drill` |
| Mobile | **Orden invertido** (categoría antes que cuenta); **chips Fecha Hoy/Ayer** + calendario | `feat(mobile): invert order (category before account) and add Hoy/Ayer date chips` |
| Mobile | **Selector de cuenta por familia Débito/Crédito** (`AccountFamilySelect`): toggle de familia + chips con avatar de marca; con una sola por familia el toggle la elige | `feat(mobile): account selector grouped by Débito/Crédito family` |
| Mobile | **Avanzadas como chips symbol-forward** (reintegro/compartir/repetir): fila de chips que activan; los params aparecen inline | `feat(mobile): advanced sections as symbol-forward activation chips` |
| i18n | `category_drill`, `other_types`, `date_today`, `date_yesterday`, `family_debit`, `family_credit` (es + en, paridad OK) | (en los commits mobile) |

**El alta mobile quedó completamente rediseñada** (Fase 1) y en verde. **Verificado:** `@grana/movement-form` tests 37/37; `apps/mobile` typecheck 0 errores; eslint limpio; paridad de claves es/en 0 diferencias.

## Decisiones que tomé (ante ambigüedad, la conservadora)

- **`showAccountSelector` se basa en "una sola cuenta elegible para el tipo"**, no por moneda. El refinamiento por moneda (Billetera ARS + cuenta USD → ocultar y que el toggle de moneda desambigüe) **quedó diferido**: hacerlo bien requiere que el toggle de moneda maneje la selección de cuenta (cambio en la cascada de moneda), riesgoso para este pase. Está comentado en `use-movement-form.ts`.
- **Transferencia/Cambio siempre muestran el selector de cuenta** (necesitan elegir entre ≥2 por su semántica), aunque `showAccountSelector` sea false por otra razón.

## Refinamiento pendiente en mobile (menor)

- Selector de cuenta con **muchas** cuentas: hoy los chips de la familia activa **envuelven** (wrap). El drilldown/hoja del escenario 3 (design D10) es un refinamiento; con pocas cuentas —el caso común— ya queda bien.
- **Monto centrado** en mobile — el input de monto no es un "hero card" como en web; tweak menor, pendiente.

## Web — diferido a una pasada revisada (recomendado)

**`apps/web/.../movement-form.tsx` no se tocó** (queda intacto y seguro; el hook nuevo no cambia su render porque web todavía no consume los derivados nuevos).

El componente sirve **desktop y mobile-web**, y el scope prohíbe tocar desktop. Por eso el rediseño web necesita:
1. Un hook `useIsMobile` (matchMedia) para **branchear layout en JS** — los cambios de comportamiento (drill, tabs) no se pueden gatear solo con CSS.
2. Rendear la variante mobile-web sin alterar el árbol de desktop.

Es un refactor delicado y **no puedo validar la no-regresión de desktop de forma autónoma** (requiere prueba visual en ambos anchos). Recomiendo hacerlo en una sesión con tu revisión, no a ciegas. Cuando arranquemos: agrego `useIsMobile`, y voy gateando pieza por pieza (empezando por ocultar cuenta con una sola + tabs), verificando desktop a cada paso.

## No hice (por regla)

- **No abrí PR** (esperá tu "abrí el PR"). **No mergeé a main.** La branch queda lista y en verde.

## Próximos pasos sugeridos (para revisar juntos)

1. Selector de cuenta por familia en mobile (D10) — el más jugoso.
2. Web mobile-web gateado por breakpoint (la mitad del scope todavía).
3. Avanzadas como chips (D9) + monto centrado en mobile.
