## Context

Hoy las fechas en la web son `<input type="date">` nativo (10 sitios). En alta de movimiento y en recurrencias hay además un `Popover` propio con un botón "Hoy" + el input nativo adentro. El usuario reporta que abrir una fecha cuesta dos clicks: primero aparece un paso compacto con "hoy" seteado y recién con un segundo click sobre el ícono de calendario se ve el mes. El aspecto y los pasos del picker nativo dependen del navegador/OS, así que no son controlables desde código.

Restricciones del repo relevantes:
- "Hoy" en operaciones financieras se computa con `getTodayAR()` (`packages/money-logic/src/cards.ts`), nunca `new Date()` (riesgo de corrupción de fecha cerca de medianoche).
- Las fechas contables son `DATE` sin timezone; en la UI viajan como string ISO `YYYY-MM-DD`. Los formularios actuales ya operan sobre ese string.
- Ya existe el primitivo `Popover` (Radix) en `apps/web/components/ui/popover.tsx` con contract en `@grana/ui-contracts`, usado para overlays anclados con colisión/flip.
- Mobile es del tech lead: este change es solo web.

## Goals / Non-Goals

**Goals:**
- Un único primitivo web `DatePicker` que, al hacer click, abre directo el mes completo.
- Reemplazar todo `<input type="date">` y el popover intermedio de fecha por ese primitivo, en los 10 sitios.
- Conservar el contrato de valor: string ISO `YYYY-MM-DD` in/out → cero cambios en submit/validación/queries.
- "Hoy" calculado con `getTodayAR()`; respetar `min`/`max` donde hoy se usan (ej. fin de recurrencia `min={startDate}`).

**Non-Goals:**
- No tocar `apps/mobile`.
- No cambiar el modelo de datos, RPCs, ni reglas de negocio de ningún formulario.
- No introducir selección de rango ni de hora (todos los campos son fecha simple).
- No promover el primitivo a `packages/ui-contracts` en este change (la contraparte mobile la decide el tech lead); se deja documentado como follow-up.

## Decisions

### D1 — `react-day-picker` para el grid de mes
Usamos `react-day-picker` (estándar de facto, el que usa shadcn `Calendar`) por sobre construir un grid de calendario a mano. Maneja navegación de mes, semanas, foco/teclado y `disabled` por rango. Alternativas descartadas: (a) input nativo + `showPicker()` — sigue dependiendo del navegador y no garantiza "mes completo"; (b) calendario propio desde cero — reinventa accesibilidad y edge-cases de fechas sin beneficio.

### D2 — Composición sobre el `Popover` existente
`DatePicker` = `Popover` (trigger = una fila/campo clickeable, estilo consistente con los `FieldRow`/`DateField` actuales) cuyo contenido es el `<DayPicker>` + un botón "Hoy". Reusar el primitivo nos da gratis posicionamiento anclado, flip por colisión, cierre por outside-click/Esc y el modo `modal` (necesario cuando vive dentro de un `Drawer`, como en el alta de movimiento — hoy `modal={isDrawer}`). El `DatePicker` expone `modal?` para propagarlo.

### D3 — Contrato del componente (valor ISO, no `Date`)
```ts
type DatePickerProps = {
  value: string                     // ISO 'YYYY-MM-DD' ('' = vacío)
  onChange: (iso: string) => void
  min?: string                      // ISO; deshabilita días anteriores
  max?: string                      // ISO; deshabilita días posteriores
  label?: string                    // para variantes con label (DateField)
  disabled?: boolean
  modal?: boolean                   // propaga a Popover (drawer)
  // estilo del trigger: variante "field" (input-like) vs "row" (FieldRow)
}
```
La conversión ISO↔`Date` se hace **solo** en el borde del componente con helpers locales que parsean/serializan en horario local sin desfase de UTC (construir `Date` con `new Date(y, m-1, d)` y formatear con padding manual, no `toISOString()` que vuelca a UTC). El "hoy" del calendario y del botón "Hoy" usa `getTodayAR()` serializado a ISO.

### D4 — Dos presentaciones del trigger, un solo componente
Los sitios actuales tienen dos estéticas: (a) `FieldRow` (ícono + label + valor, en el alta/edición de movimiento y recurrencias) y (b) `DateField` / input-like con label arriba (tarjetas, pagos, períodos, reintegros). El `DatePicker` soporta ambas vía una prop de variante para no romper el look de cada pantalla. `DateField` (en `card-form-ui.tsx`) pasa a ser un wrapper delgado sobre `DatePicker` variante field, así sus ~5 consumidores no cambian su llamada.

### D5 — Localización
`react-day-picker` recibe `locale`. La app es es-AR; se pasa la locale `es` (date-fns) y `weekStartsOn` lunes. Si `date-fns` no estuviera ya disponible se evalúa en tasks: o se agrega, o se configura los `labels`/`formatters` mínimos de RDP a mano. Los textos propios ("Hoy") salen de i18n (`@grana/i18n-messages`), reutilizando la key existente `drawer.today` o agregando una común.

## Risks / Trade-offs

- **Desfase de fecha por UTC** → Mitigación: nunca usar `toISOString()`/`Date.parse('YYYY-MM-DD')` (interpreta UTC). Parseo/serialización local explícitos + tests de borde (día 1, fin de mes, cambio de mes).
- **Regresión visual en 10 pantallas** → Mitigación: dos variantes de trigger que replican el look actual; revisar cada pantalla tras el reemplazo. Story de Storybook como referencia.
- **DatePicker dentro de `Drawer` (alta de movimiento)** → Mitigación: propagar `modal` al `Popover` igual que hoy (`modal={isDrawer}`), para que el outside-click/scroll del drawer no rompa el overlay.
- **Peso del bundle (react-day-picker + date-fns)** → Mitigación: aceptable; es un componente transversal de alto uso. Tree-shaking de date-fns locale puntual.
- **Paridad mobile pendiente** → No es regresión (mobile ya difiere y es del tech lead); se documenta como follow-up no bloqueante.

## Migration Plan

1. Agregar `react-day-picker` (y `date-fns` si hace falta) a `apps/web`.
2. Construir `DatePicker` + helpers ISO↔Date + story.
3. Reemplazar sitio por sitio, empezando por `DateField` (cubre tarjetas/pagos/períodos de un saque), luego los popovers de movimiento y recurrencias, luego reintegros y recurrencias pendientes.
4. Verificación manual por pantalla + `pnpm lint` + `pnpm build`.
- Rollback: el cambio es UI-puro y sin migraciones; revertir la branch restaura los inputs nativos sin efectos de datos.

## Open Questions

- ¿`date-fns` ya está en el árbol de dependencias de web? (resolver en la primera task; condiciona D5).
- ¿Conviene exponer ya el contract en `@grana/ui-contracts` para que el tech lead enganche mobile, o dejarlo web-only y coordinar después? Propuesta: web-only ahora, follow-up coordinado.
