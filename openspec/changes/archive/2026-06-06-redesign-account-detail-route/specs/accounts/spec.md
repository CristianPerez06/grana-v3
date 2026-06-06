## MODIFIED Requirements

### Requirement: El usuario puede ver el detalle de una cuenta

El sistema SHALL mostrar la pantalla de detalle de una cuenta como una composición de **cuatro tarjetas pares** verticales sobre la `--page` surface, en este orden lógico:

1. **Hero card de identidad** (navy gradient surface): avatar, nombre, institución (si `bank`), tipo, balances ARS/USD primario/secundario, badge `Archivada` (si `is_active=false`), y el botón `Editar` (pencil icon) como única acción del slot derecho.
2. **Tarjeta de reembolsos pendientes** (solo si la cuenta tiene reembolsos pendientes asociados): renderiza el `PendingReimbursementsBlock` con su badge de conteo y la lista de items con sus formularios in-line de confirmar/cancelar.
3. **Link píldora `+ Agregar moneda`** (solo si la cuenta no tiene todas las monedas activas — ARS y USD): superficie ligera, no es una card; abre el flujo de edición de monedas.
4. **Tarjeta de movimientos** (siempre): superficie blanca con border-radius alineado al card de hero, contiene en su interior el encabezado `Movimientos` + CTA `+ Agregar transacción`, la barra de filtros (`MovementFilters` con `showAccountFilter={false}`), los chips de filtros activos y la lista (`MovementList` con running balance per-row cuando no hay filtros de contenido).

**Las mutaciones de baja (archivar / eliminar / reactivar) NO viven en el detalle**: su superficie canónica es el menú kebab del card en `/accounts` (ver requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo"). El hero card SHALL renderizar únicamente el botón `Editar` en su slot de acciones.

La pantalla de detalle en `apps/web` SHALL adoptar el patrón de **in-page chrome con shell cliente + TanStack Query** definido en el spec `route-loading-and-errors`: el `page.tsx` server-side se reserva exclusivamente para los guards terminales (auth, `notFound()` si la cuenta no existe o no pertenece al usuario, `redirect('/cards/[id]')` si la cuenta es `type='credit'`); el resto se monta como un shell cliente cuyas secciones (hero card, tarjeta de reembolsos pendientes, tarjeta de movimientos) fetchean independientemente y entregan loading/error in-place. El back-link a `/accounts` SHALL ser visible desde el primer paint; las cards SHALL exhibir cada una su propio skeleton-card mientras cargan. Los detalles del header pattern y del state de filtros están normados en los requirements correspondientes del spec `transactions`.

#### Scenario: Detalle de cuenta cash

- **WHEN** el usuario abre el detalle de una cuenta cash
- **THEN** el hero card muestra el nombre, tipo "Efectivo", sin institución, balances ARS/USD
- **AND** la tarjeta de movimientos muestra el header `Movimientos` + CTA + filtros + lista

#### Scenario: Detalle de cuenta bank muestra institución en el hero card

- **WHEN** el usuario abre el detalle de una cuenta bank
- **THEN** el hero card muestra adicionalmente el nombre de la institución asociada como subtítulo del nombre de cuenta

#### Scenario: La lista de movimientos incluye transferencias entrantes

- **WHEN** la cuenta es destino de una transferencia desde otra cuenta
- **THEN** esa transferencia aparece en la lista dentro de la tarjeta de movimientos con signo `+` y etiqueta de cuenta origen (ver spec `transactions`)

#### Scenario: Cuenta de otro usuario no es accesible

- **WHEN** el usuario intenta acceder al detalle de una cuenta que no le pertenece
- **THEN** el guard server-side del `page.tsx` retorna `notFound()` (RLS filtra la fila; la página renderiza 404)
- **AND** el shell client nunca se monta

#### Scenario: Cuenta credit redirige a /cards/[id] server-side

- **WHEN** el usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el guard server-side ejecuta `redirect('/cards/[id]')`
- **AND** el shell client de account detail nunca se monta

#### Scenario: El back-link se renderiza desde el primer paint

- **WHEN** un usuario web navega a `/accounts/[id]` y las queries del shell aún no resolvieron
- **THEN** el back-link a `/accounts` ya está visible
- **AND** el hero card muestra su skeleton-card hasta que la query de account detail resuelva
- **AND** la tarjeta de movimientos muestra su skeleton-card hasta que las queries de movimientos resuelvan
- **AND** el botón "Editar" del hero card está disabled o cae a su link de fallback hasta que `account` e `institutions` estén disponibles

#### Scenario: El hero card solo expone Editar

- **WHEN** se renderiza el hero card del detalle de una cuenta (cash o bank)
- **THEN** el único botón en el slot derecho de acciones es `Editar`
- **AND** no se renderizan botones de `Archivar` ni `Eliminar` ni `Reactivar`
- **AND** el hero card no invoca `window.confirm()` para ninguna acción

#### Scenario: La tarjeta de reembolsos pendientes es condicional

- **WHEN** la cuenta no tiene reembolsos pendientes asociados
- **THEN** la tarjeta de reembolsos NO se renderiza
- **AND** el orden visual es: hero card → (opcional) link `+ Agregar moneda` → tarjeta de movimientos

#### Scenario: El link `+ Agregar moneda` es condicional

- **WHEN** la cuenta ya tiene ARS y USD activas
- **THEN** el link `+ Agregar moneda` NO se renderiza
- **AND** el flujo de gestión de monedas sigue disponible desde el drawer de edición

#### Scenario: Las secciones del cuerpo cargan independientemente

- **WHEN** las queries de movimientos, filtros y reembolsos del shell se ejecutan en paralelo
- **THEN** cada tarjeta muestra su propio loading state in-place mientras su query no resuelve
- **AND** una tarjeta que resuelve antes se renderiza con datos sin esperar a las demás
- **AND** una tarjeta que falla muestra error + retry localizados sin tirar el back-link ni las otras tarjetas

#### Scenario: El badge "Archivada" se renderiza sobre la superficie navy del hero card

- **WHEN** se renderiza el hero card de una cuenta con `is_active=false`
- **THEN** el badge `Archivada` aparece junto al nombre de la cuenta
- **AND** la paleta del chip está adaptada a la superficie navy del hero card (no `bg-yellow-100` sobre claro)
- **AND** la copy `accounts.badges.archived` no cambia
