## 1. Calendario de seis semanas fijas

- [x] 1.1 Confirmar que la versión instalada de `react-day-picker` (`^10.0.1` en `apps/web/package.json`) mantiene la opción `fixedWeeks` y que funciona junto con `showOutsideDays`. Verificación: la prop existe en los tipos del paquete instalado tras `pnpm install`. Si no existe, frenar y avisar antes de buscar otra vía.
- [x] 1.2 Activar `fixedWeeks` en el `DayPicker` de `apps/web/components/ui/date-picker.tsx`. Verificación: `pnpm typecheck` y `pnpm lint` pasan.
- [x] 1.3 Agregar una story en `apps/web/components/ui/date-picker.stories.tsx` que abra en un mes de cuatro o cinco semanas (por ejemplo, febrero de 2027), para revisar a ojo la sexta fila. Verificación: la story renderiza en Storybook.
- [x] 1.4 Quitar al panel del calendario el tope de 60% del alto de pantalla que el `Popover` aplica para listas largas, y dejar como único límite el espacio libre real. Así las seis semanas no generan scroll si entran. Verificación: `pnpm typecheck` y `pnpm lint` pasan, y se revisa a mano en la 2.1.

## 2. Verificación

- [x] 2.1 Verificar a mano en la web, en computadora y con pantalla de celular: abrir el selector en el alta de movimiento y pasar con las flechas entre meses de distinta cantidad de semanas, ida y vuelta, incluido el caso en que el calendario abre hacia arriba del campo. El calendario no cambia de alto, no se mueve, las flechas no se corren y no aparece barra de scroll cuando hay espacio.
- [x] 2.2 Correr `pnpm verify` y confirmar que pasa.
