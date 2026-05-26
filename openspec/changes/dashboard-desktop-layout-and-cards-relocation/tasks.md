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

- [ ] 3.1 Remover `CardsSection` / `CreditCardCarousel` de la pantalla `(app)/dashboard` web (quedan 3 secciones: Hero, Lo que viene, Balance del mes).
- [ ] 3.2 Dejar de disparar `getCreditCards` en la carga del dashboard (en `@grana/dashboard` y/o en la page); la query sigue existiendo para `/cards`.
- [ ] 3.3 Confirmar que `/cards` (web) sigue mostrando el carrusel/listado de resúmenes sin cambios funcionales.

## 4. Dashboard mobile + nativo (dashboard, mobile)

- [ ] 4.1 En `apps/mobile/app/(app)/dashboard.tsx`: renderizar 3 secciones (Hero → Lo que viene → Balance del mes), quitar la sección Tarjetas y `getCreditCards` del paralelo, manteniendo `EyeMaskProvider` y `SectionFallback` por sección.
- [ ] 4.2 Header nativo del dashboard: saludo + fecha (`getTodayAR()` o equivalente mobile), con el `eye toggle`.
- [ ] 4.3 Confirmar/formalizar el header navy + status bar `light` leyendo el color desde el mirror de tokens (sin hex literal); respetar safe-area top.
- [ ] 4.4 Verificar que Tarjetas sigue navegable desde el `AppMenu` → `/cards` (sin cambios de navegación).

## 5. i18n

- [x] 5.1 Resolver el label del botón "Nuevo movimiento": reusar key existente (p. ej. `transactions.new`) o agregar una bajo `dashboard.*` en `es.json` y `en.json`. → se agregó `dashboard.new_movement` (es/en) + `dashboard.hero.view_all_accounts`.
- [x] 5.2 Confirmar que `dashboard.welcome` / `dashboard.welcome_anon` se consumen vía el helper i18n (sin strings hardcodeados). → `DashboardHeader` los consume vía `useTranslations('dashboard')`.

## 6. Verificación

- [ ] 6.1 `pnpm lint` y type-check en web y mobile sin errores.
- [ ] 6.2 Verificar responsive web en tres anchos: <768 (mobile-first), 768–1023 (columna única + sidebar), ≥1024 (multi-columna).
- [ ] 6.3 Verificar el dashboard nativo (header navy, 3 secciones, tab bar intacto).
- [ ] 6.4 Verificar el `eye toggle`: enmascara Hero (incl. desglose desktop), Lo que viene y Balance del mes; resetea al salir/volver.
- [ ] 6.5 Cotejar el resultado contra las referencias de `design-refs/` (layout e intención, NO los hex literales).

## 7. Archivado (pre-merge)

- [ ] 7.1 Archivar el change: mover a `openspec/changes/archive/AAAA-MM-DD-...`, integrar los deltas en los specs maestros de `dashboard` y `web-app-shell`, y correr `pnpm openspec:check` (debe pasar) antes del merge `--ff-only`.
