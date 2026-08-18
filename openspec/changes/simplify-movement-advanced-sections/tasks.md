# Tasks: simplify-movement-advanced-sections

## 1. i18n — unificar y agregar copy

- [x] 1.1 Familia canónica del split en `shared.split.*` (consumida por web-mobile y nativo). Agregadas: `half` ("Mitad"), `all_other` ("Todo suyo"), `you` ("Vos"), `other_short` ("Otro"), `owes` ("te debe"), `write_your_share` ("Escribí tu parte") (es + en). Los labels viejos `transactions.form.split_you/even/other`/`your_share` quedan sin uso en mobile.
- [x] 1.2 Agregar el copy del reintegro en `packages/i18n-messages` (es y en): labels del destino `Resumen` / `Cuenta` (`target.statement_short` / `target.account_short`), el rótulo `same_bank` ("mismo banco") y `cap_short` ("tope"), sin jerga contable. (Ya no hay disparador "calcular por %": el %/tope queda visible inline.)
- [ ] 1.3 Verificar que ambas superficies (web-mobile y nativo) consumen la **misma** familia de claves del split — no dos juegos paralelos.

## 2. Web-mobile — Reintegro (`apps/web/lib/transactions/components/movement-form.tsx`, rama `isMobile`)

> Diseño cerrado: `docs/design/movement-form/reintegro/` (canvas + handoff con medidas, estados y reglas). **Solo rediseño**: preservar toda la funcionalidad activa.

- [x] 2.1 Rehacer el card como **bloque compacto de 2 filas** (ref. handoff). Fila 1: monto del reintegro + regla `% + tope` **visible inline** (nada de disclosure). Mantener la bidireccionalidad monto↔% vía `applyReimbursementPercent` (escribir monto a mano descarta el %) y el resaltado del tope cuando aplicó.
- [x] 2.2 Reemplazar el `<input type="checkbox">` de "ya me lo acreditaron" por el control **"Acreditado"** diseñado (checkbox compacto, no raw input; **no** un `Switch`). Conservar el comportamiento pendiente/recibido de `reimbursementReceivedNow` (off = pendiente, sin chip "Pendiente").
- [x] 2.3 Reemplazar los `<input type="radio">` del destino por el control **`Resumen | Cuenta`** (solo crédito; el default lo fija el hook, sin cambio de comportamiento). Preservar `pickReimbursementAccount` (tocar "Cuenta" = cuenta de la misma entidad, sin abrir selector); tocar el **nombre** abre el selector con la cuenta de la misma entidad primero ("mismo banco").
- [x] 2.4 Ocultar el selector de cuenta de acreditación cuando hay una sola cuenta cash/bank elegible; renderizarlo cuando hay más de una. No romper el prerellenado por institución.
- [x] 2.5 No tocar la rama **desktop** ni el flujo de edición read-only del reintegro (`reimbursementReadOnly`).

## 3. Web-mobile — Compartir (diseño cerrado, mismo archivo, rama `isMobile`)

> Diseño cerrado: `docs/design/movement-form/compartir/`. Atajos finales `Mitad · 70/30 · 75/25 · Todo suyo · Otro` (5 chips, una fila) + **barra de reparto Vos / [otro integrante]**. Sin chip "todo mío".

- [x] 3.1 Reemplazar el input libre + `Switch` "es 100% del otro" por: chips `Mitad` (50) / `70/30` (70) / `75/25` (75) / `Todo suyo` (0) sobre `splitFirstPct`, más un chip `Otro` que transforma la fila 1 en dos campos % (el tuyo editable 0–99; el del otro calculado, gris, no editable). El chip "Otro" muestra el valor (`65%`) cuando es custom.
- [x] 3.2 Agregar la **barra de reparto** (fila 2): Vos (`#3A6B8A`) / otro integrante (`#0E9E6E`), nombre del Hogar, truncado del nombre primero; caso `Todo suyo` = barra entera + "te debe {monto}". Estado `splitOtherMode` local; desktop intacto (branch `isMobile`).
- [x] 3.3 Copy en la familia unificada `shared.split.*` (tarea 1).

## 4. Web-mobile + Nativo — Recurrente (diseño cerrado)

> Diseño cerrado: `docs/design/movement-form/recurrente/`. Rediseño a **bloque compacto de 2 filas**
> (no solo el `<select>`→chips). Decisión con el PO: **Anual y unidad "años" se ocultan solo en
> mobile** (el modelo los mantiene; anual = "cada 12 meses"). El ícono de calendario en modo
> Personalizado es "Repetir hasta" compactado.

