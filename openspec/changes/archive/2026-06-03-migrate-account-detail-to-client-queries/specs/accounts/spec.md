## MODIFIED Requirements

### Requirement: El usuario puede ver el detalle de una cuenta

El sistema SHALL mostrar la pantalla de detalle de una cuenta con: nombre, tipo, institución (si bank), monedas activas con sus saldos derivados, y la lista de movimientos (ver `transactions`). El detalle incluye accesos directos para editar la cuenta (drawer co-localizado), archivar/reactivar/eliminar, agregar una moneda (cuando aplique) y agregar un nuevo movimiento.

La pantalla de detalle en `apps/web` SHALL adoptar el patrón de **in-page chrome con shell cliente + TanStack Query** definido en el spec `route-loading-and-errors`: el `page.tsx` server-side se reserva exclusivamente para los guards terminales (auth, `notFound()` si la cuenta no existe o no pertenece al usuario, `redirect('/cards/[id]')` si la cuenta es `type='credit'`); el resto se monta como un shell cliente cuyas secciones (header con balances, reembolsos pendientes, filtros, lista de movimientos) fetchean independientemente y entregan loading/error in-place. El header SHALL ser visible desde el primer paint. Los detalles del header pattern y del state de filtros están normados en los requirements correspondientes del spec `transactions`.

#### Scenario: Detalle de cuenta cash

- **WHEN** el usuario abre el detalle de una cuenta cash
- **THEN** la pantalla muestra el nombre, tipo "Efectivo", sin institución, sus monedas con saldos derivados, y la lista de transacciones

#### Scenario: Detalle de cuenta bank muestra institución

- **WHEN** el usuario abre el detalle de una cuenta bank
- **THEN** la pantalla muestra adicionalmente el nombre y branding de la institución asociada

#### Scenario: La lista de movimientos incluye transferencias entrantes

- **WHEN** la cuenta es destino de una transferencia desde otra cuenta
- **THEN** esa transferencia aparece en su lista de movimientos con signo `+` y etiqueta de cuenta origen (ver spec `transactions`)

#### Scenario: Cuenta de otro usuario no es accesible

- **WHEN** el usuario intenta acceder al detalle de una cuenta que no le pertenece
- **THEN** el guard server-side del `page.tsx` retorna `notFound()` (RLS filtra la fila; la página renderiza 404)
- **AND** el shell client nunca se monta

#### Scenario: Cuenta credit redirige a /cards/[id] server-side

- **WHEN** el usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el guard server-side ejecuta `redirect('/cards/[id]')`
- **AND** el shell client de account detail nunca se monta

#### Scenario: El header del detalle se renderiza desde el primer paint

- **WHEN** un usuario web navega a `/accounts/[id]` y las queries del shell aún no resolvieron
- **THEN** el back link a `/accounts`, el avatar y el nombre de la cuenta ya están visibles
- **AND** los balances ARS/USD muestran un skeleton hasta que la query de account detail resuelva
- **AND** el botón "Editar" está disabled o cae a su link de fallback hasta que `account` e `institutions` estén disponibles

#### Scenario: Las secciones del cuerpo cargan independientemente

- **WHEN** las queries de movimientos, filtros y reembolsos del shell se ejecutan en paralelo
- **THEN** cada sección muestra su propio loading state in-place mientras su query no resuelve
- **AND** una sección que resuelve antes se renderiza con datos sin esperar a las demás
- **AND** una sección que falla muestra error + retry localizados sin tirar el header ni las otras secciones
