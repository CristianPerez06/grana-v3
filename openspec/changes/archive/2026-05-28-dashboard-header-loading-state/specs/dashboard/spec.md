## MODIFIED Requirements

### Requirement: El header del dashboard saluda al usuario y muestra la fecha de hoy

El header del dashboard SHALL mostrar un saludo `Hola, {name}.` usando el nombre del perfil (key `dashboard.welcome`), con fallback a `dashboard.welcome_anon` ("Hola.") cuando el perfil no tiene nombre. El header SHALL mostrar la fecha del día calculada desde la zona horaria financiera del usuario vía `getTodayAR()`; NO SHALL usar `new Date()` directo del navegador/servidor. El `eye toggle` y el botón "Nuevo movimiento" (definidos en sus propios requirements) conviven en este header. En desktop el saludo es el título grande del header; en la app nativa el saludo se pinta dentro del header navy.

En **web**, el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del dashboard. Como el nombre del perfil se resuelve client-side (vía el cliente browser de Supabase), el header SHALL exhibir un **estado de carga** mientras esa query no resuelve: el saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") aunque exista un perfil con nombre, y los controles del header (`eye toggle` y "Nuevo movimiento") SHALL renderizarse en estado disabled (ver sus respectivos requirements). Cuando la query del perfil resuelve, el header SHALL actualizarse al saludo personalizado y habilitar sus controles. Si la query falla, el header SHALL permanecer indefinidamente en el saludo anon pero los controles SHALL pasar a estado habilitado para no bloquear al usuario.

La fecha del header NO SHALL depender de esa query: SHALL calcularse en el server o en el primer render con `getTodayAR()` y mantenerse estable entre el estado disabled y el habilitado.

#### Scenario: Saludo con nombre del perfil

- **WHEN** el usuario con nombre "Cristian" carga `/dashboard`
- **THEN** el header termina mostrando "Hola, Cristian."
- **AND** muestra la fecha de hoy en la zona horaria financiera (AR)

#### Scenario: Saludo sin nombre usa fallback

- **WHEN** el usuario no tiene nombre cargado en el perfil
- **THEN** el header muestra "Hola."

#### Scenario: La fecha de hoy se calcula desde la zona financiera

- **WHEN** se renderiza la fecha del header del dashboard
- **THEN** el valor se deriva de `getTodayAR()` y NO de `new Date()` directo

#### Scenario: El header se ve antes de que resuelva la query del perfil (web)

- **WHEN** un usuario web navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** sus controles (`eye toggle`, "Nuevo movimiento") están visibles pero disabled

#### Scenario: Resolver la query actualiza el saludo y habilita los controles (web)

- **WHEN** la query del perfil resuelve con `full_name = "Cristian Perez"` después de mostrar el estado disabled inicial
- **THEN** el saludo del header pasa a "Hola, Cristian."
- **AND** los controles del header se habilitan

#### Scenario: Fallo de la query no deja el header bloqueado (web)

- **WHEN** la query del perfil falla
- **THEN** el saludo se mantiene en "Hola." (fallback anon)
- **AND** los controles del header se habilitan igual para no bloquear al usuario

---

### Requirement: El header del dashboard ofrece un acceso primario para registrar un movimiento (web)

En web, el header del dashboard SHALL incluir un botón primario "Nuevo movimiento" (estilo `positive`/emerald) que navega a la creación de movimiento (`/transactions/new`). El label del botón SHALL leerse del catálogo i18n (no hardcodeado). En la app nativa este acceso NO es parte del header del dashboard; cargar un movimiento se resuelve por el flujo existente (fuera de alcance de este change).

Mientras el header esté en su estado de carga (ver requirement del saludo), el botón "Nuevo movimiento" SHALL renderizarse en estado **disabled**: SHALL aparecer con su tipografía e ícono completos pero sin envolver un `<Link>` (ni equivalente navegable), y SHALL no responder a clicks. Cuando el header sale del estado de carga, el botón SHALL pasar a su rendering normal (`<Button asChild><Link href="/transactions/new">…</Link></Button>` o equivalente).

#### Scenario: El botón navega a la creación de movimiento

- **WHEN** un usuario web toca "Nuevo movimiento" en el header del dashboard una vez habilitado
- **THEN** navega a `/transactions/new`

#### Scenario: El label del botón es traducible

- **WHEN** un desarrollador inspecciona el botón "Nuevo movimiento"
- **THEN** su label se obtiene del catálogo i18n, sin string hardcodeado

#### Scenario: El botón se renderiza disabled mientras el header carga (web)

- **WHEN** el header del dashboard está en su estado de carga (query del nombre sin resolver)
- **THEN** "Nuevo movimiento" se muestra con su label e ícono pero deshabilitado
- **AND** no responde a clicks
- **AND** NO envuelve a un `<Link>` (no es navegable mientras está disabled)

---

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard.

El toggle SHALL aplicar al menos a: Hero (importes ARS y USD, y los saldos del desglose de cuentas en desktop), Lo que viene (importes individuales y totales) y Balance del mes (importes de ingresos, gastos y balance).

En **web**, el `eye toggle` SHALL permanecer montado y visible mientras el header esté en su estado de carga (query del nombre sin resolver), pero SHALL renderizarse **disabled** durante ese estado: no SHALL responder a clicks ni modificar el estado del `EyeMaskProvider`. Cuando el header sale del estado de carga, el toggle SHALL pasar a su comportamiento normal. El `eye toggle` SHALL implementarse en web usando el UI `Button` con `variant="ghost"` y `size="icon"` (no como `<button>` artesanal) para reusar foco accesible, cursor y estilos de disabled.

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas y categorías permanecen visibles

#### Scenario: Salir del dashboard y volver resetea el toggle

- **WHEN** el usuario activa el toggle, navega a `/accounts` y luego vuelve a `/dashboard`
- **THEN** los importes están visibles nuevamente (estado no persistido)

#### Scenario: El toggle está montado pero disabled mientras el header carga (web)

- **WHEN** el header del dashboard está en su estado de carga
- **THEN** el `eye toggle` aparece en su posición habitual con el ícono visible
- **AND** está deshabilitado: clickearlo NO cambia el estado del `EyeMaskProvider`

#### Scenario: El eye toggle web está implementado sobre el UI Button

- **WHEN** un desarrollador inspecciona el componente `EyeMaskToggle` en `apps/web`
- **THEN** delega el render en el UI `Button` con `variant="ghost"` y `size="icon"`
- **AND** NO es un `<button>` artesanal con clases tailwind ad-hoc
