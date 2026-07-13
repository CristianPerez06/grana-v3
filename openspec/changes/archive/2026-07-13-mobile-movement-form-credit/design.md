# Design — mobile-movement-form-credit

## Contexto

B-minimal dejó la familia de tarjeta inalcanzable **por diseño**: restringió el picker a cash/bank sin tocar el hook. Todo lo demás ya está: `useMovementForm` expone el estado/handlers de cuotas y reintegro, el submit dispatcher rutea `isCredit`/`isInstallments` a `registerCardPurchase`/`registerInstallments`, y los mutators mobile bindean los 14 slots desde B. Este change es la contracara: **hacer alcanzable** lo que ya funciona, con JSX.

## Decisión 1 — Data swap: `getAccounts` con proyección espejo del loader web

La pantalla pasa de `getCashAndBankAccounts(supabase)` a `getAccounts(supabase, { today: getTodayAR() })` (el read ya isomórfico que web usa para el drawer). La proyección a `MovementFormAccount` copia la del `movement-drawer-loader.tsx` web:

```
cash/bank → igual que hoy (balances reales)
credit    → type: 'credit', balances: { ARS: 0, USD: 0 }   // off-ledger
            avatar: resolveAccountAvatar({...}, institution) // @grana/ui-contracts
```

`balances {0,0}` no es un placeholder perezoso: las tarjetas son off-ledger y el aviso de saldo negativo nunca aplica a credit (`negativeWarning` ya lo excluye en el hook). El query key del picker cambia con el swap (`accountKeys.list` era cash/bank); la pantalla usa su propio key **fuera del prefijo `['accounts']`**: `['movement-form','accounts']`. Decidido en apply: además de no pisar el cache de la lista de cuentas, el key debe escapar del sweep de invalidación post-submit (`['accounts']`), porque refetchear este read pesado (tarjetas + períodos) en cada alta estolaba el JS thread durante el pop de navegación (pantalla blanca). La invalidación post-submit se difiere con `InteractionManager.runAfterInteractions` por el mismo motivo.

## Decisión 2 — Cero cambios a hook / mutators / packages (invariante del change)

Regla dura para el apply: si algo parece requerir tocar `@grana/movement-form`, `@grana/transactions-mutations` o `mutators.ts`, es señal de mal entendimiento — parar y revisar. Las gates ya existen en el hook:

> **Excepción registrada en apply (bug upstream, no scope creep):** el submit del hook usaba `startTransition(async …)`. En React 19 una async transition mantiene el árbol suspendido mientras resuelve, y expo-router envuelve cada ruta en un Suspense con fallback vacío → **pantalla nativa en blanco durante todo el submit** (expo/expo#37155, cerrado stale sin fix). Se reemplazó `useTransition` por un flag `isPending` explícito (`runSubmit`), web-neutral (misma semántica de `isSubmitting`; los 9 tests del hook y los 466 de web pasan sin cambios). Es la única línea tocada en packages.

- `eligibleFor`: credit sólo es elegible en la tab Gasto (las demás tabs la filtran solas).
- `isInstallments = isCredit && ARS && installments ≥ 2` — con USD nunca hay cuotas.
- `submitCreate`: credit+cuotas → `registerInstallments`; credit simple → `registerCardPurchase` (con `reimbursementDecl` si target=statement); cash/bank → `createExpense`.
- `setAccountId`/`setTab` resetean `installments` a `'1'` — no hay estado zombie al cambiar de cuenta.

## Decisión 3 — UI de cuotas: chips + stepper inline, constantes locales espejadas

Mirror del web: chips preset `[1, 3, 6, 12]` + opción "Otra" que revela un stepper (−/input/＋) acotado a `2–60`. `INSTALLMENT_OPTIONS`/`MAX_INSTALLMENTS` son **constantes de presentación locales al componente** en web (no exportadas de ningún package); mobile declara las suyas con los mismos nombres/valores — duplicación consciente de 2 literales, no amerita extracción (regla de componentes reusables). Preview por cuota: `Money.divide(Money.from(amount), n)` de `@grana/validation` (ya dep), igual que web (`installmentPreview`). El CTA cambia a `actions.register_installments` (`{count}`) cuando `isInstallments`. Sección visible sólo con credit en Gasto; con USD seleccionado muestra el hint `installments_options.ars_only` en lugar de los chips.

## Decisión 4 — Reintegro: paridad completa, inline

Se porta el bloque web entero (no la versión lean): los campos ya viven todos en el hook y las keys i18n ya existen; recortar ahora crearía una divergencia funcional web↔mobile que habría que documentar y luego cerrar. Gating y cascadas (todas ya en hook/web, se replican en JSX):

```
toggle visible:   tab === 'expense'   (incl. cuotas — reintegro sobre compra en cuotas, ver nota)
al encender:      default de cuenta de acreditación (el hook ya lo setea por cascada de setAccountId;
                  mirror del re-pick del toggle web si hiciera falta — verificar en apply)
target radio:     visible sólo con credit (cash/bank ⇒ siempre 'account', sin radio)
credit-to picker: visible cuando !isCredit || target === 'account' (cash/bank del usuario)
%/tope:           inputs auxiliares → applyReimbursementPercent(percent, cap) recalcula el monto
received-now:     checkbox (Switch) + hint condicional (received_now_hint / pending_hint)
```

Layout inline (card expandible bajo el toggle), consistente con el split compartido de B-minimal. Si en el device se siente demasiado alto, sheetearlo es un refactor visual posterior que no toca estado.

## Decisión 5 — i18n: verificar, no crear

Las ~30 keys del dominio ya están en `@grana/i18n-messages` porque web las consume (`reimbursement.*` con toggle/estimated_amount/percent_label/cap_label/target/credit_to/received_now/hints/errors; `installments_options.*` con custom/ars_only/range; `drawer.credit_hint`; `actions.register_installments`; `installment_recalc_hint`). La tarea i18n es una **verificación** + alta de los pocos labels de pantalla que falten (probablemente ninguno o casi).

## Riesgos / notas

- **Cache del picker**: el swap a `getAccounts` no debe pisar el cache de `accountKeys.list` con un shape distinto (la lista de cuentas consume cash/bank). Usar un query key propio para el form.
- **USD en tarjeta**: consumo simple USD en credit es válido (`registerCardPurchase` maneja fx); sólo las cuotas son ARS-only. La UI no debe bloquear USD, sólo las cuotas.
- **Reintegro sobre compra en cuotas**: durante el apply, main mergeó `feat(shared): enable reimbursements on installment purchases` (9c9baeb), que quitó el gate `!isInstallments` del hook/web y enseñó a `registerInstallments` a declarar el reintegro contra la madre (subtipo *a resumen* → período de la primera cuota). Se reconcilió B.2a a esa regla: el bloque de reintegro se muestra también con cuotas activas (`showReimbursement = tab === 'expense'`), a paridad con web. Ya no son excluyentes.
- **Sin tests nuevos de negocio**: no hay lógica nueva (hook y orquestadores ya testeados). Verificación = typecheck + lint + smoke en device (consumo simple, cuotas 3/custom 24, reintegro a cuenta y a resumen, USD sin cuotas).
