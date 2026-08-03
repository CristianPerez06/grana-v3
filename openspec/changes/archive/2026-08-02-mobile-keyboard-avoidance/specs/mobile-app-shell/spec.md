## ADDED Requirements

### Requirement: Ninguna superficie con campos de texto queda tapada por el teclado

`apps/mobile` SHALL garantizar que, en toda superficie que contenga al menos un campo de texto, el campo enfocado, su mensaje de error asociado y la acción primaria de submit queden visibles por encima del teclado nativo, sin que el usuario tenga que cerrar el teclado ni scrollear a ciegas.

La garantía SHALL cubrir **las tres familias de superficie** que existen hoy en la app, sin excepciones por plataforma:

- Pantallas pusheadas con formulario (alta/edición de cuenta, tarjeta, movimiento, recurrencia, categoría, subcategoría, pago de resumen, liquidación, monedas de una cuenta).
- Pantallas root de tab con formulario inline (p. ej. el alta de hogar en la pestaña Hogar).
- Superficies de overlay: `Drawer`, `BottomSheet` y cualquier `Modal` que contenga inputs.

La garantía SHALL valer por igual en **iOS y en Android**, incluyendo Android en modo edge-to-edge. Una superficie que compense el teclado solo en una plataforma NO satisface este requirement.

Además del desplazamiento, la superficie SHALL **scrollear el campo enfocado a la vista**: desplazar o paddear el contenedor no alcanza cuando el formulario es más alto que la pantalla. Al enfocar un campo que quedaría bajo el teclado, el contenido SHALL reposicionarse para dejarlo visible con un margen de respiro respecto del borde superior del teclado.

La responsabilidad SHALL vivir en el **seam del shell** (un shell de pantalla de formulario y un cuerpo de overlay reutilizables), no en cada pantalla. Una pantalla o un overlay nuevos NO SHALL tener que resolver el teclado por su cuenta ni replicar la lógica de compensación.

Toda superficie scrolleable con inputs SHALL declarar `keyboardShouldPersistTaps="handled"`, de modo que un tap sobre un control del formulario (chip, selector, submit) se procese en el primer toque en vez de consumirse cerrando el teclado.

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

### Requirement: El root layout provee el contexto de teclado a toda la app

`apps/mobile/app/_layout.tsx` SHALL montar el provider de contexto de teclado envolviendo el árbol completo de la app (auth, onboarding y app autenticada), de modo que cualquier superficie descendiente pueda leer el estado y la altura del teclado sin configuración adicional.

El provider SHALL montarse **dentro de `SafeAreaProvider`** — que se mantiene como wrapper outermost según el requirement de safe-area — y por fuera del resto de los providers de la app.

Las superficies renderizadas dentro de un `Modal` nativo viven en una ventana propia y por lo tanto SHALL montar su propio contexto de teclado dentro del modal. Esa responsabilidad SHALL estar encapsulada en el cuerpo de overlay reutilizable del shell, no repetida en cada sheet.

Los campos que abren un teclado numérico SHALL exponer una acción visible para cerrarlo. El teclado decimal de iOS no tiene tecla de retorno, así que sin una barra accesoria el único modo de cerrarlo es tocar fondo vacío — lo cual no es descubrible y en un formulario denso puede no existir.

#### Scenario: Cualquier superficie puede leer el estado del teclado

- **WHEN** un componente bajo `apps/mobile/app/` consulta el estado del teclado
- **THEN** resuelve sin lanzar un error de provider ausente
- **AND** obtiene la altura y el estado de visibilidad reales del teclado

#### Scenario: El campo de monto se puede cerrar sin tocar el fondo

- **WHEN** un usuario enfoca un campo de monto (teclado decimal) en iOS
- **THEN** hay una acción visible y explícita para cerrar el teclado
- **AND** el usuario no depende de encontrar un área de fondo vacía para hacerlo

### Requirement: El tab bar no se interpone entre el contenido y el teclado

El `TabBar` de `apps/mobile` lo renderiza el navigator por fuera del contenedor de pantalla, de modo que permanece anclado al borde inferior aunque el teclado esté abierto. Cuando el teclado está visible, el tab bar SHALL ocultarse: no aporta navegación útil durante la edición de un campo y, de quedar visible, se interpone entre el contenido del formulario y el borde superior del teclado, consumiendo alto vertical justo donde hace falta.

El tab bar SHALL reaparecer al cerrarse el teclado, sin salto de layout perceptible y sin alterar la regla de rutas chromeless ya especificada (una ruta chromeless sigue sin tab bar, haya teclado o no).

#### Scenario: El tab bar se oculta al abrir el teclado en una pantalla de tab

- **WHEN** un usuario está en una pantalla root de tab con formulario inline y enfoca un campo de texto
- **THEN** el tab bar se oculta mientras el teclado está visible
- **AND** el espacio que ocupaba queda disponible para el contenido del formulario

#### Scenario: El tab bar vuelve al cerrarse el teclado

- **WHEN** el usuario cierra el teclado en esa misma pantalla
- **THEN** el tab bar vuelve a mostrarse en su posición habitual
- **AND** la pestaña activa sigue siendo la misma que antes de abrir el teclado
