## 1. Presentación del picker en `DateField`

- [x] 1.1 En `apps/mobile/components/ui/DateField.tsx`, sacar `DateTimePicker` del flujo: el bloque `{show && (<View>…)}` hermano del trigger deja de existir como contenido en layout. El trigger (variantes bordeada y `bare`) queda tal cual, sin cambios de tamaño al abrir.
- [x] 1.2 iOS: presentar el picker dentro del `BottomSheet` existente (`components/ui/BottomSheet.tsx`), con cabecera al estilo `SelectSheet` — título del campo + acción de cierre con `common.close`. Sin claves i18n nuevas.
- [x] 1.3 Android: conservar el diálogo nativo (`display="default"`), verificando que la reestructuración del render no altere el flujo de `event.type === 'set'` ni el cierre automático.
- [x] 1.4 Confirmar que la API pública no cambió: `value`, `onChange`, `placeholder`, `invalid`, `bare`, `open`, `onOpenChange` con la misma firma y semántica, y el commit del valor sigue siendo en vivo (design.md — Decisión 4).

## 2. Limpieza del workaround en el alta de movimiento

- [x] 2.1 En `apps/mobile/components/transactions/MovementForm.tsx`, revertir la fila de fecha a `items-center` y quitar los offsets de compensación (`pt-1.5` en el wrapper del trigger, `pt-1` en el de los chips) introducidos por `0aa0679`.
- [x] 2.2 Actualizar el comentario de esa fila: ya no describe una compensación por la expansión del picker.

## 3. Verificación manual en simulador

`apps/mobile` no tiene tests ni Storybook — esta sección es la red de seguridad real, no un extra.

- [x] 3.1 **iOS · `EditDatesSheet`** (el caso más riesgoso, primero): abrir Cierre y Vencimiento desde dentro del sheet de edición de fechas. Verificar que el `Modal` anidado se presenta y se cierra bien, que el sheet padre queda usable al cerrar el picker y que el doble scrim no resulta molesto. Si falla, aplicar el fallback de design.md (Risks): que el host declare que ya está dentro de un sheet y ahí iOS use el diálogo nativo.
- [x] 3.2 **iOS · alta de movimiento** (el defecto reportado): abrir el picker desde la fila de fecha de la card agrupada. Verificar que los chips Hoy / Ayer no se mueven ni salen de pantalla, que la `GroupCard` conserva su alto y que al cerrar no queda desplazamiento residual.
- [x] 3.3 **iOS · host simple**: `settle` o `CreateCardForm`, para confirmar que la variante bordeada se comporta igual que la `bare`.
- [x] 3.4 **Android**: repetir 3.1–3.3 y confirmar que no hubo regresión — el diálogo nativo abre, confirma, descarta y emite el mismo valor que antes.
- [x] 3.5 **Contrato de valor**: elegir una fecha cerca de medianoche / en un cambio de mes y confirmar que el día emitido es el elegido, sin corrimiento de zona (spec — Contrato de valor ISO sin desfase de zona).
- [x] 3.6 **Exclusión mutua**: en `EditCardForm`, abrir un campo de fecha y luego el otro; confirmar que el primero se cierra (spec — Apertura controlada para pickers mutuamente excluyentes).

## 4. Cierre

- [x] 4.1 Correr `pnpm --filter mobile typecheck` y `pnpm --filter mobile lint`.
- [x] 4.2 Archivar la change antes del merge según el checklist de `AGENTS.md`: mover a `openspec/changes/archive/YYYY-MM-DD-mobile-date-field-overlay/`, crear `openspec/specs/mobile-date-field/spec.md` con el `Purpose` real (sin placeholder `TBD`) y las requirements integradas en un `## Requirements` plano, sin secciones de delta.
- [x] 4.3 Agregar a `openspec/specs/web-date-picker/spec.md` la referencia a la capability nativa, reemplazando la nota "la contraparte mobile la maneja el tech lead" que este cambio deja resuelta.
- [x] 4.4 Correr `pnpm openspec:check` en la branch. Debe pasar antes del merge.
