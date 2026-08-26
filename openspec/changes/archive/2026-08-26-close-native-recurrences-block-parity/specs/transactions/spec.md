## MODIFIED Requirements

### Requirement: La app nativa muestra los pendientes recurrentes y la sugerencia en el feed

El feed de Movimientos nativo SHALL mostrar un **bloque de instancias recurrentes pendientes**, separado del historial, como thin consumer de `@grana/recurrences`. Por cada instancia pendiente el bloque SHALL ofrecer **Confirmar** y **Omitir**. Confirmar SHALL invocar `confirmRecurrenceInstance` (materializa el movimiento real vía los thin creates compartidos), invalidando el feed y el hub; Omitir SHALL invocar `skipRecurrenceInstance`. En esta slice, confirmar SHALL usar el **snapshot** de la instancia (sin edición inline de monto/fecha/descripción). Las instancias **compartidas** SHALL mostrarse con su badge y, al confirmarse, crear el gasto compartido con su split (paridad con `shared-recurrences`). El **warning de saldo negativo** al confirmar queda **diferido** (nicety read-only que requiere el read de saldos por cuenta); su ausencia no bloquea el confirmar.

**Presentación.** El bloque SHALL componer el `Card` del design system nativo y SHALL exponer un header accionable con badge dorado + ícono `Clock`, título (`recurrences.pending.title`), subtítulo (`…pending.subtitle`), pill con el conteo de pendientes (`…pending.count`, oculta cuando la lista está vacía) y un chevron que indica el estado. El acento SHALL ser **dorado** (algo que vence), distinto del slate informacional del bloque de reintegros, y SHALL expresarse con los tokens de `@grana/ui-tokens` (`warning`, `warning-bg`) — NO SHALL copiarse el hex literal que la implementación web escribe inline. El halo de 4px de web SHALL traducirse a un anillo de layout alrededor de la card, porque las sombras de RN no tienen `spread`; ese anillo SHALL ser lo que carga el acento, sin pisar desde `className` el borde ni el radio propios del primitivo `Card`.

El header SHALL colapsar y expandir el cuerpo del bloque. El estado inicial SHALL derivarse de la cantidad de pendientes —**abierto** con una o ninguna, **colapsado** con dos o más, paridad con web— y, una vez que el usuario toca el header, su elección SHALL mandar. Como en nativo la lista llega por `useQuery` y no por prop, ese default SHALL derivarse del estado de los datos en cada render mientras no haya elección del usuario; NO SHALL sincronizarse con un efecto, que pisaría la elección del usuario en cada refetch.

**Feedback después de actuar.** Confirmar u omitir con éxito SHALL dejar un **aviso de éxito persistente y descartable** dentro del bloque (`…pending.confirmed_success` / `…pending.skipped_success`, con acción de cierre etiquetada `…pending.close_notice`). El aviso NO SHALL autodescartarse por temporizador: es lo único que explica por qué la lista se vació, así que no puede irse antes de que el usuario lo mire. El aviso SHALL vivir en el **bloque** y no en la fila, porque un aviso montado en la fila se desmontaría con ella justo cuando la lista se vacía.

