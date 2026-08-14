## Objetivo

Cerrar el drift **visual** del alta de movimientos entre web-mobile y la app nativa, dejándolo documentado como requirement para que no vuelva a divergir. El comportamiento ya está a la par; esto es presentación. Fuente de verdad: el form web en viewport mobile (`apps/web/lib/transactions/components/movement-form.tsx`, rama `isMobile`). El nativo espeja esa estructura; no al revés.

## Decisiones

### D1 — El web-mobile es la fuente de verdad visual

El nativo replica la jerarquía del `hero` web (`movement-form.tsx`, ~L950–1015) y su agrupación de campos. Anclajes concretos que el nativo debe reproducir (traducidos a NativeWind/RN, no clases idénticas):

- **Hero de monto** — tarjeta con borde redondeado (`rounded-[18px] border`), fila superior con eyebrow **"MONTO"** a la izquierda y, a la derecha, **disparador de calculadora** + **chip de moneda** (`{currency} ▾`, `cycleCurrency` al tocar, deshabilitado si `currencyOptions.length < 2`). Debajo, el número **centrado** (`justify-center` en mobile): signo (`+`/`−`) grande, **glifo de moneda atenuado** (`opacity-50`), y `MoneyAmountInput` grande (`text-[34px]` en mobile) con `tabular-nums`.
- **La moneda es un chip inline en el hero, no un `Segmented` aparte.** El nativo hoy usa `Segmented` debajo del input; pasa a chip en la fila del monto, igual que web.
- **Campos secundarios en una sola tarjeta con divisores.** Categoría, cuenta, cuotas (si aplica) y fecha van dentro de **un** contenedor con borde, separados por divisores, en vez de tarjetas sueltas con `gap`.
- **Fecha**: disparador de calendario a la izquierda + chips **Hoy/Ayer** a la derecha, sin label.
- **Descripción**: una sola línea slim con ícono chico, sin label.
- **Cuotas**: fila borderless dentro de la tarjeta agrupada (no una tarjeta con borde propio).

La paridad se expresa como requirement **observable a nivel de estructura/rol** ("el monto se presenta como hero centrado", "los campos secundarios comparten un único contenedor"), **no** como aserciones de píxeles. Los tests siguen siendo de comportamiento; la fidelidad visual se valida por revisión.

### D2 — Calculadora nativa: hoja táctil, no popover

El spec `money-input-calculator` describe la calculadora en términos de web (`Popover`, portal al Drawer, teclado físico). En native no hay `Popover` ni teclado físico garantizado. Decisión:

- Nuevo componente nativo (p. ej. `MoneyCalculator` en `apps/mobile/components/ui/`) presentado como **hoja (bottom sheet)** con las primitivas de overlay ya usadas en el repo (las mismas de los `SelectSheet`/pickers nativos).
- Keypad táctil con `+ − × ÷`, paréntesis/clear, display de la expresión en curso y `=`. Manejado por **taps**; no depende de `Escape`/`Backspace`/`Enter` físicos.
- Reutiliza **`evaluateMoneyExpression`** de `@grana/validation` (ya compartida) — no se reimplementa aritmética.
- `=` llena el campo por el **mismo `onChange` de `MoneyAmountInput`**, idéntico al camino de tipear. El contrato canónico no cambia.
- Se habilita en los mismos campos primarios que web (alta/edición de monto y demás campos primarios listados en el spec), empezando por el alta de movimientos que es el foco de este change.

### D3 — Sin cambios en el hook ni en la data

Es presentación pura. `@grana/movement-form` no cambia: la moneda usa el `currencyOptions`/`cycleCurrency` que ya expone, la calculadora usa `onChange`, los chips de fecha usan los handlers existentes. Sin server actions, sin DB, sin reglas contables.

### D4 — Web intacto

En web, el hero y la agrupación ya existen **gateados por `isMobile`**; este change no los toca. El desktop no se toca. La única razón de mencionar `transactions`/web en los specs es dejar el requirement de paridad **compartido por las dos superficies mobile**, no reimplementar web.

### D5 — Alcance acotado al alta

El foco es el formulario de **alta** (create), que es la superficie de mayor fricción y donde vive el hero. La edición hereda la misma maqueta por compartir componente, pero no se agregan escenarios nuevos de edición. La colapsibilidad de cuenta con **muchas** cuentas (fila + selección seccionada) ya es comportamiento cubierto por `transactions`; si en native falta el equivalente visual, se ajusta como parte de la agrupación, sin nuevo requirement.

## Riesgos

- **Interacción sheet + keyboard avoidance en native.** Ya existe `2026-08-02-mobile-keyboard-avoidance`; la hoja de calculadora debe convivir con eso (abrir la calculadora no debe pelearse con el teclado del `MoneyAmountInput`). Mitigación: la calculadora reemplaza la entrada por teclado mientras está abierta (cierra el teclado del input al abrir).
- **Primitivas de overlay/animación en native.** Reusar las mismas primitivas que los pickers nativos existentes en vez de introducir dependencias nuevas.
- **Scope creep hacia otros campos primarios.** La calculadora se documenta para todos los campos primarios (paridad con web), pero la **implementación** de este change arranca por el alta de movimientos; el resto de los campos primarios nativos se listan como follow-up si no entran en la misma pasada.
- **Regresión visual en edición.** Al compartir componente, verificar que la maqueta agrupada no rompa los estados de edición (cuotas madre, reintegro read-only).
