# Tasks: simplify-movement-advanced-sections

## 1. i18n — unificar y agregar copy

- [ ] 1.1 Elegir la familia de claves canónica del control de split (preferencia `shared.split.*`) y agregar/renombrar: labels de presets `Vos` / `Mitad` / `El otro {name}`, disparador `Otro %`, y las etiquetas del editor de porcentaje libre. Retirar el copy huérfano del `Switch` fully-other si deja de usarse.
- [x] 1.2 Agregar el copy del reintegro en `packages/i18n-messages` (es y en): labels del destino `Resumen` / `Cuenta` (`target.statement_short` / `target.account_short`), el rótulo `same_bank` ("mismo banco") y `cap_short` ("tope"), sin jerga contable. (Ya no hay disparador "calcular por %": el %/tope queda visible inline.)
- [ ] 1.3 Verificar que ambas superficies (web-mobile y nativo) consumen la **misma** familia de claves del split — no dos juegos paralelos.

## 2. Web-mobile — Reintegro (`apps/web/lib/transactions/components/movement-form.tsx`, rama `isMobile`)

> Diseño cerrado: `docs/design/movement-form/reintegro/` (canvas + handoff con medidas, estados y reglas). **Solo rediseño**: preservar toda la funcionalidad activa.

- [x] 2.1 Rehacer el card como **bloque compacto de 2 filas** (ref. handoff). Fila 1: monto del reintegro + regla `% + tope` **visible inline** (nada de disclosure). Mantener la bidireccionalidad monto↔% vía `applyReimbursementPercent` (escribir monto a mano descarta el %) y el resaltado del tope cuando aplicó.
- [x] 2.2 Reemplazar el `<input type="checkbox">` de "ya me lo acreditaron" por el control **"Acreditado"** diseñado (checkbox compacto, no raw input; **no** un `Switch`). Conservar el comportamiento pendiente/recibido de `reimbursementReceivedNow` (off = pendiente, sin chip "Pendiente").
- [x] 2.3 Reemplazar los `<input type="radio">` del destino por el control **`Resumen | Cuenta`** (solo crédito; el default lo fija el hook, sin cambio de comportamiento). Preservar `pickReimbursementAccount` (tocar "Cuenta" = cuenta de la misma entidad, sin abrir selector); tocar el **nombre** abre el selector con la cuenta de la misma entidad primero ("mismo banco").
- [x] 2.4 Ocultar el selector de cuenta de acreditación cuando hay una sola cuenta cash/bank elegible; renderizarlo cuando hay más de una. No romper el prerellenado por institución.
- [x] 2.5 No tocar la rama **desktop** ni el flujo de edición read-only del reintegro (`reimbursementReadOnly`).

## 3. Web-mobile — Compartido (mismo archivo, rama `isMobile`)

- [ ] 3.1 Reemplazar el input de porcentaje libre + `Switch` "es 100% del otro" por: presets `Vos` (100) / `Mitad` (50) / `El otro` (0) como chips de un gesto sobre `splitFirstPct`, más un chip `Otro %` que revela el input de porcentaje libre (el editor `1..99` actual).
- [ ] 3.2 Confirmar que "El otro" fija `splitFirstPct = 0` (0/100) y que se elimina el `Switch`/estado `fullyOther`/`prevSplitPct` ahora redundante.
- [ ] 3.3 Migrar el copy a la familia i18n unificada (tarea 1).

## 4. Web-mobile — Repetir (mismo archivo, rama `isMobile`)

- [ ] 4.1 Reemplazar el `<select>` de unidad del intervalo custom por chips (día/semana/mes/año) sobre `intervalUnit`, espejo del nativo. No tocar frecuencia, count ni fecha fin.

## 5. Nativo — Compartido (`apps/mobile/components/transactions/MovementForm.tsx`)

- [ ] 5.1 Reemplazar el `Segmented` de 3 presets por presets `Vos` / `Mitad` / `El otro` **más** un disparador `Otro %` que revela un input de porcentaje libre (`MoneyAmountInput`/`Input` numérico) escribiendo `splitFirstPct` (0–100, validado). Mantener el hint "tu parte: X%".
- [ ] 5.2 Migrar el copy a la familia i18n unificada (tarea 1).

## 6. Nativo — Reintegro (mismo archivo)

- [x] 6.1 Rehacer el bloque como **2 filas compactas** espejo del web-mobile: monto + regla `% + tope` **visible inline** (sin disclosure), destino `Resumen | Cuenta` (crédito) + estado "Acreditado" (checkbox). Preservar la vinculación a la madre en compras en cuotas.
- [x] 6.2 Migrar el destino al control `Resumen | Cuenta` (el default lo fija el hook; "Cuenta" = misma entidad vía la lógica ya existente; el `AccountSelectField` recibe la lista ordenada "mismo banco primero") y el estado del `Switch` "ya me lo acreditaron" al **check "Acreditado"**. Ocultar el `AccountSelectField` cuando hay una sola cuenta cash/bank elegible.

## 7. Verificación

- [ ] 7.1 `pnpm --filter web lint` + typecheck web; typecheck mobile. Sin errores nuevos.
- [ ] 7.2 Tests existentes del hook y del form verdes (el hook no cambia; confirmar que ninguna aserción dependía del `Switch` fully-other ni del split `Segmented`).
- [ ] 7.3 `pnpm openspec:check` OK.
- [ ] 7.4 Verificación manual web-mobile (viewport de celular, el usuario en el navegador): las tres secciones abren con superficie mínima; split de un tap + "Otro %" funciona; el reintegro es el bloque compacto de 2 filas con el `% + tope` visible inline, destino `Resumen | Cuenta` (default Resumen; "Cuenta" toma la misma entidad; el nombre abre el selector) y check "Acreditado"; cuenta de acreditación oculta con una sola cuenta.
- [ ] 7.5 Handoff al tech lead para revisión del nativo (sin device en esta sesión): mismos criterios de paridad por rol/estructura.

## 8. Cierre

- [ ] 8.1 Archivar el change (mover a `openspec/changes/archive/YYYY-MM-DD-simplify-movement-advanced-sections/`, integrar deltas en `transactions/spec.md` y `shared/spec.md`, `pnpm openspec:check`) **solo cuando** web-mobile esté verificado y el nativo aprobado por el tech lead. No archivar antes.
