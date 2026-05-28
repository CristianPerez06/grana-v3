# @grana/money-logic

Lógica de negocio **pura** compartida entre `apps/web` y `apps/mobile`: balance derivado, ciclos de tarjetas de crédito (período/estado/sugerencia de fechas) y recurrencias (cálculo de próxima fecha, decisión de generación, detección de sugerencias).

## Por qué este package existe

Las dos apps necesitan responder las mismas preguntas contables:

- ¿Cuánto disponible tiene esta cuenta?
- ¿En qué período de la tarjeta cae este consumo?
- ¿Qué día tendría que generarse la próxima instancia de esta recurrencia?

Si cada app reimplementa esas reglas en su `lib/`, eventualmente divergen y los números muestran cifras distintas según la plataforma. Este package es el único lugar donde viven esos cálculos.

## Qué entra acá

Solo funciones **puras**:

- **Sin dependencias de Supabase, Next, fetch, React ni React Native.** El package se carga igual en Node, browser, Metro y Vitest.
- **Sin acceso a I/O.** Las funciones reciben datos ya cargados y devuelven datos calculados.
- **Sin estado global.** Cada llamada es determinística para los mismos inputs.

`decimal.js` (vía `@grana/validation`) sí se usa — es la base del tipo `Money` y todos los cálculos monetarios pasan por él según los principios cross-cutting de `AGENTS.md`.

## Qué NO entra acá

- **Queries de Supabase.** Viven en `apps/<name>/lib/.../queries.ts` porque cada app construye su cliente Supabase de forma distinta (SSR en web, AsyncStorage en mobile).
- **Server actions.** Mismo motivo: dependen del runtime de cada plataforma.
- **Componentes UI o hooks.** Para contratos visuales está `@grana/ui-contracts`.
- **Helpers acoplados al timezone del usuario** (`getTodayAR`). Eso vive en cada app porque el helper de "hoy" depende de la zona horaria del perfil, no de la lógica pura. Las funciones puras de este package aceptan `today` como parámetro.

## Módulos

| Archivo | Qué expone |
|---|---|
| `balance.ts` | `calculateTransactionSums(rows, accountIds)` — agrega ingresos/gastos/transferencias/ajustes por cuenta y moneda. |
| `cards.ts` | `derivePeriodStatus`, `derivePeriodVariant`, `suggestNextPeriodDates`, `assignTransactionToPeriod`, `splitAmountIntoInstallments`, helpers de aritmética de fechas ISO. |
| `recurrences.ts` | `getNextRecurrenceDate`, `decideRecurrenceInstance`, `detectRecurrenceSuggestions`. |

## Cómo se consume

```ts
import {
  calculateTransactionSums,
  derivePeriodStatus,
  decideRecurrenceInstance,
} from '@grana/money-logic'
```

Las apps mantienen sus propios `lib/.../balance.ts` y `lib/cards/queries.ts` para la capa que sí habla con Supabase. Esos archivos re-exportan las funciones puras de este package para no romper imports históricos.
