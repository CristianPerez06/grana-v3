## Why

Hoy en web cada página redeclara su título con un `<h1 className="text-2xl font-semibold tracking-tight">` copiado en ~20 rutas. La inconsistencia ya se manifestó: `settings/page.tsx` usaba `font-bold`, tres rutas (`accounts/new`, `accounts/[id]/edit`, `cards/[id]/periods/[periodId]`) usaban `text-xl` con o sin breadcrumb inline. Se unificó manualmente, pero el patrón sigue siendo "copiar el string de Tailwind correcto" — fácil de violar en la próxima ruta. En mobile el problema todavía no existió porque las tres pantallas no-dashboard son placeholders con texto centrado, pero cuando se construyan en serio van a heredar la misma deuda si no hay primitiva.

El repo es la memoria (V3 Rebuild Standard): el estilo del header de página tiene que vivir en un componente y un contract de props, no en un string repetido y en un PR que recuerde corregirlo.

## What Changes

- **Nuevo paquete-contract**: `PageHeaderProps` en `@grana/ui-contracts` con `title: string`, `backLink?: { href: string; label: string }` y `actions?: ReactNode`. Sigue exactamente el molde de `Spinner`/`RouteError` de `route-loading-and-errors`.
- **Implementación web**: `apps/web/components/ui/page-header.tsx` — renderiza el back link (si hay) como `next/link` arriba, el `<h1>` standalone debajo con el estilo canónico, y el slot de `actions` alineado a la derecha del título cuando aplica. Reemplaza el `<h1>` directo en las ~20 páginas top-level y forms; **no** toca headers dedicados de detalle (`DashboardHeader`, `AccountDetailHeader`, `CardHero`, `TransactionDetailHeader`) ni el wizard de onboarding.
- **Implementación mobile**: `apps/mobile/components/ui/PageHeader.tsx` — `View` + `Text` con NativeWind, mismo contract. Mismo back link como `expo-router` `Link` cuando hay `backLink.href`.
- **Refactor de pantallas mobile placeholder**: `movimientos.tsx`, `accounts.tsx`, `tarjetas.tsx` dejan de centrar un `Text` y pasan a renderizar `PageHeader` arriba (el resto del body queda vacío hasta que llegue la feature real). El estilo de "placeholder centrado" muere acá.
- **Story de Storybook (web)** con los casos: solo título, título + back link, título + actions, los tres juntos.
- **Anti-regresión**: el spec de `page-header` declara explícitamente que las pages no deben renderizar `<h1>` (web) ni un título top-level ad-hoc (mobile) por fuera de este componente — salvo las excepciones documentadas (headers dedicados de detalle, onboarding wizard).

Fuera de scope (explícito): wizard de onboarding (`text-3xl font-bold tracking-tight`, contexto visual propio), headers compuestos de detalle de entidad (DashboardHeader, AccountDetailHeader, CardHero, TransactionDetailHeader). Esos quedan como están, listados en el spec como excepciones.

## Capabilities

### New Capabilities
- `page-header`: Componente reutilizable de header de página, con contract de props compartido entre web y mobile en `@grana/ui-contracts` y dos implementaciones idiomáticas (HTML en web, React Native en mobile). Define el estilo canónico de título de página, soporte de back link y slot de acciones.

### Modified Capabilities
<!-- Ninguno: el componente es aditivo. web-app-shell y mobile-app-shell describen el shell de navegación (sidebar/drawer/tabs/AppMenu), no el contenido de las pages. Agregar PageHeader no cambia requisitos de esas capabilities. -->

## Impact

- **Código afectado (web)**: 20 archivos en `apps/web/app/(app)/**/page.tsx` que hoy declaran `<h1>` directo se refactoran al nuevo componente. 3 de ellos (`accounts/new`, `accounts/[id]/edit`, `cards/[id]/periods/[periodId]`) ya quedaron con el patrón A (back link arriba, h1 standalone) en la limpieza previa — se vuelven el call site natural para `backLink`.
- **Código afectado (mobile)**: 3 archivos placeholder (`movimientos.tsx`, `accounts.tsx`, `tarjetas.tsx`) cambian de "Text centrado" a "PageHeader arriba".
- **Paquetes**: nuevo export en `@grana/ui-contracts` (`PageHeaderProps`). No requiere build step (ya es source-only, ver CLAUDE.md "Shared packages — TypeScript paths to source").
- **Sin migración de DB, sin cambios en RPC/server actions, sin tocar lógica de dominio.**
- **Riesgo**: bajo. Es un refactor visual con cobertura de tipos. El riesgo principal es perder algún `<h1>` activo durante el refactor — mitigado por el spec de anti-regresión y un grep final.
