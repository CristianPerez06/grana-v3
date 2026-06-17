# transactions Specification (Delta)

## ADDED Requirements

### Requirement: El drawer de alta de movimiento se abre automáticamente desde un query param

Para permitir que flujos externos al layout `(app)` (como el cierre del onboarding) lleven al usuario directo al alta de un movimiento, el sistema SHALL abrir el drawer de creación de movimiento cuando una ruta dentro de `(app)` se visita con el query param `nuevo=1`. La apertura SHALL ocurrir una sola vez por navegación (no debe reabrirse si el usuario cierra el drawer y permanece en la misma URL), y el query param SHALL limpiarse de la URL al abrir para no re-disparar en refresh o navegación hacia atrás.

El drawer SHALL abrirse en modo creación (equivalente a `openCreate()` sin cuenta preseleccionada), de modo que, si el usuario no tiene movimientos, el tour guiado del primer movimiento arranque con normalidad.

Esta apertura depende de que el `MovementDrawerProvider` esté montado (datos de cuentas/categorías/household listos). Si el provider aún no está disponible al leerse el param, el sistema SHALL reintentar la apertura cuando el provider quede disponible, sin perder la intención.

#### Scenario: Visitar el dashboard con ?nuevo=1 abre el drawer de creación

- **WHEN** un usuario autenticado navega a `/dashboard?nuevo=1`
- **THEN** el drawer de alta de movimiento se abre en modo creación
- **AND** el query param `nuevo` se elimina de la URL (queda `/dashboard`)
- **AND** si el usuario no tiene movimientos, el tour guiado del drawer arranca

#### Scenario: Cerrar el drawer abierto por query param no lo reabre

- **WHEN** el drawer se abrió por `?nuevo=1` y el usuario lo cierra
- **THEN** el drawer permanece cerrado
- **AND** el drawer NO se reabre por la presencia del param (ya fue limpiado de la URL)
