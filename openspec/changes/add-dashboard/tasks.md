## 1. Queries (apps/web/lib/queries/dashboard)

- [x] 1.1 Crear `getDashboardHero()` en `apps/web/lib/dashboard/queries.ts` que devuelve `{ ars: number, usd: number }` sumando saldos disponibles de cuentas activas con `type IN ('cash','bank')`. Reutiliza `getTransactionSums` (que ya excluye consumos en tarjeta vía `.is('status', null)`). Devuelve `number` en vez de `Money` para alinear con la convención del repo (ver `getAccounts`).
- [x] 1.2 Crear `getUpcomingFortnight(today)` que devuelve `{ toPay: UpcomingItem[], toCollect: UpcomingItem[] }` para los próximos 14 días inclusive. Une `card_periods` cerrados (`end_date < today`, sin `period_payments`, `due_date in [today, today+14d]`) anotados con totales pendientes por moneda + `recurrence_instances` `status='pending'` con `scheduled_date` en el rango. Una fila por moneda en card_periods con monto > 0.
- [x] 1.3 Crear `getMonthBalanceSeries(year, month)` que devuelve `MonthBalanceSeries` con `days[]` (day, accumulatedBalance, dailyIncome, dailyExpense), totales y `finalBalance`. Solo ARS, solo `status IS NULL` (excluye consumos en tarjeta), cuentas `cash`/`bank`. Transfers omitidas (no afectan patrimonio neto). Adjustments con signo se cuentan al lado correspondiente. Ordering de cálculo `date ASC, created_at ASC, id ASC`.
- [x] 1.4 Re-exportar `getCreditCards` y `CreditCardSummary` desde `apps/web/lib/dashboard/queries.ts` para que el dashboard tenga un punto único de import.
- [x] 1.5 Tests unitarios en `apps/web/lib/dashboard/__tests__/aggregations.test.ts` (20 casos): aggregateHero con cuentas mixtas + off-ledger + decimal math; upcoming con overlap período+recurrencia mismo día, ya pagado, income vs expense/transfer, sort cronológico, multi-currency; month series con día sin movimientos, día con sueldo, día con pago de resumen, transfers omitidos, adjustments signados, accounts no propias ignoradas, meses cortos. Las queries se refactorizaron extrayendo funciones puras a `aggregations.ts` para testear sin DB, siguiendo el patrón ya usado en `lib/transactions/balance.ts`.
- [ ] 1.5 Tests unitarios: hero con cuentas mixtas y consumos en tarjeta no descontados; upcoming con solapamiento de resumen cerrado + recurrencia el mismo día; series mensual con día sin movimientos, día con sueldo y día con pago de resumen.

## 2. Componentes de UI (apps/web/components/dashboard)

