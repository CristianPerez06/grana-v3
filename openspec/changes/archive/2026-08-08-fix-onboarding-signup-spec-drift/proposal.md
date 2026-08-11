# Corregir el drift de las specs de signup y onboarding

## Why

Dos requirements describen un flujo que cambió por debajo de ellos. Ninguno quedó ambiguo: quedaron **confiadamente equivocados**, que es la forma más cara de desactualizarse, porque un lector nuevo no tiene señal de que esa parte no es de fiar.

**`onboarding` → "Bimoneda por defecto"** (la deuda 1 anotada por `split-project-conventions`):

- Nombra rutas que no existen: `/onboarding/perfil` y `/onboarding/saldo-actual`. El wizard real es `welcome` → `initial-balance` → `done`.
- Tiene un scenario, "Cuenta bancaria creada en onboarding tiene ambas monedas", que describe **un paso que no existe**: el wizard no crea ninguna cuenta. `initial-balance` lee la `Billetera` que creó el trigger de signup y actualiza su saldo. El bullet correspondiente ("toda cuenta creada en el wizard de onboarding") es igual de inexistente.
- Dice "según el modo". Los modos de usuario se eliminaron en la change archivada `2026-05-27-remove-user-modes`; no queda ninguna referencia en el código.
- Difiere el opt-out de USD a una "próxima change" de `settings`. No llegó: `settings` sólo tiene la preferencia "Mostrar centavos". Como forward-reference lleva meses siendo falsa.
- Afirma que "toda cuenta creada" lleva ARS y USD. Es más amplio que la garantía real: `accounts` dice que las cuentas que crea el usuario llevan "una o más" monedas. Las dos monedas son una garantía **del trigger de signup**.

**`accounts` → "Cuenta Efectivo por defecto en el signup"**: dice que el trigger crea una cuenta llamada `Efectivo`. La migración `0012_profiles_onboarding_and_default_account.sql` la renombró a `Billetera` —reemplazó la función del trigger y backfilleó las filas existentes— y `onboarding`, `auth`, `dashboard` y `transactions` ya la llaman así. `accounts` es la única que quedó atrás.

Los dos defectos son la misma especie —specs de alta de usuario que describen un flujo anterior— y por eso van juntos.

## What Changes

### `onboarding` — "Bimoneda por defecto"

- La ruta pasa a `/onboarding/initial-balance`, y el alcance a la `Billetera` en vez de "todas las cuentas relevantes".
- **Se elimina el scenario de creación de cuenta bancaria** y su bullet. En su lugar entra un scenario que afirma lo contrario y es verificable: el wizard NO crea cuentas, opera sobre la `Billetera` del trigger.
- Desaparece "según el modo".
- El opt-out de USD deja de ser "próxima change" y pasa a condicional ("si en el futuro `settings` agrega…"), con una nota de que hoy no existe. La regla de que sólo afecta presentación se conserva intacta.
- La garantía de bimoneda se acota explícitamente al trigger de signup, y se dice que las cuentas creadas después llevan las monedas que el usuario elija.

### `accounts` — "Cuenta Efectivo por defecto en el signup"

- El nombre pasa a `Billetera` en el enunciado y en los tres scenarios.
- Se agrega la traza de por qué: `0007` la creó como `Efectivo`, `0012` la renombró, y la verdad del schema son las migraciones **ordenadas**. Sin esa nota, alguien que abra `0007` vuelve a "corregir" la spec en la dirección equivocada.
- Se aclara que "Efectivo" como **tipo de cuenta** y como rótulo de sección en los listados es correcto y no tiene relación con este nombre.

El título del requirement de `accounts` **no se cambia**, aunque diga "Efectivo": renombrarlo sería un `REMOVED` + `ADDED` en el vocabulario de OpenSpec, con la ambigüedad de deprecación que eso arrastra, por un cambio puramente cosmético. Queda anotado como seguimiento.

Ninguna regla de comportamiento cambia. No es **BREAKING**: el código ya hace todo esto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `onboarding`: 1 `MODIFIED` — "Bimoneda por defecto".
- `accounts`: 1 `MODIFIED` — "Cuenta Efectivo por defecto en el signup".

## Impact

- **Código**: ninguno. Ambas specs describían mal un comportamiento que ya es correcto.
- **Datos**: ninguno. La migración del rename se aplicó hace meses.
- **Specs**: 2 capabilities, 1 `MODIFIED` cada una. Los conteos no cambian (`onboarding` 6, `accounts` 29).
- **Riesgo**: bajo. Todo lo que se afirma es verificable contra el filesystem, las migraciones y las changes archivadas.
- **Solapamiento con changes activas**: ninguna.
