## 1. Lógica pura compartida (`@grana/dashboard`)

- [ ] 1.1 Reescribir `formatTodayLine` para que resuelva los dos estados de la línea: fecha de hoy completa parado en el mes corriente, `Mes Año` parado en cualquier otro. Reemplaza la opción `shortMonth`, que se elimina.
- [ ] 1.2 Exponer la cadena de degradación como datos: la función devuelve las variantes en orden de preferencia (completa → sin día de la semana), para que cada plataforma elija la primera que entra. Sin medir texto dentro de la función.
- [ ] 1.3 Agregar `reachableMonths(todayISO)` — el mes corriente más los 12 anteriores, agrupados por año, con cada mes marcado como alcanzable o no. Es la fuente única del rango para las dos hojas.
- [ ] 1.4 Tests de 1.1–1.3, incluido el peor caso de la línea (día de la semana más largo + mes más largo + día de dos cifras) y los bordes del rango: el mes 12 hacia atrás entra, el 13 no, ningún mes futuro entra.
- [ ] 1.5 Borrar de los tests y del README lo que quede referido a `shortMonth`.

## 2. Contrato de la hoja (`@grana/ui-contracts`)

- [ ] 2.1 Definir `MonthSheetProps` (mes seleccionado, meses alcanzables, `onSelect`, `onDismiss`, estado abierto) y exportarlo.
- [ ] 2.2 Documentar en el README del package que la hoja tiene dos implementaciones y un solo contrato, como el resto de los primitivos.

## 3. Copy (`@grana/i18n-messages`)

- [ ] 3.1 Agregar en `es.json` **y** `en.json` las claves nuevas: acción "Volver a hoy", título de la hoja, y el pie que nombra el desfasaje de Compromisos.
- [ ] 3.2 Verificar que no queda ninguna clave usada por una plataforma y ausente en la otra.

## 4. Hoja de meses — web

- [ ] 4.1 Implementar la hoja en `apps/web/app/(app)/dashboard/_components/`, presentada como bottom sheet debajo de `md` según el spec `web-app-shell`.
- [ ] 4.2 Grilla por año con los meses no alcanzables **visibles y deshabilitados**, y el mes seleccionado marcado de forma distinguible.
- [ ] 4.3 Pie con el desfasaje de Compromisos.
- [ ] 4.4 Cierre por scrim y por `Escape` sin cambiar la selección, y devolución del foco a la línea de la fecha.

## 5. Hoja de meses — nativo

- [ ] 5.1 Implementar el espejo en `apps/mobile/components/dashboard/`, consumiendo el mismo `MonthSheetProps`.
- [ ] 5.2 Seguir las reglas de `mobile-app-shell` para superficies con `Modal`: **el scrim va como hermano detrás del panel, no como ancestro** (referencia: `MovementFiltersSheet`), y la región scrolleable lleva su propio tope de alto en píxeles.
- [ ] 5.3 Paridad de comportamiento con 4.2–4.4: deshabilitados visibles, marcado del seleccionado, descarte sin cambios, foco de vuelta.

## 6. La línea de la fecha como lente

- [ ] 6.1 Web: convertir la línea en un control activable con caret permanente, área táctil ≥44px y foco accesible, que abre la hoja. Sacar `MonthNavigator` y `EyeMaskToggle` del header.
- [ ] 6.2 Nativo: el mismo cambio en `DashboardHeader.tsx`, con `hitSlop` en lugar del `::after` de web (divergencia de plataforma permitida, con comentario).
- [ ] 6.3 Implementar la elección de variante por medición en cada plataforma, cayendo al truncado con elipsis como piso.
- [ ] 6.4 Renderizar "Volver a hoy" junto a la línea solo fuera del mes corriente, y que devuelva la selección al mes corriente.
- [ ] 6.5 Verificar que la línea queda habilitada desde el primer paint, sin depender de la query del nombre del perfil.

## 7. Mudanza del eye toggle

- [ ] 7.1 Montar el `EyeMaskToggle` dentro de la card de saldo en web, leyendo del mismo provider.
- [ ] 7.2 Idem en nativo, en `BalanceCard.tsx`.
- [ ] 7.3 Quitar la dependencia del estado de carga del perfil que el toggle arrastraba por vivir en el header.
- [ ] 7.4 Confirmar que el enmascarado sigue cubriendo todo lo que el requirement enumera, en las dos plataformas.

## 8. Verificación en dispositivos — NO delegable a CI

- [ ] 8.1 **Mobile-web**: abrir el dashboard a 320, 360, 375, 390 y 430px y confirmar que la línea entra en un renglón en los siete días de la semana, con especial atención a miércoles y domingo.
- [ ] 8.2 **App nativa**: lo mismo en un dispositivo o simulador real, recordando que el header nativo tiene 32px menos de ancho útil (`px-6` contra `px-4`).
- [ ] 8.3 **Fuente del sistema agrandada**: repetir 8.1 y 8.2 con el escalado en "grande" y "más grande", y confirmar que la degradación cae a "30 de septiembre" y después a elipsis, en ese orden, sin envolver nunca.
- [ ] 8.4 Confirmar que la hoja nativa no tiene el defecto de scroll parcial que el spec `mobile-app-shell` describe: arrastrar empezando sobre un mes de la grilla y verificar que la hoja entera responde igual.
- [ ] 8.5 Mirar a alguien que no participó del diseño abrir el dashboard y pedirle que cambie de mes, para saber si la línea se lee como un control. Es el riesgo declarado de este change y esta es su única verificación real.

## 9. Cierre

- [ ] 9.1 Actualizar los mocks del handoff en `docs/design/dashboard/` para que reflejen el header sin controles y el eye toggle en la card.
- [ ] 9.2 Correr las cinco validaciones locales que espeja CI: `pnpm lint` + `lint:mobile`, `typecheck` + `typecheck:mobile`, `test`, `build`, `openspec:check`.
- [ ] 9.3 Archivar el change en la rama antes del merge, con las deltas aplicadas a `openspec/specs/dashboard/spec.md` y sin secciones `## ADDED/MODIFIED` sobrantes en el master spec.
