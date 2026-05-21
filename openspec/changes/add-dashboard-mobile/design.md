## Context

El dashboard ya está implementado y mergeado en web (`apps/web/app/(app)/dashboard/page.tsx` + `apps/web/app/(app)/dashboard/_components/*` + `apps/web/lib/dashboard/*`). El spec fue consolidado en `openspec/specs/dashboard/spec.md` al archivar `add-dashboard`. La app mobile (`apps/mobile`, Expo + Expo Router + NativeWind) tiene el shell completo con tabs (`dashboard / movimientos / tarjetas / menu`), AppMenu, auth y onboarding propios, pero la pantalla del tab "dashboard" es un placeholder de una línea.

Este change cumple dos objetivos simultáneamente:

1. **Llevar el dashboard a feature parity en mobile.**
2. **Estrenar formalmente la convención cross-platform** (mismos nombres de componentes web/mobile, distintas implementaciones idiomáticas) — registrada en memoria, aplicable desde ahora a toda capability multi-platform.

Constraints relevantes:

- **No-build-step monorepo**: los packages exponen `src/index.ts` directo; resolución via `transpilePackages` en Next y por TS `paths`. Cualquier package nuevo se agrega a `transpilePackages` en `apps/web/next.config.ts` y a `paths` en `tsconfig.base.json`. Metro de RN no necesita `transpilePackages` pero el package debe ser RN-compatible (sin DOM ni APIs de Node específicas).
- **React debe ser una sola versión** en el monorepo (RN 0.81 pinea exactamente 19.1.0). Un package puro de queries no usa React, así que no introduce ese riesgo, pero sí debe importarlo `peer` si alguna vez agregamos un hook al package — no es el caso de V1.
- **Tailwind v4 + NativeWind**: el design system se distribuye vía `@grana/ui-tokens` (CSS-first en web, TS mirror en mobile vía codegen futuro). Los componentes mobile usan NativeWind clases con los mismos nombres semánticos.
- **Cero impacto en schema**: ningún cambio en migraciones, queries idénticas en comportamiento.
- **Web NO debe romperse**: el refactor pasa imports de `@/lib/dashboard` a `@grana/dashboard` y se valida con build + tests antes de tocar mobile.

## Goals / Non-Goals

**Goals:**

- Mover queries + aggregations + tipos + tests a `packages/dashboard/` (`@grana/dashboard`) sin cambiar comportamiento.
- Implementar la pantalla `/dashboard` en mobile con las cuatro secciones funcionando contra datos reales.
- Mantener la convención de naming entre web y mobile: mismos nombres de componentes, hooks, providers, queries y tipos.
- Hacer el `href` de `UpcomingItem` neutral a la plataforma para que cada app construya su propia URL.
- Conservar la lógica de negocio existente: bimoneda, off-ledger credit, deterministic ordering, fecha AR, eye toggle, tolerancia a datos parciales.

**Non-Goals:**

- Compartir código de UI entre web y mobile (componentes RN vs DOM/Tailwind — no se intenta).
- Storybook mobile (no hay setup).
- Tests E2E mobile (sin Detox/Maestro).
- Pull-to-refresh, animaciones de transición del chart, pills contextuales, comentario pedagógico dinámico — anchors V2+.
- Reescribir el web (solo se ajustan imports).
- Tocar el módulo cards mobile (la ruta de detalle de tarjeta y de período aún no existen en mobile — los clicks navegan a `/tarjetas` y dentro de esa pantalla se resolverá la profundidad cuando se aborde ese change).

## Decisions

### 1. Package nuevo `@grana/dashboard` (scoped al módulo)

**Decisión:** crear `packages/dashboard/` con `@grana/dashboard` como nombre. Scope: solo el módulo dashboard. No empaqueta queries de otros módulos.

**Alternativas consideradas:**

