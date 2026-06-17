# transactions Specification (Delta)

## ADDED Requirements

### Requirement: El toggle de recurrencia comunica su propósito

El toggle "Hacer recurrente" del alta de movimiento (web) SHALL comunicar para qué sirve, no solo su comportamiento, partiendo la información según el momento de la decisión:

- **Antes de activar** — la nota bajo el label (siempre visible) SHALL comunicar el propósito con ejemplos concretos, para que el usuario decida si le sirve sin tener que activarlo ("Para lo que pagás seguido: alquiler, suscripciones, el sueldo.").
- **Al activar** — el sistema SHALL mostrar un hint contextual **con color** (no texto gris tenue) que explique el mecanismo: cuando corresponde, Grana lo deja listo y el usuario lo registra con un toque, y nunca se registra sin su confirmación.

El hint SHALL ser ayuda contextual permanente mientras el toggle está activo (aparece al activar, desaparece al desactivar) y NO SHALL persistirse en `user_guidance_events` ni marcarse como visto.

Copy de referencia (canon español):
- Nota: "Para lo que pagás seguido: alquiler, suscripciones, el sueldo."
- Hint: "Cuando toca, Grana te lo deja listo y vos lo registrás con un toque. Nunca se carga solo sin tu OK."

#### Scenario: La nota visible comunica el propósito antes de activar

- **WHEN** el usuario ve el toggle "Hacer recurrente" sin activarlo
- **THEN** la nota bajo el label describe para qué sirve con ejemplos (alquiler / suscripciones / sueldo)

#### Scenario: Activar el toggle muestra el hint con el mecanismo

- **WHEN** el usuario activa el toggle "Hacer recurrente" en el alta de movimiento
- **THEN** aparece un hint contextual con tinte de color (no gris)
- **AND** el hint explica que Grana lo deja listo y el usuario lo registra con un toque, sin que se registre sin su confirmación

#### Scenario: Desactivar el toggle oculta el hint

- **WHEN** el usuario desactiva el toggle "Hacer recurrente"
- **THEN** el hint contextual desaparece
- **AND** no se persiste ningún registro de que el hint fue visto
