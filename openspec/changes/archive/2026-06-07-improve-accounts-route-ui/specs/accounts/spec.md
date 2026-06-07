## ADDED Requirements

### Requirement: El estilo visual de `/accounts` (raíz) sigue el handoff `docs/design/accounts/` y respeta sus no-goals

El sistema SHALL renderizar la ruta `/accounts` (raíz, sin segmentos hijos) siguiendo el handoff visual versionado en `docs/design/accounts/`. El handoff es **referencia normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock HTML.

El rediseño SHALL operar **solamente** sobre los componentes y datos que la ruta ya expone hoy. Los componentes habilitados son:

- `AccountsHeader` (en `apps/web/app/(app)/accounts/_components/`, montado desde `accounts/layout.tsx`).
- `CreateAccountButton` (acción primaria del header).
- `ActiveAccountsContainer` y `ArchivedAccountsContainer` (containers server async).
- `AccountsHint` (banner condicional de primer uso, client-only, descartable por `localStorage`).
- `AccountSection` (sección con título caps + count + lista de filas).
- `AccountRow` (fila de cuenta con avatar, identidad, balances ARS/USD, kebab).
- `AccountRowMenu` (menú kebab por fila — ver requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo" para items y matriz).
- `EmptyAccountsState` (estado vacío con CTA secundario).
- `ActiveAccountsSkeleton` y `ArchivedAccountsSkeleton` (skeletons shape-matched para `loading.tsx`).
- `AccountsErrorBoundary`, `RouteError`, `SectionFallback` (chrome de error — ver requirement existente "El header de /accounts se renderiza desde el primer paint…").

Los datos habilitados son **exactamente** los que ya devuelven `getCashAndBankAccounts()` y `getInstitutions()`: nombre, tipo, institución opcional, monedas activas, balances ARS y USD por cuenta, `is_active`, `has_transactions`, avatar resuelto, y el catálogo de instituciones para el drawer. El rediseño NO SHALL agregar campos a `AccountWithBalances` ni queries nuevas.

**Reglas de jerarquía visual en `AccountRow`.** Cada fila SHALL renderizar, en este orden de izquierda a derecha:

1. Avatar (`AccountAvatar`) resuelto según el requirement existente "Cada cuenta tiene un avatar visual".
2. Bloque de identidad apilado en columna: (a) nombre de la cuenta como primera línea; (b) badge `Archivada` en su propia línea inmediatamente debajo del nombre cuando `is_active === false`; (c) institución del banco como tercera línea opcional (solo si `account.type === 'bank' && account.institution`). El badge SHALL NO renderizarse inline en la línea del nombre — esto evita que el badge compita con un nombre largo y se desborde del slot.
3. Bloque de balances de las monedas activas: ARS primario (semibold, `text-text`); USD subordinado (menor jerarquía, `text-text-soft`). Una fila con `is_active=false` o sin actividad en una moneda SHALL seguir mostrando ambas monedas si están activas en la cuenta, con sus valores reales (incluyendo `$ 0,00`).
4. Trigger kebab (`AccountRowMenu`) en el extremo derecho.

ARS SHALL renderizarse siempre antes que USD cuando ambas monedas están activas. ARS y USD NO SHALL sumarse, mezclarse ni convertirse. Si la cuenta tiene una sola moneda activa, SHALL renderizarse esa única línea.

**Layout responsive bajo viewports angostos.** Bajo `< sm` (Tailwind `sm`, 640px), el contenido interno del `<Link>` de la fila — bloque de identidad + bloque de balances — SHALL apilarse en columna y SHALL ocupar el ancho horizontal disponible (los hijos del `<Link>` no forzan `items-start` en cross-axis; por default toman el ancho del contenedor vía `align-items: stretch`). Esto evita que un nombre largo o el badge `Archivada` compitan con montos largos como `$ 1.840.300,50` cuando el ancho disponible no alcanza para layout horizontal. Avatar y kebab SHALL mantenerse a los costados de la fila (avatar a la izquierda del bloque apilado, kebab a la derecha). A partir de `sm` y hacia arriba, la fila SHALL volver a su layout horizontal con balances alineados a la derecha.

**Wrapping del nombre y del subtítulo de institución.** En `< sm`, el nombre de la cuenta y el subtítulo de institución SHALL permitir wrapping a múltiples líneas (`break-words`) en vez de truncarse con elipsis. Un nombre largo se continúa en una nueva línea debajo, sin desbordarse sobre el slot del kebab. En `≥ sm`, ambas líneas SHALL volver a `truncate` (one-liner con elipsis) para preservar la compactez horizontal del layout desktop.

**Acciones del header y del empty state.** El botón "+ Crear cuenta" del header (`CreateAccountButton`) SHALL seguir usando el primitivo `Button` (`@/components/ui/button.tsx`); el CTA del `EmptyAccountsState` SHALL seguir siendo `<Button asChild><Link href="/accounts/new">…</Link></Button>`. NO SHALL re-tipearse `bg-primary` / `bg-emerald` ni paddings ad-hoc sobre `<button>` o `<Link>` desnudos.

**Web y mobile son implementaciones nativas en paralelo.** El handoff incluye `docs/design/accounts/web/accounts.html` y `docs/design/accounts/mobile/accounts.html`. El requirement aplica a **web** en este change. La paridad mobile SHALL implementarse como una vista nativa RN equivalente en un change futuro, con la misma estructura (header → hint condicional → sección cash → sección bank → sección archivada opcional → estados de carga y error), JSX **no** compartido, y los mismos no-goals.

**No-goals (vinculantes).** El rediseño NO SHALL:

- Agregar totales globales por moneda al pie de sección, al header o como tarjeta separada.
- Agregar resumen / overview / hero card por encima de las secciones.
- Agregar búsqueda, toolbar de filtros, chips de filtros activos, ni control de ordenamiento. El orden permanece el que devuelve la query (`created_at` ascendente por grupo).
- Agregar métricas derivadas (e.g. "cuántas cuentas activas en USD") más allá del contador `· N` que ya muestra `AccountSection`.
- Agregar acciones de cuenta nuevas (la matriz `(is_active, has_transactions)` y los items del menú quedan definidos en el requirement existente del listado).
- Agregar nuevos campos a `AccountWithBalances`, nuevas queries en `lib/accounts/`, ni nuevas server actions.

Cualquier propuesta que viole un no-goal SHALL abrir un change OpenSpec nuevo y modificar este requirement antes de implementarse.

#### Scenario: La ruta sigue el handoff de docs/design/accounts/

- **WHEN** un desarrollador implementa el rediseño visual de `/accounts`
- **THEN** la composición sigue la estructura del handoff: header con título + acción primaria, hint condicional, sección cash con su título caps + count, sección bank con su título caps + count, sección archivada opcional con borde dashed
- **AND** la implementación usa los componentes ya enumerados en el requirement, no JSX inline ni componentes nuevos creados ad-hoc
- **AND** los valores visuales se derivan de tokens en `@grana/ui-tokens` y primitivos en `apps/web/components/ui/`, no de hex literales copiados del mock

#### Scenario: La fila de cuenta respeta ARS primaria y USD secundaria

- **WHEN** una cuenta tiene ARS y USD activas
- **THEN** la fila muestra el balance ARS primero con jerarquía mayor (semibold `text-text`) y el balance USD debajo con jerarquía menor (`text-text-soft`)
- **AND** los valores SHALL NOT sumarse ni convertirse
- **AND** si una cuenta tiene solo ARS activa, la fila muestra solo la línea ARS; si tiene solo USD activa, muestra solo la línea USD

#### Scenario: La fila se apila bajo viewports angostos

- **WHEN** el viewport es `< sm` (640px) y una fila contiene un nombre largo (e.g. "Caja de ahorro Galicia sueldo y gastos del hogar") o un badge `Archivada` además del nombre
- **THEN** el contenido interno del `<Link>` (identidad + balances) se apila en columna ocupando el ancho horizontal disponible
- **AND** los balances ARS/USD aparecen debajo de la identidad en lugar de a la derecha
- **AND** el avatar y el kebab siguen a los costados (avatar a la izquierda del bloque apilado, kebab a la derecha) y SHALL alinearse al **inicio vertical** de la fila (la fila usa `items-start` bajo `< sm`), de modo que el avatar quede a la altura del nombre y el kebab a la altura del primer renglón, en vez de flotar al centro vertical de la fila apilada
- **AND** la regla bimoneda se respeta dentro del bloque de balances (ARS arriba, USD abajo)

#### Scenario: Un nombre largo wrappea a una segunda línea en `< sm` y no se desborda sobre el kebab

- **WHEN** el viewport es `< sm` y el nombre de la cuenta excede el ancho disponible entre avatar y kebab (e.g. "Caja de ahorro Galicia sueldo y gastos del hogar")
- **THEN** el nombre se continúa en una nueva línea debajo de la primera, sin truncarse
- **AND** el texto NO SHALL desbordarse sobre el slot del kebab ni cubrirlo visualmente
- **AND** si la cuenta es bank, el subtítulo de institución SHALL aplicar la misma regla (wrappea en lugar de truncar bajo `< sm`)

#### Scenario: Bajo `≥ sm` el nombre y el subtítulo vuelven a truncarse con elipsis

- **WHEN** el viewport es `≥ sm` y el nombre de la cuenta o el subtítulo de institución excede el ancho disponible
- **THEN** el texto se trunca con elipsis (`truncate`) y queda en una sola línea
- **AND** el layout horizontal compacto del desktop se preserva

#### Scenario: A partir de `sm` la fila vuelve al layout horizontal

- **WHEN** el viewport es `≥ sm` (640px o más)
- **THEN** identidad y balances se renderizan en la misma línea horizontal con los balances alineados a la derecha
- **AND** la fila usa `items-center` (avatar y kebab vuelven a centrarse verticalmente respecto a la fila)
- **AND** la regla bimoneda se respeta dentro del bloque de balances (ARS arriba, USD abajo)

#### Scenario: El badge "Archivada" se renderiza en su propia línea debajo del nombre

- **WHEN** se renderiza una fila de cuenta con `is_active=false` (típicamente en la sección Archivadas)
- **THEN** el badge `Archivada` aparece en una línea separada inmediatamente debajo del nombre y, si hay institución, por encima del subtítulo de institución
- **AND** el badge usa la paleta `bg-warning-soft text-warning` con la copy `accounts.badges.archived`
- **AND** el badge tiene ancho intrínseco (no se estira al ancho del bloque) y no se desborda del slot, aún con nombres largos
- **AND** la sección que la contiene tiene `border-dashed` (per requirement existente del listado)

#### Scenario: El hint de primer uso aparece solo con una cuenta activa y no descartado

- **WHEN** el usuario tiene exactamente una cuenta activa (`cash.length + bank.length === 1`) y no descartó el hint en `localStorage`
- **THEN** `AccountsHint` se renderiza por encima de las secciones, dentro del bloque de cuentas activas
- **AND** el botón de descarte deja el hint dismissed para futuras visitas a la ruta
- **AND** si el usuario tiene 0 o ≥2 cuentas activas, el hint NO se renderiza independientemente del valor de `localStorage`

#### Scenario: La sección Archivadas se omite cuando no hay archivadas

- **WHEN** la query `getCashAndBankAccounts({ archivedOnly: true })` resuelve con cero filas
- **THEN** `ArchivedAccountsContainer` retorna `null` y no se renderiza título de sección, lista, ni separador visual fantasma
- **AND** el contenido visible queda compuesto solo por header + (hint condicional) + sección cash + sección bank

#### Scenario: Abrir el kebab de una fila no reflowa el header de la ruta

- **WHEN** el usuario abre el `DropdownMenu` del kebab de una fila
- **THEN** el `PageHeader` de `/accounts` no cambia su layout (la acción "+ Crear cuenta" sigue en la misma línea que el título "Cuentas", no salta a una línea debajo)
- **AND** la ruta no introduce un horizontal scrollbar transitorio mientras el menú está abierto
- **AND** el menú se anchora al trigger sin alterar el ancho disponible del cuerpo (el primitivo `DropdownMenu` evita el `react-remove-scroll` de Radix vía `modal={false}` para este caso)

#### Scenario: Estados de carga y error usan los componentes existentes

- **WHEN** una de las secciones está cargando o falla
- **THEN** el área de la sección activa muestra `ActiveAccountsSkeleton` o `SectionFallback` según el momento
- **AND** el área de la sección archivada muestra `ArchivedAccountsSkeleton` o `SectionFallback` según el momento
- **AND** un throw fuera de los `try/catch` de los containers es capturado por `AccountsErrorBoundary` y reemplaza el área del contenido por `RouteError`, sin tapar el header
- **AND** ningún estado de carga o error introduce datos, queries ni componentes nuevos

#### Scenario: Las acciones tipo CTA usan el primitivo Button

- **WHEN** se renderizan las dos acciones tipo CTA de la ruta — "+ Crear cuenta" en el header y "+ Crear cuenta" del `EmptyAccountsState`
- **THEN** ambas componen el primitivo `Button` (directamente o vía `asChild` con `<Link>`)
- **AND** no se aplican clases `bg-primary` / `bg-emerald` / paddings ad-hoc inline sobre `<button>` o `<Link>` desnudos

#### Scenario: El rediseño NO agrega totales por moneda

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** no existe ningún elemento visual que sume balances ARS de varias cuentas, ni balances USD de varias cuentas
- **AND** no existe una card de "Total cash + bank" ni un strip de totales al pie de sección
- **AND** el único conteo numérico de sección es el `· N` (cantidad de filas) ya emitido por `AccountSection`

#### Scenario: El rediseño NO agrega búsqueda, filtros ni ordenamiento

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** no aparece un input de búsqueda en el header ni en las secciones
- **AND** no aparecen toolbars de filtros, chips de filtros activos, ni controles de ordenamiento
- **AND** el orden de las cuentas dentro de cada grupo sigue siendo el que devuelve la query (`created_at` ascendente)

#### Scenario: El rediseño NO agrega acciones de cuenta nuevas

- **WHEN** se abre el kebab de una fila
- **THEN** los items del menú son los definidos en el requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo" según la matriz `(is_active, has_transactions)`
- **AND** no aparecen items nuevos como "Compartir", "Duplicar", "Exportar" ni similares
- **AND** no aparecen acciones primarias por fila fuera del kebab

#### Scenario: El rediseño NO introduce datos ni queries nuevos

- **WHEN** se inspecciona la implementación de la ruta tras este change
- **THEN** las queries usadas son exclusivamente `getCashAndBankAccounts()` (sin flags) en active y `getCashAndBankAccounts({ archivedOnly: true })` en archived, más `getInstitutions()` para el drawer
- **AND** el tipo `AccountWithBalances` NO incluye campos nuevos respecto al estado pre-change
- **AND** NO se agregan server actions ni endpoints nuevos en `lib/accounts/`

#### Scenario: Web y mobile son implementaciones nativas en paralelo

- **WHEN** se implementa el rediseño web bajo este change
- **THEN** la implementación vive en `apps/web/app/(app)/accounts/_components/` con JSX HTML/Next
- **AND** NO se introduce un módulo compartido de JSX entre `apps/web` y `apps/mobile`
- **AND** el handoff `docs/design/accounts/mobile/accounts.html` queda disponible como referencia para una implementación RN equivalente en un change futuro, que SHALL respetar los mismos componentes, datos y no-goals