- [x] 4.1 Web-mobile: chips de frecuencia `Semanal · Quincenal · Mensual · Personalizado` (sin Anual); fila 2 = campo "Repetir hasta — opcional" (o `cada N · días/sem./meses` + botón calendario en Personalizado); línea de aviso gris fuera de la card con resumen en lenguaje natural. Desktop intacto.
- [x] 4.2 Agregar `onClear`/`clearLabel` opcional al `DatePicker` (web) → footer "Sin fecha de fin" en el popover. Aditivo, no afecta otros usos.
- [x] 4.3 Nativo: mismo rediseño por rol (chips sin Anual; Personalizado con stepper + `Segmented` días/sem./meses; `DateField` de fin + "Sin fecha de fin"; línea de aviso). `FREQUENCIES`/`INTERVAL_UNITS` recortados al subset mobile.
- [x] 4.4 i18n: `drawer.repeat_until_placeholder`, `drawer.repeat_no_end`, `drawer.repeat_reassure`, `drawer.repeat_summary_prefix`, `drawer.repeat_summary_no_end`, `recurrences.custom_interval.units_short` (es + en).

## 5. Nativo — Compartir (`apps/mobile/components/transactions/MovementForm.tsx`)

- [x] 5.1 Reemplazar el `Segmented` de 3 presets por los mismos chips que web (`Mitad · 70/30 · 75/25 · Todo suyo · Otro`) + la **barra de reparto** (Views proporcionales) + el modo "Otro" de dos campos (`Input` bare + campo calculado). Estado local `splitOtherMode`/`splitDraft`.
- [x] 5.2 Copy en la familia unificada `shared.split.*` (tarea 1).

## 6. Nativo — Reintegro (mismo archivo)

- [x] 6.1 Rehacer el bloque como **2 filas compactas** espejo del web-mobile: monto + regla `% + tope` **visible inline** (sin disclosure), destino `Resumen | Cuenta` (crédito) + estado "Acreditado" (checkbox). Preservar la vinculación a la madre en compras en cuotas.
- [x] 6.2 Migrar el destino al control `Resumen | Cuenta` (el default lo fija el hook; "Cuenta" = misma entidad vía la lógica ya existente; el `AccountSelectField` recibe la lista ordenada "mismo banco primero") y el estado del `Switch` "ya me lo acreditaron" al **check "Acreditado"**. Ocultar el `AccountSelectField` cuando hay una sola cuenta cash/bank elegible.

## 7. Verificación

- [x] 7.1 `pnpm --filter web lint` + typecheck web; typecheck mobile. Sin errores nuevos.
- [x] 7.2 Tests existentes del hook y del form verdes (54/54). El hook solo ganó el fallback por nombre de institución en `pickReimbursementAccount`; ninguna aserción dependía del `Switch` fully-other ni del split `Segmented`.
- [x] 7.3 `pnpm openspec:check` OK.
- [x] 7.4 Verificación manual web-mobile (viewport de celular, el usuario en el navegador): (a) **Reintegro** — bloque compacto de 2 filas con `% + tope` visible inline, destino `Resumen | Cuenta` ("Cuenta" toma la misma entidad; el nombre abre el picker de la app), check "Acreditado", cuenta oculta con una sola. (b) **Compartir** — atajos `Mitad · 70/30 · 75/25 · Todo suyo · Otro` en una fila, barra de reparto Vos/[otro] con el nombre del Hogar, "Todo suyo" = barra entera + "te debe", "Otro" = dos campos %. (c) **Recurrente** — chips sin Anual, "Repetir hasta" + "Sin fecha de fin", Personalizado con stepper + días/sem./meses, línea de aviso. En las tres: nada se scrollea de más.
- [ ] 7.5 Handoff al tech lead para revisión del nativo (sin device en esta sesión): mismos criterios de paridad por rol/estructura. **Pendiente: lo revisa el tech lead (mañana).**

## 8. Cierre

- [ ] 8.1 Archivar el change (mover a `openspec/changes/archive/YYYY-MM-DD-simplify-movement-advanced-sections/`, integrar deltas en `transactions/spec.md` y `shared/spec.md`, `pnpm openspec:check`) **solo cuando** web-mobile esté verificado y el nativo aprobado por el tech lead. No archivar antes.
