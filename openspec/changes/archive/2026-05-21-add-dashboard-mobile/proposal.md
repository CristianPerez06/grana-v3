## Why

El dashboard ya existe en la web y es la landing universal post-login del producto, pero en mobile la pantalla `apps/mobile/app/(app)/dashboard.tsx` sigue siendo un stub que solo renderiza la palabra "Dashboard". El shell mobile ya está armado (tabs `dashboard / movimientos / tarjetas / menu`, AppMenu, onboarding mobile en curso), así que el momento del "change separado" que el spec web había prometido llegó.

Sin este change, la app mobile arranca al usuario en una pantalla vacía que no responde a las tres preguntas que el dashboard contesta de un vistazo (¿cuánto tengo? ¿qué tengo comprometido? ¿cómo me fue?). Y además, no aprovechamos que la lógica de negocio (las cuatro queries agregadas) ya está escrita y probada en `apps/web/lib/dashboard/`: bastaría con moverla a un package para que mobile la consuma.

## What Changes

- **Crear el package `@grana/dashboard`** (nuevo, scoped al módulo) y migrar a él `queries.ts`, `aggregations.ts`, tipos y tests existentes desde `apps/web/lib/dashboard/`. Web pasa a importar desde el package; mobile lo consume directo. El package solo depende del cliente Supabase y de helpers puros — sin DOM, sin APIs de Node específicas, RN-compatible.
- **Reescribir `apps/mobile/app/(app)/dashboard.tsx`** para renderizar las cuatro secciones del dashboard en orden vertical: Hero "Para gastar" → Lo que viene → Balance del mes → Tarjetas. Todo envuelto en `EyeMaskProvider`. Carga de datos vía `Promise.allSettled` sobre las cuatro queries del package, con `SectionFallback` por sección ante fallas individuales.
- **Implementar los componentes mobile** bajo `apps/mobile/components/dashboard/` siguiendo la convención cross-platform: mismos nombres que sus pares web (HeroSection, UpcomingFortnightSection, MonthBalanceSection, MonthBalanceChart, MonthNavigator, CardsSection, CreditCardCarousel, MaskedAmount, EyeMaskToggle, EyeMaskProvider/`useEyeMask`, SectionFallback, DashboardHeader), mismas props públicas cuando es técnicamente posible, pero cada uno usando lo idiomático de RN: `View`/`Text`, `Pressable`+`useRouter`, `react-native-svg` para el chart, `FlatList` horizontal con `snapToInterval` para el carrusel.
- **Layout específico de mobile en "Lo que viene"**: dos secciones stackeadas verticalmente (primero "A pagar" con su total, después "A cobrar" con su total, y al pie "Balance del período" desglosado por moneda) en vez de las dos columnas lado-a-lado que usa web. El componente padre sigue llamándose `UpcomingFortnightSection` y consume la misma query; solo el layout interno difiere.
- **CreditCardCarousel mobile nuevo desde cero**: `FlatList` horizontal con `snapToInterval`, paginación nativa, card visual reimplementada con primitivas RN (gradiente vía `expo-linear-gradient` o `react-native-svg`, brand logo, badge de vencido, importes con `MaskedAmount`). Empty state con CTA "Agregar tarjeta" navega a `/tarjetas` (el módulo cards mobile aún no tiene una ruta de alta dedicada).
- **Modificar las capabilities OpenSpec**:
  - `dashboard`: agregar scenarios `(mobile)` donde el comportamiento técnico diverge del web (clicks → `Pressable`+`useRouter`, eye toggle en header de pantalla mobile, layout stackeado de "Lo que viene"). Tag `(web)` solo los scenarios cuyo enunciado actual es específicamente DOM/Next (scroll-snap CSS, `<Link href="...">`). El resto de scenarios y todos los requirements de lógica de negocio (qué entra, qué no entra, bimoneda, ordering, gráfico solo confirmed+ARS, tolerancia a datos parciales) permanecen platform-neutral sin tag.
  - `mobile-app-shell`: modificar el requirement "Arranque con sesión activa lleva al dashboard" para reflejar que `/dashboard` ya no es un placeholder. No agrega un requirement nuevo — el shell solo provee la ruta; la implementación de la pantalla es responsabilidad de la capability `dashboard`.
