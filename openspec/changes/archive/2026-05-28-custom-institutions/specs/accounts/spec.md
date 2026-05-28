## ADDED Requirements

### Requirement: Crear institución custom desde el form de cuenta

El sistema SHALL permitir al usuario crear una institución propia ("custom") desde el dropdown del form de cuenta (`CreateAccountForm` y `EditAccountForm`) cuando el banco/billetera buscada no existe en el catálogo. La institución custom queda asociada al usuario (`user_id = auth.uid()`) y es indistinguible del catálogo aguas arriba: tiene los mismos campos (`name`, `brand_color`, `icon_type`) y el avatar de cuenta deriva de ella con las mismas reglas que el catálogo.

La creación SHALL ocurrir vía un sub-form inline dentro del dropdown (no modal), que pide `name` (1–50 trimmed, único por usuario), `brand_color` (de una paleta cerrada para mantener consistencia visual), `icon_type` (`bank` o `wallet`). El sub-form aparece al hacer click en un ítem "+ Agregar nueva institución…" que el dropdown expone. Confirmar persiste la institución y la deja seleccionada en el form padre; cancelar vuelve al dropdown sin persistir.

#### Scenario: El usuario crea una institución custom desde el alta de cuenta

- **WHEN** un usuario crea una cuenta bancaria, busca en el dropdown un nombre que no matchea, y hace click en "+ Agregar nueva institución…"
- **THEN** aparece un sub-form inline con campos `name`, `color`, `icon_type`
- **AND** el `name` viene pre-rellenado con el texto buscado

#### Scenario: La institución custom queda seleccionada al crearla

- **WHEN** el usuario confirma la creación con datos válidos
- **THEN** la institución se persiste con `user_id = auth.uid()`
- **AND** queda seleccionada en el dropdown del form padre
- **AND** el sub-form se cierra

#### Scenario: Cancelar el sub-form no persiste nada

- **WHEN** el usuario abre el sub-form, ingresa datos, y hace click en Cancelar
- **THEN** la institución no se persiste y el dropdown vuelve a su estado anterior

#### Scenario: La cuenta bancaria con institución custom funciona como con catálogo

- **WHEN** el usuario crea una cuenta `type='bank'` apuntada a una institución custom
- **THEN** la cuenta se persiste con `institution_id` apuntando a la fila custom
- **AND** el avatar de la cuenta (en lista, detalle y dashboard) usa el `brand_color` y `icon_type` de esa institución

## MODIFIED Requirements

### Requirement: Cada cuenta tiene un avatar visual (color + ícono)

El sistema SHALL representar cada cuenta `cash`/`bank` con un avatar visual compuesto por un **color** y un **ícono**, resueltos desde dos campos nullable `accounts.color_key` y `accounts.icon_key`. La regla de resolución SHALL ser: un valor explícito es la elección del usuario (override fijo); `NULL` significa "derivar automáticamente". El avatar SHALL renderizarse en la lista de cuentas, el header de detalle y el breakdown del hero del dashboard. (Mostrar el avatar dentro de los pickers de cuenta de los formularios de transacción/transferencia queda fuera de alcance de este requirement: el control actual es un `<select>` nativo y requiere un dropdown custom — change posterior.)

La derivación automática (`NULL`) SHALL ser:
- **bank** → color e ícono heredados **en vivo** de la institución referenciada por `institution_id`, sea del catálogo o custom — la herencia funciona igual para ambas (`institutions.brand_color`; `icon_type='bank'` → ícono `landmark`, `icon_type='wallet'` → ícono `wallet`). "En vivo" significa que si la cuenta repunta a otra institución, el avatar derivado cambia con ella.
- **cash** → ícono `wallet` y color determinístico a partir del `id` de la cuenta (`hash(id) % tamaño_paleta`), de modo que distintas cuentas cash no salgan todas iguales. El color determinístico se computa al resolver; no se persiste.

`color_key` SHALL referenciar la paleta curada de cuentas (tokens `--account-*` en `@grana/ui-tokens`); `icon_key` SHALL referenciar el set curado de íconos. Ambas paletas SHALL excluir los colores semánticos (`emerald`=ingreso/positivo, `terracotta`/`error`=negativo). Cuando el ícono resuelto es ausente, el avatar SHALL mostrar el **monograma** (primera letra del `name`) sobre el color.

#### Scenario: Banco con institución custom hereda su color e ícono

- **WHEN** una cuenta `type='bank'` con `color_key=NULL` e `icon_key=NULL` apunta a una institución custom del usuario con `brand_color='#3A7D44'` e `icon_type='wallet'`
- **THEN** el avatar usa color `#3A7D44` e ícono `wallet`

#### Scenario: Cambiar de institución del catálogo a una custom actualiza el avatar

- **WHEN** una cuenta `type='bank'` con `color_key=NULL` cambia su `institution_id` del catálogo a una custom del usuario
- **THEN** el avatar pasa a reflejar el branding de la custom, sin tocar `color_key`
