## ADDED Requirements

### Requirement: El dominio Compartido expone sus lecturas desde un paquete `@grana/shared` agnóstico de plataforma

El monorepo SHALL exponer las lecturas del dominio Compartido (hogar, deuda, proyección, cuenta corriente, liquidaciones pendientes, movimientos compartidos, reparto de un movimiento) desde un paquete `@grana/shared` consumible por `apps/web` y `apps/mobile`. Cada lectura SHALL recibir el cliente de Supabase como parámetro (no crear su propio cliente ni depender de un runtime de plataforma) y SHALL derivar la matemática de deuda/proyección delegando en `@grana/money-logic`, sin recalcular en la capa de lectura.

Las funciones de lectura SHALL cubrir al menos: `getHousehold`, `getHouseholdDebt`, `getHouseholdOutlook`, `getCurrentAccount`, `getPendingSettlements`, `getSharedAccruedMovements`, `getMovementSharedInfo`, `getSharedExpenses`.

#### Scenario: Una lectura recibe el cliente y no lo construye

- **WHEN** un desarrollador invoca cualquier lectura de `@grana/shared`
- **THEN** la función acepta el cliente de Supabase como argumento
- **AND** no importa ni inicializa un cliente propio de web o de mobile

#### Scenario: La deuda se deriva, no se persiste ni recalcula en la lectura

- **WHEN** `getHouseholdDebt` produce la deuda neta por moneda
- **THEN** la derivación usa `@grana/money-logic`
- **AND** el resultado no lee un saldo persistido ni reimplementa la matemática de reparto

### Requirement: El dominio Compartido expone núcleos de mutación agnósticos de plataforma

`@grana/shared` SHALL exponer núcleos de mutación (validación de input + llamada a la RPC atómica correspondiente) para las operaciones de escritura del dominio: crear hogar, generar invitación, unirse con código, actualizar configuración (nombre / split por defecto), salir del hogar, registrar liquidación, asignar cuenta receptora y revertir/cancelar liquidación. Cada núcleo SHALL devolver un resultado tipado de éxito o error de campo/formulario, y NO SHALL contener acoplamiento de plataforma (ni `revalidatePath`, ni invalidación de react-query, ni redirecciones).

La glue de plataforma SHALL vivir en el consumidor: las server actions de web (`'use server'`) envuelven el núcleo y agregan `revalidatePath`; los handlers de mobile envuelven el núcleo e invalidan las queries de react-query.

#### Scenario: El núcleo valida y llama la RPC sin glue de plataforma

- **WHEN** un consumidor invoca un núcleo de mutación (p. ej. registrar liquidación)
- **THEN** el núcleo valida el input y llama la RPC atómica (`register_settlement`, `confirm_settlement`, `reverse_settlement`, `join_household_by_code`, según corresponda)
- **AND** devuelve un resultado tipado sin ejecutar `revalidatePath` ni tocar react-query

#### Scenario: La web mantiene el borde `'use server'` delegando al núcleo

- **WHEN** una server action de `apps/web/app/_actions/shared.ts` procesa una escritura
- **THEN** delega la validación y la RPC al núcleo de `@grana/shared`
- **AND** conserva su `revalidatePath` propio como glue de plataforma

### Requirement: Los tipos compartidos del hogar tienen un único hogar canónico

El tipo `Household` (y `HouseholdMember`) SHALL definirse una sola vez, en `@grana/ui-contracts`, y ser consumido desde ahí por `@grana/shared`, `@grana/movement-form`, `apps/web` y `apps/mobile`. NO SHALL existir una segunda definición del tipo en `apps/web/lib/shared/types.ts` ni en `packages/movement-form/src/types.ts`.

#### Scenario: No hay definiciones duplicadas del tipo Household

- **WHEN** un desarrollador busca la definición de `type Household` en el monorepo
- **THEN** existe exactamente una, en `@grana/ui-contracts`
- **AND** el resto de los paquetes/apps la importan desde ahí

### Requirement: Los consumidores usan el paquete sin duplicar la capa de datos

`apps/web` SHALL consumir las lecturas de `@grana/shared` directamente desde sus server components, sin dejar un shim intermedio: `apps/web/lib/shared/queries.ts` SHALL ser eliminado (consistente con el rollout de direct reads que borró `app/_actions/queries.ts`). En `apps/mobile`, la **implementación duplicada** del stub (`apps/mobile/lib/shared/queries.ts`, con los cuerpos propios de `getHousehold` + `getMovementSharedInfo`) SHALL ser reemplazada por un wrapper delgado que inyecta el cliente nativo en las lecturas de `@grana/shared` y conserva las firmas de la app (mismo patrón que `lib/cards/queries.ts` y `lib/transactions/queries.ts`); NO SHALL quedar ninguna reimplementación de esas lecturas en `apps/mobile`.

`@grana/shared` SHALL permanecer libre de UI (solo tipos + lógica) para no introducir una segunda versión de React en el monorepo (RN 0.81 fija React a 19.1.0).

#### Scenario: La web ya no tiene la capa de lectura local

- **WHEN** un desarrollador busca `apps/web/lib/shared/queries.ts`
- **THEN** el archivo no existe
- **AND** los server components importan las lecturas desde `@grana/shared`

#### Scenario: Mobile ya no duplica las lecturas del hogar

- **WHEN** un desarrollador inspecciona `apps/mobile/lib/shared/queries.ts`
- **THEN** no contiene cuerpos propios de `getHousehold`/`getMovementSharedInfo`, solo wrappers que inyectan el cliente en las lecturas de `@grana/shared`
- **AND** el movement form y el módulo Hogar obtienen esas lecturas de `@grana/shared` (vía el wrapper delgado)

#### Scenario: El paquete no arrastra React

- **WHEN** un desarrollador inspecciona las dependencias de `@grana/shared`
- **THEN** no depende de `react` ni de componentes de UI
- **AND** ambas apps pueden importarlo sin duplicar la versión de React
