## Context

El dashboard web vive en `apps/web/app/(app)/dashboard/` con secciones aisladas por componente, cada una detrás de su `<Suspense>` con skeleton shape-matched (ver spec `dashboard`). Los datos llegan vía RSC containers (`getDashboardHero`, `getCommittedOutlook`) + TanStack para las secciones mensuales (`getMonthBalanceSeries`, `getMonthCategoryBreakdown`), gobernadas por `DashboardMonthProvider`. El enmascarado lo da `EyeMaskProvider` + `MaskedAmount`/`MaskedAmountDisplay`. Tokens, tipografía (Plus Jakarta Sans) y formato AR ya existen en `@grana/ui-tokens` y `@grana/i18n-messages`.

Este change es una **iteración presentacional** sobre ese dashboard, guiada por el handoff `apps/web/prototypes/dashboard-redesign-v1/`. No toca el data layer salvo consumir una query ya existente (neto del Hogar). Alcance **solo web**; las paridades nativas de estas secciones quedan diferidas (las requirements `(mobile)` del spec `dashboard` no se modifican).

## Goals / Non-Goals

**Goals:**

- Que cada sección comunique su número de un vistazo: barra de concentración, tiles de compromiso, barra caja-vs-tarjeta, barras en la leyenda.
- Mantener todo **data-driven**: anchos de barras, segmentos de concentración y el neto del cierre se calculan de los payloads, nunca hardcodeados.
- Reusar los primitivos y el estado existentes (Card, Segmented, MonthNavigator, EyeMask, FlowRow, SpendingDonut) — sin tokens ni componentes nuevos salvo los estrictamente presentacionales de estas secciones.
- Surfacar la presencia del Hogar en el Inicio sin duplicar la derivación de deuda (reusar `apps/web/lib/shared/queries.ts`).

**Non-Goals:**

- Paridad mobile/Expo de estas secciones (diferida).
- Cambios de data model, migraciones o nuevas queries de agregación.
- Tocar la matemática de neto por categoría, deuda de tarjeta o proyección de recurrencias (se reusa `@grana/money-logic`).
- Reintroducir el modo usuario o cualquier flag de perfil.

## Decisions

### 1. "Dónde está": concentración derivada en el componente, divergencia web-only

La card consume el mismo `getDashboardHero` (cuentas ya ordenadas por ARS desc + total USD). El nuevo layout se calcula en render, sin tocar la query:

- **Callout `%`**: `pct_dominante = cuenta[0].ars / Σ cuentas.ars` (ARS), redondeado a entero. Si `Σ = 0`, no se muestra el callout (estado vacío neutral).
- **Barra de concentración**: un segmento por cuenta con `flex-basis`/width = `cuenta.ars / Σ`. Se respeta el cap de 6 cuentas actual; el resto y la fila USD van en la grilla. Color por cuenta desde el avatar/paleta existente (sin hex inline).
- **Grilla compacta 2-col**: las cuentas restantes + fila "En dólares" en emerald.

Como la redefinición es **solo web**, la requirement de `dashboard` "La card 'Dónde está'…" se parte en escenarios `(web)` (concentración) y `(mobile)` (lista, sin cambios). El cálculo de porcentajes es puro y testeable; si hay una sola cuenta, el callout muestra 100% y la barra un único segmento.

_Alternativa descartada:_ mover el cálculo de concentración a `@grana/dashboard`. No aporta hoy (es presentacional y web-only); se promueve si mobile lo adopta.

### 2. "Comprometido": tiles + cierre neto

Se reemplaza el cuerpo `FlowRow` por:

- **Dos mini-tiles** de egreso (Resúmenes tarjeta / Gastos recurrentes) con ícono + label + monto. El total protagonista (titular) se mantiene = `resúmenes + recurrentes`.
- **Estado con ingreso recurrente** (cuando `recurringIncome > 0`): sub-label "YA SALE" sobre las tiles, una **tile verde "Ya entra"** a ancho completo, y una **banda de cierre neto**: `neto = recurringIncome − totalComprometido`. Si `neto ≥ 0` → "arrancás con +N a favor" (verde); si `neto < 0` el texto comunica el déficit. El ingreso **sigue sin sumar al total** (un ingreso no es compromiso) — el neto es un cálculo aparte, presentacional.

El dato `recurringIncome` ya viaja en `CommittedOutlook` por moneda; no cambia la query. Esto **modifica** la requirement de Comprometido, que hoy exige "filas estilo FlowRow, sin rediseño" y trata el ingreso solo como contexto sin cierre neto.

### 3. Tira "Compartido" condicional

Nueva sección full-width que consume el **neto derivado del Hogar** de `apps/web/lib/shared/queries.ts` (deuda derivada por moneda; ya existe y testeada en `apps/web/lib/shared/__tests__/debt.test.ts`). Reglas:

