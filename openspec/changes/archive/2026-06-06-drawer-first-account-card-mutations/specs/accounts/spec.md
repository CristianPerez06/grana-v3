## MODIFIED Requirements

### Requirement: El usuario puede ver la lista de sus cuentas agrupadas por tipo

El sistema SHALL mostrar las cuentas del usuario agrupadas por `type` — un grupo para `cash` y otro para `bank`. Las cuentas `type='credit'` (tarjetas) NO se listan en esta pantalla: viven en su propia capability `cards`. Por defecto la lista excluye las cuentas con `is_active=false`. El orden dentro de cada grupo es por `created_at` ascendente. Cada cuenta SHALL renderizarse con su avatar visual (ver requirement "Cada cuenta tiene un avatar visual").

La pantalla SHALL adoptar el lenguaje visual del shell de `(app)`:
- Header con `PageHeader` (título + acción "+ Nueva cuenta" como `actions`).
- Cada sección renderiza un label en caps con count (por ejemplo "EFECTIVO · 2") y un contenedor de filas con `bg-card` explícito sobre `bg-background`, hairline `border-border-soft` y radio `rounded-2xl`. Las filas dentro del card SHALL separarse con `divide-y divide-border-soft`.
- Cada fila SHALL renderizar, en este orden y en columnas alineadas: avatar (`AccountAvatar`), bloque nombre + institución, balances ARS/USD a la derecha (ARS en `text-text` semibold, USD en `text-text-soft`), y **un único trigger de menú kebab** (`MoreVertical`) al final de la fila que expone las mutaciones aplicables a esa cuenta.

Las cuentas archivadas se siguen omitiendo del listado por default, pero cuando se renderizan (por ejemplo en la misma pantalla bajo una sección dedicada) SHALL diferenciarse por: borde del card `border-dashed`, un pill `Archivada` en cada fila (`bg-warning-soft text-warning`) y el mismo trigger de menú kebab al final, con un conjunto distinto de items. El estado archivado SHALL NOT depender de `opacity` global sobre la fila o la sección.

**Trigger de menú por fila.** Cada `AccountRow` SHALL renderizar un único botón con ícono `MoreVertical` en su slot derecho. Al click, SHALL abrir un `DropdownMenu` (ver capability `overlay-primitives`) anclado al botón con los siguientes items según `(is_active, has_transactions)`:

| `is_active` | `has_transactions` | Items del menú (en orden) |
|---|---|---|
| `true` | `true` | `Editar`, `Archivar` (destructive) |
| `true` | `false` | `Editar`, `Archivar`, `Eliminar` (destructive) |
| `false` | `true` | `Reactivar` |
| `false` | `false` | `Reactivar`, `Eliminar` (destructive) |

`Editar` SHALL invocar el `AccountsEditDrawerProvider` ya provisto sobre la lista (el comportamiento del drawer es idéntico al actual). `Reactivar` SHALL ejecutar `reactivateAccount(id)` directo, sin confirmación. `Archivar` y `Eliminar` SHALL abrir un confirm dialog (ver capability `overlay-primitives`, requirement de `Dialog`) que muestra el nombre de la cuenta, copy localizado por acción, los errores tipados del action en caso de `!ok`, y un CTA con `variant="destructive"`. El menú SHALL cerrarse antes de abrir el dialog.

**Datos requeridos.** `getCashAndBankAccounts` SHALL devolver `has_transactions: boolean` por cuenta, calculado como `EXISTS` de al menos una transacción del usuario con `account_id = <cuenta>.id` o `transfer_destination_account_id = <cuenta>.id`, excluyendo `is_parent = true`. El cálculo SHALL ocurrir server-side en una sola query (sin round-trips por fila). El tipo `AccountWithBalances` SHALL incluir el flag.

**Mobile-web.** El trigger del kebab SHALL tener al menos 44×44 px de target tap. En viewports `< sm`, el dialog de confirmación SHALL presentarse como sheet desde abajo (a definir en el primitivo `Dialog`); en `≥ sm` SHALL presentarse centrado.

#### Scenario: Cuentas agrupadas por tipo

- **WHEN** el usuario tiene 2 cuentas cash y 3 cuentas bank activas
- **THEN** la pantalla muestra dos secciones: "Efectivo" con 2 y "Bancarias" con 3

#### Scenario: Las tarjetas no aparecen en la lista de cuentas

- **WHEN** el usuario tiene tarjetas de crédito (`type='credit'`) activas
- **THEN** no aparecen en la pantalla de cuentas (su listado vive en la capability `cards`)

#### Scenario: Las archivadas no aparecen por default

- **WHEN** el usuario tiene cuentas con `is_active=false`
- **THEN** no aparecen en las secciones activas del listado (pero siguen accesibles vía consulta con `includeArchived=true`)

