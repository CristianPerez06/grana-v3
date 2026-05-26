## 1. Shell — estructura del sidebar (web-app-shell)

- [x] 1.1 Reestructurar el sidebar island en `apps/web/app/(app)/_components/app-shell.tsx`: logo `grana` como header fijo (`flex-shrink:0`), nav primaria como zona central (`flex:1; min-h-0; overflow-y-auto`), Configuración + Cerrar sesión como footer (`flex-shrink:0`) separados por el divisor.
- [x] 1.2 Verificar que el scroll del nav es interno al island (no mueve el `<main>`) y que el footer queda siempre alcanzable, sin romper "island flotante" ni "`<main>` scrollable".
- [x] 1.3 Usar clases de token (`bg-card`, `border-border-soft`, `text-navy`, etc.), sin hex literales.

## 2. Dashboard desktop — header + layout multi-columna (dashboard, web)

- [x] 2.1 Header del dashboard: saludo `Hola, {name}.` (`dashboard.welcome`, fallback `dashboard.welcome_anon`) + fecha de hoy vía `getTodayAR()` (no `new Date()`); mantener el `eye toggle`.
- [x] 2.2 Botón primario "Nuevo movimiento" (estilo `positive`/emerald) → `/transactions/new`, con label desde i18n.
- [x] 2.3 Grid desktop (≥`lg`): Hero full-width arriba; debajo "Balance del mes" (crece) + rail "Lo que viene" (ancho acotado) lado a lado, alturas igualadas. Bajo `lg`, columna única mobile-first.
- [x] 2.4 Hero desktop: desglose de 2–3 cuentas `cash`/`bank` con saldo + enlace "Ver todas las cuentas" → `/accounts`; en mobile el Hero queda minimal (solo disponible total ARS + USD). Respetar bimoneda (sin merge).
- [x] 2.5 Asegurar que el `eye toggle` enmascara también los saldos del desglose de cuentas del Hero.

## 3. Quitar la sección Tarjetas del dashboard (dashboard, web + datos)

- [x] 3.1 Remover `CardsSection` / `CreditCardCarousel` de la pantalla `(app)/dashboard` web (quedan 3 secciones: Hero, Lo que viene, Balance del mes). → se borró el componente muerto `cards-section.tsx`; `CreditCardCarousel` sigue para `/cards`.
- [x] 3.2 Dejar de disparar `getCreditCards` en la carga del dashboard (en `@grana/dashboard` y/o en la page); la query sigue existiendo para `/cards`. → se quitó del `Promise.allSettled` de la page; `getCreditCards` queda solo en `/cards` y `accounts/queries`.
- [x] 3.3 Confirmar que `/cards` (web) sigue mostrando el carrusel/listado de resúmenes sin cambios funcionales. → `/cards` no se tocó (importa `getCreditCards` + `CreditCardCarousel` aparte, usa el namespace i18n `cards`).

## 4. Dashboard mobile + nativo (dashboard, mobile)

- [x] 4.1 En `apps/mobile/app/(app)/dashboard.tsx`: renderizar 3 secciones (Hero → Lo que viene → Balance del mes), quitar la sección Tarjetas y `getCreditCards` del paralelo, manteniendo `EyeMaskProvider` y `SectionFallback` por sección. → se borró `useDashboardCards` y el `CardsSection` mobile.
- [x] 4.2 Header nativo del dashboard: saludo + fecha (`getTodayAR()` o equivalente mobile), con el `eye toggle`. → `DashboardHeader` recibe `name` + `todayISO`; saludo (`dashboard.welcome`/`welcome_anon`) + fecha (locale) + eye toggle, dentro del header navy.
- [x] 4.3 Confirmar/formalizar el header navy + status bar `light` leyendo el color desde el mirror de tokens (sin hex literal); respetar safe-area top. → header usa la clase token `bg-navy` (no hex), `StatusBar style="light"` ya está en `(app)/_layout.tsx`, `SafeAreaView edges={['top']}`.
- [x] 4.4 Verificar que Tarjetas sigue navegable desde el `AppMenu` → `/cards` (sin cambios de navegación). → `AppMenu` intacto; además se cableó la pantalla `/cards` mobile (mirror de web: título + carrusel), reubicando `CreditCardCarousel`/`CreditCardItem` a `components/cards/`, así no queda código muerto. Nota: sin afford. "agregar tarjeta" porque no existe ruta `/cards/new` en mobile (fuera de alcance).

## 5. i18n

- [x] 5.1 Resolver el label del botón "Nuevo movimiento": reusar key existente (p. ej. `transactions.new`) o agregar una bajo `dashboard.*` en `es.json` y `en.json`. → se agregó `dashboard.new_movement` (es/en) + `dashboard.hero.view_all_accounts`.
- [x] 5.2 Confirmar que `dashboard.welcome` / `dashboard.welcome_anon` se consumen vía el helper i18n (sin strings hardcodeados). → `DashboardHeader` los consume vía `useTranslations('dashboard')`.

## 6. Verificación

- [x] 6.1 `pnpm lint` y type-check en web y mobile sin errores. → web: lint 0 errores + typecheck OK; mobile: lint 0 errores + typecheck OK (warnings preexistentes, ajenos al change).
- [ ] 6.2 Verificar responsive web en tres anchos: <768 (mobile-first), 768–1023 (columna única + sidebar), ≥1024 (multi-columna). → verificación visual manual a cargo del usuario, en paralelo al archivado (decisión acordada).
- [ ] 6.3 Verificar el dashboard nativo (header navy, 3 secciones, tab bar intacto). → verificación visual manual a cargo del usuario, en paralelo.
- [ ] 6.4 Verificar el `eye toggle`: enmascara Hero (incl. desglose desktop), Lo que viene y Balance del mes; resetea al salir/volver. → verificación visual manual a cargo del usuario, en paralelo.
- [ ] 6.5 Cotejar el resultado contra las referencias de `design-refs/` (layout e intención, NO los hex literales). → verificación visual manual a cargo del usuario, en paralelo.

## 7. Archivado (pre-merge)

- [x] 7.1 Archivar el change: mover a `openspec/changes/archive/AAAA-MM-DD-...`, integrar los deltas en los specs maestros de `dashboard` y `web-app-shell`, y correr `pnpm openspec:check` (debe pasar) antes del merge. → archivado a `archive/2026-05-26-...`; deltas integrados (+ se corrigieron inconsistencias consecuentes que los deltas no cubrían: Purpose, escenarios de click en carrusel, "tres secciones", lista de naming mobile); `CLAUDE.md` (módulo dashboard) actualizado; `openspec:check` OK.
