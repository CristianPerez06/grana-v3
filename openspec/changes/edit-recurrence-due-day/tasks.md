# Tareas

Cierra **#121**. Entrega chica y aislada: un campo, dos plataformas, sin migraciones.

## 1. El campo

- [ ] 1.1 Agregar el campo **día de vencimiento** al drawer de edición web, precargado con el `start_date`
      actual, y mandarlo en el `updateRecurrence` que el drawer ya arma.
- [ ] 1.2 Mismo campo en el formulario nativo, en el **mismo commit** — es la política de paridad, no una
      tarea de seguimiento. Usa el date field nativo que ya usan los otros formularios.
- [ ] 1.3 Etiqueta y ayuda en `es.json` y `en.json`. La etiqueta nombra el efecto ("día de vencimiento"),
      no la columna ("fecha de inicio"), que suena a un dato histórico que no se puede tocar.
- [ ] 1.4 La ayuda dice lo que el usuario no puede deducir: el cambio rige desde acá y lo que ya está por
      revisar conserva su fecha. Sin esa línea, una ocurrencia vieja en el día viejo parece un bug.

## 2. Que no se rompa lo que ya está

- [ ] 2.1 Regresión: cambiar el ancla de una regla mensual del 8 al 10 mueve la próxima fecha al 10 y
      **no** materializa nada anterior al cambio.
- [ ] 2.2 Regresión: una ocurrencia sin resolver del día viejo conserva su vencimiento después del cambio
      —el vencimiento es inmutable— y las siguientes salen en el día nuevo.
- [ ] 2.3 Regresión: la edición funciona con la regla **pausada**, y no la reactiva.
- [ ] 2.4 Verificar contra la base real (PGlite con el SQL de `0064` tal cual) que el trigger hace lo que
      el proposal afirma: versión nueva con `effective_from = greatest(hoy, start_date)`. Si el trigger no
      se comportara así, el campo no se expone hasta arreglarlo.

## 3. Cierre

- [ ] 3.1 QA manual en las dos plataformas, con el caso real del sueldo.
- [ ] 3.2 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile`, `pnpm build`.
- [ ] 3.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 3.4 `pnpm openspec:check` en verde.
