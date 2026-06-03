## MODIFIED Requirements

### Requirement: El header del dashboard saluda al usuario y muestra la fecha de hoy

El header del dashboard SHALL mostrar un saludo `Hola, {name}.` usando el nombre del perfil (key `dashboard.welcome`), con fallback a `dashboard.welcome_anon` ("Hola.") cuando el perfil no tiene nombre. El header SHALL mostrar la fecha del día calculada desde la zona horaria financiera del usuario vía `getTodayAR()`; NO SHALL usar `new Date()` directo del navegador/servidor. El `eye toggle` siempre vive en este header; el botón "Nuevo movimiento" vive en este header **solo en desktop-web** (viewport `≥sm`) — en mobile-web el acceso primario para registrar es el FAB definido en la spec de `transactions` y NO se renderiza en el header. En desktop el saludo es el título grande del header; en la app nativa el saludo se pinta dentro del header navy.

En **web**, el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del dashboard. Para lograrlo, el header y su provider de estado (`EyeMaskProvider`) SHALL montarse desde `apps/web/app/(app)/dashboard/layout.tsx` (Variant C del spec `route-loading-and-errors`), no desde `page.tsx`. El layout SHALL ser un Server Component async que lee las preferencias server-side necesarias para inicializar el provider (ej. `getEyeMasked()`); el `page.tsx` SHALL ser sync para no suspender el segmento. Como el chrome vive en el layout, queda persistente entre cualquier transición de `{children}` (loading, error, navegación a hijos), garantizando el primer paint inmediato del header.

Como el nombre del perfil se resuelve client-side (vía el cliente browser de Supabase), el header SHALL exhibir un **estado de carga** mientras esa query no resuelve: el saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") aunque exista un perfil con nombre, y los controles que sí vivan en el header en el viewport activo SHALL renderizarse en estado disabled (ver sus respectivos requirements). En desktop-web esto cubre el `eye toggle` y el botón "Nuevo movimiento"; en mobile-web cubre únicamente el `eye toggle`. Cuando la query del perfil resuelve, el header SHALL actualizarse al saludo personalizado y habilitar los controles del header. Si la query falla, el header SHALL permanecer indefinidamente en el saludo anon pero los controles SHALL pasar a estado habilitado para no bloquear al usuario.

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

#### Scenario: El header se ve antes de que resuelva la query del perfil (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** sus controles (`eye toggle`, "Nuevo movimiento") están visibles pero disabled

#### Scenario: El header se ve antes de que resuelva la query del perfil (mobile-web)

- **WHEN** un usuario web en viewport `<sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** el `eye toggle` está visible pero disabled
- **AND** el botón "Nuevo movimiento" NO se renderiza en el header (su lugar lo ocupa el FAB)

#### Scenario: Resolver la query actualiza el saludo y habilita los controles (web)

- **WHEN** la query del perfil resuelve con `full_name = "Cristian Perez"` después de mostrar el estado disabled inicial
- **THEN** el saludo del header pasa a "Hola, Cristian."
- **AND** los controles que vivan en el header en el viewport activo se habilitan

#### Scenario: Fallo de la query no deja el header bloqueado (web)

- **WHEN** la query del perfil falla
- **THEN** el saludo se mantiene en "Hola." (fallback anon)
- **AND** los controles del header se habilitan igual para no bloquear al usuario

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/transactions` y navega a `/dashboard`
- **THEN** durante la transición del segmento, el header del dashboard aparece desde el primer paint del nuevo segmento (proviene de `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched (de `dashboard/loading.tsx`) mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: El header persiste durante el loading del contenido tras un redirect desde login (web)

- **WHEN** un usuario completa el login y el servidor redirige a `/dashboard`
- **AND** el `(app)/layout.tsx` resolvió su auth check (fuera del scope de este requirement)
- **THEN** el siguiente paint visible del usuario incluye el header del dashboard (desde `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched mientras las server queries del dashboard resuelven
- **AND** el usuario NO ve un spinner full-screen entre el login y el dashboard
