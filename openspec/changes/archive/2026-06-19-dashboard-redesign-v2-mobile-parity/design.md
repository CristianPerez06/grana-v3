## Context

El dashboard mobile (`apps/mobile`) vive en `app/(app)/dashboard.tsx` + `components/dashboard/*`, con secciones aisladas, cada una con su hook TanStack (`lib/dashboard/queries.ts`) y su swap region (skeleton / error / data) de alto estable. Estado compartido: `EyeMaskProvider` + `DashboardMonthProvider` (mirrors nativos). i18n vía `useT()` sobre `@grana/i18n-messages` (mismo catálogo que web). Styling NativeWind + `lib/colors.ts` para valores inline.

El rediseño v2 ya está en web (`redesign-dashboard-home-v2`, mergeado). Este change porta los deltas a Expo. Las decisiones de diseño (concentración, tiles + neto, barra caja/tarjeta, barras de leyenda, chip) ya están documentadas en `docs/design/dashboard-redesign-v2/` y en el design del change web; acá solo se documenta lo específico de la plataforma nativa.

## Goals / Non-Goals

**Goals:**

- Paridad visual y de comportamiento con el dashboard web v2 en las secciones existentes + las dos nuevas (Comprometido, Gastaste este mes).
- Reusar la matemática pura (concentración) entre apps: promover `computeConcentration` a `@grana/dashboard`.
- Respetar los patrones nativos existentes: swap region de alto estable, naming espejo, `SkeletonBlock`, `useT`, primitivas RN.

**Non-Goals:**

- Tira "Compartido" en mobile (requiere capa de datos de Hogar nativa, diferida con el módulo `shared`).
- Cambios de data model o de queries de agregación.
- Tocar `getCommittedOutlook`/`getMonthCategoryBreakdown` (se consumen tal cual).

## Decisions

### 1. `computeConcentration` puro y compartido

La math de concentración (porcentaje dominante + anchos de segmentos) se promueve de `apps/web/lib/dashboard/concentration.ts` a `packages/dashboard/src/concentration.ts` (RN-safe, sin deps DOM/Node) y se exporta desde `@grana/dashboard`. Web y mobile la importan; el test unitario vive en `apps/web` y apunta al package (el alias de vitest resuelve). _Alternativa descartada:_ duplicar la función en mobile (viola "no duplicate calculation code").

### 2. Rich text en mobile sin `t.rich`

Web usa `t.rich` con tags (`<amount></amount>`, `<b></b>`) para inyectar el monto enmascarado dentro de una frase. Mobile `useT()` devuelve un string; siguiendo el patrón existente de `NetThisMonth`, se hace `string.match` del tag y se renderiza `before + <MaskedAmount.../> + after` dentro de un `<Text>` (los componentes Masked devuelven `<Text>`, anidables). Aplica al cierre neto de "Comprometido" y a la caption de "Gastaste este mes".

### 3. Barra caja/tarjeta apilada en mobile

En web la barra es horizontal y colapsa a columna bajo cierto ancho. En mobile, siempre angosto, se renderiza directamente como dos bandas apiladas full-width (cada una label + monto sobre su color), evitando segmentos horizontales sub-legibles.

### 4. Iconos y colores nativos

Tiles de "Comprometido" usan `lucide-react-native` (CreditCard / Repeat / ArrowUpRight). Fondos de ícono y de banda usan valores del mirror `lib/colors.ts` (navy) o hex de token (terracota `#B56A5A`, slate `#3A6B8A`) inline, igual que el resto de componentes nativos. Clases de tono (`bg-emerald`, `bg-warning/15`, `text-emerald-deep`, `text-negative`) vía NativeWind.

### 5. Comprometido es estático (no sigue el navegador de mes)

`useCommittedOutlook` tiene queryKey `['dashboard','committed']` sin año/mes — igual que web, la card es "desde hoy". Loading/error/empty in-card como las demás secciones, con `CommittedSkeleton`.

## Risks / Trade-offs

- **Drift de specs web/mobile** → Mitigación: este change quita los tags `(web)` de chip y leyenda y actualiza las requirements de Dónde está / Comprometido / mobile-screen para reflejar la paridad.
- **NativeWind `bg-warning/15` / fracciones `w-1/2`** → Mitigación: typecheck + lint pasan; verificación visual queda como follow-up del tech lead.
- **Tira Compartido ausente en mobile** → asimetría conocida y documentada (no es regresión: nunca existió en mobile).

## Migration Plan

Cambio presentacional, sin migración de datos. Branch `feature/dashboard-redesign-v2-mobile`. Archivar en la branch antes del merge (sync de specs + `openspec:check`). El merge squash lo hace el usuario.
