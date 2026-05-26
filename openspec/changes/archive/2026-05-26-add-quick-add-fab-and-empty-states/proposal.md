## Why

Dos fricciones del módulo Movimientos que el Change 3 dejó pendientes:

1. **Registrar exige llegar a un header.** Hoy el alta se dispara desde un botón de header: el de `/transactions`, el del dashboard, o el CTA de una cuenta/tarjeta. Mientras se escanea una lista larga, ese acceso queda fuera de vista (hay que volver arriba). Falta un acceso rápido **siempre visible**.

2. **El listado vacío muestra un único mensaje genérico**, sin distinguir *por qué* está vacío. No es lo mismo "todavía no cargaste nada" (hay que invitar a registrar) que "tu búsqueda no encontró nada" o "ningún movimiento cumple estos filtros" (hay que ofrecer salir del filtro). El mensaje único no guía la salida.

Este change (Change 4 del rediseño, sobre los Changes 1/2/3) ataca esas dos fricciones. El **detalle como drawer/bottom-sheet queda fuera** (es un cambio de arquitectura de rutas con peso propio → Change 5).

## What Changes

- **Quick-add FAB**: un botón flotante (fixed, esquina inferior) para registrar un movimiento, presente en **Movimientos y dashboard**, que abre `/transactions/new`. Coexiste con los botones de header (el FAB sigue visible al scrollear listas largas; ése es su valor).
- **Empty states de 3 variantes** en el listado global de Movimientos, según por qué está vacío:
  - **Sin movimientos** (sin búsqueda ni filtros de contenido): mensaje de bienvenida + CTA para registrar el primero.
  - **Sin resultados de búsqueda** (hay término de búsqueda activo): "no encontramos resultados para «X»" + acción para limpiar la búsqueda.
  - **Sin resultados de filtro** (hay filtros de contenido activos): "ningún movimiento cumple estos filtros" + acción para limpiar filtros.
- Sin migraciones de base: es presentación + claves i18n.

## Capabilities

### Modified Capabilities
- `transactions`: agrega un **acceso rápido flotante (FAB)** para registrar un movimiento en Movimientos y dashboard, y reemplaza el **empty state único** del listado global por **tres variantes** (sin movimientos / sin resultados de búsqueda / sin resultados de filtro), cada una con la acción adecuada.

## Impact

- **Web — FAB**: nuevo componente `QuickAddFab` (link fijo a `/transactions/new`, con ícono) montado en `/transactions` y `/dashboard`. La navegación por mes (Change 2) no lo afecta.
- **Web — empty states**: la página de Movimientos deriva el **motivo del vacío** de los filtros (búsqueda `query` vs otros filtros de contenido: tipo, categoría, cuenta, moneda, rango de monto) y se lo pasa a `MovementList`, que renderiza la variante y su acción (limpiar búsqueda / limpiar filtros vía URL, reusando el mecanismo del Change 2). La vista de cuenta mantiene su empty "registrá el primero".
- **i18n**: claves nuevas (label/aria del FAB; 3 mensajes de empty + acciones "limpiar búsqueda" / "limpiar filtros").
- **Sin migraciones**; **sin cambios en mobile** (lo maneja el tech lead; el FAB y los empty states son presentación web).
- **Se apila sobre el Change 3** (ya en `main`).
- **Fuera de alcance**: detalle como drawer/bottom-sheet (Change 5); resumen por moneda en el dashboard.
