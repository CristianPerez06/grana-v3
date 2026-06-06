## ADDED Requirements

### Requirement: Dialog modal de confirmación con scrim, foco y errores tipados

El sistema SHALL proveer un primitivo `Dialog` controlado (`open` + `onClose`) que renderee un panel modal sobre un scrim semitransparente. El Dialog SHALL distinguirse de `Drawer` en su posicionamiento: en viewports `≥ sm` el panel SHALL renderizarse centrado vertical y horizontalmente; en viewports `< sm` el panel SHALL renderizarse como sheet pegado al borde inferior, ocupando el ancho completo. El Dialog SHALL cerrarse al hacer click en el scrim y al presionar `Esc`, invocando `onClose` en ambos casos. Mientras está abierto, SHALL atrapar el foco dentro del panel y, al cerrarse, SHALL devolver el foco al elemento que lo abrió.

El Dialog SHALL componerse de sub-componentes coordinados:

- `<Dialog>`: contenedor controlado.
- `<DialogHeader>`: zona del título de la confirmación (no es chrome de página, no usa `PageHeader`).
- `<DialogBody>`: zona del cuerpo (texto descriptivo + slot para errores tipados que el caller renderiza inline).
- `<DialogFooter>`: zona de CTAs (botón secundario `Cancelar` + botón primario, opcionalmente con `variant="destructive"`).

El Dialog NO SHALL imponer variantes "alert" / "info" / "destructive" — la semántica destructive se expresa vía `<Button variant="destructive">` en el footer, lo cual mantiene el primitivo agnóstico de uso. El Dialog SHALL soportar un estado en el que su CTA primario quede en `loading` (disabled + indicador visual) sin cerrar el panel — el caller controla cuándo cerrar el Dialog en función del resultado del action.

#### Scenario: Abrir y cerrar el Dialog

- **WHEN** el host setea `open=true`
- **THEN** el scrim aparece y el panel se renderiza (centrado en `≥ sm`, sheet inferior en `< sm`)
- **WHEN** el usuario hace click en el scrim
- **THEN** el Dialog invoca `onClose`
- **WHEN** el usuario presiona `Esc`
- **THEN** el Dialog invoca `onClose`

#### Scenario: Foco gestionado

- **WHEN** el Dialog se abre
- **THEN** el foco entra al panel y queda atrapado dentro mientras está abierto
- **WHEN** el Dialog se cierra
- **THEN** el foco vuelve al elemento que lo abrió

#### Scenario: CTA destructive es responsabilidad del caller

- **WHEN** el caller compone `<DialogFooter><Button variant="destructive">Eliminar</Button></DialogFooter>`
- **THEN** el primitivo no agrega clases extra ni cambia el styling del panel
- **AND** el botón se renderiza con el styling destructive del componente `Button`

#### Scenario: Estado loading sin cerrar el Dialog

- **WHEN** el caller setea el CTA primario en `loading` mientras una action está en flight
- **THEN** el botón muestra spinner inline y queda disabled
- **AND** el Dialog NO se cierra automáticamente
- **WHEN** el caller pasa `open=false` después de un resultado exitoso
- **THEN** el Dialog se cierra

#### Scenario: Error tipado renderizado en el cuerpo

- **WHEN** el caller renderiza un slot de error dentro de `<DialogBody>` (por ejemplo, debajo del texto descriptivo) cuando la action devuelve `!ok`
- **THEN** el primitivo no oculta ese slot ni cierra el Dialog
- **AND** el panel permanece abierto hasta que el caller setee `open=false`

---

### Requirement: DropdownMenu anclado a un trigger con items navegables por teclado

El sistema SHALL proveer un primitivo `DropdownMenu` que renderee un conjunto de items en columna anclados a un elemento trigger. El menu SHALL ser controlado (`open` + `onOpenChange`) y SHALL implementar: posicionamiento debajo del ancla con flip si no entra, cierre por click afuera, cierre por `Esc`, y `role="menu"` semántico. La implementación interna puede apoyarse en Radix (`@radix-ui/react-dropdown-menu`) o equivalente — el contract es el comportamiento, no el engine.

El menu SHALL componerse de:

- `<DropdownMenu>`: contenedor controlado.
- `<DropdownMenuTrigger>`: botón disparador. Es agnóstico — recibe `asChild`/children para envolver cualquier botón existente (por ejemplo, un kebab `MoreVertical`).
- `<DropdownMenuContent>`: panel del menu (anclado al trigger).
- `<DropdownMenuItem>`: item del menu, renderizado como `<button role="menuitem">`.
- `<DropdownMenuItemDestructive>`: variante styling para acciones destructive (color `text-destructive`, sin afectar role ni keyboard semantics).
- `<DropdownMenuSeparator>`: separador visual entre grupos de items.

**Keyboard semantics.** Cuando el menu está abierto, las flechas `↑` y `↓` SHALL mover el foco roving entre items; `Enter` o `Space` SHALL invocar el `onClick` del item enfocado; `Esc` SHALL cerrar el menu. Items con `disabled` SHALL ser skippeados por la navegación con flechas y NO invocar `onClick`.

El menu NO SHALL soportar sub-menus en este primitivo (un solo nivel). Si emerge necesidad, se evalúa en un change separado.

#### Scenario: El menu se ancla al trigger con flip

- **WHEN** el usuario clickea el `DropdownMenuTrigger`
- **THEN** el `DropdownMenuContent` se renderiza anclado debajo del trigger
- **AND** si no hay espacio debajo, se reposiciona arriba (flip)
- **WHEN** el usuario hace click fuera del menu
- **THEN** el menu se cierra

#### Scenario: Navegación por teclado entre items

- **WHEN** el menu está abierto y el usuario presiona `↓`
- **THEN** el foco se mueve al siguiente item habilitado
- **WHEN** el usuario presiona `↑` desde el primer item
- **THEN** el foco no se mueve (no hay wrap-around opinado; aceptable como default)
- **WHEN** el usuario presiona `Enter` o `Space` sobre un item enfocado
- **THEN** el menu invoca el `onClick` del item
- **AND** el menu se cierra automáticamente después de invocar `onClick` (default)
- **WHEN** el usuario presiona `Esc`
- **THEN** el menu se cierra

#### Scenario: Items disabled no son navegables ni invocan onClick

- **WHEN** un `<DropdownMenuItem disabled>` está en el menu
- **THEN** la navegación con flechas lo skippea
- **AND** el click no invoca `onClick`

#### Scenario: Variante destructive cambia el styling sin cambiar la semántica

- **WHEN** un item se renderiza como `<DropdownMenuItemDestructive>`
- **THEN** su texto/ícono usan `text-destructive`
- **AND** sigue siendo `role="menuitem"` y participa de la navegación por teclado

#### Scenario: El trigger es agnóstico — envuelve cualquier botón

- **WHEN** el caller compone `<DropdownMenuTrigger asChild><button aria-label="Acciones"><MoreVertical/></button></DropdownMenuTrigger>`
- **THEN** el primitivo no agrega un botón propio
- **AND** el botón del caller recibe los handlers de apertura del menu
