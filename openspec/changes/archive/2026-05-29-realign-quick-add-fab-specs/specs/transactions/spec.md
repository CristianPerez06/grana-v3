## MODIFIED Requirements

### Requirement: El encabezado de Movimientos es minimalista y pelado

El sistema SHALL renderizar el encabezado de `/transactions` como un `PageHeader` clásico **completamente pelado**: SOLO un título corto "Movimientos" (h1, 24px font-semibold). Sin subtítulo, sin actions slot, sin display de mes, sin links contextuales.

El encabezado **NO SHALL** llevar:
- Display tipográfico grande del mes activo.
- Botones de navegación `‹ ›` para el mes.
- Subtítulo informativo con conteo y monedas.
- Botones primary CTA "Recurrencias" o "Registrar movimiento" a la derecha.
- Link contextual a Recurrencias en el slot de actions o el subtítulo.

Razón: las acciones del listado (buscar, ver recurrencias, filtrar) viven en una **micro-toolbar pegada al listado** especificada en el próximo requirement, donde tienen contexto inmediato con la lista sobre la que operan. El único selector de mes vive dentro del card del `CategorySpendingOverview`. El acceso para registrar **en mobile-web** pasa por el FAB definido más abajo en esta spec. **En desktop-web** el FAB NO se renderiza y el encabezado pelado tampoco ofrece CTA: el acceso primario para registrar desde desktop-web se cumple desde el header del dashboard (botón "Nuevo movimiento", spec de `dashboard`) o navegando directo a `/transactions/new`; restaurar un CTA en este encabezado para desktop-web es follow-up explícito fuera de alcance de esta spec.

#### Scenario: El encabezado muestra solo el título

- **WHEN** el usuario abre `/transactions`
- **THEN** el encabezado muestra "Movimientos" como h1 (~24px font-semibold)
- **AND** NO aparece debajo ningún subtítulo, link, ni botón

#### Scenario: El encabezado no duplica la navegación por mes

- **WHEN** el sistema renderiza el encabezado de `/transactions`
- **THEN** no aparece ningún display grande del mes ni botones `‹ ›` para navegar mes
- **AND** la navegación por mes única vive dentro del card del breakdown

#### Scenario: En desktop-web el encabezado pelado no ofrece acceso para registrar (gap conocido)

- **WHEN** un usuario web en viewport `≥sm` abre `/transactions`
- **THEN** el encabezado pelado NO contiene CTA de registrar
- **AND** el FAB tampoco se renderiza en ese viewport
- **AND** el acceso para registrar en ese viewport se cumple desde el header del dashboard o navegando directo a `/transactions/new`
- **AND** restaurar un CTA en este encabezado para desktop-web es follow-up explícito fuera de alcance

---

### Requirement: El usuario tiene un acceso rápido flotante para registrar un movimiento

En **web**, el sistema SHALL ofrecer un **acceso rápido flotante** (FAB) para registrar un movimiento, **visible solo en viewport `<sm` (mobile-web)** en el listado global de Movimientos y en el dashboard, de modo que el usuario pueda iniciar un alta sin scrollear de vuelta al header. El FAB SHALL abrir el flujo de alta canónico (`/transactions/new`). En mobile-web el FAB **reemplaza** al botón "Nuevo movimiento" del header del dashboard (el botón no se renderiza en ese viewport, ver spec de `dashboard`); el FAB es el único acceso primario para registrar desde esas pantallas. En desktop-web (viewport `≥sm`) el FAB NO SHALL renderizarse: el acceso primario lo cumple el botón "Nuevo movimiento" del header del dashboard y los accesos propios de la pantalla `/transactions`.

