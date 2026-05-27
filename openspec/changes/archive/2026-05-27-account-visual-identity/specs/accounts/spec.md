## ADDED Requirements

### Requirement: Cada cuenta tiene un avatar visual (color + ícono)

El sistema SHALL representar cada cuenta `cash`/`bank` con un avatar visual compuesto por un **color** y un **ícono**, resueltos desde dos campos nullable `accounts.color_key` y `accounts.icon_key`. La regla de resolución SHALL ser: un valor explícito es la elección del usuario (override fijo); `NULL` significa "derivar automáticamente". El avatar SHALL renderizarse en la lista de cuentas, el header de detalle y el breakdown del hero del dashboard. (Mostrar el avatar dentro de los pickers de cuenta de los formularios de transacción/transferencia queda fuera de alcance de este requirement: el control actual es un `<select>` nativo y requiere un dropdown custom — change posterior.)

La derivación automática (`NULL`) SHALL ser:
- **bank** → color e ícono heredados **en vivo** de la institución (`institutions.brand_color`; `icon_type='bank'` → ícono `landmark`, `icon_type='wallet'` → ícono `wallet`). "En vivo" significa que si cambia la institución de la cuenta, el avalar derivado cambia con ella.
- **cash** → ícono `wallet` y color determinístico a partir del `id` de la cuenta (`hash(id) % tamaño_paleta`), de modo que distintas cuentas cash no salgan todas iguales. El color determinístico se computa al resolver; no se persiste.

`color_key` SHALL referenciar la paleta curada de cuentas (tokens `--account-*` en `@grana/ui-tokens`); `icon_key` SHALL referenciar el set curado de íconos. Ambas paletas SHALL excluir los colores semánticos (`emerald`=ingreso/positivo, `terracotta`/`error`=negativo). Cuando el ícono resuelto es ausente, el avatar SHALL mostrar el **monograma** (primera letra del `name`) sobre el color.

#### Scenario: Banco hereda el branding de su institución

- **WHEN** una cuenta `type='bank'` tiene `color_key=NULL` e `icon_key=NULL` y su institución tiene `brand_color` e `icon_type='bank'`
- **THEN** el avatar usa el color de la institución y el ícono `landmark`

#### Scenario: Cambiar la institución actualiza el avatar heredado

- **WHEN** una cuenta `type='bank'` con `color_key=NULL` cambia su `institution_id` a otra institución con distinto `brand_color`
- **THEN** el avatar pasa a reflejar el branding de la nueva institución (herencia viva), sin tocar `color_key`

#### Scenario: Override explícito queda fijo

- **WHEN** el usuario elige un `color_key` explícito para una cuenta bank y luego cambia la institución de la cuenta
- **THEN** el avatar conserva el color elegido por el usuario y no sigue al de la nueva institución

#### Scenario: Cuenta cash sin elección recibe color determinístico

- **WHEN** una cuenta `type='cash'` tiene `color_key=NULL`
- **THEN** el avatar usa el ícono `wallet` y un color de la paleta derivado de `hash(id)`, estable entre renders

#### Scenario: Fallback a monograma

- **WHEN** una cuenta resuelve un ícono ausente (sin `icon_key` y sin ícono derivable)
- **THEN** el avatar muestra la primera letra del `name` de la cuenta sobre el color

#### Scenario: La lista muestra el avatar de cada cuenta

- **WHEN** el usuario abre la lista de cuentas
- **THEN** cada fila muestra el avatar (color + ícono o monograma) de la cuenta junto a su nombre y saldos

#### Scenario: Key inválida es rechazada en validación

- **WHEN** el usuario envía un `color_key` o `icon_key` que no pertenece al registry curado
- **THEN** la action retorna error de validación y no persiste el valor

## MODIFIED Requirements

### Requirement: El usuario puede ver la lista de sus cuentas agrupadas por tipo

El sistema SHALL mostrar las cuentas del usuario agrupadas por `type` — un grupo para `cash` y otro para `bank`. Las cuentas `type='credit'` (tarjetas) NO se listan en esta pantalla: viven en su propia capability `cards`. Por defecto la lista excluye las cuentas con `is_active=false`. El orden dentro de cada grupo es por `created_at` ascendente. Cada cuenta SHALL renderizarse con su avatar visual (ver requirement "Cada cuenta tiene un avatar visual").

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
