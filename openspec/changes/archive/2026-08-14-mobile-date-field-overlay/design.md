## Context

Ver `proposal.md` — Why para la motivación. Lo que importa para el enfoque:

- `DateField` (`apps/mobile/components/ui/DateField.tsx`) monta hoy `DateTimePicker` dentro de su propio árbol, como hermano del trigger, envuelto en un `<View>` en flujo. Por eso el componente cambia de tamaño al abrirse.
- En **Android** ese render no tiene costo de layout: `display="default"` delega en el diálogo del SO, que se presenta fuera del árbol. El defecto es **exclusivamente de iOS**, donde `display="spinner"` renderiza una vista real en el árbol.
- La app nativa ya tiene el primitivo de overlay que hace falta: `BottomSheet` (`components/ui/BottomSheet.tsx`) — `Modal` transparente + scrim + grabber + slide-up, con cap de 90% de alto. `Popover` y `SelectSheet` ya presentan sus contenidos a través de él, así que los pickers de cuenta y categoría del mismo formulario ya se ven así.
- `DateField` **no** tiene contract en `@grana/ui-contracts`: es un primitivo local de `apps/mobile`. Sus internals pueden cambiar sin tocar web ni romper typing cruzado.
- `apps/mobile` no tiene tests ni Storybook — sólo `lint` y `typecheck`. La verificación de este cambio es necesariamente manual, en simulador, en las dos plataformas.

## Goals / Non-Goals

**Goals:**

- Que el picker deje de participar del layout, en el primitivo, de una sola vez para los 18 call sites.
- Reusar el overlay que ya existe en lugar de introducir uno nuevo, para que el campo de fecha se sienta como los demás pickers de la app.
- Mantener intacta la API pública de `DateField`, para que ningún call site tenga que editarse.
- Dejar escrita la regla, no sólo el arreglo.

**Non-Goals:**

- **No** se cambia el estilo del calendario de iOS (sigue siendo el spinner de ruedas, no la grilla de mes). Ver Decisions.
- **No** se toca el comportamiento de Android más allá de lo que exija reestructurar el render.
- **No** se agrega `min`/`max` al campo nativo. Web los tiene (`web-date-picker`), la nativa no, y agregarlos es una change aparte con su propio scope.
- **No** se abre un `DateFieldProps` en `@grana/ui-contracts`. El contract compartido tendría sentido si web y nativa convergieran en la misma API, y hoy no lo están; forzarlo acá agregaría acoplamiento sin comprador.

## Decisions

### 1. Arreglar el primitivo, no envolver en el call site

**Decisión**: cambiar `DateField` por dentro.

La alternativa era un wrapper (`DateFieldSheet` o similar) usado sólo por el alta de movimiento, dejando `DateField` como está. Se descarta: los 18 usos en 9 archivos heredan hoy el mismo defecto, y el alta de movimiento es sólo donde se nota más porque es el único host que pone algo **al lado** del campo. Un wrapper dejaría 17 casos rotos y crearía dos primitivos de fecha con presentaciones distintas — exactamente el tipo de divergencia que la Web↔Mobile policy y el layering de UI buscan evitar.

Que la API pública no cambie es lo que hace viable arreglarlo abajo: `value` / `onChange` / `placeholder` / `invalid` / `bare` / `open` / `onOpenChange` se mantienen, así que el diff toca un archivo de primitivo y un archivo de formulario, no diecinueve.

### 2. iOS: presentar dentro de `BottomSheet`, no en un `Modal` ad-hoc ni en posicionamiento absoluto

**Decisión**: el picker de iOS se presenta a través del `BottomSheet` existente, con una cabecera igual a la de `SelectSheet` (título + acción de cierre).

Alternativas consideradas:

- **`Modal` propio dentro de `DateField`**: funcionaría, pero duplicaría scrim, animación, insets y grabber que `BottomSheet` ya resuelve, y el campo de fecha quedaría visualmente distinto de los pickers de cuenta y categoría de la misma pantalla.
- **Posicionamiento absoluto sobre el host** (`position: absolute` + `zIndex`): saca al picker del flujo, pero en React Native queda recortado por el `overflow-hidden` de cualquier ancestro —y `GroupCard` lo tiene— y no cubre el caso de un campo cerca del borde inferior de la pantalla. Resuelve el síntoma horizontal y reintroduce otros.
- **`BottomSheet`** gana porque el precedente ya está tomado: `Popover` en mobile *es* un `BottomSheet`, y su spec (`overlay-primitives`) ya declara que "en mobile el contenido PUEDE presentarse como sheet (divergencia de placement permitida por la Web↔Mobile policy)". Presentar el calendario igual que los demás pickers no es una excepción nueva, es aplicar la convención que ya rige.