- `@grana/queries` (casa común para todas las queries cross-app). Descartada: mezcla dominios, hace el package grande sin razón clara, y todavía no hay otro consumer de queries cross-app.
- `@grana/data` (queries + helpers de fecha/Money). Descartada por la misma razón: scope inflado prematuramente.

**Por qué scoped funciona:** cada módulo que tenga lógica compartida en el futuro (transactions, accounts, cards) puede tener su propio package siguiendo el mismo patrón. Si llegado el caso se vuelven todos pequeños y repetitivos, se consolida después. No al revés.

**Layout del package:**

```
packages/dashboard/
  package.json        # name: @grana/dashboard, main/exports → src/index.ts, no build step
  tsconfig.json       # extends tsconfig.base.json
  src/
    index.ts          # public exports
    queries.ts        # getDashboardHero, getUpcomingFortnight, getMonthBalanceSeries, hasUserMovements (reexporta getCreditCards desde @grana/cards si existe o desde un slot)
    aggregations.ts   # funciones puras testeables sin DB
    types.ts          # DashboardHero, UpcomingItem, UpcomingFortnight, MonthBalanceSeries, MonthBalanceDay
  __tests__/
    aggregations.test.ts
```

**Dependencias del package:** `@grana/supabase` (cliente y tipos), `decimal.js` (money math). NO depende de `react`, `next`, `@grana/ui-tokens`, ni DOM.

### 2. `getCreditCards` y `hasUserMovements`: ubicación

**Decisión:** dejar `getCreditCards` donde está (`apps/web/lib/cards/queries.ts`) por ahora — no es lógica del dashboard, es del módulo cards. El dashboard mobile va a necesitarla también, lo que dispara una decisión similar a esta para el módulo cards. **Esa decisión la toma un change futuro** (`promote-cards-queries` o equivalente). Para no bloquear este change:

- El package `@grana/dashboard` define un tipo `CreditCardSummary` (re-exportable) y **no** incluye `getCreditCards`.
- Mobile, en V1, **duplica** `getCreditCards` en `apps/mobile/lib/cards/queries.ts` con la misma firma. Es deuda explícita anotada en tasks (no se promueve ahora para no inflar el scope de este change).
- Cuando llegue el change que promueva cards a `@grana/cards`, ambos apps importarán de ahí y se borra la duplicación.

`hasUserMovements` (la query que alimenta `WelcomeFirstMoveCard`) sí entra al package — es lógica del dashboard.

**Alternativas consideradas:**

- Promover cards y dashboard juntos. Descartada: dos refactors en un mismo change aumentan el blast radius y dificultan rollback. Cards merece su propio análisis.
- Crear `@grana/dashboard` que dependa de un futuro `@grana/cards` ya hoy. Descartada: depender de algo que no existe es trampa.

### 3. `UpcomingItem.href` → campos semánticos + builder por plataforma

**Decisión:** reemplazar el campo `href: string` por campos semánticos en el tipo `UpcomingItem`:

```ts
type UpcomingItem = {
  id: string
  kind: 'card_period' | 'recurrence_instance'
  direction: 'pay' | 'collect'
  date: string
  label: string
  amount: number
  currency: 'ARS' | 'USD'
  // antes: href: string
  // ahora:
  target:
    | { kind: 'card_period'; accountId: string; periodId: string }
    | { kind: 'recurrence_instance'; recurrenceId: string }
}
```

Cada app implementa un helper `routeForUpcomingItem(target)` que mapea a su propia URL (web: `/cards/[id]/periods/[id]`, mobile: `/tarjetas/[id]` o lo que defina cards mobile cuando esté).

**Por qué:** las URLs son specific de la plataforma. Que la query las hardcodee viola el principio del package (RN-compatible, sin asunciones de plataforma). Esto es además un fix pequeño en web — solo cambia el componente que renderiza el `<Link>`.

**Alternativas consideradas:**

- Mantener `href` y duplicar el código de aggregation por plataforma. Descartada: rompe el motivo de tener un package.
- Inyectar un builder en la query (`getUpcomingFortnight({ buildHref })`). Descartada: agrega complejidad sin beneficio — la transformación es trivial en el consumer.