El FAB web SHALL ser un cuadrado de 64×64 px con esquinas ligeramente redondeadas (`rounded-2xl`, ≈16 px), fondo verde semántico (`bg-success` / `text-success-foreground`, mapeado al token `--success` = emerald), anclado en `bottom-10 right-10` (40 px de cada borde) con `z-index` por encima del contenido scrolleable. El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`), nunca hardcodeado.

Las pantallas que renderizan el FAB en mobile-web SHALL reservar padding inferior suficiente para que el FAB no tape la última fila de contenido al scrollear hasta el final (`pb-24 sm:pb-0` o equivalente).

#### Scenario: FAB visible en Movimientos y dashboard (mobile-web)

- **WHEN** el usuario autenticado abre `/transactions` o `/dashboard` en viewport `<sm`
- **THEN** ve un FAB cuadrado verde anclado en la esquina inferior derecha, visible aunque haya scrolleado la pantalla
- **AND** al activarlo navega a `/transactions/new`

#### Scenario: FAB no visible en desktop-web

- **WHEN** el usuario abre `/transactions` o `/dashboard` en viewport `≥sm`
- **THEN** el FAB NO se renderiza
- **AND** el acceso primario para registrar lo cumple el botón "Nuevo movimiento" del header del dashboard (en `/dashboard`) y los accesos propios de la pantalla en `/transactions`

#### Scenario: El FAB no aparece en otras pantallas web

- **WHEN** el usuario está en una pantalla web que no es Movimientos ni el dashboard (cualquier viewport)
- **THEN** el FAB no se muestra (los accesos de esa pantalla son los suyos propios)

#### Scenario: El contenido scrolleable reserva padding inferior para el FAB en mobile-web

- **WHEN** el usuario en viewport `<sm` scrollea hasta el final del contenido de `/dashboard` o `/transactions`
- **THEN** la última fila de contenido NO queda tapada por el FAB
- **AND** el padding inferior solo se aplica en mobile-web (en desktop el FAB no existe y el padding NO SHALL inflar la página innecesariamente)

## ADDED Requirements

### Requirement: La app nativa expone un FAB para registrar un movimiento

En la app nativa, las pantallas `dashboard` y `transactions` SHALL renderizar un FAB equivalente al de mobile-web para iniciar el alta de un movimiento. El FAB nativo SHALL ser un cuadrado de 80×80 px con esquinas ligeramente redondeadas (`rounded-2xl`), fondo `bg-emerald` (token emerald del mirror de tokens, no hex hardcodeado), ícono `Plus` blanco, anclado en `bottom-10 right-10` por encima del tab bar (no debajo). El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`).

Mientras la pantalla `/transactions/new` mobile **no exista**, el FAB nativo SHALL renderizarse en estado **disabled**: SHALL mantener su aspecto visual (forma, color, ícono) con `opacity-50` y `accessibilityState.disabled = true`, NO SHALL responder al press, y NO SHALL ejecutar `router.push('/transactions/new')`. El destino de navegación (`/transactions/new`) SHALL estar declarado en el componente para que habilitarlo cuando llegue la pantalla sea un cambio mínimo (flip de un constante / borrado del flag).

La pantalla `dashboard` SHALL reservar padding inferior en su `ScrollView` (`pb-28` o equivalente) para que el FAB nativo no tape la última sección al scrollear. La pantalla `transactions` stub actual no necesita padding adicional mientras no tenga contenido scrolleable; cuando llegue contenido SHALL aplicarse la misma reserva.

#### Scenario: FAB visible en dashboard y transactions (mobile native)

- **WHEN** el usuario autenticado abre la pestaña `Dashboard` o `Movimientos` en la app nativa
- **THEN** ve un FAB cuadrado verde de 80 px anclado en la esquina inferior derecha, por encima del tab bar
- **AND** el FAB respeta el safe-area del dispositivo (el tab bar es quien maneja el inset bottom)

#### Scenario: El FAB nativo está disabled mientras no existe `/transactions/new` mobile

- **WHEN** la pantalla `/transactions/new` mobile todavía no fue implementada
- **THEN** el FAB se renderiza con `opacity-50` y `accessibilityState.disabled = true`
- **AND** un tap sobre el FAB NO ejecuta `router.push('/transactions/new')`
- **AND** el destino `/transactions/new` está declarado en el código del componente para habilitarlo cuando la pantalla aterrice

#### Scenario: El FAB nativo se habilita cuando aterriza `/transactions/new` mobile

- **WHEN** un change posterior implementa la pantalla `/transactions/new` en la app nativa y flippea el flag del FAB
- **THEN** el FAB pierde la opacidad reducida y el `accessibilityState.disabled`
- **AND** un tap navega a `/transactions/new`

#### Scenario: El label del FAB nativo es traducible

- **WHEN** un desarrollador inspecciona el FAB en la app nativa
- **THEN** el `accessibilityLabel` se obtiene del catálogo i18n (`transactions.actions.register_movement`), sin string hardcodeado