### 3. Android se queda con el diálogo nativo

**Decisión**: en Android no se envuelve nada; sigue `display="default"`.

El diálogo de fecha de Android ya es modal, ya se presenta fuera del árbol y ya tiene sus propias acciones de confirmar/descartar. Meterlo dentro de nuestro `BottomSheet` daría un modal dentro de otro modal sin ganar nada y rompería la convención de plataforma. La divergencia queda declarada en el spec como divergencia idiomática permitida, con un scenario por plataforma.

### 4. El commit del valor sigue siendo en vivo

**Decisión**: preservar el comportamiento actual — el spinner emite `onChange` mientras el usuario lo mueve, y la afordancia del sheet sólo cierra; no hay "Cancelar" que revierta.

La alternativa era semántica Cancelar / Listo, con commit únicamente al confirmar. Es defendible, pero es un **cambio de comportamiento**, no de presentación, y esta change se define como behavior-preserving salvo por dónde se dibuja el calendario. Meterlo acá mezclaría dos discusiones y haría más difícil atribuir una regresión. Queda como candidato a change propia.

Trade-off asumido: al cerrar tocando el scrim, el último valor scrolleado queda commiteado. Es exactamente lo que pasa hoy al cerrar el picker en flujo, así que no es una regresión — pero ahora el scrim tapa el trigger mientras se elige, así que el usuario ve el valor recién al cerrar.

### 5. El calendario de iOS sigue siendo el spinner

**Decisión**: mantener `display="spinner"`.

Dentro de un sheet hay espacio de sobra para `display="inline"` (la grilla de mes moderna de iOS), que además se parecería más al `DatePicker` de web, cuyo spec exige "un click abre el mes completo". Es tentador y probablemente sea la evolución correcta. Se deja afuera igual: cambiar la forma de elegir la fecha es una decisión de producto con su propia paridad web↔mobile que discutir, y esta change no debería necesitar una discusión de UX para mergearse. El spec que se escribe acá no fija spinner ni grilla, así que ese cambio futuro no requerirá modificar requirements — sólo agregar los que hagan falta.

## Risks / Trade-offs

- **`Modal` dentro de `Modal` en `EditDatesSheet`** → `EditDatesSheet` ya es un `BottomSheet` y contiene dos `DateField`, así que al abrir un picker habrá un `Modal` de RN sobre otro. RN lo soporta en ambas plataformas, pero es históricamente el punto frágil (animaciones que se pisan, scrim doble, el sheet padre que no recupera el foco). **Mitigación**: es el primer caso a verificar en simulador iOS, antes que el alta de movimiento. Si no se comporta, el fallback acotado es que `DateField` detecte que ya está dentro de un sheet —vía prop explícita del host— y en ese caso use el diálogo nativo también en iOS, en lugar de anidar.
- **Doble scrim visual** en ese mismo caso → aunque funcione, dos scrims apilados oscurecen de más. **Mitigación**: verificar y, si molesta, el fallback anterior lo resuelve de paso.
- **Regresión silenciosa en Android** al reestructurar el render condicional → el defecto es de iOS, pero el archivo que se toca es compartido. **Mitigación**: la verificación manual incluye Android explícitamente, no sólo iOS.
- **Sin red automatizada** → `apps/mobile` no tiene tests ni Storybook; `typecheck` y `lint` no ven layout. **Mitigación**: la checklist de verificación manual es parte de `tasks.md`, con los hosts concretos a recorrer, no una nota al pie.
- **El scrim tapa el trigger mientras se elige** (ver Decisión 4) → el usuario no ve la fecha actualizarse en vivo detrás del sheet. Se acepta: la cabecera del sheet puede mostrar el valor en curso si en la verificación se siente ciego.

## Migration Plan

No hay migración de datos, de schema ni de API: el cambio es de presentación y toca un primitivo local de `apps/mobile`.

1. Cambiar `DateField` (presentación en overlay para iOS, Android sin cambios funcionales).
2. Revertir en `MovementForm` los workarounds de `0aa0679` en la fila de fecha (`items-start` + los offsets `pt-1.5` / `pt-1`), que dejan de tener propósito.
3. Verificar en simulador, en este orden: `EditDatesSheet` (el caso anidado, el más riesgoso), el alta de movimiento (el defecto reportado), y un host simple (`settle` o `CreateCardForm`) — en iOS y en Android.
4. Rollback: revertir los dos archivos. No queda estado persistido de por medio.
