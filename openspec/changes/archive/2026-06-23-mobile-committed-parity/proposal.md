## Why

El dashboard mobile quedó atrás del web tras el rediseño de la card **"Comprometido"** (modelo "obligaciones pendientes"). Desde el commit `0f549f3` ("mobile parity for redesign v2"), aterrizaron 8 commits web-only que reformaron esa card (capa de datos + UI), más dos pulidos menores (auto-escala del monto central de la dona, nombre del banco en "Dónde está"). La capa de datos compartida (`@grana/dashboard`) ya cambió de forma **aditiva**, así que mobile **compila y muestra números correctos hoy** — la deuda quedó bien acotada automáticamente. Lo que falta es **presentación**: la card mobile todavía pinta el layout viejo de dos tiles y la spec de `dashboard` ya describe el modelo nuevo también para mobile (escenario "La card 'Comprometido' se renderiza en mobile con el mismo modelo"). Es decir, la implementación nativa **derivó de una spec ya vigente**.

## What Changes

- **`CommittedSection` (mobile)** — re-portar el rediseño de `committed-section.tsx`: titular "Total a pagar", **dos secciones de obligación** ("Resúmenes de tarjeta · a pagar + en curso" y "Recurrencias · pendientes de confirmar") cada una con su subtotal (ARS + USD consistente) y la **lista de los 3-4 movimientos de mayor monto** (fecha · descripción · monto), con **prioridad de detalle** en Recurrencias; **aviso de vencido** ("incluye $X vencido") cuando aplica; banda "Ya entra" + cierre neto como contexto (ya presente, se conserva). Reemplaza el layout viejo de dos tiles + strip USD al pie.
- **`CommittedSkeleton` (mobile)** — re-formar al shape nuevo: total + dos secciones de obligación (ícono + label + subtotal + un par de filas de movimiento).
- **`SpendingDonut` (mobile)** — portar la auto-escala del monto central para que los totales largos no pisen el anillo (espejo de `donutAmountFontSize`).
- **`AccountsCard` (mobile)** — mostrar el **nombre del banco/institución** (`institutionName ?? name`) en el callout de concentración y en la grilla de cuentas, igual que web.
- **Sin cambios en la capa de datos mobile**: `lib/dashboard/queries.ts` ya devuelve el objeto enriquecido (`overdue`, `topCard`, `topRecurring`, `institutionName`); los strings i18n nuevos ya existen en `@grana/i18n-messages`.

## Capabilities

### New Capabilities
<!-- Ninguna. Esta change no introduce capacidades nuevas. -->

### Modified Capabilities
- `dashboard`: la card **"Dónde está"** pasa a mostrar el nombre de institución/banco de la cuenta cuando existe (fallback al nombre dado por el usuario), en ambas plataformas. El resto del trabajo (modelo "Comprometido" en mobile, dona legible) **conforma la implementación nativa a requirements ya vigentes** y no altera la spec.

## Impact

- **Código (solo mobile, presentación):** `apps/mobile/components/dashboard/CommittedSection.tsx`, `CommittedSkeleton.tsx`, `SpendingDonut.tsx`, `AccountsCard.tsx`; un helper nuevo `apps/mobile/lib/donut-amount.ts` (espejo puro del de web).
- **Sin cambios de datos/API:** consume `@grana/dashboard` (`getCommittedOutlook`, `HeroAccountBalance.institutionName`) y `@grana/i18n-messages` (keys `dashboard.committed.*`, ya presentes) tal como están.
- **Referencia de port:** `apps/web/app/(app)/dashboard/_components/{committed-section,committed-skeleton,spending-donut,accounts-card}.tsx` y `apps/web/lib/donut-amount.ts`.
- **Regla cross-platform:** mismos nombres/estructura/props públicas que web, render idiomático RN (`View`/`Text`/`react-native-svg`/`lucide-react-native`/NativeWind, mirror de tokens, sin DOM ni Tailwind-web).
- **Riesgos:** bajo. No toca lógica monetaria ni queries; la deuda ya se calcula correcta. La tira "Compartido" sigue sin par mobile (fuera de alcance, como en la spec).
