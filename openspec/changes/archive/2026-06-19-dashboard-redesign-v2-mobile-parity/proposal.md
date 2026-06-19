## Why

El rediseño del dashboard v2 (`redesign-dashboard-home-v2`) aterrizó **solo en web**. La app nativa quedó atrás: "Dónde está" sigue siendo una lista, no tiene "Comprometido" ni "Gastaste este mes", y le faltan el chip "Sin registrar" y las barras de leyenda. Este change lleva esos deltas a Expo para recuperar la paridad web↔mobile que el repo exige (misma composición por feature, naming espejo).

## What Changes

- **"Dónde está" (mobile)** pasa de lista a la misma vista de **concentración** que web: callout `%` de la cuenta dominante + barra de concentración proporcional + grilla compacta 2-col + fila "En dólares". (mobile)
- **"Comprometido" (mobile)** — nueva sección nativa (antes diferida): dos mini-tiles de egreso + estado con ingreso recurrente (tile "Ya entra" + banda de cierre neto), por moneda. Nuevo hook `useCommittedOutlook` sobre `getCommittedOutlook` (ya en `@grana/dashboard`). (mobile)
- **"Gastaste este mes" (mobile)** — nueva sección nativa: barra caja vs tarjeta (en mobile, segmentos apilados en columna), reutilizando los hooks de balance + breakdown. (mobile)
- **Chip "SIN REGISTRAR" (mobile)** en la fila Ajustes de "Balance del mes". (mobile)
- **Barras de leyenda (mobile)** bajo cada categoría de "¿En qué gasté?". (mobile)
- **`computeConcentration` se promueve a `@grana/dashboard`** (función pura RN-safe) y la consumen web y mobile — sin duplicar la matemática de concentración.
- **NO incluido:** la tira **"Compartido"** queda **diferida en mobile** — la app nativa no tiene capa de datos de Hogar (`apps/web/lib/shared` es web-only y la paridad mobile del módulo `shared` está diferida). Se documenta como follow-up.

Sin cambios de data model ni de queries de agregación: los anchos/segmentos/neto se derivan de payloads existentes.

## Capabilities

### New Capabilities

_(ninguna — itera la capability `dashboard`)_

### Modified Capabilities

- `dashboard`:
  - MODIFIED "La card 'Dónde está' desglosa las cuentas del usuario" — la presentación de concentración (callout + barra + grilla) ahora aplica también en mobile.
  - MODIFIED "La card 'Comprometido' muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)" — deja de ser web-only; se implementa en mobile.
  - MODIFIED "El dashboard muestra cuánto del gasto del mes se financió en tarjeta" — la sección "Gastaste este mes" se implementa también en mobile (barra apilada).
  - MODIFIED "La fila 'Ajustes' de 'Balance del mes' marca el monto como sin registrar" — el chip aplica web y mobile (se quita el tag (web)).
  - MODIFIED "La leyenda de '¿En qué gasté?' muestra una barra proporcional por categoría" — aplica web y mobile (se quita el tag (web)).
  - MODIFIED "Los componentes del dashboard mobile siguen la convención de naming espejo del web" — suma `CommittedSection`, `CommittedSkeleton`, `SpentThisMonthSection`.
  - MODIFIED "La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales" — orden de secciones nativo: Hero → Dónde está → Balance → Comprometido → Gastaste este mes → ¿En qué gasté?.

## Impact

- **Solo `apps/mobile`** + promoción de un helper puro a `packages/dashboard`. Componentes: `AccountsCard`/`AccountsCardSkeleton` (rediseño), `MonthBalanceSection` (chip), `SpendingSection` (barras), nuevos `CommittedSection`/`CommittedSkeleton`/`SpentThisMonthSection`, hook `useCommittedOutlook`, screen `dashboard.tsx` (orden).
- **i18n**: sin keys nuevas — reutiliza las del rediseño web (`@grana/i18n-messages` es compartido).
- **Riesgo**: bajo. Ports presentacionales sobre hooks/datos existentes; la única query nueva (`useCommittedOutlook`) envuelve una función ya probada en web.
- **Diferido**: tira "Compartido" en mobile (requiere capa de datos de Hogar nativa).
