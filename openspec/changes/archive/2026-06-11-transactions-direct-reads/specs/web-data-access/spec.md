# web-data-access Spec Delta

## ADDED Requirements

### Requirement: Los reads de las rutas web van directo del browser a Supabase

Las rutas client de `apps/web` SHALL obtener sus datos de lectura consultando Supabase (PostgREST) directamente desde el browser vía TanStack Query, usando el browser client (`lib/supabase/client.ts`, sesión compartida por cookies con el server). Las server actions NO SHALL usarse como `queryFn` de queries de lectura — quedan reservadas para mutaciones (donde la serialización de React es aceptable) y conservan `revalidatePath` + invalidación TanStack.

Las query functions de lectura SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro (`(supabase, …)`) en lugar de crearlo internamente, de modo que web (browser client), mobile (client nativo) y cualquier otro consumer puedan reutilizarlas sin cambios.

Los query keys y los `staleTime` por familia centralizados en `lib/query-client.ts` SHALL conservarse al migrar una query de transporte: cambiar el mecanismo de fetch NO SHALL cambiar la identidad de cache ni su política de frescura.

Esta capability define el patrón canónico; las rutas existentes migran ruta por ruta en changes dedicados (en este change: `/transactions`).

#### Scenario: El mount de /transactions fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/transactions`
- **THEN** las queries de las secciones (listado, breakdown, filter options, pending blocks, sugerencia) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: Una query function migrada es reutilizable desde mobile

- **WHEN** una query function de lectura migra al patrón de esta capability
- **THEN** su firma recibe el client Supabase como primer parámetro y no importa `@/lib/supabase/server`
- **AND** puede invocarse sin modificación con el client de `apps/mobile`

#### Scenario: Las mutaciones siguen siendo server actions

- **WHEN** el usuario registra, edita o elimina un movimiento desde una ruta migrada
- **THEN** la operación ejecuta una server action (no una llamada directa del browser)
- **AND** la action conserva su `revalidatePath` y la invalidación de queries TanStack existente

### Requirement: Los reads compuestos calientes se implementan como funciones RPC de Postgres

Cuando un read requiere lógica que PostgREST no expresa en un solo roundtrip (self-joins, filtros compuestos, paginación con lookahead), el sistema SHALL implementarlo como función SQL en una migración, invocada vía `supabase.rpc(...)`. Las funciones SHALL ser `SECURITY INVOKER` para que RLS aplique con los permisos del usuario que llama.

La página global de movimientos SHALL implementarse bajo este contrato: una función que aplica **todos** los filtros en SQL (rango de fechas/mes, categoría, subcategoría incluyendo el marker "sin subcategoría", moneda, cuenta — incluyendo parents con hijos en la cuenta y card payments vía `period_payments` —, tipo funcional, texto y rango de montos), excluye reimbursements no recibidos o cancelados, resuelve el linked expense de cada reimbursement en el mismo query, y devuelve `limit + 1` filas para derivar `hasMore` sin queries adicionales.

#### Scenario: La página de movimientos filtrada resuelve en un roundtrip

- **WHEN** el usuario aplica un filtro de texto, tipo funcional o rango de montos en `/transactions`
- **THEN** el listado resultante se obtiene con una única invocación RPC que aplica todos los filtros en SQL
- **AND** el sistema NO pagina chunks descartando filas en el cliente

#### Scenario: El linked expense del reimbursement viene embebido

- **WHEN** la página de movimientos incluye un reimbursement recibido con `linked_transaction_id`
- **THEN** la respuesta de la RPC incluye los datos del gasto vinculado (descripción, categoría, fecha, monto) sin un segundo query

#### Scenario: hasMore se deriva del lookahead

- **WHEN** la RPC se invoca con `limit = 50` y existen al menos 51 filas que matchean
- **THEN** la respuesta permite derivar `hasMore = true` sin un count adicional
- **AND** el listado muestra exactamente 50 filas

#### Scenario: RLS aplica dentro de la RPC