#### Scenario: Estado vacío de un grupo

- **WHEN** el usuario no tiene cuentas activas de un tipo
- **THEN** esa sección se omite (por ejemplo, no se muestra "Bancarias" si no hay cuentas bank activas)

#### Scenario: Header de la pantalla usa `PageHeader`

- **WHEN** se renderiza `/accounts`
- **THEN** el header de la página es el componente `PageHeader` con el título de la ruta y la acción "+ Nueva cuenta" como `actions`
- **AND** no se renderiza un header artesanal con `<div>` y CTA propios

#### Scenario: Cada sección es una card blanca explícita sobre el shell

- **WHEN** se renderiza una sección con cuentas
- **THEN** el contenedor de filas usa `bg-card` (resuelto a `#FFFFFF`) con `border-border-soft` y `rounded-2xl`
- **AND** no se ve el `bg-background` del shell a través del card

#### Scenario: La sección Archivadas se diferencia por pill y borde dashed

- **WHEN** se renderiza la sección de archivadas
- **THEN** el contenedor de la sección usa `border-dashed`
- **AND** cada fila incluye un pill "Archivada" con `bg-warning-soft text-warning`
- **AND** el trigger de menú al final de la fila es el mismo kebab `MoreVertical`
- **AND** la sección NO aplica `opacity` global sobre las filas

#### Scenario: Las filas se renderizan con columnas alineadas

- **WHEN** una sección renderiza dos o más filas con nombres de cuenta de largos distintos
- **THEN** el avatar, el bloque de balances y el trigger de menú mantienen el mismo "riel" vertical en todas las filas (slots de ancho fijo, no derivado del contenido)

#### Scenario: Menú de cuenta activa con transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=true` y `has_transactions=true`
- **THEN** el menú muestra exactamente dos items: `Editar` (default) y `Archivar` (destructive)
- **AND** no incluye `Eliminar`

#### Scenario: Menú de cuenta activa sin transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=true` y `has_transactions=false`
- **THEN** el menú muestra tres items en orden: `Editar`, `Archivar`, `Eliminar`
- **AND** `Eliminar` aparece en variante destructive

#### Scenario: Menú de cuenta archivada con transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=false` y `has_transactions=true`
- **THEN** el menú muestra solo el item `Reactivar`
- **AND** no incluye `Eliminar` ni `Editar`

#### Scenario: Menú de cuenta archivada sin transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=false` y `has_transactions=false`
- **THEN** el menú muestra dos items: `Reactivar` y `Eliminar` (destructive)

#### Scenario: Editar abre el drawer existente

- **WHEN** el usuario clickea `Editar` en el menú
- **THEN** el menú se cierra
- **AND** se abre el drawer de edición del `AccountsEditDrawerProvider` con la cuenta de la fila ya prefilleada
- **AND** no hay navegación a `/accounts/[id]/edit`

#### Scenario: Reactivar ejecuta sin confirmación

- **WHEN** el usuario clickea `Reactivar` en el menú
- **THEN** el sistema invoca `reactivateAccount(id)` directamente
- **AND** no abre ningún dialog
- **AND** al resolver `ok=true` invalida las queries de accounts y la fila migra a la sección activa

#### Scenario: Archivar abre el confirm dialog

- **WHEN** el usuario clickea `Archivar` en el menú de una fila activa
- **THEN** el menú se cierra
- **AND** se abre un `Dialog` con el nombre de la cuenta en el título y copy de cuerpo `confirmations.archive_body`
- **AND** el CTA primario "Archivar" tiene `variant="destructive"`
- **AND** existe un CTA secundario "Cancelar" que cierra el dialog

#### Scenario: Confirmar archivar invoca la action

- **WHEN** desde el dialog el usuario confirma archivar
- **THEN** el CTA pasa a `loading` y `archiveAccount(id)` se invoca
- **AND** al resolver `ok=true` el dialog se cierra y la fila migra a la sección archivada (vía invalidación)
- **AND** al resolver `ok=false` el dialog permanece abierto con el `formError` renderizado debajo del cuerpo

#### Scenario: Eliminar abre el confirm dialog con copy específico

- **WHEN** el usuario clickea `Eliminar` en el menú
- **THEN** se abre un `Dialog` con copy `confirmations.delete_body_no_transactions`
- **AND** el CTA primario "Eliminar" tiene `variant="destructive"`
- **AND** al confirmar se invoca `deleteAccount(id)`; si resuelve `ok=true` el dialog se cierra y la fila desaparece de la lista
- **AND** si la action devolviera `ok=false` con `formError`, el dialog lo renderiza inline sin cerrarse

#### Scenario: El menú se cierra al scrollear la lista

