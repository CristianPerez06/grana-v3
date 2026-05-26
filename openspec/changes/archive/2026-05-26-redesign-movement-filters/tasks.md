## 1. Modelo de filtros y parseo (`filters.ts`)

- [x] 1.1 Extender `MovementFilters` y `parseMovementFilters` con `currency` ('ARS'|'USD'), `amountMin`/`amountMax`, y `month` (`YYYY-MM`); derivar `from`/`to` del mes con default al mes actual (`getTodayAR`), manteniendo `from`/`to` explícitos como rango custom con prioridad. (Se quitó el viejo `period`/`resolveMovementPeriod`.)
- [x] 1.2 Helper `hasContentFilters` (tipo, categoría, búsqueda, rango de monto) separado de la navegación temporal (mes) y de la moneda, para decidir el ocultado del running balance.
- [x] 1.3 Helpers de navegación por mes (`shiftMonth`, `monthOf`, `resolveMonthRange`). Los chips activos y su remoción de la URL se arman en el componente (Grupo 3).
- [x] 1.4 Tests de `filters.ts`: derivación mes→from/to, default mes actual, prioridad del rango custom, `shiftMonth`/`monthOf`, `hasContentFilters` (16 tests, 169 verdes).

## 2. Query

- [x] 2.1 `getGlobalMovementsPage`: filtrar por `currency` (server) y por rango de monto (`amountMin`/`amountMax` post-map sobre el monto absoluto); la búsqueda de texto ya recorría todo el historial (loop por chunks).
- [x] 2.2 Vista de cuenta: filtra el historial (mes + contenido) client-side sobre los movimientos mapeados y oculta el running balance cuando hay filtros de contenido (`hasContentFilters`); la navegación por mes y la moneda NO lo ocultan.

## 3. Componentes de filtros (`apps/web`)

- [x] 3.1 Reescribir `movement-filters.tsx`: barra compacta (búsqueda + navegación por mes ‹ › + botón "Filtros" con contador) — client.
- [x] 3.2 Búsqueda instantánea: input debounced (~300ms, `useEffect`) que hace `router.replace` con el nuevo `q` (sin recargar, sin botón "Aplicar").
- [x] 3.3 Panel desplegable con tipo, categoría, cuenta (solo experto, oculto en vista de cuenta), moneda y rango de monto; aplican vía `router.replace`.
- [x] 3.4 Chips de filtros activos + "Limpiar todo" (derivados de la URL; quitar un chip = quitar el param).
- [x] 3.5 Control de navegación por mes (‹ Mes Año ›) con `month` en la URL; "hoy"/mes actual desde `getTodayAR`; muestra "Rango personalizado" si hay from/to custom.
- [x] 3.6 Claves i18n nuevas (navegación de mes, "Filtros", "Limpiar todo", moneda, monto, rango custom) en `@grana/i18n-messages`.

## 4. Integración

- [x] 4.1 `/transactions/page.tsx`: el período se resuelve desde `month` (default mes actual) vía `parseMovementFilters`; pasa `isExpert` a `MovementFilters`; el reset del límite de paginación lo hace el componente al cambiar filtros (`params.delete('limit')` en `router.replace`).
- [x] 4.2 `/accounts/[id]/page.tsx`: parsea filtros, filtra la lista (mes + contenido) y oculta el running balance con filtros de contenido; suma `MovementFilters` con `showAccountFilter={false}`.

## 5. Verificación

- [x] 5.1 `pnpm build` (web) verde (corre lint); 169 tests verdes; typecheck limpio.
- [x] 5.2 Verificación en navegador (por el usuario): barra compacta + chips + panel; búsqueda instantánea; navegación por mes con default mes actual; filtro de moneda; rango de monto; filtro de cuenta oculto en novato; running balance se mantiene al navegar mes y se oculta con filtros de contenido. Todo OK.
