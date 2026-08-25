## MODIFIED Requirements

### Requirement: Ninguna superficie con campos de texto queda tapada por el teclado

`apps/mobile` SHALL garantizar que, en toda superficie que contenga al menos un campo de texto, el campo enfocado, su mensaje de error asociado y la acción primaria de submit queden visibles por encima del teclado nativo, sin que el usuario tenga que cerrar el teclado ni scrollear a ciegas.

La garantía SHALL cubrir **toda superficie con al menos un campo de texto**, sin excepciones por plataforma y sin excepciones por tipo de pantalla. La enumeración que sigue describe las familias que existen hoy y NO SHALL leerse como una lista cerrada: una superficie que no encaje en ninguna igual queda alcanzada por el requirement.

- Pantallas pusheadas con formulario (alta/edición de cuenta, tarjeta, movimiento, recurrencia, categoría, subcategoría, pago de resumen, liquidación, monedas de una cuenta).
- Pantallas root de tab con formulario inline (p. ej. el alta de hogar en la pestaña Hogar).
- Superficies de overlay: `Drawer`, `BottomSheet` y cualquier `Modal` que contenga inputs.
- **Pantallas que no son de formulario y hospedan inputs de forma incidental**: feeds y detalles que muestran un campo dentro de un bloque expandible, un buscador inline o cualquier control de edición embebido. Que la pantalla no sea "un formulario" NO la exime: lo que activa el requirement es la presencia del campo, no la naturaleza de la pantalla.

La garantía SHALL valer por igual en **iOS y en Android**, incluyendo Android en modo edge-to-edge. Una superficie que compense el teclado solo en una plataforma NO satisface este requirement.

Además del desplazamiento, la superficie SHALL **scrollear el campo enfocado a la vista**: desplazar o paddear el contenedor no alcanza cuando el formulario es más alto que la pantalla. Al enfocar un campo que quedaría bajo el teclado, el contenido SHALL reposicionarse para dejarlo visible con un margen de respiro respecto del borde superior del teclado.

La responsabilidad SHALL vivir en el **seam del shell** (un shell de pantalla de formulario y un cuerpo de overlay reutilizables), no en cada pantalla. Una pantalla o un overlay nuevos NO SHALL tener que resolver el teclado por su cuenta ni replicar la lógica de compensación.

Cuando ningún seam aplica — la pantalla compone su propio header, necesita `RefreshControl`, o mantiene un hermano fuera del scroller (un FAB, una barra de acciones) — la pantalla SHALL consumir el **scroller compartido** del app shell (`apps/mobile/components/layout/keyboard-aware-scroll-view`) pasándole el `bottomOffset` compartido, y NO SHALL importar el scroller directamente de `react-native-keyboard-controller`: ese módulo es el que lo registra en NativeWind, y sin ese registro `className` / `contentContainerClassName` se descartan en silencio, sin que TypeScript lo detecte. Esto es una vía alternativa de consumo del seam, no una excepción a él: la pantalla sigue sin escribir lógica de teclado propia. `KeyboardAvoidingView` de `react-native` SHALL seguir prohibido en cualquiera de los dos caminos.

El `bottomOffset` compartido SHALL incluir el alto del `KeyboardToolbar` además del margen de respiro: el scroller posiciona el campo respecto del borde superior del **teclado** y no conoce el toolbar, así que un offset menor deja el campo tapado por él.

Toda superficie scrolleable con inputs SHALL declarar `keyboardShouldPersistTaps="handled"`, de modo que un tap sobre un control del formulario (chip, selector, submit) se procese en el primer toque en vez de consumirse cerrando el teclado. Esto SHALL valer también para las superficies que no son de formulario: en un feed o un detalle, los controles vecinos al campo (confirmar, limpiar la búsqueda, chips de filtro) son los que pagan el tap perdido.

#### Scenario: El campo enfocado a media altura de un formulario largo queda visible

- **WHEN** un usuario abre el alta de movimiento y enfoca el campo de monto, que en reposo queda a media altura de un formulario más alto que la pantalla
- **THEN** el contenido se reposiciona para que el campo de monto quede visible por encima del teclado
- **AND** el usuario puede ver lo que está tipeando sin cerrar el teclado

#### Scenario: El submit sigue siendo alcanzable con el teclado abierto

- **WHEN** un usuario está tipeando en el último campo de un formulario y el teclado está abierto
- **THEN** puede scrollear hasta el botón de submit y tocarlo con el teclado todavía abierto
- **AND** el tap dispara el submit en el primer toque, sin consumirse en cerrar el teclado

#### Scenario: La compensación funciona igual en Android edge-to-edge

- **WHEN** un usuario en un dispositivo Android (con `edgeToEdgeEnabled`) enfoca cualquier campo de cualquiera de las superficies con formulario
- **THEN** el campo enfocado queda visible por encima del teclado
- **AND** el comportamiento es equivalente al de iOS, sin superficies que queden sin compensación en Android

#### Scenario: Un formulario dentro de un overlay compensa el teclado

- **WHEN** un usuario abre el `Drawer` de alta de categoría (o cualquier overlay con inputs, como el sheet de filtros de movimientos) y enfoca un campo
- **THEN** el contenido del overlay se reposiciona para que el campo quede visible por encima del teclado
- **AND** el overlay no queda parcialmente fuera de pantalla ni pierde su header

#### Scenario: Una pantalla de formulario nueva hereda la compensación sin escribirla

- **WHEN** se agrega una pantalla de formulario nueva bajo `apps/mobile/app/(app)/` usando el shell de formulario del app shell
- **THEN** la pantalla compensa el teclado sin declarar ninguna lógica de teclado propia
- **AND** NO importa ni monta un `KeyboardAvoidingView` a nivel pantalla

#### Scenario: Un campo dentro de un bloque expandible del feed queda visible

- **WHEN** un usuario expande un reintegro pendiente a media altura del feed de movimientos y enfoca el campo de monto real
- **THEN** el contenido se reposiciona para que el campo, su texto de error y el botón de confirmar queden por encima del teclado y del `KeyboardToolbar`
- **AND** con el teclado abierto, el tap sobre confirmar dispara la acción en el primer toque

#### Scenario: El buscador inline de una pantalla de detalle no pierde taps

- **WHEN** un usuario abre el buscador inline de los movimientos de una cuenta, que enfoca su campo automáticamente
- **THEN** el campo queda visible con el teclado abierto
- **AND** la acción de limpiar la búsqueda y los chips de filtro responden al primer toque, sin consumirse cerrando el teclado

#### Scenario: Una pantalla que no puede usar un seam consume el scroller compartido

- **WHEN** una pantalla que no es de formulario recibe un input y no puede adoptar el shell de formulario ni el cuerpo de overlay — porque compone su propio header, necesita `RefreshControl` o mantiene un hermano fuera del scroller
- **THEN** obtiene su contenedor scrolleable del módulo de scroller compartido del app shell, con el `bottomOffset` compartido y `keyboardShouldPersistTaps="handled"`
- **AND** NO importa el scroller directamente de `react-native-keyboard-controller` ni monta un `KeyboardAvoidingView`
- **AND** conserva el comportamiento que ya tenía la pantalla, incluido el pull-to-refresh y el padding de su contenedor de contenido
