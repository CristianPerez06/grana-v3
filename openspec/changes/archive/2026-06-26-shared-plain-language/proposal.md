## Why

Un usuario real, usando la app, preguntó **qué era "cuenta corriente"**. Para alguien con background financiero es un ABC (un libro que corre entre dos partes — la columna vertebral del módulo, ver `docs/design/shared/decisiones-rediseno.md`). Para el usuario promedio, "cuenta corriente" = el tipo de cuenta del banco, o nada: una palabra vacía que no invita a tocar y no dice lo que la pantalla hace.

El problema no es el **modelo** (libro derivado por moneda, contraasiento, deuda en reloj de impacto — sólido, no se toca). El problema es que le pusimos a las **superficies visibles** el nombre técnico de lo que son por dentro. Y "cuenta corriente" era la punta del iceberg: abajo conviven *ecuación, partes, liquidaciones, contraasiento, importe, "a favor de"* — toda la pantalla habla en contador, justo donde un novato se ahoga al intentar responder su segunda pregunta ("¿por qué ese número?").

El objetivo del rediseño ya era *"cada cifra puede responder ¿de dónde sale?"*. Un usuario que no entiende los rótulos no puede responderla. Esto cierra esa brecha.

## What Changes

**Sólo copy / i18n. Cero lógica, cero modelo, cero infra.** Se barre la jerga contable de las superficies visibles de Compartido (hub + cuenta corriente + saldar), reemplazándola por lenguaje llano y consistente. La derivación interna, la ruta `/shared/cuenta-corriente` y el modelo de libro **no cambian** (son internos; renombrar la ruta sería churn sin upside).

Mapeo de términos (humano ← jerga):

| Jerga actual | Humano | Clave(s) i18n |
|---|---|---|
| Cuenta corriente (botón hub) | **Ver el detalle** | `dashboard.current_account_action` |
| Cuenta corriente (título) | **Las cuentas entre ustedes** | `cuenta_corriente.title` |
| De dónde sale el saldo… (subtítulo) | **Quién pagó qué y cómo queda el saldo. Nada se borra.** | `cuenta_corriente.subtitle` |
| A favor de {name} | **Le debés a {name}** | `in_favor_of` |
| A tu favor | **{name} te debe** | `owed_to_you` |
| Liquidaciones / liquidación | **Pagos entre ustedes / pago** | `filter_settlements`, `eq_reimb_settle`, `contra_hint`, `revert_confirm` |
| Contraasiento | **Anulación** | `state_contra` |
| Anulada por contraasiento | **Anulada** | `reversed_hint` |
| ecuación (ocultar/mostrar) | **desglose** | `equation_hide`, `equation_show` |
| Importe | **Monto** | `col_amount` |
| split 50·50 | **mitad y mitad** | `split_5050` |
| Partes de {name} en lo que pagaste vos | **Lo que pagaste por {name}** | `eq_other_shares` |
| Tus partes en lo que pagó {name} | **Lo que {name} pagó por vos** | `eq_your_shares` |
| Reintegros y liquidaciones | **Reintegros y pagos** | `eq_reimb_settle` |
| …queda en la cuenta corriente | **…queda con {name}** | `settle.after_remaining` |

**Se conservan a propósito (NO se tocan):** **reintegro / Reintegro** (término preciso que el usuario base ya maneja — pedido explícito), **Saldar deuda** ("saldar" es común y la acción es clara), los estados **Completada / Pendiente / Revertida**, y los rótulos ya legibles (Fecha, Movimiento, Qué cambia, Saldo).

**Consistencia "liquidación → pago":** el barrido debe ser completo en las ~5 claves que la usan; cambiar una y dejar otra deja dos palabras para lo mismo (peor que ahora).

## Capabilities

### Modified Capabilities
- `shared`: las superficies visibles usan **lenguaje llano sin jerga contable**; se ajustan los rótulos del dashboard (acceso "Ver el detalle"), de la cuenta corriente (título, subtítulo explicativo, dirección de deuda, "monto", "desglose", agregados en castellano natural) y el copy de saldar. El modelo y la ruta no cambian.

## Impact

- **`packages/i18n-messages/src/es.json`** — ~15 claves bajo `shared.dashboard`, `shared.cuenta_corriente` y `shared.settle` (mapeo de arriba).
- **`packages/i18n-messages/src/en.json`** — espejar las mismas claves.
- **`apps/web/.../shared/cuenta-corriente/_components/current-account-view.tsx`** — **no cambia** (lee las claves; el render es agnóstico al texto). Verificar que ninguna cadena esté hardcodeada fuera de i18n.
- **Mobile / capa compartida (tech lead):** chequear que la card nativa no **hardcodee** estos labels; si los toma de i18n, hereda el cambio. No tocar `apps/mobile`.
- **`openspec/specs/shared/spec.md`** — modificar el requirement de dashboard (rótulo de acceso) y el de cuenta corriente (rótulos en lenguaje llano); agregar el principio "lenguaje llano sin jerga contable".
