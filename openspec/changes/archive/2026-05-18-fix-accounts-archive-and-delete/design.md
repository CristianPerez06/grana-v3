## Context

El módulo `accounts` se construyó antes de que existiera `transactions`. En ese momento la regla de "no archivar con saldo distinto de cero" parecía razonable: la cuenta no tenía historial todavía, y mantener "saldo cero" como condición era simple. Cuando se agregó `transactions`, esa regla quedó obsoleta porque pasó a haber dos conceptos distintos: **saldo derivado** (cambia con cada transacción) y **historial** (existencia de filas en `transactions`). La intención funcional original — "archivar sirve para preservar historial" — nunca llegó al código.

Análogamente, `deleteAccount` se escribió como `DELETE` físico sin guard, asumiendo (vía comentario en el código) que se agregaría una validación cuando llegara `transactions`. No se agregó.

Este change cierra esos dos gaps con la mínima cantidad de código, sin tocar DB.

## Goals / Non-Goals

**Goals:**

- Alinear el comportamiento de `archiveAccount` y `deleteAccount` con la intención funcional del spec.
- Hacer que la UI guíe naturalmente al usuario al botón correcto (Archivar vs Eliminar) según el estado de la cuenta.
- No introducir migración nueva.

**Non-Goals:**

- Soft delete general — el delete físico sigue siendo válido para el caso "cuenta sin transacciones".
- Recuperar cuentas borradas — no hay undo.
- Refactor del componente de detalle más allá de lo necesario para mostrar el botón correcto.

## Decisions

### §1 · El guard de "tiene transacciones" se calcula en la action, no en DB

La validación que bloquea `deleteAccount` cuando hay historial vive en la server action mediante un `SELECT COUNT(*)`. Alternativa rechazada: cambiar la FK `transactions.account_id` a `ON DELETE RESTRICT` y dejar que la DB rechace. Eso es más estricto pero da un error de DB poco amigable; la action puede dar un mensaje claro y permitir que la UI redirija al usuario a archivar.

**Trade-off:** una llamada concurrente que crea una transacción justo después del COUNT pero antes del DELETE podría llevar al delete con cascade. Es una race condition real pero extremadamente improbable en single-user contexts. Si se vuelve un problema, se puede pasar a `ON DELETE RESTRICT` luego.

### §2 · La UI muestra un único botón según el estado

En lugar de mostrar "Eliminar" + "Archivar" y deshabilitar el inadecuado, se muestra **uno solo**: "Eliminar" cuando `transactions.count === 0`, "Archivar" en caso contrario. Esto evita la pregunta del usuario "¿cuál uso?".

**Por qué no usar enabled/disabled:** Un botón deshabilitado siempre genera la duda "¿por qué no puedo?". Mostrar solo el botón aplicable elimina esa fricción.

### §3 · El conteo de transacciones se hace en la página de detalle

La página `accounts/[id]/page.tsx` ya hace varias queries (cuenta + transacciones). Agregamos un COUNT a esas queries (o lo derivamos del `transactions.length`) y se lo pasamos al header. No requiere round-trip extra.

### §4 · No se renombra ni reorganizan las actions

`archiveAccount`, `reactivateAccount`, `deleteAccount`, `addCurrencyToAccount`, `deactivateCurrencyFromAccount` mantienen nombres y signatures. Solo cambia el cuerpo de `archiveAccount` y `deleteAccount`.

## Risks / Trade-offs

**[Riesgo bajo] Race condition en delete.**
Descripta en §1. Mitigación: aceptable en MVP single-user; revisitar si se vuelve multi-device.

**[Trade-off] El usuario pierde la opción de "borrar todo con cascade".**
Antes podías borrar una cuenta de prueba con cosas adentro. Ahora tenés que ir y borrar las transacciones primero o archivar. Es deliberado — el flow esperado para deshacerse de una cuenta con historial es archivar, no eliminar.

**[Riesgo bajo] Cuentas con `initial_balance ≠ 0` archivadas pre-cambio.**
No hay tales cuentas en producción porque el código bloqueaba justamente ese caso. El cambio no afecta cuentas archivadas existentes.

## Migration Plan

1. Editar `archiveAccount` y `deleteAccount` en `apps/web/app/_actions/accounts.ts`.
2. Editar la página y el header del detalle para mostrar el botón apropiado.
3. Agregar i18n strings de error.
4. Remover las dos notas en `openspec/specs/accounts/spec.md`.
5. Correr `pnpm build`.
6. Test manual: crear una cuenta nueva sin transacciones → confirmar que aparece "Eliminar" y funciona; crear una transacción en otra cuenta existente → confirmar que aparece "Archivar" y funciona; intentar eliminar la segunda → verificar que se rechaza.

**Rollback:** revertir el commit. No hay cambios de DB.
