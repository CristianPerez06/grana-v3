## Why

El header del dashboard afirma **dos tiempos distintos a 15px de distancia**: la fecha de hoy ("Miércoles, 2 de septiembre") y el mes seleccionado ("Sep 2026"). Uno de los dos sobra mientras el usuario está parado en el mes actual, que es casi siempre.

Peor, los dos compiten por el mismo ancho. El selector de mes más el eye toggle son ~190px de una fila de ~330px a 360px de viewport; a la fecha le quedan ~125px, donde entra "Martes, 1 de sep" (92px) pero **no** "Miércoles, 2 de sep" (109px). La fecha trunca en producción los miércoles y domingos.

La causa de fondo no es el ancho sino la **ubicación**: el header es identidad de página (quién sos, qué día es) y el selector de mes es un control de alcance (cambia qué significan los números de abajo). Un control de alcance metido en el chrome de identidad compite por ancho con ella y además **miente sobre su alcance**: parece global, pero la tira "Compartido" lo ignora y "Compromisos" lo sigue con un mes de desfasaje, y un pill en el header no tiene forma de expresar eso.

## What Changes

- **La línea de la fecha pasa a SER la lente temporal.** Es tocable y abre una hoja de meses. Deja de ser un rótulo pasivo y pasa a nombrar desde dónde está mirado el dashboard.
- **La línea cambia de forma junto con los números.** Parado en el mes actual dice el día ("Miércoles, 2 de septiembre"), porque el saldo es el de hoy. Parado en otro mes dice el mes ("Agosto 2026"), porque el saldo se corta al último día de ese mes — que es lo que el spec de `dashboard` ya define.
- **Aparece "Volver a hoy"** junto a la línea, solo cuando el usuario está fuera del mes actual.
- **El "al cierre" NO se dice en la línea de la fecha.** Ya lo dice el rótulo de la card de saldo, que el requirement "El Hero muestra el disponible total bimoneda" **ya define**: en un mes pasado el rótulo pasa a "Saldo al cierre de mayo de 2026". Eso no cambia acá; se aprovecha. La línea de la fecha nombra dónde estás parado y el rótulo explica qué es el número — cada uno en su registro, sin repetirse.
- **BREAKING (para el usuario):** las flechas `‹ ›` del `MonthNavigator` desaparecen del dashboard. Se reemplazan por una hoja con los 13 meses alcanzables, cualquiera a un toque — con las flechas, ir de septiembre a septiembre pasado eran once toques. Los meses no alcanzables (futuros, y anteriores a los 12 hacia atrás) se renderizan **visibles pero deshabilitados**, para que la regla se vea en vez de descubrirse tropezando.
- **El eye toggle baja a la primera card**, donde empiezan los montos. Enmascara montos, así que su lugar es donde los montos están; y es una preferencia de privacidad, no un control de alcance, así que no tiene por qué convivir con el mes.
- **El texto de la fecha degrada por pasos, no de entrada**: completo → sin día de la semana → elipsis como piso. Reemplaza el acortado incondicional del mes a tres letras, que era un parche para el problema que este cambio elimina.
- **Se retira el `MonthNavigator` del header del dashboard** en las dos plataformas. El componente sigue existiendo para la ruta Movimientos, que no cambia.

### Alternativas descartadas

Decididas con el owner sobre mockups a 360px reales:

- **Selector adentro de la card de saldo.** Gobierna tres bloques; meterlo en uno lo hace parecer más chico de lo que es.
- **Chip achicado en el header.** No resuelve el planteo: el control de alcance seguiría compitiendo por ancho con el nombre de la persona.
- **Barra de lente permanente entre header y contenido.** Alcance honesto, pero ~44px permanentes en la pantalla donde el alto es el recurso escaso. Además, **el nativo ya tuvo exactamente eso y se sacó por caro** — volver ahí es revertir una decisión ya tomada.

## Capabilities

### New Capabilities

Ninguna. El cambio reubica y reformula controles de una capability existente.

### Modified Capabilities

- `dashboard`: cambian tres requirements — el del header (la fecha pasa de rótulo a control), el del selector de mes (ubicación e interacción) y el del eye toggle (ubicación). Se agrega uno para la hoja de meses. El requirement del Hero NO cambia: su rótulo ya depende del mes seleccionado.

## Impact

**Código afectado**, en el mismo commit por la política Web ↔ Mobile del repo:

- `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx` y `apps/mobile/components/dashboard/DashboardHeader.tsx` — la línea de la fecha pasa a ser un control; salen `MonthNavigator` y `EyeMaskToggle`.
- `apps/web/app/(app)/dashboard/_components/balance-card.tsx` y `apps/mobile/components/dashboard/BalanceCard.tsx` — entra el eye toggle. El rótulo ya depende del mes seleccionado; no se toca.
- Nueva hoja de selección de mes, una implementación por plataforma con props compartidas en `@grana/ui-contracts`. En web se presenta como bottom sheet debajo de `md` (spec `web-app-shell`); en nativo es un overlay que debe seguir las reglas de `mobile-app-shell` para superficies con `Modal`.
- `packages/dashboard/src/today-line.ts` — `formatTodayLine` pasa de "acortar el mes" a resolver los estados de la línea y su degradación por pasos.
- `packages/i18n-messages/src/{es,en}.json` — claves nuevas ("Volver a hoy", el título de la hoja) en los dos catálogos.
- `MonthNavigator` (web y mobile) deja de usarse en el dashboard; **no se borra**, lo sigue usando Movimientos.

**Sin impacto** en el modelo de datos, las queries ni el estado del mes: `DashboardMonthProvider` / su espejo nativo y su contrato (12 meses hacia atrás, sin futuro, sin persistir) quedan igual. Cambia quién los maneja, no qué exponen.

**Riesgo conocido, con mitigación en las specs:** la app no topea el escalado de fuente del sistema (cero ocurrencias de `allowFontScaling` o `maxFontSizeMultiplier` en `apps/mobile`), y las medidas dan que a 320px en nativo la fila deja de entrar en ~1.40× de escala. De ahí sale el requirement de degradación por pasos. Las mediciones se hicieron en Chromium sobre un mockup, no sobre los componentes reales, así que la verificación en dispositivos es una tarea explícita y no una casilla asumida.
