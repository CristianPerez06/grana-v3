# Rediseño del form de movimientos como drawer lateral

## Why

Registrar/editar un movimiento es la acción más frecuente de Grana. Hoy en v3 vive como **página completa** (`/transactions/new` y `/transactions/[txId]/edit`, componente `movement-form.tsx`): funciona y cubre los cinco tipos (ingreso, gasto, transferencia, ajuste, **cambio de moneda**), cuotas, reintegro, sugerencia de categoría y aviso de saldo negativo — pero saca al usuario del contexto del listado y agrega fricción (navegación de ida y vuelta por cada carga).

El handoff de diseño (Julieta, hi-fi) pide reemplazar esa página por un **drawer lateral derecho** que se desliza sobre el listado de Movimientos manteniendo el contexto, con el objetivo de **mínima fricción**: el monto toma foco al abrir, lo avanzado queda oculto hasta que se necesita (progressive disclosure), y se puede cargar un movimiento atrás de otro sin cerrar ("+ Otro").

Decisión de alcance (Cristian, mayo 2026):

1. **Reusar la lógica existente, no reescribirla**: el drawer es una capa de presentación sobre el estado, las server actions y las validaciones de `movement-form`. La lógica pura compartible (formato de monto AR, derivaciones por tipo, estado del form) se promueve a `packages/` para no duplicar entre web y mobile. **Cero duplicación de negocio.**
2. **Cinco tabs, no cuatro**: el prototipo trae 4 (Gasto/Ingreso/Transferencia/Ajuste) pero v3 también tiene **Cambio de moneda** (exchange). Se agrega como 5º tab; su diseño (no presente en el prototipo) se deriva del layout de Transferencia + doble monto/moneda, siguiendo los tokens de v3.
3. **Paridad web + mobile**: el drawer se implementa en ambas plataformas. Web usa los primitivos de `add-overlay-primitives`; mobile su contraparte.
4. **"Personalizado" en Repetir**: el toggle de recurrencia expone la frecuencia personalizada (`cada N · unidad` + fin opcional) habilitada por `add-custom-recurrence-frequency`.

Es **fase 3** y depende de las fases 1 (`add-custom-recurrence-frequency`) y 2 (`add-overlay-primitives`).

## What Changes

### A — El alta/edición de movimientos se presenta como drawer (web)

- **ADDED** "El form de movimientos se abre en un drawer lateral derecho sobre el listado": abierto desde el FAB `+`, el botón "Registrar movimiento" del header, y el click en una fila del listado (modo edición). Header fijo (eyebrow + título + cerrar + eliminar en edición) → body scrolleable → footer fijo (CTA + "+ Otro").
- **MODIFIED** la relación con las rutas página: `/transactions/new` y `/transactions/[txId]/edit` siguen resolviendo (deep-link, no-JS, y reuso por mobile) renderizando el mismo form. En desktop, los openers abren el drawer en vez de navegar. Sin duplicar la lógica del form.
- **ADDED** "Monto como elemento hero con foco automático al abrir", usando `MoneyAmountInput` + `parseMoneyInput`. Color del monto por tipo (gasto/transferencia navy, ingreso emerald, ajuste navy con signo). Pill de moneda ARS/USD.
- **ADDED** "Progressive disclosure": filas de campos clickeables que abren popovers anclados (cuenta origen, cuenta destino, categoría con **drill de subcategorías**, fecha); cuotas y toggles (reintegro, repetir) que aparecen/despliegan según tipo y cuenta.

### B — Quinto tab: Cambio de moneda

- **ADDED** "El tipo 'Cambio de moneda' está disponible en el form unificado del drawer", reusando `createExchange`/`updateExchange`. Layout: fila cuenta origen + moneda/monto origen, fila cuenta destino + moneda/monto destino (origen ≠ destino de moneda), con helper de tasa implícita. (Diseño derivado, no presente en el prototipo.)

### C — Selector de categoría con drill de subcategorías

- **ADDED** "El popover de categoría replica el drill del card 'En qué se fue'": nivel 0 lista categorías (drillables muestran `›`), nivel 1 muestra "Toda la categoría" + subcategorías. Reusa el árbol de `getAllCategories` y el lenguaje visual de `spending-by-category`. El chip "SUGERIDA" se alimenta de `suggestCategoryFromHistory` y se quita al elegir manualmente.

### D — Cuotas, reintegro y repetir (incluye Personalizado)

- **MODIFIED** "Cuotas aparecen automáticamente con cuenta de crédito en Gasto" reusando el flujo `registerInstallments` (madre/hijas, ARS only). Pills 1×–24× + breakdown "N cuotas de $X · primera vence …".
- **MODIFIED** "Toggle Tiene reintegro" (en Gasto) usa la declaración de reintegro anidada existente (`reimbursementDeclarationSchema`).
- **MODIFIED** "Toggle Repetir" crea una recurrencia vía `createRecurrenceFromMovement`; las freq-pills incluyen Semanal · Quincenal · Mensual · Anual · **Personalizado**, esta última con el control `cada N · unidad` + fin opcional de `add-custom-recurrence-frequency`.

### E — Guardar y cargar otro · edición · atajos

- **ADDED** "Botón '+ Otro' (guardar y cargar otro)": guarda, limpia monto + descripción, mantiene cuenta/fecha/tipo y devuelve el foco al monto. Oculto en edición.
- **MODIFIED** "Modo edición respeta `editableFields`": precarga el movimiento real, deshabilita el cambio de tipo, muestra eliminar (respetando las reglas de borrado: hijas de cuotas, consumos pagados), oculta "+ Otro", CTA "Guardar cambios".
- **ADDED** "Atajos de teclado en el drawer": `Esc` cierra el popover (si hay) o el drawer; `⌘/Ctrl+Enter` envía.

### F — Mobile

- **ADDED** "Paridad mobile del drawer de movimientos" (`apps/mobile`), usando los primitivos mobile de `add-overlay-primitives` y la lógica pura compartida.

## Stakeholders

- **Producto** (Cristian): valida el diseño del 5º tab (exchange) que no estaba en el prototipo, y el copy del control "Personalizado".
- **Diseño** (Julieta): dueña del hi-fi; valida el snapping de tokens del prototipo a `@grana/ui-tokens` (emerald-soft `#E4F5EE`→`--emerald-bg`/`--emerald-soft`, ámbar del banner de ajuste → `--warning`).
- **Mobile** (tech lead): implementación RN del drawer en paralelo (paridad pedida).

## Out of scope

- Cambios en el motor de balances/contabilidad (las server actions ya existen y no se tocan).
- Gastos compartidos / dividir (módulo `shared` no implementado) — explícitamente excluido del form, como aclara el handoff.
- "Día específico" en recurrencias (fuera de v1 de `add-custom-recurrence-frequency`).
