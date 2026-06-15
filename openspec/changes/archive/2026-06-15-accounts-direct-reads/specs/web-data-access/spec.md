# Delta: web-data-access

## MODIFIED Requirements

### Requirement: Los reads de las rutas web van directo del browser a Supabase

Las rutas client de `apps/web` SHALL obtener sus datos de lectura consultando Supabase (PostgREST) directamente desde el browser vía TanStack Query, usando el browser client (`lib/supabase/client.ts`, sesión compartida por cookies con el server). Las server actions NO SHALL usarse como `queryFn` de queries de lectura — quedan reservadas para mutaciones (donde la serialización de React es aceptable) y conservan `revalidatePath` + invalidación TanStack.

Las query functions de lectura SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro (`(supabase, …)`) en lugar de crearlo internamente, de modo que web (browser client), mobile (client nativo) y cualquier otro consumer puedan reutilizarlas sin cambios.

Los query keys y los `staleTime` por familia centralizados en `lib/query-client.ts` SHALL conservarse al migrar una query de transporte: cambiar el mecanismo de fetch NO SHALL cambiar la identidad de cache ni su política de frescura.

Esta capability define el patrón canónico; las rutas existentes migran ruta por ruta en changes dedicados. Rutas migradas a la fecha: `/transactions`, `/accounts/[id]`.

#### Scenario: El mount de /transactions fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/transactions`
- **THEN** las queries de las secciones (listado, breakdown, filter options, pending blocks, sugerencia) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: El mount de /accounts/[id] fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/accounts/[id]`
- **THEN** las queries de las secciones (account detail, historial ascendente de movimientos, filter options, pending reimbursements, linked recurrence ids, institutions) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: Una query function migrada es reutilizable desde mobile

- **WHEN** una query function de lectura migra al patrón de esta capability
- **THEN** su firma recibe el client Supabase como primer parámetro y no importa `@/lib/supabase/server`
- **AND** puede invocarse sin modificación con el client de `apps/mobile`

#### Scenario: Las mutaciones siguen siendo server actions

- **WHEN** el usuario registra, edita o elimina un movimiento desde una ruta migrada
- **THEN** la operación ejecuta una server action (no una llamada directa del browser)
- **AND** la action conserva su `revalidatePath` y la invalidación de queries TanStack existente
