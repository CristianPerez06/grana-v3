# Design: first-movement-tour

## D1 — Spotlight sin librería (box-shadow trick)

El overlay se renderiza vía portal en `document.body`, `position: fixed`,
cubriendo el viewport. El "agujero" iluminado es un div posicionado sobre el rect
del target con `box-shadow: 0 0 0 9999px rgba(11,26,43,0.55)` y `border-radius`.
Eso atenúa todo menos el target sin necesidad de `driver.js` ni dependencias nuevas.

**Por qué:** mínimo footprint, control total del estilo, coherente con el navy de
la marca. Alternativa descartada: agregar una librería de tours (peso + estilo
ajeno + mantenimiento).

## D2 — Anclas por `data-tour`, no refs encadenadas

Los targets (Monto, Cuenta, Categoría, Descripción, Guardar) se marcan con
`data-tour="<step>"` en los elementos existentes. El tour recibe un
`containerRef` del `<form>` y resuelve cada target con
`container.querySelector('[data-tour="..."]')`.

**Por qué:** el form compone los campos como variables (`hero`, `fieldGroup`,
`submitButton`) y luego los ensambla. Encadenar refs por todas esas variables sería
invasivo; un atributo declarativo en cada elemento es localizado y legible.

## D3 — Medición y scroll

Al entrar a cada paso: `target.scrollIntoView({ block: 'center' })` (el body del
drawer scrollea), luego se mide `getBoundingClientRect()` en el próximo frame.
Se re-mide ante `scroll` (capture) y `resize` para mantener el spotlight pegado.
El globo se posiciona debajo del target y se voltea arriba si no hay espacio,
clampeado al viewport.

## D4 — Pasos y persistencia

5 paradas: 4 numeradas (Monto, Cuenta, Categoría, Descripción) + 1 cierre sobre
Guardar (`finale`, sin contador, botón "¡A guardar!" que completa el tour).

Se omite a propósito el paso "Tipo": el usuario ya eligió Gasto/Ingreso por la
pestaña para estar en el form, así que explicarlo es redundante. En cambio se
incluye "Descripción" (campo opcional, debajo de la categoría, fácil de pasar por
alto) porque es la llave del autocategorizador: el matcheo de sugerencias es por
descripción exacta (`normalizeDescription`), así que sin descripción no hay
aprendizaje. El paso lo aclara para no generar falsa promesa.

El tour es **informativo/preview**: ningún paso exige que el campo esté lleno; el
usuario recorre y después carga. Esto evita validaciones a mitad de tour y calza
con el patrón de Mercado Pago.

Persistencia con un único guidance id `first_movement.tour` sobre la tabla
existente: completar → `completed_at`; omitir → `dismissed_at`. `useGuidance`
ya devuelve `isVisible` con esa lógica.

## D5 — Arranque y gating

Auto-start cuando: `showFirstMovementGuidance` (= sin movimientos) **y** drawer
**y** no-edit **y** `tab ∈ {expense, income}` **y** `isVisible` del tour. El tab por
defecto es `expense`, así que arranca solo en el alta nueva. Si el usuario cambia a
Transferencia/Ajuste/Cambio, el tour no aplica (esos flujos no tienen los mismos
campos) y se cierra.

## D6 — Reemplazo de los InlineGuide

Se quitan los 3 usos de `InlineGuide` (`.type`, `.account`, `.category`) del
formulario. El primitivo `InlineGuide` y su catálogo quedan en el repo (pueden
servir a futuros casos no-tour), pero ya no se usan en el primer movimiento.
