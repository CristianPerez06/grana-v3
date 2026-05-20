## Why

El dashboard es la pantalla principal post-login de Grana y hoy en v3 es una página huérfana: solo muestra un saludo y el nombre del usuario. El onboarding del modo novato ni siquiera la usa — al terminar, redirige a `/cards`, dejando al usuario sin un "hogar" del producto.

Sin dashboard, Grana es una colección de pantallas sueltas (cuentas, movimientos, tarjetas) en lugar de un asistente financiero. El dashboard es lo que responde, de un vistazo, las tres preguntas que el usuario se hace cada vez que abre la app:

- ¿Cuánto tengo para gastar hoy?
- ¿Qué tengo comprometido para los próximos días?
- ¿Cómo me fue este mes?

V2 ya tenía un dashboard maduro (sección "Hero", navegador mensual, gráfico de gastos por categoría, scroll de tarjetas). V3 toma esas ideas como baseline pero las repiensa: saca lo que no aportaba (tabs Mensual/Diario), incorpora lo que faltaba ("Lo que viene"), y posterga lo que depende de módulos aún no construidos (pills de `shared` y `savings`).

## What Changes

- Crear la pantalla `/dashboard` con cuatro secciones verticales en orden fijo:
  1. **Hero "Para gastar"**: disponible total en ARS+USD, bimoneda lado a lado. Eye toggle para enmascarar importes (privacidad).
  2. **Lo que viene (próximas 2 semanas)**: dos columnas — "A pagar" (resúmenes cerrados pendientes + movimientos recurrentes salientes) y "A cobrar" (recurrentes entrantes). Sin cuotas sueltas (viven dentro de un resumen). Balance del período abajo.
  3. **Balance del mes**: gráfico de línea con el balance acumulado día a día del mes seleccionado, navegador `◀ ▶` para meses anteriores (límite −12 meses). Totales de ingresos y gastos del mes debajo.
  4. **Tarjetas**: carrusel horizontal con scroll-snap, reutilizando el componente `CreditCardCarousel` ya existente del módulo `cards`.
- Cambiar el redirect post-onboarding del modo novato de `/cards` a `/dashboard`. El dashboard pasa a ser la landing universal post-login y post-onboarding.
- El dashboard es **idéntico en ambos modos** (novato y experto). El detalle por cuenta vive en el módulo Cuentas; el dashboard solo muestra el agregado.
- Toda la pantalla es **read-only**: no permite crear, editar ni eliminar nada. Los importes son siempre clickeables y navegan al módulo correspondiente (Hero → Cuentas, ítem de "Lo que viene" → Tarjetas o Movimientos, tarjeta del carrusel → detalle de tarjeta).
- Quedan **fuera de scope V1** (anchors registrados para futuro):
  - Pills contextuales en el Hero (Ahorros, Economía Familiar) — esperan los módulos `savings` y `shared`.
  - Comentario pedagógico dinámico en el Hero (alerta de resumen próximo a vencer, comparativa con mes anterior, contexto inflacionario) — pendiente de definición funcional una vez que el dashboard esté en uso.
  - Vista de saldo proyectado día a día — pertenece al módulo `cashflow`.
  - Top categorías en el dashboard — se incorporan al módulo Movimientos como encabezado visual, no al dashboard.
  - Movimientos recientes en el dashboard — viven en su pantalla dedicada.

## Capabilities

### New Capabilities

- `dashboard`: Define la pantalla principal post-login con sus cuatro secciones (Hero, Lo que viene, Balance del mes, Tarjetas), las queries agregadas que consume, el eye toggle de privacidad, y las reglas de navegación a otros módulos.

### Modified Capabilities

- `auth`: El redirect tras completar el onboarding novato pasa de `/cards` a `/dashboard`. Login y signup ya redirigen a `/dashboard` por spec; este cambio alinea el flujo de onboarding con esa convención.

## Impact

- **Schema**: ninguna migración. El dashboard es read-only y se alimenta de las tablas existentes (`accounts`, `account_currencies`, `transactions`, `card_periods`, `period_payments`, `recurrence_instances`).
- **Backend**: nuevas queries agregadas en `apps/web/lib/queries/dashboard/`:
  - `getDashboardHero(userId)` — suma de saldos disponibles por moneda, excluyendo cuentas `credit` (ya lo hace `getAccountBalances`).
  - `getUpcomingFortnight(userId, from)` — une `card_periods` cerrados+pendientes (próximos 14 días por `due_date`) con `recurrence_instances` no confirmadas y no omitidas en el mismo rango.
  - `getMonthBalanceSeries(userId, year, month)` — devuelve un array `[{ day, accumulatedBalance, dailyIncome, dailyExpense }]` para el mes seleccionado.
- Reutiliza queries existentes para Tarjetas: `getCreditCards(userId)`.
- **Frontend**: nuevos componentes en `apps/web/components/dashboard/` (`HeroSection`, `UpcomingFortnightSection`, `MonthBalanceChart`, `MonthNavigator`, `EyeMaskToggle`). Reescribe `apps/web/app/(app)/dashboard/page.tsx`.
- **Librería de charts**: se introduce una dependencia ligera para el gráfico de línea del balance del mes. Decisión a tomar en implementación entre Recharts y opciones más livianas (visx, nivo, una mini-lib CSS-only). El requirement de la spec define el comportamiento esperado; no el motor de render.
- **Onboarding**: una sola línea de cambio en `apps/web/app/(app)/onboarding/_components/novato-onboarding-form.tsx:41` (`router.push('/cards')` → `router.push('/dashboard')`). El flujo experto ya está correctamente apuntando a `/dashboard` (verificar y, si no, alinear).
- **Eye toggle**: estado client-side (React context), no persistente, alcance toda la pantalla dashboard. Cuando el usuario navega fuera y vuelve, el estado vuelve a "visible".
- **Dependencias previas**: `accounts`, `transactions`, `cards` (todas ya done) y la modificación de `transactions` por recurrencias (también done). Este change no introduce dependencias hacia adelante: lo construido será extensible cuando lleguen `shared`, `savings` y `cashflow`.
- **Mobile**: este change cubre solo web. La pantalla `(app)/dashboard` de mobile (placeholder actual con botón de logout) se aborda en un change separado cuando el shell mobile lo justifique.
