## Why

La sección "Balance del mes" del dashboard navega el mes vía URL (`?month=YYYY-MM`) en web y mobile. Cambiar de mes dispara una navegación de ruta completa: en web re-renderiza toda la página y parpadea el spinner full-screen de la ruta; en mobile la tarjeta se desmonta y vuelve a montarse (renderiza `null` mientras la query del nuevo mes está `pending`). Además la tarjeta no tiene estado de carga ni de error propios, y en web la flecha derecha del navegador se desborda fuera de la tarjeta cuando el viewport está entre ~1024px y ~1088px (columna izquierda del grid demasiado angosta).

## What Changes

- **Mes como estado de cliente**, no URL. La tarjeta "Balance del mes" pasa a ser un componente cliente que posee el mes seleccionado en estado local de React y obtiene los datos del lado del cliente al navegar.
  - Web: el fetch del mes navegado se hace vía un **server action** que envuelve `getMonthBalanceSeries`; el mes actual sigue llegando server-rendered como dato inicial (sin parpadeo en la carga del dashboard).
  - Mobile: el fetch sigue por **TanStack Query** (`useMonthBalanceSeries`), pero el mes deja de leerse de `useLocalSearchParams` y pasa a estado local; las flechas dejan de ser `Link` de Expo Router.
  - **BREAKING (UX)**: el mes deja de reflejarse en la URL; ya no es deep-linkable ni sobrevive a un refresh (siempre abre en el mes actual). Decisión tomada con el usuario.
- **Estado de carga propio de la tarjeta**: mientras se obtienen los datos de un mes, el spinner reemplaza únicamente el gráfico y el footer (balance/ingresos/gastos). El título y el navegador mensual permanecen visibles e interactivos. El alto y ancho de la tarjeta no cambian (sin layout shift).
- **Estado de error propio de la tarjeta**: si el fetch del mes falla, el área del gráfico + footer muestra un error compacto con opción de reintentar, manteniendo título y navegador visibles y el tamaño de la tarjeta.
- **Fix de overflow (web)**: la flecha derecha del navegador nunca se desborda de la tarjeta entre ~1024–1088px de viewport. El header del navegador se mantiene contenido (el navegador no se encoge, el título cede espacio/trunca).

## Capabilities

### New Capabilities
<!-- Ninguna. Esto modifica comportamiento existente del dashboard. -->

### Modified Capabilities
- `dashboard`: el requisito "La sección 'Balance del mes' muestra un gráfico de línea acumulada con navegador mensual" cambia su comportamiento de navegación (mes en estado de cliente en vez de URL) y agrega estados de carga y error propios de la tarjeta (in-card, tamaño fijo) más una garantía de no-overflow del navegador en web.

## Impact

- **Web** (`apps/web/app/(app)/dashboard/`):
  - `_components/month-balance-section.tsx` → componente cliente con estado de mes, fetch on-navigate y estados loading/error in-card; fix de layout del header.
  - `_components/month-navigator.tsx` → las flechas pasan de `<Link>` a botones con `onPress`/callbacks; `shrink-0` y título truncable para el fix de overflow.
  - `page.tsx` → deja de leer `?month=` para esta sección; pasa solo el dato inicial del mes actual server-rendered. `parseMonthParam` puede dejar de usarse para el dashboard.
  - Nuevo **server action** que envuelve `getMonthBalanceSeries(supabase, year, month)`.
- **Mobile** (`apps/mobile/`):
  - `components/dashboard/MonthBalanceSection.tsx` → estado de mes local, estados loading/error in-card de tamaño fijo.
  - `components/dashboard/MonthNavigator.tsx` → flechas como `Pressable` con callback en vez de `Link`.
  - `app/(app)/dashboard.tsx` → deja de derivar el mes de `useLocalSearchParams` para esta sección; ya no condiciona el render de la tarjeta a `monthSeries.data`.
- **Sin cambios** en `@grana/dashboard` (`getMonthBalanceSeries`, `buildMonthBalanceSeries`, tipos) ni en el esquema de DB. Es un cambio de capa de presentación/fetching por app.
- i18n: posibles claves nuevas para el mensaje de error/reintento de la tarjeta (`dashboard.month.error` ya existe; podría sumarse un label de reintento si no existe).