### 4. Layout "Lo que viene" en mobile: dos secciones stackeadas verticalmente

**Decisión:** `UpcomingFortnightSection` en mobile renderiza primero "A pagar" (con su total por moneda al pie), después "A cobrar" (con su total al pie), y al final "Balance del período" desglosado por moneda. El componente sigue llamándose igual que web; solo el JSX interno cambia.

**Alternativas consideradas:**

- Lista única ordenada cronológicamente con badge in/out. Descartada por el usuario: pierde la dualidad explícita.
- Tabs "A pagar / A cobrar". Descartada por el usuario: oculta info, requiere toggle.
- Dos columnas horizontal scroll. Descartada: anti-patrón en mobile.

### 5. CreditCardCarousel: implementación mobile nueva con FlatList

**Decisión:** `apps/mobile/components/dashboard/CreditCardCarousel.tsx` usa `FlatList` horizontal con `snapToInterval`, `pagingEnabled` y `decelerationRate="fast"`. Item width fijo (probablemente `screenWidth - 32px` para mostrar un pedacito de la siguiente). La card visual se reimplementa con primitivas RN (gradiente vía `expo-linear-gradient`, badge de vencido con `View`+`Text`, importes via `MaskedAmount`). NO se intenta compartir la pinta con web.

**Alternativas consideradas:**

- Portar el componente web a un package cross-platform. Descartada por el usuario: NW funciona pero el componente tendría que evitar primitivas específicas de cada plataforma — la complejidad supera el beneficio.
- Usar una lib externa (react-native-snap-carousel). Descartada: el package está unmaintained y `FlatList` con `snapToInterval` cubre el caso.

### 6. EyeMaskProvider en mobile

**Decisión:** mismo patrón que web — un React context client-side, no persistido, alcance toda la pantalla dashboard. En mobile NO hay distinción server/client, así que es solo "context". Cuando el usuario sale del tab dashboard y vuelve, el provider se desmonta y se vuelve a montar — el estado se resetea naturalmente. No hay que hacer nada extra para satisfacer el scenario "Salir del dashboard y volver resetea el toggle".

### 7. MonthBalanceChart en mobile: react-native-svg

**Decisión:** reimplementar el chart con `react-native-svg` (ya está en `package.json` mobile). Misma forma del trazado y la baseline punteada que web. El componente recibe la misma prop `series: MonthBalanceSeries` y renderiza idéntico semánticamente.

**Alternativas consideradas:**

- Recharts/Victory Native — bundle grande, overkill para una línea.
- Canvas via `react-native-skia` — más performance pero agrega dependencia no trivial.

### 8. Imports en web post-refactor

**Decisión:** los archivos `apps/web/lib/dashboard/{queries,aggregations,types}.ts` se **eliminan**. Cualquier import dentro de web que apuntaba a `@/lib/dashboard/*` se reescribe a `@grana/dashboard`. Sin re-exports temporales.

**Por qué sin re-exports:** el repo es chico, los imports los cambia un find-replace en minutos, y dejar shims temporales es deuda escondida.

### 9. Etiquetado `(web)` / `(mobile)` en `dashboard` spec

**Decisión:** del spec actual de `dashboard`, **solo** estos scenarios se renombran a `(web)`:

- "Click en un ítem de 'Lo que viene' navega al módulo correspondiente" — el enunciado dice "navega a `/cards/[accountId]/periods/[periodId]`", URL específica de web.
- "Click en una tarjeta del carrusel navega al detalle" — idem.
- "Click en el Hero navega a Cuentas" — idem.
- "Tarjeta con resumen vencido aparece en rojo en el carrusel del dashboard" — sigue siendo neutral (el badge visual aplica a ambos), no se tagea.
- "Usuario con dos tarjetas activas ve ambas en el carrusel" — sigue neutral; el comportamiento aplica a ambos.

