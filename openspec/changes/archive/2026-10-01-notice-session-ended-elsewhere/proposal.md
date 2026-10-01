## Why

Restablecer la contraseña o cambiarla desde Ajustes cierra las demás sesiones de la persona, pero el celular se entera recién cuando le vence el pase de acceso: hasta una hora después. Mientras tanto sigue mostrando saldos y movimientos. Muchas veces la contraseña se cambia justo porque un celular se perdió o se prestó, que es cuando esa hora importa (#169, mismo caso que Pinpoint #230).

Además, al cerrar la sesión —con el botón o desde otro dispositivo— los datos de la persona quedan en la memoria de la app. Si otra cuenta inicia sesión en el mismo celular sin cerrar la app, puede ver por un momento los saldos y movimientos de la anterior.

## What Changes

- El celular le pregunta al servidor si su sesión sigue en pie al abrirse, al volver al frente y cada 5 minutos mientras está abierto.
- Si la sesión se cerró desde otro dispositivo, el celular muestra el inicio de sesión: en el acto al abrirse o volver, y en menos de 5 minutos si estaba abierto.
- Sin conexión, o ante cualquier respuesta que no diga que la sesión ya no existe, no cambia nada: la persona sigue con la sesión iniciada.
- Cada vez que la sesión se cierra, por el motivo que sea, la app olvida lo que tenía en memoria de esa persona; quien inicie sesión después parte de cero.

No se hace:

- La pantalla de inicio de sesión no dice *por qué* se cerró la sesión: el servidor no informa el motivo.
- La web no cambia: ya valida con el servidor en cada página.
- No se agrega una forma nueva de cerrar otras sesiones.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `auth`: requirement nuevo — el celular se entera en minutos de una sesión cerrada desde otro dispositivo y muestra el inicio de sesión. *Logout desde el área autenticada* suma que, al cerrarse la sesión por cualquier motivo, el celular olvida los datos en memoria de esa persona.

## Impact

- `apps/mobile/lib/` — el chequeo (al abrir, al volver al frente, cada 5 minutos), registrado junto a la conexión con Supabase.
- `apps/mobile/app/_layout.tsx` — el aviso de sesión cerrada, que ya lleva al inicio de sesión, además vacía la memoria de datos.
- Un test que fija el comportamiento de la librería del que depende todo: sin conexión la sesión no se cierra.
- Sin dependencias nuevas, sin cambios en la base, nada en la web.