El bloque SHALL renderizar **nada** cuando no hay instancias pendientes **y el usuario no actuó sobre ninguna en esta sesión**: entrar sin pendientes no ocupa espacio ni muestra un empty-state en el feed (mismo comportamiento que el bloque web). Mientras el aviso de éxito esté vivo el bloque SHALL seguir montado aunque la lista quede vacía, y en ese caso el cuerpo SHALL mostrar la fila "todo al día" (`…pending.all_clear`). Vaciar la lista actuando NO SHALL desmontar el bloque en silencio. El aviso SHALL ser la condición de montaje del caso vacío —un único estado, no dos que puedan desincronizarse—, de modo que cerrarlo con la lista ya vacía SHALL desmontar el bloque.

Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages` (`recurrences.pending.*`).

El feed SHALL mostrar además un **banner de sugerencia de recurrencia** cuando `getTopRecurrenceSuggestion` detecta un patrón repetido, con **Aceptar** (crea la regla vía `acceptRecurrenceSuggestion`) y **Descartar** (`dismissRecurrenceSuggestion`, idempotente por fingerprint). El banner SHALL ofrecer un deep-link a la regla.

La afordancia de navegación al **hub de recurrencias** SHALL vivir en el `PageHeader` de la pantalla de Movimientos, y NO SHALL duplicarse dentro del bloque de pendientes ni del banner — paridad con web, cuyo bloque tampoco linkea al hub.

#### Scenario: Confirmar una instancia pendiente desde el feed

- **WHEN** el usuario toca Confirmar en una instancia recurrente pendiente
- **THEN** se crea el movimiento real (vía `confirmRecurrenceInstance`), la instancia queda confirmada, y el feed + el hub se invalidan
- **AND** confirmar usa el snapshot de la instancia (sin edición inline en esta slice)

#### Scenario: Omitir una instancia pendiente

- **WHEN** el usuario toca Omitir en una instancia pendiente
- **THEN** la instancia queda `skipped` (sin crear movimiento) y la regla avanza su cursor para no re-proponer esa fecha

#### Scenario: El bloque se presenta como card con header colapsable

- **WHEN** el usuario ve el bloque de pendientes recurrentes en el feed
- **THEN** el bloque es una card del design system con header de badge dorado + `Clock`, título, subtítulo, pill de count y chevron
- **AND** el acento dorado sale de los tokens (`warning`, `warning-bg`) y se dibuja como anillo alrededor de la card, sin pisar el borde ni el radio del `Card`
- **AND** tocar el header colapsa o expande el cuerpo
- **AND** con una sola pendiente el bloque abre expandido, y con dos o más abre colapsado, hasta que el usuario elige lo contrario

#### Scenario: La elección de colapso sobrevive un refetch

- **WHEN** el usuario expande el bloque teniendo dos o más pendientes, sale de la pestaña Movimientos y vuelve (disparando un refetch on-focus)
- **THEN** el bloque sigue expandido: la elección del usuario manda sobre el default derivado

#### Scenario: Actuar deja un aviso de éxito descartable

- **WHEN** el usuario confirma u omite una instancia con éxito y todavía quedan otras pendientes
- **THEN** el bloque muestra un aviso con la copy de la acción (`confirmed_success` u `skipped_success`) y un control de cierre
- **AND** el aviso sigue visible hasta que el usuario lo cierra o vuelve a actuar, sin autodescartarse por temporizador

#### Scenario: Vaciar la lista actuando muestra "todo al día"

- **WHEN** el usuario confirma (u omite) la última instancia pendiente
- **THEN** el bloque NO se desmonta: sigue en pantalla con su header y su aviso de éxito
- **AND** el cuerpo muestra la fila "todo al día" en vez de la lista, y la pill de count desaparece
- **AND** cerrar el aviso desmonta el bloque

#### Scenario: Sin instancias pendientes el bloque no se renderiza

- **WHEN** el usuario abre la pestaña Movimientos sin instancias recurrentes pendientes y sin haber actuado sobre ninguna en esta sesión
- **THEN** el bloque de pendientes recurrentes no se renderiza (no ocupa espacio ni muestra un empty-state en el feed)

#### Scenario: Aceptar o descartar una sugerencia

- **WHEN** el feed muestra un banner de sugerencia de recurrencia
- **THEN** Aceptar crea la regla (`acceptRecurrenceSuggestion`) y ofrece ir a ella; Descartar la oculta de forma idempotente (`dismissRecurrenceSuggestion`)

#### Scenario: El acceso al hub vive en el header de la pantalla

- **WHEN** el usuario está en la pestaña Movimientos
- **THEN** la afordancia para ir al hub de recurrencias está en el `PageHeader` de la pantalla
- **AND** ni el bloque de pendientes ni el banner de sugerencia la duplican

#### Scenario: Una instancia compartida se confirma como gasto compartido

- **WHEN** el usuario confirma una instancia recurrente **compartida** (con hogar + split)
- **THEN** se crea un gasto compartido con el split heredado de la regla
- **AND** la instancia se muestra con su badge de compartida en el bloque de pendientes
