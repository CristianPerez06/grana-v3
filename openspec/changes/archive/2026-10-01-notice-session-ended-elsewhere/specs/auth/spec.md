## ADDED Requirements

### Requirement: El celular se entera de una sesión cerrada desde otro dispositivo

La app de mobile SHALL preguntarle al servicio de autenticación si su sesión sigue en pie cuando la app se abre, cuando vuelve al frente desde segundo plano y cada 5 minutos mientras está al frente. Sin sesión iniciada, la app MUST NOT preguntar.

Cuando el servicio responde que la sesión ya no existe, la app SHALL cerrar su sesión y mostrar el inicio de sesión, igual que si la persona hubiera cerrado sesión en el celular. Una sesión cerrada desde otro dispositivo SHALL llegar por eso al inicio de sesión en el celular en menos de 5 minutos con la app abierta, y en el acto la próxima vez que se abra o vuelva al frente.

Cualquier otro resultado SHALL dejar a la persona con la sesión iniciada: sin conexión, un pedido que no responde a tiempo, o una respuesta del servicio que no dice que la sesión ya no existe. La app MUST NOT cerrar la sesión de nadie porque no pudo preguntar.

Razón: cambiar o restablecer la contraseña cierra las demás sesiones. La web valida con el servidor en cada página y lo nota enseguida; el celular seguía funcionando hasta que vencía su pase de acceso, hasta una hora, y una contraseña muchas veces se cambia porque un celular se perdió o se prestó. Cinco minutos acercan esa promesa a la verdad con un pedido chico que solo corre con la app al frente.

#### Scenario: Volver al celular después de que se cambió la contraseña en otro lado

- **WHEN** la app de mobile está en segundo plano
- **AND** la persona restablece o cambia su contraseña desde otro dispositivo
- **AND** la app vuelve al frente
- **THEN** la app muestra el inicio de sesión

#### Scenario: El celular está abierto cuando se cambia la contraseña en otro lado

- **WHEN** la app de mobile está abierta
- **AND** la persona cambia su contraseña desde otro dispositivo
- **THEN** la app muestra el inicio de sesión en menos de 5 minutos, sin que nadie toque nada

#### Scenario: Abrir el celular sin conexión

- **WHEN** la app de mobile se abre o vuelve al frente sin conexión
- **THEN** la persona sigue con la sesión iniciada

#### Scenario: La sesión sigue en pie

- **WHEN** la app pregunta y la sesión sigue en pie
- **THEN** nada cambia en pantalla

## MODIFIED Requirements

### Requirement: Logout desde el área autenticada

El sistema SHALL ofrecer una forma de cerrar sesión desde el área autenticada. Al activarla el sistema SHALL invalidar la sesión de Supabase y redirigir al área no autenticada.

En mobile, cada vez que la sesión se cierra —con el botón, desde otro dispositivo o porque el servicio de autenticación rechazó renovarla— la app SHALL olvidar todos los datos de la persona que tenía en memoria, de modo que quien inicie sesión después no vea nada de la cuenta anterior.

En web, el control vive como botón en el header de toda ruta bajo `(app)/`. En mobile, el control vive como botón dentro de la pantalla de dashboard (no hay header global por ahora).

#### Scenario: Logout desde el dashboard (web)

- **WHEN** un usuario autenticado clickea el botón de logout en el header
- **THEN** el sistema llama a `supabase.auth.signOut()`
- **AND** el usuario es redirigido a `/login`
- **AND** la navegación posterior a `/dashboard` redirige de vuelta a `/login`

#### Scenario: Logout desde el dashboard (mobile)

- **WHEN** un usuario autenticado en mobile toca el botón "Cerrar sesión" dentro de `(app)/dashboard`
- **THEN** la app llama a `supabase.auth.signOut()`
- **AND** el listener `onAuthStateChange` en el root layout recibe `SIGNED_OUT` y redirige a `(auth)/login`
- **AND** `expo-secure-store` queda sin tokens persistidos para el próximo arranque

#### Scenario: Otra cuenta inicia sesión en el mismo celular (mobile)

- **WHEN** un usuario cierra sesión en mobile, por el botón o porque se cerró desde otro dispositivo
- **AND** otra cuenta inicia sesión sin que la app se haya cerrado
- **THEN** ninguna pantalla muestra saldos, movimientos ni otros datos de la cuenta anterior, ni siquiera por un momento

