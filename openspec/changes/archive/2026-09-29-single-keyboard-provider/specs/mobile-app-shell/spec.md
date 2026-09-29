## MODIFIED Requirements

### Requirement: El root layout provee el contexto de teclado a toda la app

`apps/mobile/app/_layout.tsx` SHALL montar el provider de contexto de teclado envolviendo el árbol completo de la app (auth, onboarding y app autenticada), de modo que cualquier superficie descendiente pueda leer el estado y la altura del teclado sin configuración adicional.

El provider SHALL montarse **dentro de `SafeAreaProvider`** — que se mantiene como wrapper outermost según el requirement de safe-area — y por fuera del resto de los providers de la app.

El de `_layout.tsx` SHALL ser el **único** provider de contexto de teclado de la app. Las superficies renderizadas dentro de un `Modal` nativo — `Drawer`, `BottomSheet`, sheets propios — NO SHALL montar uno propio: el contexto del root alcanza su contenido, y un segundo provider sobre la misma ventana le quita al del root el aviso de cierre del `Modal`. Desde ese momento el root deja de escuchar el teclado y la barra accesoria queda fija en la última altura que conoció, en cualquier pantalla, hasta que se reinicia la app (issue #166, reproducido en Android).

Los campos que abren un teclado numérico SHALL exponer una acción visible para cerrarlo. El teclado decimal de iOS no tiene tecla de retorno, así que sin una barra accesoria el único modo de cerrarlo es tocar fondo vacío — lo cual no es descubrible y en un formulario denso puede no existir.

#### Scenario: Cualquier superficie puede leer el estado del teclado

- **WHEN** un componente bajo `apps/mobile/app/` consulta el estado del teclado
- **THEN** resuelve sin lanzar un error de provider ausente
- **AND** obtiene la altura y el estado de visibilidad reales del teclado

#### Scenario: El campo de monto se puede cerrar sin tocar el fondo

- **WHEN** un usuario enfoca un campo de monto (teclado decimal) en iOS
- **THEN** hay una acción visible y explícita para cerrar el teclado
- **AND** el usuario no depende de encontrar un área de fondo vacía para hacerlo

#### Scenario: Cerrar un sheet no deja la barra del teclado pegada

- **WHEN** un usuario, en el alta o la edición de un movimiento, abre un selector (cuenta, categoría, fecha o calculadora) con el teclado visible, lo cierra eligiendo una opción, pasa de un campo a otro y cierra el teclado
- **THEN** la barra accesoria del teclado desaparece junto con el teclado
- **AND** no queda dibujada en esa pantalla ni en ninguna otra a la que navegue después
- **AND** vale igual en Android y en iOS

#### Scenario: Después de cerrar un sheet, el teclado sigue acomodando los campos

- **WHEN** un usuario abre y cierra un selector con el teclado cerrado, y después enfoca un campo del formulario
- **THEN** la barra accesoria aparece sobre el teclado
- **AND** el campo enfocado queda visible por encima del teclado y de la barra

#### Scenario: Ningún `Modal` monta su propio contexto de teclado

- **WHEN** se inspecciona el código de `apps/mobile`
- **THEN** el provider de contexto de teclado se monta en un solo lugar, `apps/mobile/app/_layout.tsx`
- **AND** ningún componente que renderiza un `Modal` monta otro
