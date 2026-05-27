# @grana/validation

Esquemas de validación **Yup** + helpers, puros y cross-platform. Es la fuente única de las reglas de forma de los datos que entran a las server actions de web y a los forms de mobile.

## Por qué este package existe

Las dos apps validan los mismos inputs (signup, alta de cuenta, consumo de tarjeta, recurrencia…). Si cada una reimplementa las reglas, divergen: un campo que web exige y mobile no, un mínimo distinto, un mensaje de error que no matchea. Centralizar los esquemas garantiza que ambas plataformas aceptan y rechazan exactamente lo mismo.

Acá también vive el tipo `Money` (branded, backed por `decimal.js`) y sus parsers, porque toda la aritmética monetaria del repo arranca en ese tipo (ver principios cross-cutting en `CLAUDE.md`).

## Qué exporta

| Módulo | Qué expone |
|---|---|
| `money.ts` | El tipo branded `Money`, `parseMoneyInput`, `normalizeMoneyAmount`. Base de todo cálculo monetario. |
| `auth.ts` | `signupSchema`, `loginSchema`, `forgotSchema`, `resetSchema`, `otpCodeSchema` (+ tipos). |
| `accounts.ts` | `createAccountSchema`, `updateAccountSchema`, `addCurrencySchema`. |
| `transactions.ts` | Esquemas de ingreso, gasto, transferencia, ajuste y cambio (`exchange`). |
| `categories.ts` | Esquemas de categorías y subcategorías propias. |
| `credit-cards.ts` | Alta experto/novato, consumo, cuotas, pago de resumen, fechas de período. |
| `recurrences.ts` | Plantillas de recurrencia, confirmación/aceptación/descarte de instancias y sugerencias. |
| `onboarding.ts` | `profileSchema`, `initialBalanceSchema`. |
| `validate-action-input.ts` | `validateActionInput(schema, input)` → `ValidationResult<T>` (`{ ok, data }` o `{ ok:false, fieldErrors }`), patrón usado por todas las server actions. |
| `translate-error.ts` | `translateFieldError` — mapea la key de error de Yup a un mensaje i18n. |

## Reglas

- **Puro:** solo `yup` y `decimal.js`. Sin Supabase, Next, React ni React Native. Carga igual en Node, browser, Metro y Vitest.
- Los esquemas devuelven **keys** de error, no copy traducida; la traducción la hace `translateFieldError` contra los catálogos de `@grana/i18n-messages`.

## Cómo se consume

```ts
import { createExpenseSchema, validateActionInput, Money } from '@grana/validation'
```
