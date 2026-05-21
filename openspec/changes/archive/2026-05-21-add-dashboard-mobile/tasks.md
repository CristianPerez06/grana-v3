## 1. Crear el package `@grana/dashboard` y migrar la lógica desde web

- [x] 1.1 Crear `packages/dashboard/package.json` con `"name": "@grana/dashboard"`, `"main": "src/index.ts"`, `"exports": { ".": "./src/index.ts" }`, `private: true`, dependencias `@grana/supabase` (workspace), `decimal.js`.
- [x] 1.2 Crear `packages/dashboard/tsconfig.json` extendiendo `tsconfig.base.json` (mirror del setup de otros packages como `@grana/validation`).
- [x] 1.3 Crear `packages/dashboard/src/types.ts`: mover `DashboardHero`, `UpcomingFortnight`, `MonthBalanceSeries`, `MonthBalanceDay` desde `apps/web/lib/dashboard/types.ts`. **Cambiar `UpcomingItem`**: reemplazar `href: string` por el discriminated union `target` definido en design.md (decisión 3).
- [x] 1.4 Crear `packages/dashboard/src/aggregations.ts`: mover funciones puras `aggregateHero`, `buildUpcomingFortnight`, `buildMonthBalanceSeries` y sus tipos de input desde `apps/web/lib/dashboard/aggregations.ts`. **Reemplazar** la construcción de `href: '/cards/...'` por la construcción del `target` semántico. Asegurar imports independientes de Next/web.
- [x] 1.5 Crear `packages/dashboard/src/queries.ts`: mover `getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `hasUserMovements` desde `apps/web/lib/dashboard/queries.ts`. Reemplazar `import { createClient } from '@/lib/supabase/server'` por una firma que recibe el `SupabaseClient` como parámetro (las apps inyectan su propio cliente — web pasa el server client, mobile pasa `supabase` de `apps/mobile/lib/supabase.ts`). NO re-exportar `getCreditCards` desde el package (queda fuera de scope; ver tarea 4.x).
- [x] 1.6 Crear `packages/dashboard/src/index.ts` exportando todo lo público.
- [x] 1.7 Mover `apps/web/lib/dashboard/__tests__/aggregations.test.ts` a `packages/dashboard/__tests__/aggregations.test.ts`. Ajustar imports relativos. Adaptar los tests al nuevo formato de `target` en `UpcomingItem` (los tests existentes asercionan `href` — pasan a asercionar `target.kind` + IDs).
- [x] 1.8 Agregar `"@grana/dashboard"` a `transpilePackages` en `apps/web/next.config.ts`.
- [x] 1.9 Agregar `"@grana/dashboard"` a `paths` en `tsconfig.base.json` (`"@grana/dashboard": ["./packages/dashboard/src/index.ts"]`).
- [x] 1.10 Agregar `@grana/dashboard` a `pnpm-workspace.yaml` si no está cubierto por el glob existente (`packages/*` ya lo cubre — verificar).
- [x] 1.11 Correr `pnpm install` desde la raíz para registrar el workspace package y refrescar lockfile.
- [x] 1.12 Correr `pnpm --filter @grana/dashboard test` (o el comando que el package exponga; ver setup de tests del repo). Validar que los tests pasan en su nueva ubicación.

## 2. Actualizar imports en web y validar que no se rompe

- [x] 2.1 Reescribir todos los imports en `apps/web` que apuntaban a `@/lib/dashboard/queries`, `@/lib/dashboard/aggregations`, `@/lib/dashboard/types` para apuntar a `@grana/dashboard`. Usar `grep -RE "@/lib/dashboard" apps/web` para encontrarlos.
- [x] 2.2 Adaptar los componentes web que usaban `href` en `UpcomingItem`: implementar un helper local `routeForUpcomingItem(target): string` en `apps/web/app/(app)/dashboard/_components/upcoming-fortnight-section.tsx` (o en `apps/web/lib/dashboard-routes.ts` si conviene reusarlo) que mapee `target` → URL web. Los `<Link href={...}>` usan ese helper.
- [x] 2.3 Adaptar los componentes web que usaban `createClient` server-side: pasar explícitamente el cliente Supabase a las queries del package (la firma cambió en 1.5).
- [x] 2.4 Eliminar `apps/web/lib/dashboard/` por completo (queries.ts, aggregations.ts, types.ts, __tests__/). No dejar shims temporales.
- [x] 2.5 Correr `pnpm --filter web typecheck` y `pnpm --filter web build`. Cero errores antes de seguir.
- [x] 2.6 Correr `pnpm --filter web lint`. Cero errores.
- [x] 2.7 QA manual en dev: abrir `/dashboard` en el navegador, verificar que las cuatro secciones siguen renderizando idéntico, que los clicks en "Lo que viene" navegan al detalle de período correcto, y que la welcome card aparece en una cuenta sin movimientos.

## 3. Preparar el consumo desde mobile

- [x] 3.1 Agregar `"@grana/dashboard": "workspace:*"` a `apps/mobile/package.json`.
- [x] 3.2 Correr `pnpm install` desde la raíz para enlazar el package en mobile.
- [x] 3.3 Validar resolución TS: agregar un import temporal en algún archivo mobile (ej: `apps/mobile/lib/supabase.ts`) tipo `import type { DashboardHero } from '@grana/dashboard'` y correr `pnpm --filter mobile typecheck`. Cero errores. Borrar el import temporal una vez validado.
- [x] 3.4 Validar resolución de Metro: tocar la pantalla `(app)/dashboard.tsx` para usar el import (incluso solo importando el tipo), arrancar `pnpm --filter mobile dev` (Expo) y validar que el bundle se genera sin `Unable to resolve module`. Revertir el toque experimental.
- [x] 3.5 Si Metro requiere configuración extra (`metro.config.js` para que watche el path del package), documentarlo en `apps/mobile/metro.config.js` con comentario corto explicando el por qué.

## 4. Duplicar `getCreditCards` en mobile (deuda anotada)

- [x] 4.1 Crear `apps/mobile/lib/cards/queries.ts` copiando la firma y la lógica de `apps/web/lib/cards/queries.ts:getCreditCards`. Adaptar el cliente Supabase a `supabase` de `apps/mobile/lib/supabase.ts`.
- [x] 4.2 Re-exportar el tipo `CreditCardSummary` igual que en web.
- [x] 4.3 Agregar un comentario al tope del archivo: `// TODO(@grana/cards): duplicación temporal — promover cards a un package compartido (change separado). Mantener firma sincronizada con apps/web/lib/cards/queries.ts hasta que ocurra.`

## 5. Implementar componentes mobile bajo `apps/mobile/components/dashboard/`

> Convención: cada componente sigue el mismo nombre PascalCase que su par web. Cada archivo es PascalCase (`HeroSection.tsx`, etc.), siguiendo el patrón ya usado en `apps/mobile/components/ui/`.

- [x] 5.1 `EyeMaskProvider` + `useEyeMask` en `apps/mobile/components/dashboard/EyeMaskContext.tsx`. React context client-side, no persistido, idéntico al de web.
- [x] 5.2 `EyeMaskToggle` con icono Eye/EyeOff (lucide-react-native o equivalente; verificar dependencia disponible — si no, usar `react-native-svg` para los íconos o `@expo/vector-icons`). Botón `Pressable` que llama `toggle()`.
- [x] 5.3 `MaskedAmount` que recibe `{ amount: number, currency: 'ARS' | 'USD' }` y renderiza `••••••` si masked, sino el monto formateado con `formatARS`/`formatUSD`. Reusar formatters si están en `@grana/i18n-messages` o duplicar/portar a mobile según convenga (TBD durante implementación).
- [x] 5.4 `HeroSection` (Client) — envuelve todo en `Pressable` que navega con `useRouter()`; muestra dos `MaskedAmount` (ARS grande, USD subordinado).
- [x] 5.5 `UpcomingFortnightSection` (Client) — **layout stackeado** según design.md decisión 4: primero "A pagar" con su `Column` interno (lista + total al pie por moneda), después "A cobrar" igual, después "Balance del período" desglosado por moneda. Cada ítem es un `Pressable` que navega via `useRouter()` usando el helper local `routeForUpcomingItem(target)`. Manejo de empty state con mensaje neutral.
- [x] 5.6 `MonthNavigator` con flechas izquierda/derecha (lucide o vector-icons) y label "MES AÑO". Recibe `year`, `month`, `prevHref`/`nextHref` (sí, se usan también en mobile: la pantalla parsea el search param via `useLocalSearchParams()` y el navigator usa `<Link>` de Expo Router que sí existe en RN — diferente del de Next).
- [x] 5.7 `MonthBalanceChart` (Client) — SVG con `react-native-svg`: `Svg` root, `Path` para la línea, `Path` o `Polygon` para el área coloreada según signo del balance final, `Line` punteada para baseline en y=0, tick labels (`SvgText`) para días 1/5/10/15/20/25/último. Misma fórmula visual que web; ajustar paddings/anchos al `useWindowDimensions()`.
- [x] 5.8 `MonthBalanceSection` (Client) — compone título + `MonthNavigator` (hrefs a `/dashboard?month=YYYY-MM` via `<Link>` de expo-router) + `MonthBalanceChart` + footer con balance final coloreado e ingresos/gastos totales.
- [x] 5.9 `CardsSection` (Client) — usa `useEyeMask`, renderiza `CreditCardCarousel` pasando `masked`. Empty state con CTA navegando a `/tarjetas` (decisión transitoria documentada).
- [x] 5.10 `CreditCardCarousel` (Client) — `FlatList` horizontal con `snapToInterval`, `pagingEnabled`, `decelerationRate="fast"`, item width fijo (probablemente `screenWidth - 32px`). Cada item es la card visual reimplementada con primitivas RN. Decidir entre `expo-linear-gradient` (verificar si está instalado; si no, agregarlo a `apps/mobile/package.json`) o gradiente vía `react-native-svg`. Reusar `MaskedAmount` para importes.
- [x] 5.11 `SectionFallback` — vista de error compacta con icono y mensaje i18n por sección.
- [x] 5.12 `DashboardHeader` (Client) — título de pantalla + `EyeMaskToggle` a la derecha. Vive en el header de la pantalla (no en el shell de tabs).
- [x] 5.13 `WelcomeFirstMoveCard` — porta el componente web. Aparece arriba del Hero cuando `hasUserMovements()` devuelve `false`. CTA navega a `/tarjetas` (no hay pantalla de cuentas mobile aún) o a un destino que el módulo accounts mobile defina cuando exista.

## 6. Wireear la pantalla `(app)/dashboard.tsx`

- [x] 6.1 Reescribir `apps/mobile/app/(app)/dashboard.tsx` como pantalla que:
  - Lee el `month` del search param via `useLocalSearchParams()` (validar formato `YYYY-MM` y rango ±12 meses).
  - Dispara las cuatro queries (`getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `getCreditCards`) en paralelo con `Promise.allSettled`.
  - Envuelve todo en `EyeMaskProvider`.
  - Renderiza `DashboardHeader`, después un `ScrollView` con las cuatro secciones en orden (Welcome card opcional → Hero → UpcomingFortnight → MonthBalance → Cards). Cada sección renderiza `SectionFallback` si su promesa rechazó.
- [x] 6.2 Inyectar el cliente Supabase del proyecto (`apps/mobile/lib/supabase.ts`) a cada query (la nueva firma del package así lo requiere).
- [x] 6.3 Validar que el `EyeMaskProvider` reset al cambiar de tab funciona out-of-the-box (el provider se desmonta cuando el tab pierde foco; cuando vuelve, monta limpio). Si Expo Router mantiene el componente vivo entre tabs, agregar lógica explícita de reset.

## 7. i18n

- [x] 7.1 Validar que `apps/mobile/lib/i18n.ts` lee correctamente las claves `dashboard.*` ya existentes en `packages/i18n-messages/src/{es,en}.json`. Si no hay setup adecuado, alinear con el de web (revisar `apps/web` para entender el patrón).
- [x] 7.2 Si se necesita alguna clave mobile-only (ej: copy del estado vacío adaptado, mensaje del header), agregarla bajo `dashboard.*` siguiendo la nomenclatura existente.

## 8. QA manual

- [x] 8.1 Caso usuario nuevo (sin movimientos): Hero en $ 0 y u$s 0, "Lo que viene" vacío, gráfico mes plano, carrusel con la tarjeta default sin alertas, `WelcomeFirstMoveCard` arriba.
- [x] 8.2 Caso usuario con saldos en ambas monedas: Hero muestra los dos importes.
- [x] 8.3 Caso consumo en tarjeta no descuenta del Hero ni baja el gráfico.
- [x] 8.4 Caso pago de resumen sí descuenta del Hero y aparece como caída en el gráfico mensual.
- [x] 8.5 Caso resumen próximo a vencer aparece en "A pagar" con fecha y monto correctos, cuotas individuales NO duplicadas.
- [x] 8.6 Caso recurrencia mensual entrante aparece en "A cobrar".
- [ ] 8.7 Caso navegador de mes: ir 12 meses atrás (flecha izquierda deshabilitada en el 12), volver al actual (flecha derecha deshabilitada).
- [ ] 8.8 Caso eye toggle: activar enmascara todo en pantalla, cambiar al tab "movimientos" y volver — los importes están visibles otra vez.
- [ ] 8.9 Caso falla deliberada en `getUpcomingFortnight` (forzar error en dev): las otras tres secciones siguen funcionando.
- [x] 8.10 Validar visualmente que el chart con `react-native-svg` se "lee" como el de web (no exige pixel parity).
- [x] 8.11 Validar QA del refactor web post-migración: las 8 secciones web siguen funcionando idéntico (no debería haber regresión por la migración a `@grana/dashboard`).

## 9. Documentación y archivado

- [x] 9.1 CLAUDE.md no requiere cambios — la convención cross-platform ya está en memoria. Si esta primera implementación deja un patrón claro, considerarlo para una mención breve en CLAUDE.md en un change futuro de "convenciones consolidadas".
- [x] 9.2 Verificar que `apps/mobile/PROXIMAS_FASES.md` no necesita actualización (este change no introduce dependencias EAS nuevas).
- [ ] 9.3 Archivar el change cuando el PR mergee a `main`: `openspec/changes/add-dashboard-mobile/` → `openspec/changes/archive/YYYY-MM-DD-add-dashboard-mobile/` y aplicar los deltas a `openspec/specs/dashboard/spec.md` y `openspec/specs/mobile-app-shell/spec.md`.

## 10. Decisiones a resolver durante implementación

- [x] 10.1 Confirmar si `expo-linear-gradient` ya está en `apps/mobile/package.json`. Si no, agregarlo en la tarea 5.10.
- [x] 10.2 Resolver el icon set (`lucide-react-native` vs `@expo/vector-icons` vs custom SVG). Tomar la decisión más liviana que cubra Eye, EyeOff, ChevronLeft, ChevronRight; documentar en código.
- [x] 10.3 Decidir si los `formatARS`/`formatUSD` se promueven a `packages/i18n-messages` (junto con los catálogos) o se duplican en mobile. Si web ya los tiene en `apps/web/lib/`, evaluar promoverlos al package que les corresponda — pero **fuera de scope de este change** salvo que sea trivial.
- [x] 10.4 Confirmar si la pantalla de "cuentas" mobile existe. Si no existe, documentar en código que el click en el Hero navega al menú (decisión transitoria).