- **Validar i18n**: las claves `dashboard.*` ya existen en `packages/i18n-messages/src/{es,en}.json`. Confirmar que `apps/mobile/lib/i18n.ts` las lee igual que web. Agregar claves nuevas solo si las necesita el copy específico de mobile (ej: mensaje del header de pantalla).

**Fuera de scope V1 mobile** (anchors registrados para futuro):
- Pills contextuales en el Hero (Ahorros, Economía Familiar) — esperan los módulos `savings` y `shared`.
- Comentario pedagógico dinámico en el Hero — pendiente de UX research.
- Animaciones de transición en el gráfico — primera versión es estática.
- Pull-to-refresh — solo si calza barato con Expo; si requiere arquitectura, change futuro.
- Tests E2E mobile — Detox/Maestro no instalado.
- Storybook mobile — no existe setup; se aborda separado.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities

- `dashboard`: agregar scenarios `(mobile)` en los requirements cuyo comportamiento técnico diverge entre plataformas (navegación táctil con `useRouter`, layout stackeado de "Lo que viene", eye toggle en header de pantalla mobile). Tag `(web)` los scenarios actuales que son específicamente DOM/Next.
- `mobile-app-shell`: ajustar el scenario "Arranque con sesión activa lleva al dashboard" para reflejar que `/dashboard` ya renderiza el dashboard real, no un stub.

## Impact

- **Schema**: ninguna migración. Las cuatro queries no cambian de comportamiento; solo se mueven de carpeta.
- **Nuevo package**: `packages/dashboard/` con `package.json` (`@grana/dashboard`, `main`/`exports` apuntando a `src/index.ts`, sin build step — convención del repo), `src/queries.ts`, `src/aggregations.ts`, `src/types.ts`, `src/index.ts`, `__tests__/aggregations.test.ts`. Dependencias: `@grana/supabase`, `decimal.js`, helpers de fecha AR. **Sin** dependencias de `react`, `next`, DOM, ni APIs de Node específicas.
- **apps/web**:
  - Cambio en imports: `apps/web/lib/dashboard/queries.ts` y `aggregations.ts` se eliminan (o se mantienen como re-exports temporales si conviene migrar gradualmente — decisión a tomar en design.md).
  - Agregar `@grana/dashboard` a `transpilePackages` en `apps/web/next.config.ts`.
  - Validar que los componentes web siguen funcionando idénticos tras el refactor.
- **apps/mobile**:
  - `package.json`: agregar `"@grana/dashboard": "workspace:*"`.
  - Reescribir `apps/mobile/app/(app)/dashboard.tsx`.
  - Crear `apps/mobile/components/dashboard/` con los 11 componentes espejo del web.
  - Posible nueva dependencia: `expo-linear-gradient` (para el gradiente de la card) si la card visual lo requiere.
- **tsconfig**: agregar `@grana/dashboard` a `paths` en `tsconfig.base.json`. `apps/web/tsconfig.json` y `apps/mobile/tsconfig.json` ya extienden esa base.
- **Metro**: validar que resuelve `@grana/dashboard` sin tocar config (los demás `@grana/*` ya resuelven). Si Metro requiere algún workaround (p.ej. `metro.config.js` ya tiene `workspace` settings), documentarlo.
- **Tests**: los tests unitarios de aggregations se mueven al package y siguen corriendo con el mismo runner (Vitest en web, configurable como test del package). No se agregan tests E2E (no hay setup mobile todavía).
- **Convención cross-platform**: este change estrena formalmente la convención registrada en memoria — mismos nombres de componentes entre web y mobile, cada uno usando lo idiomático de su stack. Aplica desde ahora a toda capability multi-platform; futuros changes ya no la van a re-debatir.
- **Riesgo y mitigación**: el principal riesgo es que la migración del package rompa imports en web. Mitigación: hacer el refactor del package en pasos (a) crear y poblar el package, (b) actualizar imports en web, (c) correr el build de web antes de seguir con mobile. Si algo rompe, queda obvio dónde está el problema.
- **Dependencias previas**: módulos `accounts`, `transactions`, `cards`, `transactions` con recurrencias — todos done. La capability `dashboard` ya existe en `openspec/specs/dashboard/spec.md` (recién consolidada al archivar `add-dashboard`). El shell mobile (`mobile-app-shell`) está done.
