## Context

`reverseCardPayment` se implementó como parte del módulo `cards` original (commit `dace5b4`). El action arma un flujo atómico: revierte el `status` de las cuotas a `pending`, borra el `period_payment`, borra el `expense`. El componente `ReversePaymentDialog` se creó para invocarlo desde el detalle del resumen pagado.

En algún momento durante o después del desarrollo se tomó una decisión de UX que no llegó a quedar registrada en specs: los pagos no son reversibles; si el usuario se equivoca, agrega un `adjustment` en la cuenta cash/bank. Esa decisión se ve hoy únicamente en el copy del formulario de pago (`pay-card-period-form.tsx:192-194`). El dialog nunca llegó a importarse desde una page.

Resultado: 3 artefactos divergentes (spec que pide la operación, action implementado, copy que la prohíbe), código muerto, e inconsistencia entre la promesa del spec y la realidad funcional.

## Goals / Non-Goals

**Goals:**
- Eliminar el código muerto (action + componente).
- Reflejar en el spec la decisión real: pagos irreversibles, errores se corrigen vía adjustment.
- Dejar el rastro de la decisión en el spec (REMOVED con Reason y Migration) para que una sesión futura entienda *por qué* no está, y no intente re-implementarla.

**Non-Goals:**
- Implementar una nueva UX de "corregir pago con adjustment" — el adjustment ya existe como operación independiente y el copy actual ya guía al usuario hacia ella.
- Refactorear el resto del flujo de pago.
- Cambiar el comportamiento del action `payCardPeriod` o sus invariantes.

## Decisions

**Decisión 1: Remover el action junto con el componente, no solo el componente.**
La alternativa sería mantener el action por si en el futuro se decide habilitar la feature. Se descarta porque:
- Un action sin caller es una promesa rota — invita a futuros desarrolladores (humanos o LLMs) a "completar" la feature wireando el dialog.
- Si la decisión cambia, el código se puede recuperar de git history (commit `dace5b4`).
- El principio del V3 Rebuild Standard ("the repo is the memory") favorece estados coherentes sobre estados que preservan código "por si acaso".

**Decisión 2: Marcar el requirement como REMOVED con Migration explícita.**
El delta del spec usa `## REMOVED Requirements` con `**Reason**` (decisión de UX) y `**Migration**` (usar adjustment). Esto deja registro de *por qué* la feature no existe — clave para que el cuerpo del spec sea narrativo y consistente.

**Decisión 3: Limpiar también el scenario residual en `cards/spec.md`.**
Existe un scenario en cards/spec.md ("Revertir un pago muestra nuevamente el período con deuda") que asume que la reversión existe. Aunque ese scenario está en un requirement sobre priorización de período activo (no sobre reversión per se), describir la reversión como flujo válido contradice la nueva decisión. Se reformula el requirement removiendo ese scenario.

## Risks / Trade-offs

- **Risk**: Si el negocio cambia de opinión y la reversión vuelve a ser deseable, hay que re-implementar action + componente + wirear. → **Mitigation**: el código vive en git history (commit `dace5b4`), recuperable con `git show`. El spec REMOVED señala que la feature existió y por qué se fue.
- **Trade-off**: La columna `period_payments` ya no necesita en principio el rastro del pago para revertir, pero igual la mantenemos como FK al expense — soporta consultas históricas y se usa para detectar "es un pago de tarjeta" en queries. No se cambia ese diseño.
