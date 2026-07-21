## ADDED Requirements

### Requirement: El tab Hogar renderiza el módulo Compartido en la app nativa (mobile)

En `apps/mobile`, el tab **Hogar** (`(app)/home.tsx`) SHALL renderizar el módulo Compartido real —no un placeholder ni un `return null`— con los mismos tres estados que la home de web, resueltos por la presencia y composición del hogar del usuario:

1. **Sin hogar:** el formulario de setup inline (crear / unirse con código).
2. **Esperando segundo miembro:** la tarjeta de invitación (generar código, copiar, compartir).
3. **Hogar activo:** el dashboard del hogar (hero de gasto neto con navegador de mes, franja de deuda fija en "hoy", proyección, últimos movimientos), con el alta de movimiento como **FAB** y el acceso a Configuración como ícono.

El comportamiento de dominio de cada estado SHALL cumplir las requirements ya definidas para la home de Compartido; esta requirement fija que el consumidor nativo existe y respeta el chrome mobile: `PageHeader` con chrome visible desde el primer paint (título/acciones presentes, deshabilitados hasta cargar; nunca ocultos tras un skeleton) y `SafeAreaView` con `edges={['top']}`.

#### Scenario: Sin hogar, el tab Hogar muestra el setup

- **WHEN** un usuario sin hogar abre el tab Hogar
- **THEN** ve el formulario de setup (crear / unirse con código)
- **AND** no ve un placeholder ni una pantalla vacía

#### Scenario: Esperando miembro, el tab Hogar muestra la invitación

- **WHEN** un usuario con hogar de un solo miembro abre el tab Hogar
- **THEN** ve la tarjeta de invitación con generar/copiar/compartir código

#### Scenario: Hogar activo, el tab Hogar muestra el dashboard con FAB

- **WHEN** un usuario con hogar de dos miembros abre el tab Hogar
- **THEN** ve el hero de gasto neto con navegador de mes, la franja de deuda a hoy, la proyección y los últimos movimientos del mes
- **AND** el alta de movimiento se ofrece como FAB
- **AND** el header muestra el acceso a Configuración

### Requirement: Las subpantallas de Compartido se pushean chromeless desde el tab Hogar (mobile)

En `apps/mobile`, las pantallas de setup, saldar (`settle`), configuración (`settings`) y cuenta corriente SHALL presentarse como rutas **pusheadas** desde el tab Hogar, en modo **chromeless** (el tab bar se oculta), consistente con el patrón ya usado por `/transactions/new` y `/cards/[id]`. Los segmentos de ruta nuevos SHALL registrarse en la detección de chromeless del `TabBar`. Cada subpantalla SHALL usar `PageHeader` con back-link visible desde el primer paint.

#### Scenario: Una subpantalla oculta el tab bar

- **WHEN** un usuario navega desde el tab Hogar a saldar, configuración o cuenta corriente
- **THEN** la pantalla se presenta full-screen con el tab bar oculto
- **AND** el `PageHeader` muestra el back-link desde el primer paint

### Requirement: El flujo de saldar deuda existe en la app nativa (mobile)

En `apps/mobile`, la pantalla de saldar deuda SHALL permitir al pagador registrar una liquidación cumpliendo el comportamiento de dominio ya definido (selección de moneda cuando debe en más de una, monto vía `MoneyAmountInput`, chips rápidos de total/mitad, selector de cuenta con saldos, preview de impacto antes/después, aviso no bloqueante de saldo negativo, submit que deja la liquidación en `pending_receipt`). El receptor SHALL poder asignar la cuenta receptora desde la home (tarjeta de liquidación pendiente), disparando la operación atómica de confirmación.

#### Scenario: El pagador registra una liquidación desde mobile

- **WHEN** un usuario con deuda viva completa el flujo de saldar en la app nativa
- **THEN** se crea la liquidación en estado `pending_receipt`
- **AND** el monto quedó acotado a la deuda de esa moneda

#### Scenario: El receptor asigna la cuenta desde la home nativa

- **WHEN** el receptor toca "asignar cuenta" en una liquidación pendiente en el tab Hogar
- **THEN** la liquidación pasa a completada de forma atómica (movimiento del receptor creado)

### Requirement: La configuración del hogar existe en la app nativa (mobile)

En `apps/mobile`, la pantalla de configuración del hogar SHALL exponer, mediante drawers/sheets nativos idiomáticos, la edición del nombre del hogar, la configuración del split por defecto (primer miembro editable 1..99%, el segundo derivado), la invitación cuando hay menos de dos miembros, y el salir del hogar (bloqueado si hay deuda viva, liquidaciones pendientes o recurrencias compartidas activas), cumpliendo el comportamiento de dominio ya definido para esas operaciones.

#### Scenario: Editar el nombre del hogar desde mobile

- **WHEN** un usuario edita el nombre del hogar en el drawer de configuración nativo
- **THEN** el nombre se actualiza y se refleja en la home

#### Scenario: Salir del hogar bloqueado por deuda

- **WHEN** un usuario intenta salir del hogar con deuda viva desde mobile
- **THEN** la operación se bloquea con el mensaje correspondiente

### Requirement: La cuenta corriente existe en la app nativa con sus caminos de escritura (mobile)

En `apps/mobile`, la pantalla de cuenta corriente SHALL mostrar el extracto derivado por moneda (toggle de moneda, ecuación expandible, filtros por tipo/persona, entradas con impacto en el saldo) y SHALL soportar sus caminos de escritura: revertir una liquidación completada (contraasiento vía `reverse_settlement`) y cancelar una pendiente (borrado), cumpliendo el comportamiento de dominio ya definido (incluida la regla de que la reversión es contraasiento, no borrado).

#### Scenario: Ver el extracto por moneda en mobile

- **WHEN** un usuario abre la cuenta corriente en la app nativa
- **THEN** ve las entradas del extracto de la moneda seleccionada con su impacto en el saldo
- **AND** puede alternar la moneda y filtrar por tipo/persona

#### Scenario: Revertir una liquidación completada desde mobile

- **WHEN** un usuario revierte una liquidación completada en la cuenta corriente nativa
- **THEN** se registra un contraasiento (no se borra la liquidación original)