- [x] 2.1 Componente `EyeMaskProvider` en `_components/eye-mask-context.tsx` (React context client-side) que expone `{ masked, toggle }`. Estado no persistente.
- [x] 2.2 Componente `EyeMaskToggle` (botón) que renderiza Eye/EyeOff de Lucide y llama `toggle()`, con i18n labels.
- [x] 2.3 Componente `MaskedAmount` que recibe `{ amount: number, currency: 'ARS'|'USD' }` y renderiza `••••••` si masked, sino `formatARS`/`formatUSD` respetando `useShowCents`.
- [x] 2.4 Componente `HeroSection` (Server) que envuelve todo en un `<Link href="/accounts">` y muestra dos `MaskedAmount` (ARS grande, USD subordinado con `showCentsOverride`).
- [x] 2.5 Componente `UpcomingFortnightSection` (Server) con dos columnas (`Column` interno), cada ítem clickeable navega a su detalle. Totales por columna desglosados por moneda. "Balance del período" desglosado por moneda con color positivo/negativo. Manejo de empty.
- [x] 2.6 Componente `MonthNavigator` con ChevronLeft/Right y label "MES AÑO" en minúsculas. Recibe `year`, `month`, `prevHref?`, `nextHref?` (undefined = disabled visual + funcional). Usa `Link` de Next para que el cambio de mes pase por searchParams y no requiera estado client.
- [x] 2.7 Componente `MonthBalanceChart` (Server) — SVG custom con línea + área coloreada según signo del balance final + baseline punteada en y=0 + tick labels para días 1/5/10/15/20/25/último.
- [x] 2.8 Componente `MonthBalanceSection` (Server) compone título + `MonthNavigator` (hrefs hacia `/dashboard?month=YYYY-MM`) + Chart + footer con balance final coloreado e ingresos/gastos totales. Calcula `canGoBack` por límite `monthsBackLimit=12` y `canGoForward` por diferencia con mes actual.
- [x] 2.9 `CardsSection` (Client, lee `useEyeMask` + `useShowCents`) reutiliza `CreditCardCarousel` pasando `masked`. Modificación retro-compatible al carousel/item: prop `masked?: boolean` opcional, default false. Empty state con CTA.
- [x] 2.10 Stories de Storybook agregadas para los componentes que no son async (las secciones son Server Components con `getTranslations` y el repo no tiene setup de `NextIntlClientProvider` en Storybook). Cubierto: `MonthBalanceChart` (mes feliz, plano, negativo, mes corto), `MonthNavigator` (ambos enabled, mes actual, 12 meses atrás), `MaskedAmount` (ARS visible, USD con cents, masked, cero), `SectionFallback` (default, hero error). Stories para `HeroSection`/`UpcomingFortnightSection`/`MonthBalanceSection`/`CardsSection`/`WelcomeFirstMoveCard` quedan como deuda — requieren primero un decorator global de next-intl en Storybook (cambio que excede este alcance).

## 3. Decisiones técnicas a resolver durante implementación

- [ ] 3.1 Elegir librería de chart para `MonthBalanceChart`. Criterio: bundle size mínimo, soporta línea suavizada/escalonada, accesible (tooltip por keyboard), funciona en Server/Client Components según la decisión. Candidatos a evaluar: Recharts (más conocido, ~90kb), visx (más pesado pero modular), una mini-lib SVG custom (más liviano, más trabajo). Documentar la decisión en un comentario corto en el componente.
- [ ] 3.2 Definir el formato bimoneda de `MaskedAmount` consistente con el formateo ya usado en `cards` y `accounts`. Si existe un helper `formatMoney(value, currency)` ya en `packages/`, reutilizarlo. Si no, definirlo en `packages/` (no en `apps/web`).
- [ ] 3.3 Confirmar que el ordering determinístico de `getMonthBalanceSeries` usa el orden de cálculo (`date ASC, created_at ASC, id ASC`) y no el de display.

## 4. Página y routing (apps/web/app/(app)/dashboard)

- [x] 4.1 Reescribir `apps/web/app/(app)/dashboard/page.tsx` como Server Component que parsea `searchParams.month` (formato `YYYY-MM`, validado y dentro de límite), carga las 4 queries con `Promise.allSettled`, y pasa data a las secciones envueltas por `EyeMaskProvider`.
- [x] 4.2 Layout vertical Hero → UpcomingFortnight → MonthBalance → Cards. `DashboardHeader` (Client) con título y `EyeMaskToggle`.
- [x] 4.3 Manejo de error por sección: `Promise.allSettled` + componente `SectionFallback` con mensaje i18n por sección. Una sección rota no rompe el resto.
- [x] 4.4 Middleware no requiere cambios: `apps/web/app/(app)/layout.tsx:11-12` ya ejecuta `if (!user) redirect('/login')` antes de renderizar el shell, lo que protege todas las rutas bajo `(app)/`.

## 5. Redirect post-onboarding (apps/web/app/(app)/onboarding)

