## Why

La pregunta que un usuario quiere contestar cuando abre la página de detalle de una tarjeta es **"¿cómo viene mi tarjeta?"** — una pregunta decisional y prospectiva: si quiero hacer una compra hoy, ¿la tarjeta ya viene abultada (mejor esperar al cierre) o tengo margen (compro hoy aunque venza el mes próximo)?

La página actual (`/cards/[id]`) no responde esa pregunta en un vistazo:

- El protagonista es el resumen en curso aislado; los próximos resúmenes con sus cuotas comprometidas viven como una lista chiquita más abajo.
- Hay dos links con labels distintos (`Ver resúmenes` y `Ver historial`) que apuntan al mismo destino, generando confusión.
- El botón "Cuotas — Próximamente" disabled es ruido sostenido que erosiona confianza.
- La info clave para decidir (cierre del resumen actual, carga del próximo) no está jerarquizada.
- El bloque de límite repite tres veces el mismo dato (barra, "% utilizado", "$ disponible").

Es una página de contabilidad pura cuando lo que necesita ser es una página de **decisión**.

## What Changes

- **Layout reorganizado como termómetro horizontal de tres columnas** (en curso · próximo · siguiente). Cada columna muestra fechas de cierre y vencimiento, barra horizontal con `% usado del límite total`, monto ARS pendiente, monto USD subordinado, y copy "sin cuotas" cuando el monto es cero.
- **Unificación de links** a `/cards/[id]/periods`: un único label `"Ver todos los resúmenes →"`. El título de la página destino pasa de "Historial de resúmenes" a "Resúmenes" (porque incluye pasados, presentes y futuros, no solo historial).
- **CTAs reordenados por estado del período activo**, sin el botón "Cuotas — Próximamente":
  - `actual`, `pagado` → `[Registrar consumo]` único.
  - `cerrado_esperando_pago` → `[Pagar resumen]` primario + `[Registrar consumo]` secundario.
  - `vencido` → banner full-width rojo + `[Pagar ahora]` primario rojo + `[Registrar consumo]` secundario.
  - `tarjeta_nueva` → estado vacío sin termómetro + `[Registrar primer consumo]`.
  - `inactiva con pendientes` → solo `[Pagar resumen]` cuando corresponde.
  - `inactiva sin pendientes` → estado vacío + `[Reactivar]` + `[Eliminar definitivamente]`.
- **Banner ámbar "se acerca" eliminado** (la columna ya muestra `vence DD/MM`). Solo se mantiene el banner rojo full-width para `overdue`.
- **Línea total de disponible** debajo del termómetro, con cuatro variantes: `Disponible $X de $Y` (normal), `Comprometido $X — $Z por encima del límite` (excede, rojo), `Disponible $Y de $Y` (sin compromisos), `"Cargá el límite para ver cuánto te queda"` (sin límite cargado).
- **Movimientos del período activo** se muestran todos sin paginación.
- **Acciones administrativas** (Editar, Archivar/Eliminar, Detalles) bajan a un footer discreto al pie.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`:
  - Requirement de detalle de tarjeta reescrito con la estructura del termómetro, las etiquetas/colores por estado, la matriz de CTAs y el comportamiento del límite (barra = usado, línea total = disponible).
  - Requirement del historial renombrado: la pantalla ahora se llama "Resúmenes" y el link de entrada es "Ver todos los resúmenes".
  - Requirement de mora visible actualizado: en el detalle, el banner ámbar "Se acerca" se elimina y queda solo el banner rojo full-width para `overdue`.

## Impact

- `apps/web/app/(app)/cards/[id]/page.tsx` y subcomponentes (`card-hero.tsx`, `quick-actions.tsx`, `payment-cta-block.tsx`, `card-details-section.tsx`): rediseño completo de la composición.
- Nuevos componentes: `cards-thermometer.tsx` (tres columnas) y `limit-summary.tsx` (línea de disponible).
- `apps/web/app/(app)/cards/[id]/periods/page.tsx`: cambio de título `<h1>`.
- Sin cambios de DB, de tipos generados, ni del backend (server actions, queries) — todo el cambio vive en presentación.
- Mobile (`apps/mobile`): fuera de scope para este change. Si la página equivalente existe en mobile, se replicará en un change posterior con el mismo IA.
