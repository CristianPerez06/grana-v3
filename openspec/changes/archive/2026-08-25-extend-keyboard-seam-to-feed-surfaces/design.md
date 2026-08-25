## Context

El seam de teclado del app shell se construyó en `2026-08-02-mobile-keyboard-avoidance` alrededor de dos puntos de entrada: `FormScreen` (pantalla pusheada) y `FormSheetBody` / `FormSheetKeyboardView` (overlay). Ambos componen internamente `KeyboardAwareScrollView` + `KEYBOARD_BOTTOM_OFFSET` desde `apps/mobile/components/layout/keyboard-aware-scroll-view.ts`, el módulo que registra el componente en NativeWind vía `cssInterop`.

Ese diseño asumió que toda superficie con inputs es una pantalla de formulario o un overlay. Dos superficies rompen el supuesto:

- `app/(app)/transactions/index.tsx:127` — feed de movimientos, tab root, hospeda `PendingReimbursementsBlock`, que al expandirse muestra `MoneyAmountInput` + `DateField` a media altura del scroller, con el botón de confirmar inmediatamente debajo.
- `app/(app)/accounts/[id]/index.tsx:72` — detalle de cuenta, hospeda el buscador inline `autoFocus` de `MovementsSection`, con la `X` de limpiar y los chips de filtro alrededor.

Un barrido de las 20 pantallas de `apps/mobile` con `ScrollView` crudo, cruzado con los componentes que hospedan, deja exactamente estos dos casos: los otros tres candidatos (`cards/[id]/periods/[periodId]` → `EditDatesSheet`, `transactions/recurring/[id]` → `RecurrenceEditForm`, `home/settings` → `Drawer`) ya entran por un overlay.

El escape hatch que necesitan estas dos pantallas ya está documentado en `AGENTS.md` ("Mobile form surfaces — never compose the chrome by hand", cuarto bullet) y ya está en uso en `app/(app)/home/index.tsx` y `app/(onboarding)/initial-balance.tsx`. Lo que falta es cerrarlo en el spec, que es donde una sesión fresca lo va a buscar.

## Goals / Non-Goals

**Goals:**

- Que el requirement de teclado deje de enumerar familias cerradas y quede anclado a la presencia de un campo, no a la naturaleza de la pantalla.
- Que el spec nombre el consumo directo del scroller compartido como vía válida del seam, con su condición de uso y su trampa (el import directo de la librería).
- Cubrir las dos superficies afectadas sin regresionar `RefreshControl`, padding ni el `pb-28` que el feed reserva para el tab bar.

**Non-Goals:**

- Rediseñar el seam o agregar un tercer shell. No hay componente nuevo.
- Tocar `PendingReimbursementsBlock` o `MovementsSection`: el contenedor scrolleable es responsabilidad de quien lo hospeda, no del bloque hospedado.
- Cerrar los `Drawer` de `app/(app)/home/settings.tsx`, que pasan un `View` pelado en vez de `FormSheetBody`. Es la misma clase de deriva pero sin síntoma (campos arriba de un panel full-height, sin `ScrollView` que coma taps) y su follow-up, ya anotado en `components/ui/Drawer.tsx`, necesita primero un `SafeAreaView` en el panel para poder alinear los flags de edge-to-edge.
- Automatizar la detección. Ver Decisions.

## Decisions

### Reemplazar el `ScrollView` de la pantalla, no envolver el bloque hospedado

La alternativa era darle a `PendingReimbursementsBlock` su propio contenedor consciente del teclado. Se descarta: anidar un scroller dentro de otro rompe el scroll del feed, y el problema no es del bloque — es del scroller que lo contiene. Un segundo bloque con inputs en la misma pantalla volvería a fallar. El fix en el hospedador cubre cualquier input que crezca adentro, presente o futuro.

### Consumir `KeyboardAwareScrollView` directo en vez de migrar a `FormScreen`

Ninguna de las dos pantallas puede adoptar `FormScreen`: el detalle de cuenta necesita `RefreshControl` y ambas componen su propio `PageHeader` con acciones (el ícono de recurrencias, el de editar). Forzar el shell exigiría agregarle props de escape (`refreshControl`, `headerActions`, `contentClassName`) hasta desdibujar lo que el shell significa. La cuarta viñeta de `AGENTS.md` ya prevé exactamente esto, y `home/index.tsx` es el precedente en el repo.

### Enumeración abierta en vez de una cuarta familia cerrada

Agregar "feed/detalle" como cuarta viñeta y dejar la lista cerrada repetiría el error: la quinta forma de superficie que aparezca vuelve a nacer fuera. El delta invierte la lectura — la lista pasa a ser descriptiva y lo normativo es la primera frase ("toda superficie que contenga al menos un campo de texto"). La viñeta nueva se agrega igual, como ejemplo, para que el caso quede nombrado.

### Sin regla de lint que lo detecte

Se consideró una regla ESLint que prohíba `ScrollView` de `react-native` en `apps/mobile`. Se descarta por ahora: hay ~18 pantallas legítimas sin inputs que la violarían, y la señal que haría falta (¿este subárbol contiene un `TextInput`?) es transitiva a través de componentes, fuera del alcance de una regla sintáctica. El costo de los falsos positivos supera el beneficio. La defensa queda en el spec + `AGENTS.md`, que es donde ya estaba funcionando para las otras tres familias.

### `keyboardShouldPersistTaps` se explicita para no-formularios

El requirement ya lo exige para "toda superficie scrolleable con inputs" — las dos pantallas están en incumplimiento directo, sin delta necesario. El delta agrega igual una frase que nombra los controles que pagan el tap perdido fuera de un formulario (confirmar, limpiar búsqueda, chips), porque el enunciado actual lista solo controles de formulario y se lee como acotado a ellos.

## Risks / Trade-offs

- **El offset se ve corto y se "arregla" bajando `KEYBOARD_BOTTOM_OFFSET`** → la constante ya incluye los 42px del `KeyboardToolbar` justamente por eso, y el delta lo sube a norma. Si el campo queda tapado, el sospechoso es el offset local, nunca la constante compartida.
- **El cambio de scroller pierde el padding en silencio** → es el modo de falla exacto que `cssInterop` previene y que TypeScript no ve. Mitigación: importar siempre de `components/layout/keyboard-aware-scroll-view`, nunca de la librería; el delta lo hace normativo. Verificación visual en el paso de QA.
- **`RefreshControl` se comporta distinto en el scroller nuevo** → `KeyboardAwareScrollView` extiende `ScrollView` y acepta la prop igual. Se verifica explícitamente en el checklist del detalle de cuenta.
- **Interacción con el tab bar en el feed** → el tab bar se oculta con el teclado abierto (requirement propio del app shell) y el `pb-28` del contenedor sigue siendo el reservado para cuando está visible. No se toca; se verifica que no aparezca hueco al cerrar el teclado.
- **Nada de esto se valida en CI** → la verificación es manual sobre un development build (`KeyboardProvider` y `KeyboardToolbar` no corren en Expo Go). `pnpm typecheck` y `pnpm lint` cubren solo la parte mecánica.
