## Contexto

Tercera y última change del stack de cuentas mobile. Construye el consumer nativo thin sobre la capa compartida ya lista (`@grana/accounts`, `@grana/cards`, `@grana/transactions`, `@grana/money-logic`) + el contrato de error neutro de #1. Prerequisitos: #1 (`messageKey` traducible) y #2 (read slice de movimientos).

## El shell: web tiene server actions, mobile no

```
   WEB (_actions/accounts.ts)              MOBILE (lib/accounts/mutations.ts)
   'use server'                            módulo plano (no 'use server')
   createClient() (RSC/browser)            supabase singleton (lib/supabase.ts)
   getAuthenticatedUserId()                supabase.auth.getUser()
   getTodayAR()                            getTodayAR()  (@grana/money-logic)
   call @grana/accounts mutation  ◄──────► call @grana/accounts mutation  (MISMO pkg)
   finish(): messageKey→next-intl          map: messageKey→errorKey (useT en pantalla)
   revalidatePath(...)                     queryClient.invalidateQueries(...)
   → ActionResult                          → { ok } | { ok:false, errorKey, fieldErrors }
```

El precedente exacto del mutator nativo es `apps/mobile/lib/categories.ts` (shape `{ ok } | { ok:false, errorKey, fieldErrors }`, consumido por las pantallas con `useT(errorKey)`). La diferencia: categories reimplementaba la lógica en mobile (duplicada con "keep in sync with web"); cuentas es **más delgado** porque la lógica vive en `@grana/accounts` — el mutator solo resuelve auth/today, llama el paquete y mapea.

## Decisión: reads vía TanStack, query keys propios de mobile

Mobile ya lee con TanStack (`useDashboardHero` → `getDashboardHero(supabase)`). Espejo: `lib/accounts/queries.ts` con hooks sobre los paquetes. Los `QUERY_KEYS` de web viven en `apps/web/lib` (no compartidos), así que mobile define los suyos en `lib/accounts/query-keys.ts`. `today` se inyecta solo donde el read lo pide: `getCashAndBankAccounts(supabase)` y `getAccountDetail(supabase, id)` **no** lo necesitan; las mutations sí (`createAccount`/`archiveAccount`/`addCurrency`).

## Decisión: web "drawer" → mobile "pantalla pushed"

Web abre crear/editar/agregar-moneda en drawers (Radix). Mobile los hace **pantallas pushed** en el stack, mirror de `settings/categories/{new,[id]/edit}`. Es el patrón cross-platform del repo: mismos nombres de componente/props públicas, impl idiomática por plataforma. Cada pantalla: `SafeAreaView edges=['top']` + `PageHeader` con `backLink` (chrome visible desde el primer paint, botones disabled hasta cargar data — regla canónica de `route-loading-and-errors`), nunca el header nativo del stack (`Stack { headerShown:false }`).

## Decisión: action sheet = `Popover` + `Alert`, sin lib nueva

No hay ni se agrega `@expo/react-native-action-sheet` ni bottom-sheet libs. `AccountRowMenu` reusa el patrón de `CategoryRow`: botón `MoreHorizontal` → `Popover` (Modal-based bottom sheet) con `MenuItem`s (Editar / Archivar|Reactivar / Eliminar), y `Alert.alert` para la confirmación destructiva. El caso `pending_debt` (deuda de tarjeta en archive) se ramifica por `reason`, no por texto.

## Decisión: tokens estructurales, no aliases shadcn

Los aliases shadcn (`bg-muted`, `bg-background`, `bg-primary`) son web-only (renderizan transparente en mobile). Mobile usa tokens estructurales (`bg-page`, `bg-card`, `bg-navy`, `bg-border-soft`, `text-text`, `text-muted`, `bg-account-*`). Para props RN que no son className (tints de íconos Lucide, `RefreshControl`) se usan los pixel values de `lib/colors.ts`. Los mocks de `docs/design/accounts*/mobile` se traducen a tokens, nunca hex literal.

## Decisión: `@grana/cards` queda fuera

`/accounts` (web y por ende mobile) es **solo cash+bank**: usa `getCashAndBankAccounts`, no `getAccounts`; el detalle de una credit redirige a `/cards/[id]`. El guard de deuda de tarjeta (`getCreditCardDebtCheck`) dentro de `archiveAccount` solo dispara para `type:'credit'`, que no aparece acá. Entonces mobile-accounts no toca `@grana/cards`. El módulo de tarjetas nativo es change posterior, propia.

## Inputs de dinero

Saldos iniciales (en crear) y montos usan `MoneyAmountInput` (primitivo cross-platform, `apps/mobile/components/ui/MoneyAmountInput.tsx`). En editar, los saldos van **locked** (mirror de `LockedMoneyGroup` web). El form compone `Label + MoneyAmountInput + error Text` (el primitivo no trae label/error).

## Detalles a confirmar en apply

- **Saldo corriente por fila:** web lo computa pero lo **esconde en mobile-web** (muestra 2 columnas). Para nativo: ¿mostrar saldo corriente por fila, o solo el total en el hero y la lista sin running balance? A decidir con los mocks `docs/design/accounts-detail/mobile`. El cálculo (`computeRunningBalances`) está disponible igual.
- **Fidelidad de BankSelector custom:** alta de institución inline con color picker (6 colores `ACCOUNT_COLOR_KEYS`) — confirmar paridad visual con el mock nativo.
- **Fidelidad del avatar/color picker** en crear/editar.
- **`fieldErrors` neutros:** depende de lo resuelto en #1 (task 5.1). Si quedaron como strings localizados, el mutator los pasa tal cual; si son keys, se resuelven con `useT`.

## Verificación

`pnpm --filter mobile typecheck` + `lint` pasan; React en una sola versión (RN 0.81 pinea 19.1.0). Pase manual en simulador: pushear Cuentas desde Menú; lista con secciones + archivadas; crear cuenta (banco con institución custom + saldos); detalle con saldos + movimientos + reintegros; editar nombre/institución; agregar y desactivar moneda; archivar/eliminar/reactivar (con confirmación) y el guard de movimientos; flujos de error mostrando el mensaje traducido por `useT`. Paridad funcional con web validada flujo por flujo.