- [x] 5.1 Verificado: el viejo flujo `(app)/onboarding/_components/novato-onboarding-form.tsx` ya no existe. El onboarding migró al wizard `(onboarding-wizard)/onboarding/` con páginas welcome → perfil → saldo-actual → done. El page `done/page.tsx:63` ya renderiza `<Link href="/dashboard">` como CTA. Aterriza correctamente.
- [x] 5.2 Verificado: el wizard usa el mismo `done` page para ambos modos (novato y experto). Por lo tanto ambos flujos terminan apuntando a `/dashboard`.
- [ ] 5.3 Test E2E (Playwright o similar) que cubra: signup → confirmación email → onboarding novato → llegada a `/dashboard` con tarjeta default visible en el carrusel y Hero en $ 0. Aplazado a F9 (no hay Playwright instalado todavía; evaluar setup antes).

## 6. Internacionalización

- [x] 6.1 Agregar a `packages/i18n-messages/src/es.json` y `en.json` las claves de copy del dashboard bajo el namespace `dashboard`: hero label, upcoming (title/subtitle/to_pay/to_collect/period_balance/empty/error), month (title/income/expense/final_balance/empty/error), cards (title/empty_title/empty_cta/error), mask_show/mask_hide, hero_error.
- [x] 6.2 Categorías no entran a V1 del dashboard — no se agregan claves pluralizables aún. Cuando se incorpore el módulo de Reportes, se evaluará allí el patrón de "Otros (N cat.)".

## 7. QA manual

> Notas: el usuario validó (a) que el estado vacío inicial quedaba "raro" sin afordance — se incorporó la `WelcomeFirstMoveCard` (ver 7.0); (b) que el dashboard renderiza correctamente con sus datos reales. Los casos 7.2-7.9 quedan como verificaciones a hacer antes del merge a `main` — el código está completo y los tests cubren la lógica de las queries.

- [x] 7.0 **Bonus** (no en spec inicial): `WelcomeFirstMoveCard` portada de V2 — aparece arriba del Hero cuando el usuario tiene 0 transacciones de `income`/`expense` (parent rows y transfer/adjustment no cuentan, mismo criterio que V2). Auto-dismiss al primer movimiento real. CTA navega a `/accounts`. Query `hasUserMovements()` agregada. i18n bajo `dashboard.welcome_card`.
- [x] 7.1 Caso usuario nuevo (sin movimientos, tarjeta default creada por onboarding): Hero en $ 0 y u$s 0, "Lo que viene" vacío, gráfico mes plano en 0, carrusel con la tarjeta default sin alertas, WelcomeFirstMoveCard arriba con CTA a `/accounts`.
- [ ] 7.2 Caso usuario con saldos en ambas monedas: Hero muestra los dos importes correctamente.
- [ ] 7.3 Caso consumo en tarjeta no descuenta del Hero ni baja el gráfico mensual.
- [ ] 7.4 Caso pago de resumen sí descuenta del Hero y aparece como caída en el gráfico mensual en el día del pago.
- [ ] 7.5 Caso resumen próximo a vencer aparece en "A pagar" con la fecha y el monto correctos, sin que ninguna de sus cuotas individuales se duplique en la columna.
- [ ] 7.6 Caso recurrencia mensual entrante aparece en "A cobrar" con la fecha esperada.
- [ ] 7.7 Caso navegador de mes: ir 12 meses atrás (flecha izquierda deshabilitada en el 12), volver al actual (flecha derecha deshabilitada).
- [ ] 7.8 Caso eye toggle: activar enmascara todo, salir a `/accounts` y volver, los importes están visibles otra vez.
- [ ] 7.9 Caso falla deliberada en `getUpcomingFortnight` (forzar error en dev): las otras tres secciones siguen funcionando.

## 8. Documentación y archivado

- [x] 8.1 CLAUDE.md no requiere cambios. El dashboard es read-only, no agrega invariantes contables ni cambia convenciones existentes. La única decisión de convención fue alinearse con el patrón ya existente del repo (queries devuelven `number` no `Money`, viven en `lib/<module>/queries.ts`, no en `lib/queries/<module>/`).
- [ ] 8.2 Archivar cuando el PR se mergee a `main`: `openspec/changes/add-dashboard/` → `openspec/changes/archive/YYYY-MM-DD-add-dashboard/` y consolidar el spec en `openspec/specs/dashboard/spec.md`. (Owner task — se ejecuta post-merge.)
