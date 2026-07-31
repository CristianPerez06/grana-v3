# Tasks — clarify-dashboard-lenses

> Alcance: **solo `apps/web`**. `apps/mobile` lo lleva el tech lead; esta change deja
> la capa web lista y conserva los contratos de datos que la app nativa consume
> (`getMonthBalanceSeries`, `getMonthCategoryBreakdown`, `getDashboardHero`) sin tocarlos.

## 0. Decisión previa (bloqueante)

- [ ] 0.1 Aprobar los strings propuestos en `design.md §1`. Son decisión de producto; la spec fija **qué debe comunicar** cada rótulo, no las palabras. Sin esto aprobado, no arrancar la sección 2.

## 1. Contrato de producto (spec)

- [ ] 1.1 Delta de `dashboard` con los cuatro requirements modificados (`specs/dashboard/spec.md`): la pregunta por sección, el Hero, el neto del mes y el puente caja → consumo.
- [ ] 1.2 Verificar que los headers de los `MODIFIED Requirements` coincidan **carácter por carácter** con los del master (`openspec/specs/dashboard/spec.md`), acentos incluidos — un header que no matchea crea un requirement duplicado en vez de modificar el existente.
- [ ] 1.3 Verificar que cada restatement conserve todo lo que el master ya tenía, en particular las reglas de reconciliación y de signo que aterrizó `fix-balance-read-path-defects` (archivado 2026-07-30). Un `MODIFIED Requirement` **reemplaza** al del master: lo que no se restatea, se borra.

## 2. Copy (i18n)

- [ ] 2.1 `dashboard.hero.*`: eyebrow y caption dejan de prometer gastabilidad; la caption declara que el monto no descuenta lo comprometido.
- [ ] 2.2 `dashboard.hero.*`: string nuevo para el estado de disponible negativo (nombra el estado e invita a revisar el registro; no acusa).
- [ ] 2.3 `dashboard.month.title` y el label del importe dejan de usar vocabulario de saldo.
- [ ] 2.4 `dashboard.month.*`: strings nuevos para la lectura del signo (positivo / negativo / cero).
- [ ] 2.5 `dashboard.month.*`: encabezado del grupo de movimiento interno.
- [ ] 2.6 `dashboard.month.*`: chips de fila — "Gastos" sin tarjeta, pago de resumen de meses anteriores, transferencias fuera de las cuentas activas.
- [ ] 2.7 `dashboard.month.adjustment_note` y `adjustment_unregistered` reencuadrados como reconciliación, no como reproche.
- [ ] 2.8 Adaptar `dashboard.spent.caption` a su nuevo contexto (cierre de card, ya no título de card suelta) y agregar el texto del paso a "¿En qué gasté?".
- [ ] 2.9 Eliminar `dashboard.month.financed_on_card` — clave huérfana, remanente de una iteración anterior del mismo puente (verificado: sin referencias fuera de `es.json`).
- [ ] 2.10 Mantener paridad de claves en `en` si el catálogo la exige.

## 3. Hero (`hero-section.tsx`)

- [ ] 3.1 Aplicar el eyebrow y la caption nuevos.
- [ ] 3.2 Agregar el tratamiento condicional del importe ARS negativo. **Ojo**: la card tiene fondo navy (`bg-surface-dark text-white`); definir el tono contra el token que corresponda y verificar contraste — no reusar el de las cards claras sin chequear.
- [ ] 3.3 Renderizar la línea de estado negativo debajo del importe.
- [ ] 3.4 Confirmar que el eye-mask sigue cubriendo todos los importes, incluido el estado negativo.

## 4. Card del neto del mes (`month-balance-section.tsx`)

- [ ] 4.1 Título y label del importe según los strings aprobados.
- [ ] 4.2 Línea de lectura del signo debajo del importe (positivo / negativo / cero).
- [ ] 4.3 Agrupar las filas por naturaleza: flujo real (sin encabezado) · movimiento interno (con encabezado) · corrección de stock.
- [ ] 4.4 Renderizar `totalTransfer` como fila condicional cuando es distinto de cero, dentro del grupo de movimiento interno, participando del escalado por `maxFlow`.
- [ ] 4.5 Generalizar el patrón de chip (hoy solo en Ajustes) a las filas de Gastos, pago de resumen y transferencias.
- [ ] 4.6 Verificar que el cálculo de `maxFlow` y los anchos siguen derivándose de los datos con las filas nuevas presentes.

## 5. Puente caja → consumo

- [ ] 5.1 Mover el bloque de `spent-this-month-section.tsx` al pie de la card del neto del mes, conservando el cálculo (`financiado = devengado − caja`) y las **mismas query keys** para que TanStack siga dedupeando (sin fetch nuevo).
- [ ] 5.2 Agregar el paso a "¿En qué gasté este mes?".
- [ ] 5.3 Retirar la card suelta del stack en `dashboard-content.tsx` y actualizar el comentario de composición del archivo.
- [ ] 5.4 Confirmar que sigue sin renderizarse cuando `financiado <= 0`.

## 6. Verificación

- [ ] 6.1 `pnpm typecheck` (web) en verde.
- [ ] 6.2 Tests de `packages/dashboard` en verde — este change no toca agregaciones, así que no debería moverse ninguno; si alguno rompe, es señal de que se tocó lógica sin querer.
- [ ] 6.3 QA visual con datos reales, mes con tarjeta: la suma de las filas visibles explica el neto, y el puente cierra `total = caja + financiado`.
- [ ] 6.4 QA visual, mes sin movimientos internos: la card se lee igual que antes (ningún grupo ni fila condicional aparece de más).
- [ ] 6.5 QA del estado negativo del Hero — forzarlo en local; verificar contraste sobre navy y que el eye-mask lo cubra.
- [ ] 6.6 Barrido responsive a 375px de las dos cards tocadas: sin overflow horizontal, chips que no rompen el layout con textos largos.

## 7. Cierre

- [ ] 7.1 Archivar el change **en la branch, antes del merge**: mover la carpeta a `openspec/changes/archive/`, sincronizar los cuatro requirements en el master `openspec/specs/dashboard/spec.md`.
- [ ] 7.2 Evaluar como higiene aparte si conviene renombrar los headers de requirement que citan literalmente "Balance del mes" (quedan stale respecto del nuevo copy). **No hacerlo en este change**: renombrar un header rompe el match del archive. Si se decide, va como change propio con `REMOVED` + `ADDED`.
- [ ] 7.3 `pnpm openspec:check` en verde.
- [ ] 7.4 Dejar la branch lista y **no mergear** — el merge (squash + ff-only) lo hace el usuario.
