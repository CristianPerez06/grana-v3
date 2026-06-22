## Why

El hero navy de `/cards` muestra una sola cifra, "A pagar este mes" (resúmenes ya cerrados e impagos). Cuando no hay nada cerrado-impago — el caso más común cuando el usuario está al día — el hero queda vacío con un texto seco ("No tenés resúmenes a pagar este mes") y no comunica nada útil. El usuario pierde la pregunta que más le importa de un vistazo: **"¿más o menos cuánto se me viene a pagar en tarjetas?"**. Esa información ya existe en los datos (los resúmenes en curso devengándose) pero el hero no la expone.

Además hay un drift: el spec pide mostrar `$ 0` cuando "A pagar" es cero, pero la UI muestra un texto en su lugar.

## What Changes

- El hero navy de `/cards` pasa de **una** cifra a **dos**, lado a lado:
  - **A pagar (ahora)**: sin cambios de semántica — suma de resúmenes **cerrados e impagos** (deuda firme, vence ~este mes). Empty-state alineado al spec: muestra **`$ 0`**, no un texto. (Corrige el drift.)
  - **En curso** — NUEVO: suma de **todos los resúmenes abiertos (aún no cerraron) con saldo > 0** de todas las tarjetas activas. Es el **acumulado real** de los consumos del ciclo abierto (no una estimación): un piso que sigue creciendo hasta el cierre. Lleva el caption **"se sigue sumando hasta el cierre"**. Responde "lo que se viene".
- Cada fila de **"Próximos cierres"** (hoy `fecha · nombre`) suma el **monto del resumen** de esa tarjeta → `fecha · nombre · ~monto`, para dar el desglose por tarjeta/fecha que respalda el agregado "En curso".
- Bimoneda se mantiene en ambas cifras: ARS primario + USD subordinado, **nunca sumados ni convertidos**.
- El contrato del summary (`getCardsMonthSummary` / `CardsMonthSummary`) se extiende con la cifra "En curso" por moneda y el monto por fila de próximos cierres.

No se rediseña el resto del listado (wallet, grupos por banco, filas de 2 líneas, archivadas): **solo el hero y el summary que lo alimenta**.

**Deroga un no-goal vigente.** El requirement "El estilo visual de `/cards` (raíz)…" tiene el no-goal "Rediseñar el hero ni agregar KPIs nuevos", y el propio spec exige (su última cláusula) abrir un change OpenSpec y modificar ese requirement antes de tocarlo. Este change hace exactamente eso: deroga ese no-goal **acotado a la cifra "En curso"** (cualquier otro KPI nuevo sigue fuera de alcance).

## Capabilities

### New Capabilities
<!-- Ninguna capability nueva: es una modificación del hero existente. -->

### Modified Capabilities
- `cards`: el requirement "El listado de tarjetas se muestra como wallet con hero de pago mensual" cambia el contrato del hero navy (de una cifra a dos: "A pagar ahora" + "En curso"), el empty-state de "A pagar" (`$ 0` en vez de texto), y enriquece las filas de "Próximos cierres" con el monto. Incluye el contrato de datos `getCardsMonthSummary` (nueva agregación de resúmenes abiertos y el monto por fila).

## Impact

- **Spec**: `openspec/specs/cards/spec.md` — requirement del listado/hero + notas del hero navy (la línea que hoy pide `$ 0`).
- **Datos**: `apps/web/lib/cards/queries.ts` — `getCardsMonthSummary` / type `CardsMonthSummary`. Necesita el resumen **abierto** de cada tarjeta activa (que para una tarjeta en estado "a pagar" NO es `activePeriod`, sino el período siguiente), sin introducir N+1.
- **UI web**: `CardsMonthHero` (+ su container) en `apps/web/app/(app)/cards/`.
- **i18n**: `packages/i18n-messages` — claves `cards.month_hero.*` (nueva etiqueta "En curso", retiro/reuso del `empty` de "A pagar").
- **Mobile**: mantiene **paridad estructural** (hero unificado con las dos cifras), pero la implementación nativa es un **follow-up aparte** (no entra en este change); la lógica pura de agregación MAY compartirse vía helpers en `lib/cards/`.
- **Conceptual**: "A pagar ahora" = caja; "En curso" = comprometido/devengado (alineado con la lente "Comprometido" del dashboard y el vocabulario "EN CURSO" del detalle de tarjeta). Sin cambios de contabilidad, solo de presentación del hero.