- Render **solo si hay actividad** compartida (existe Hogar de 2 y el neto/movimientos no son vacíos). Sin Hogar o sin actividad → la tira no se monta (no ensucia el dashboard del usuario sin Compartido).
- Hoy hay **un solo Hogar**, así que el neto es **una sola dirección**: `te deben` (emerald) o `debés` (terracota), por moneda sin combinar.
- Es navegacional (lleva a `/shared`), read-only, participa del eye-mask.
- Se monta detrás de su propio `<Suspense>`/container con tolerancia a fallas (no rompe el resto), siguiendo el patrón de las demás secciones.

_Alternativa descartada:_ calcular el neto en un nuevo endpoint del dashboard. Se evita: la derivación ya vive en `lib/shared`; duplicarla viola "no duplicar la matemática del neto".

### 4. "Gastaste este mes": barra caja vs tarjeta

`FinancedOnCardNote` (nota de texto) se reemplaza por `SpentThisMonthSection`: reutiliza **las mismas query keys** (`balance-series` + `category-breakdown`) que ya lee la nota, de modo que TanStack dedupea (sin fetch nuevo). Cálculo idéntico al actual: `caja = balance.ARS.totalExpense`, `devengado = Σ breakdown.ARS`, `financiado = devengado − caja`. Render:

- Total del mes (`devengado`) como titular.
- **Barra horizontal de 2 segmentos** con `flex` proporcional: "De tu caja" (`caja/devengado`, slate) + "Financiado en tarjeta" (`financiado/devengado`, terracota), label + monto adentro.
- Caption "se paga en los próximos resúmenes".
- **Solo se renderiza si `financiado > 0`** (igual que hoy). Sigue el navegador de mes; participa del eye-mask. En mobile la barra colapsa a columna.

Esto **modifica** la requirement "El dashboard muestra cuánto del gasto del mes se financió en tarjeta": de tira de texto a sección con barra. La reconciliación `total = caja + financiado` se conserva.

### 5. Leyenda de "¿En qué gasté?" con barras

Cada fila de la leyenda suma, debajo del row dot+nombre+monto+%, una **barra proporcional** con ancho = `slice.value / max(slices.value)`, color del slice (`sliceColor`). La dona y el total central ya existen y no cambian. Modificación menor y aditiva sobre la requirement de "En qué se fue".

### 6. Chip "SIN REGISTRAR" en Ajustes

La fila "Ajustes" (ya condicional, tono warning) suma un chip ámbar "SIN REGISTRAR" junto al monto, leído de i18n. El aviso educativo debajo ya existe. Modificación mínima.

### 7. Orden de secciones

`dashboard-content.tsx` queda: fila superior (Hero + Dónde está) → fila (Balance + Comprometido) → **Compartido (condicional)** → **Gastaste este mes (condicional)** → ¿En qué gasté?. Esto actualiza la requirement de layout multi-columna (orden de las full-width).

## Risks / Trade-offs

- **Drift web/mobile en "Dónde está" y "Comprometido"** → Mitigación: tagear escenarios `(web)`/`(mobile)` en el spec y registrar la paridad nativa como follow-up explícito; el naming de componentes espejo se mantiene.
- **Barra de concentración con muchas cuentas chicas** (segmentos sub-pixel) → Mitigación: aplicar un ancho mínimo visible por segmento sin alterar el cálculo del dato (igual que el cap de 6 + resto en grilla).
- **Tira Compartido para usuarios sin Hogar** → Mitigación: gate estricto (sin Hogar o sin actividad ⇒ no se monta); cubierto por escenario.
- **Neto del Hogar y eye-mask** → Mitigación: el monto pasa por `MaskedAmount` como el resto.
- **i18n faltante** → Mitigación: agregar todas las keys nuevas en `packages/i18n-messages` antes de tocar componentes; sin strings hardcodeados.

## Migration Plan

Cambio presentacional sin migración de datos ni feature flag. Se implementa en la branch `feature/redesign-dashboard-home-v2`, se archiva el change en la branch antes del merge (sync de specs + `pnpm openspec:check`), y el merge squash lo hace el usuario. Rollback = revertir el commit squash (no hay estado persistido nuevo).

## Open Questions

- Texto exacto del cierre neto cuando `neto < 0` (déficit): ¿se muestra la banda en terracota con "te queda **−N**" o se omite? Default propuesto: mostrarla en terracota para no ocultar el déficit (alineado con "nada oculto").
- ¿La tira "Compartido" se ubica antes o después de "Gastaste este mes"? Default propuesto: Compartido primero (cierra el bloque "lo del grupo" antes del detalle de consumo), como en el handoff.