- **WHEN** el usuario abre el kebab de una fila y luego scrollea la lista de cuentas
- **THEN** el menú se cierra (heredando el comportamiento del primitivo `Popover` sobre el que se monta)

#### Scenario: El trigger del kebab es accesible por teclado

- **WHEN** el usuario navega con `Tab` sobre la lista
- **THEN** el foco llega al botón kebab de cada fila
- **AND** `Enter` o `Space` abren el menú; `Esc` lo cierra

#### Scenario: `getCashAndBankAccounts` devuelve `has_transactions` por cuenta

- **WHEN** un Server Component o action invoca `getCashAndBankAccounts()` o `getCashAndBankAccounts({ archivedOnly: true })`
- **THEN** cada cuenta del resultado incluye `has_transactions: boolean`
- **AND** el flag es `true` si existe al menos una fila en `transactions` del usuario con `account_id = <cuenta>.id` o `transfer_destination_account_id = <cuenta>.id` y `is_parent = false`
- **AND** el flag es `false` en cualquier otro caso

---

### Requirement: El usuario puede ver el detalle de una cuenta

El sistema SHALL mostrar la pantalla de detalle de una cuenta con: nombre, tipo, institución (si bank), monedas activas con sus saldos derivados, y la lista de movimientos (ver `transactions`). El detalle incluye accesos directos para editar la cuenta (drawer co-localizado) y agregar un nuevo movimiento. **Las mutaciones de baja (archivar / eliminar / reactivar) NO viven en el detalle**: su superficie canónica es el menú kebab del card en `/accounts` (ver requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo"). El detalle SHALL renderizar únicamente el botón `Editar` en su slot de acciones del header.

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

#### Scenario: El header del detalle solo expone Editar

- **WHEN** se renderiza el header del detalle de una cuenta (cash o bank)
- **THEN** el único botón en el slot derecho de acciones es `Editar`
- **AND** no se renderizan botones de `Archivar` ni `Eliminar` ni `Reactivar`
- **AND** el header no invoca `window.confirm()` para ninguna acción

#### Scenario: Las secciones del cuerpo cargan independientemente

- **WHEN** las queries de movimientos, filtros y reembolsos del shell se ejecutan en paralelo
- **THEN** cada sección muestra su propio loading state in-place mientras su query no resuelve
- **AND** una sección que resuelve antes se renderiza con datos sin esperar a las demás
- **AND** una sección que falla muestra error + retry localizados sin tirar el header ni las otras secciones

---

### Requirement: El usuario puede eliminar permanentemente una cuenta sin historial

El sistema SHALL permitir eliminar una cuenta **solo si nunca tuvo transacciones registradas**. Eliminar es la opción correcta para limpiar cuentas creadas por error (errata de tipeo, alta duplicada, prueba); no es la herramienta para "dar de baja" una cuenta con historial — para ese caso existe archivar. Una cuenta con transacciones (propias o entrantes como destino de transferencia) no puede eliminarse: el usuario debe archivarla.

La eliminación es permanente y cascadea a `account_currencies` (FK `ON DELETE CASCADE`). La DB además bloquea el delete si la cuenta es destino de alguna transferencia activa (`transfer_destination_account_id` tiene `ON DELETE RESTRICT`).

**Affordance en la UI.** La opción "Eliminar" SHALL exponerse en el menú kebab del card en la lista `/accounts` cuando `has_transactions=false`, y SHALL ocultarse del menú cuando `has_transactions=true` (caso en el que el item visible es "Archivar" en su lugar). La pantalla de detalle NO SHALL exponer la acción "Eliminar" en su header (ver requirement "El usuario puede ver el detalle de una cuenta").

#### Scenario: Eliminar cuenta sin movimientos

- **WHEN** el usuario elimina una cuenta que nunca tuvo transacciones
- **THEN** la cuenta y sus monedas se borran permanentemente

#### Scenario: Intentar eliminar cuenta con movimientos es rechazado

- **WHEN** el usuario intenta eliminar una cuenta con al menos una transacción donde `account_id = X` o `transfer_destination_account_id = X`
- **THEN** el sistema rechaza la operación y orienta al usuario a archivar en su lugar

#### Scenario: El menú del card ofrece Eliminar o Archivar según el historial

- **WHEN** una cuenta de la lista tiene `has_transactions=false`
- **THEN** el menú kebab del card incluye el item `Eliminar` (destructive) como opción de baja permanente
- **AND** también incluye `Archivar` como opción no destructiva

#### Scenario: Cuentas con historial ocultan Eliminar del menú

- **WHEN** una cuenta de la lista tiene `has_transactions=true`
- **THEN** el menú kebab NO muestra `Eliminar`
- **AND** la opción de baja visible es `Archivar`
