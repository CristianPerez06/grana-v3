## MODIFIED Requirements

### Requirement: Los reads de las rutas web van directo del browser a Supabase

Las rutas client de `apps/web` SHALL obtener sus datos de lectura consultando Supabase (PostgREST) directamente desde el browser vía TanStack Query, usando el browser client (`lib/supabase/client.ts`, sesión compartida por cookies con el server). Las server actions NO SHALL usarse como `queryFn` de queries de lectura — quedan reservadas para mutaciones (donde la serialización de React es aceptable) y conservan `revalidatePath` + invalidación TanStack.

Las query functions de lectura SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro (`(supabase, …)`) en lugar de crearlo internamente, de modo que web (browser client), mobile (client nativo) y cualquier otro consumer puedan reutilizarlas sin cambios.

Los query keys y los `staleTime` por familia centralizados en `lib/query-client.ts` SHALL conservarse al migrar una query de transporte: cambiar el mecanismo de fetch NO SHALL cambiar la identidad de cache ni su política de frescura.

Esta capability define el patrón canónico; las rutas existentes migran ruta por ruta en changes dedicados. Rutas migradas a la fecha: `/transactions`, `/accounts/[id]`, `/dashboard`, `/transactions/recurring`. Con la migración de `/transactions/recurring` no queda ningún server action de lectura usado como `queryFn` en el repo (`app/_actions/queries.ts` eliminado).

#### Scenario: El mount de /transactions fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/transactions`
- **THEN** las queries de las secciones (listado, breakdown, filter options, pending blocks, sugerencia) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: El mount de /accounts/[id] fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/accounts/[id]`
- **THEN** las queries de las secciones (account detail, historial ascendente de movimientos, filter options, pending reimbursements, linked recurrence ids, institutions) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: La navegación de mes en /dashboard refetchea sin cola de actions

- **WHEN** el usuario cambia el mes seleccionado en `/dashboard` y los islands "Balance del mes" y "En qué se fue" refetchean su mes
- **THEN** ambos refetches se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguno espera en una cola de server actions: el cambio de mes queda gobernado por el refetch más lento, no por la suma de ambos
- **AND** el mes actual sigue sirviéndose del `initialData` server-rendered sin refetch

#### Scenario: El botón de creación de /transactions/recurring fetchea sus catálogos directo

- **WHEN** el usuario abre `/transactions/recurring` y el botón "Crear recurrencia" carga sus catálogos (accounts y categories)
- **THEN** ambas queries se disparan como requests HTTP browser → Supabase invocando `getAccounts`/`getAllCategories` con el browser client, no vía server actions
- **AND** conservan los query keys `accountsList` y `categoriesTree` y su política de frescura previa
- **AND** el botón permanece visible y disabled hasta que ambos catálogos resuelven (chrome-always-visible)

#### Scenario: Una query function migrada es reutilizable desde mobile

- **WHEN** una query function de lectura migra al patrón de esta capability
- **THEN** su firma recibe el client Supabase como primer parámetro y no importa `@/lib/supabase/server`
- **AND** puede invocarse sin modificación con el client de `apps/mobile`

#### Scenario: Las mutaciones siguen siendo server actions

- **WHEN** el usuario registra, edita o elimina un movimiento desde una ruta migrada
- **THEN** la operación ejecuta una server action (no una llamada directa del browser)
- **AND** la action conserva su `revalidatePath` y la invalidación de queries TanStack existente

### Requirement: Ningún write bloquea el read path

Las operaciones de escritura lazy que hoy acompañan una carga de página (materialización de instancias recurrentes debidas) SHALL dispararse fuera del camino crítico de las queries de lectura: fire-and-forget al montar la ruta, sin que ninguna query de lectura espere su resultado. Cuando la operación reporta cambios (`created > 0`), el sistema SHALL invalidar las queries afectadas (pending recurrences, listado de movimientos) — o, en rutas server-rendered, refrescar la ruta (`router.refresh()`) — para que el dato nuevo aparezca sin reload.

#### Scenario: El listado no espera la generación de instancias

- **WHEN** el usuario hace un cold-load de `/transactions` con una recurrencia que tiene una instancia debida sin materializar
- **THEN** la query del listado de movimientos se dispara sin esperar a la generación
- **AND** la generación corre en paralelo como mutación independiente

#### Scenario: La instancia recién generada aparece sin reload

- **WHEN** la generación fire-and-forget materializa al menos una instancia nueva
- **THEN** las queries de pending recurrences (y las afectadas) se invalidan
- **AND** el bloque "A confirmar" muestra la instancia nueva sin que el usuario recargue

#### Scenario: El mount de /transactions/recurring no espera la generación de instancias

- **WHEN** el usuario hace un cold-load de `/transactions/recurring` con una recurrencia que tiene una instancia debida sin materializar
- **THEN** el `Promise.all` de lecturas del server component (recurrences, pending instances, accounts) se resuelve sin esperar a `generateDueRecurrenceInstances`
- **AND** la generación se dispara fire-and-forget al montar (client-side), como mutación independiente

#### Scenario: La instancia generada en /transactions/recurring aparece sin reload

- **WHEN** la generación fire-and-forget de `/transactions/recurring` materializa al menos una instancia nueva (`created > 0`)
- **THEN** la ruta se refresca (`router.refresh()`) y el bloque de pendientes muestra la instancia nueva sin que el usuario recargue
- **AND** cuando no se materializó nada (`created === 0`) no se dispara ningún refresh