Los scenarios nuevos `(mobile)` se agregan en los mismos requirements, con enunciados análogos:

- "Click en un ítem de 'Lo que viene' navega al módulo correspondiente (mobile)" — `useRouter().push` a la ruta mobile.
- "Click en una tarjeta del carrusel navega al detalle (mobile)".
- "Click en el Hero navega a Cuentas (mobile)" — hoy navega al menú; cuando exista pantalla cuentas mobile, a esa ruta. **Decisión transitoria** documentada en el spec.
- "El layout de 'Lo que viene' en mobile es stackeado verticalmente (mobile)".
- "El eye toggle vive en el header de la pantalla dashboard mobile (mobile)" — opcional, depende de si queda claro implícitamente.

Los requirements de lógica de negocio (Hero bimoneda, qué entra y qué no entra en "Lo que viene", gráfico solo confirmed+ARS, tolerancia a datos parciales) permanecen platform-neutral sin tags.

### 10. Empty state del carrusel mobile

**Decisión:** el CTA "Agregar tarjeta" en mobile navega a `/tarjetas` (el tab existente). El módulo cards mobile aún no tiene una ruta de alta de tarjeta dedicada — cuando exista, este CTA se redirigirá a esa ruta. Documentado en el spec como decisión transitoria.

## Risks / Trade-offs

- **Riesgo: el refactor del package rompe imports en web.** → Mitigación: hacer el refactor en orden estricto (a) crear y poblar `packages/dashboard/`; (b) actualizar imports en web y correr `pnpm --filter web build` + tests antes de tocar mobile; (c) recién después implementar mobile. Si el build de web falla, queda obvio dónde está.
- **Riesgo: Metro de RN no resuelve `@grana/dashboard` automáticamente.** → Mitigación: validar resolución agregando un import simple (`import type { DashboardHero } from '@grana/dashboard'`) en un archivo mobile existente y corriendo `pnpm --filter mobile typecheck` + un build de Metro antes de implementar pantallas reales. Los `@grana/*` ya resuelven, así que el riesgo es bajo.
- **Riesgo: duplicar `getCreditCards` en mobile genera divergencia entre apps.** → Mitigación: anotar la deuda con un TODO en `apps/mobile/lib/cards/queries.ts` referenciando al issue/change futuro que promueva cards. Aceptado: la divergencia es pequeña y la duplicación es temporal.
- **Riesgo: el chart con `react-native-svg` se ve diferente al SVG inline del web.** → Mitigación: comparar visual side-by-side con datos idénticos en QA manual; ajustar paddings/colores hasta que se "lea" como el mismo gráfico. La spec no exige pixel parity, solo paridad semántica.
- **Trade-off: sin tests automáticos del componente mobile.** → Aceptado por ahora. Los tests del package cubren la lógica; la UI mobile depende de QA manual hasta que se incorpore Detox o equivalente (change futuro).
- **Trade-off: el `href` semántico (target) cambia la API pública del aggregator.** → Aceptado. Web se ajusta en el mismo PR (es trivial). La API nueva es más limpia.

## Open Questions

- **¿`expo-linear-gradient` ya está instalado o lo agregamos?** Verificar en `apps/mobile/package.json`; si no está, agregarlo como parte de las tasks. Alternativa: usar `react-native-svg` también para el fondo de la card (más complejo, evita la dependencia).
- **¿La pantalla de "cuentas" mobile existe?** Si no existe, el click en el Hero navega temporalmente al menú o muestra un toast "Próximamente". Validar en exploración inicial — afecta el spec mobile del scenario "Click en el Hero".
- **¿Renombrar `welcome-first-move-card` o dejarlo como bonus mobile también?** Recomendación: incluirlo en V1 mobile siguiendo el mismo criterio que web (zero movimientos → CTA). Mismo nombre de componente.

Estas se resuelven en las primeras tareas de la fase de exploración del package y la primera tarea de UI mobile, no bloquean iniciar el change.
