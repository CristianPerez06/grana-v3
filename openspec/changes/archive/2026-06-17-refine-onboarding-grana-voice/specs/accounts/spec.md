# accounts Specification (Delta)

## ADDED Requirements

### Requirement: El drawer de alta de cuenta se abre automáticamente desde un query param

Para que la creación de cuenta siempre se presente en el drawer (consistente con el resto de la app) incluso cuando se llega desde fuera de la lista de cuentas —como el cierre del onboarding—, el sistema SHALL abrir el drawer de "Crear cuenta" cuando se visita `/accounts` con el query param `nuevaCuenta=1`. La apertura SHALL ocurrir una sola vez por navegación y el query param SHALL limpiarse de la URL al abrir, para no re-disparar en refresh o navegación hacia atrás.

Como el formulario de alta necesita la lista de instituciones (que carga de forma asíncrona), la apertura automática SHALL esperar a que las instituciones estén disponibles antes de abrir el drawer; mientras tanto el param SHALL conservarse.

#### Scenario: Visitar la lista de cuentas con ?nuevaCuenta=1 abre el drawer de creación

- **WHEN** un usuario autenticado navega a `/accounts?nuevaCuenta=1`
- **THEN** una vez cargadas las instituciones, el drawer de "Crear cuenta" se abre
- **AND** el query param `nuevaCuenta` se elimina de la URL (queda `/accounts`)

#### Scenario: Cerrar el drawer abierto por query param no lo reabre

- **WHEN** el drawer se abrió por `?nuevaCuenta=1` y el usuario lo cierra
- **THEN** el drawer permanece cerrado
- **AND** el drawer NO se reabre por la presencia del param (ya fue limpiado de la URL)
