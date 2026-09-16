# Tareas

Ver `design.md` para el porqué de cada decisión y `specs/transactions/spec.md` para lo
que cada paso tiene que cumplir.

## 1. La decisión nueva, en un solo lugar

- [ ] 1.1 En `@grana/recurrences` (`review-surface.ts`), agregar la decisión de **regla trabada**: dos o más ocurrencias sin resolver **y** la más vieja ya vencida. Devolver, además del sí/no, la fecha de la más vieja y cuántas hay — el aviso las nombra y no se pueden recalcular en cada plataforma. Verificar con tests los cuatro bordes: una sola vencida (no), dos futuras (no), dos con la más vieja vencida (sí), veintisiete desde junio (sí, con fecha y conteo).
- [ ] 1.1b El conteo se expone como **lo que hay para revisar**, y la decisión lleva si queda reconstrucción pendiente, para que el aviso no dé un total que el sistema no tiene (la materialización corre por lotes de 50 con continuación). Verificar con un test que, con reconstrucción pendiente, el aviso no presenta el conteo como cerrado.
- [ ] 1.2 Verificar en negativo que «trabada» NO se decide sobre el bloque entero: tres reglas distintas con una vencida cada una no producen ningún aviso. Es el caso que el `design.md` usa para justificar que la propiedad es de la regla.
- [ ] 1.3 Verificar que el `status` de la regla no la exime: una regla pausada con dos vencidas también cuenta. El aviso describe vencimientos sin resolver, y ninguna condición de la regla los resuelve por su cuenta.

## 2. Que se vea, en las dos plataformas

- [ ] 2.1 Web — `pending-recurrences-block.tsx`: dibujar una línea por regla trabada en una tira al principio del bloque, con el nombre de la regla, su fecha y su conteo. La lista de vencimientos sigue plana: no se agrupa por regla, eso es otra entrega. Verificar con una regresión de render que con dos reglas trabadas hay dos líneas y ningún total, y que una regla con una sola vencida no produce ninguna.
- [ ] 2.2 Nativo — `PendingRecurrencesBlock.tsx`: el mismo aviso, en el mismo commit que 2.1. Verificar abriendo las dos superficies mobile (web a ancho de teléfono y la app nativa) y comprobando que dicen lo mismo. `apps/mobile` no tiene runner de tests: lo que lo sostiene es el modelo del punto 1, el typecheck y la QA del 4.2.
- [ ] 2.3 Claves de i18n del aviso en `es.json` y `en.json`. Verificar que no queda ninguna clave nueva sin su par en los dos catálogos.

## 3. Que «lo que viene» no se corte a fin de mes

- [ ] 3.1 En `upcoming-recurrences.tsx`, reemplazar el final de la segunda ventana: `hoy+30` en lugar de `fin de mes`. El comienzo sigue en `hoy+8` para que las dos tarjetas no repitan una ocurrencia. Verificar con una regresión que el 25 de septiembre una ocurrencia del 23 de octubre aparece en la segunda tarjeta — hoy no aparece en ninguna.
- [ ] 3.2 Verificar el borde superior con una regresión: el 25 de septiembre, una ocurrencia del 25 de octubre entra y una del 26 de octubre no.
- [ ] 3.3 Verificar que las dos ventanas siguen siendo disjuntas: ninguna ocurrencia aparece en las dos tarjetas.
- [ ] 3.4 Renombrar el rótulo de la segunda tarjeta a «Próximos 30 días» en los dos catálogos de i18n, y retirar la clave `later_this_month` si no la usa nadie más.

## 4. Cierre

- [ ] 4.1 `pnpm verify` en verde.
- [ ] 4.2 QA manual en las dos plataformas: acumular dos vencidas en una regla y ver el aviso con su fecha y su conteo; comprobar que una sola vencida no lo dispara. En web, además, comprobar la segunda tarjeta pasado el día 22 del mes, que es cuando hoy se vacía.
- [ ] 4.3 Archivar el change y aplicar el delta al spec maestro de `transactions`.
- [ ] 4.4 `pnpm openspec:check` en verde.