- **WHEN** un usuario invoca la RPC de movimientos
- **THEN** solo recibe filas que las policies de RLS le permiten leer (propias o de su household)
- **AND** la función no eleva privilegios (`SECURITY INVOKER`)

### Requirement: RLS es la frontera de autorización de los reads web

Toda tabla que una ruta web lee directamente desde el browser SHALL tener Row Level Security habilitado con policies de SELECT que limiten el acceso al owner o a su household según el dominio. Antes de migrar una ruta al patrón de lectura directa, las tablas nuevas de su read path SHALL auditarse: RLS habilitado, policy de SELECT presente y correcta, y sin aperturas mayores a las que el read server-side tenía.

#### Scenario: Migrar una ruta exige auditar sus tablas

- **WHEN** un change migra una ruta al patrón de lectura directa e introduce una tabla no auditada previamente
- **THEN** el change incluye la verificación de RLS + policy de SELECT de esa tabla
- **AND** los hallazgos se corrigen por migración dentro del mismo change

#### Scenario: Un usuario no puede leer datos ajenos por el path directo

- **WHEN** un usuario autenticado consulta desde el browser una tabla del read path con un filtro que matchearía filas de otro usuario fuera de su household
- **THEN** la respuesta no incluye ninguna fila ajena

### Requirement: La sesión se valida localmente en el camino de datos

El proxy de `apps/web` SHALL validar la sesión verificando las claims del JWT localmente (firma asimétrica), sin un roundtrip de red al Auth server por request. El helper de autenticación de las server actions SHALL resolver el `user_id` por el mismo mecanismo. El refresh del token expirado sigue siendo responsabilidad del proxy (único punto que sí contacta al Auth server, solo cuando hace falta).

Trade-off aceptado y documentado: una sesión revocada permanece válida hasta la expiración del access token.

#### Scenario: Una request autenticada no contacta al Auth server

- **WHEN** un usuario con sesión válida y token no expirado navega o dispara una request de datos
- **THEN** la validación de sesión se resuelve localmente (verificación de firma del JWT)
- **AND** no se emite ningún request a `auth/v1/user` en ese camino

#### Scenario: Una sesión ausente o inválida sigue redirigiendo a login

- **WHEN** un usuario sin sesión válida intenta acceder a una ruta autenticada
- **THEN** el proxy lo redirige a login, igual que antes de este cambio

### Requirement: Ningún write bloquea el read path

Las operaciones de escritura lazy que hoy acompañan una carga de página (materialización de instancias recurrentes debidas) SHALL dispararse fuera del camino crítico de las queries de lectura: fire-and-forget al montar la ruta, sin que ninguna query de lectura espere su resultado. Cuando la operación reporta cambios (`created > 0`), el sistema SHALL invalidar las queries afectadas (pending recurrences, listado de movimientos) para que el dato nuevo aparezca sin reload.

#### Scenario: El listado no espera la generación de instancias

- **WHEN** el usuario hace un cold-load de `/transactions` con una recurrencia que tiene una instancia debida sin materializar
- **THEN** la query del listado de movimientos se dispara sin esperar a la generación
- **AND** la generación corre en paralelo como mutación independiente

#### Scenario: La instancia recién generada aparece sin reload

- **WHEN** la generación fire-and-forget materializa al menos una instancia nueva
- **THEN** las queries de pending recurrences (y las afectadas) se invalidan
- **AND** el bloque "A confirmar" muestra la instancia nueva sin que el usuario recargue

### Requirement: Los reads costosos no críticos se difieren con cache de sesión

Los reads que computan resultados estables dentro de una sesión y no pertenecen al camino crítico del mount (la sugerencia de recurrencia, que escanea 6 meses de movimientos) SHALL configurarse con `staleTime` largo (≥ 30 minutos) para no recomputarse en cada navegación.

#### Scenario: La sugerencia no se recomputa al navegar

- **WHEN** el usuario navega fuera de `/transactions` y vuelve dentro de la ventana de frescura
- **THEN** la sugerencia de recurrencia se sirve desde el cache de TanStack sin re-ejecutar la detección
