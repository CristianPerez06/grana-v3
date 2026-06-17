## Why

El toggle "Hacer recurrente" del alta de movimiento explica *qué hace* ("Grana te va a pedir confirmar antes de registrarlo cada vez") pero no *para qué sirve* ni *cuándo conviene usarlo*. Para un usuario nuevo es una feature opcional y medio escondida: sin contexto, o no la usa o no entiende qué gana. La nota es texto gris chiquito que pasa desapercibido.

## What Changes

- **Nota del toggle** (web, siempre visible): comunica el propósito con ejemplos, para decidir antes de activar — "Para lo que pagás seguido: alquiler, suscripciones, el sueldo."
- **Hint contextual con color**: al activar el toggle, aparece un hint tintado (no gris perdido) que explica el mecanismo — Grana lo deja listo y lo registrás con un toque, sin que se cargue sin tu OK.
- El hint es ayuda contextual permanente mientras el toggle está activo — NO usa el sistema de guidance ni persistencia (no es un "se muestra una vez").

Sin cambios de lógica de recurrencia ni de datos. Solo copy + un bloque de UI en el form. Mobile fuera de alcance (el alta de movimiento nativa no existe aún).

## Capabilities

### Modified Capabilities
- `transactions`: el toggle de recurrencia del alta de movimiento ahora comunica su propósito (gastos fijos que se repiten solos) mediante una nota más clara y un hint contextual al activarlo.

## Impact

**Código**:
- `apps/web/lib/transactions/components/movement-form.tsx` → hint tintado bajo el toggle cuando `isRecurrent`

**i18n**:
- `packages/i18n-messages/src/es.json` y `en.json` → `transactions.drawer.repeat_note` (reescrita) + `transactions.drawer.repeat_hint` (nueva)
