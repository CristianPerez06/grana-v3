## 1. Componentes nuevos

- [x] 1.1 Crear `apps/web/app/(app)/cards/_components/cards-thermometer.tsx`: renderiza las 3 columnas (en curso · próximo · siguiente). Recibe los 3 períodos derivados como prop y el límite total de la tarjeta. Aplica etiqueta y color de la columna activa según estado (`EN CURSO` / `POR PAGAR` / `VENCIDO` / `PAGADO`). Aplica umbrales de color en la barra individual (≤69 primario, 70-89 ámbar, ≥90 rojo). Muestra USD subordinado en cada columna si la tarjeta tiene USD activo. Muestra "sin cuotas" cuando el monto ARS de la columna es cero.
- [x] 1.2 Crear `apps/web/app/(app)/cards/_components/limit-summary.tsx`: línea total debajo del termómetro. Cuatro variantes (normal, sin compromisos, excede, sin límite). Cálculo: `disponible = credit_limit − Σ(pendingARS de las 3 columnas mostradas)`. ARS-only.

## 2. Refactor de componentes existentes

- [x] 2.1 Refactor `apps/web/app/(app)/cards/_components/card-hero.tsx`: simplificar. Ahora solo muestra identidad (nombre, banco, "Límite $X"). Sin monto grande, sin eyebrow, sin banners (los maneja la composición de la page).
- [x] 2.2 Refactor `apps/web/app/(app)/cards/_components/payment-cta-block.tsx`: usar la nueva matriz de CTAs por estado. Soportar CTA secundario `[Registrar consumo]` cuando corresponde (estados `cerrado_esperando_pago` y `vencido`).
- [x] 2.3 Eliminar `apps/web/app/(app)/cards/_components/quick-actions.tsx`. El botón "Cuotas — Próximamente" desaparece. `[Registrar consumo]` pasa al `PaymentCTABlock`.
- [x] 2.4 Reducir/eliminar `apps/web/app/(app)/cards/_components/card-details-section.tsx`: el bloque de límite migra al header + `LimitSummary`. Lo que queda (fecha de alta, fecha de archivado) se mueve al footer admin discreto al pie.

## 3. Página `/cards/[id]`

- [x] 3.1 Reescribir `apps/web/app/(app)/cards/[id]/page.tsx` con la nueva composición: breadcrumb → identidad (nombre + banco + límite) → banner rojo full-width si vencido → `<CardsThermometer />` → `<LimitSummary />` → CTAs → sección Movimientos del período actual (encabezado con link "Ver todos los resúmenes →") → footer admin (Detalles · Editar · Archivar/Eliminar).
- [x] 3.2 Caso `tarjeta_nueva` (no hay history ni en períodos pasados ni pagos): renderizar estado vacío sin termómetro. Copy y CTA según design.md sección 7.
- [x] 3.3 Caso `inactiva sin pendientes`: renderizar estado vacío con `[Reactivar]` únicamente (vía `InactiveCardBanner`). `[Eliminar definitivamente]` quedó fuera de scope — la action `deleteAccount` bloquea borrado de cuentas con historial transaccional. Documentado en design.md y spec.md.
- [x] 3.4 Caso `inactiva con pendientes`: termómetro normal + banner inactiva. CTA `[Pagar resumen]` cuando aplica (variante `inactiva` retorna null del `PaymentCTABlock`; el flow de pago vive en `/cards/[id]/periods/[periodId]/pay` accesible vía el listado de Resúmenes). NO renderizar `[Registrar consumo]`.
- [x] 3.5 Calcular "próximo" y "siguiente" como los dos `card_periods` con `start_date > activo.start_date` ordenados ascendente. Si no existen como filas reales, se **proyectan en memoria** (no se persisten) usando `suggestNextPeriodDates` iterativamente. Decisión: la página es de solo lectura, no debe hacer writes a la DB en cada render. Las filas reales se generan vía el flow lazy existente cuando una transacción aterriza en ese período.
- [x] 3.6 Eliminar el banner ámbar "El vencimiento se acerca" del hero. Solo se mantiene el banner rojo full-width para `overdue` (renderizado en la composición de la page).

## 4. Página `/cards/[id]/periods`

- [x] 4.1 Cambiar el `<h1>` de "Historial de resúmenes" a "Resúmenes" en `apps/web/app/(app)/cards/[id]/periods/page.tsx`.
- [x] 4.2 Verificar que la navegación desde el detalle (link "Ver todos los resúmenes →") apunta correctamente a esta página.

## 4b. Sección "Archivadas" en el listado (`/cards`)

- [x] 4b.1 Crear `apps/web/app/(app)/cards/_components/archived-cards-section.tsx`: sección colapsable (`<details>`, sin JS de cliente) que solo se renderiza si hay ≥1 archivada. Encabezado `Archivadas (N)`. Cada item linkea al detalle (`/cards/[id]`).
- [x] 4b.4 Alinear la regla de archivado con el master spec (Opción A: no se archiva con deuda). `getCreditCardDebtCheck` (`lib/cards/queries.ts`) bloqueaba solo deuda en períodos `closed`/`overdue`; ahora bloquea si **cualquier** período no-pagado tiene transacciones (incluye `open`/futuros, ej. cuotas). En consecuencia, una tarjeta inactiva nunca tiene deuda → el detalle de archivada es siempre "sin pendientes"; se elimina el render y el escenario "archivada con pendientes" (era inalcanzable bajo la regla A). El master spec ya definía A — driftaba solo la implementación.
- [x] 4b.2 Modificar `apps/web/app/(app)/cards/page.tsx`: traer todas las tarjetas con `includeArchived: true`, separar activas (`is_active=true`) de archivadas, pasar las activas al carrusel y las archivadas a `<ArchivedCardsSection />`. Motivo: el `[Reactivar]` del detalle (introducido por este redesign) era inalcanzable porque el listado filtraba las archivadas.
- [x] 4b.3 Banner-CTA de pago: `period-alert-banner.tsx` reemplaza el botón ancho de pago debajo del termómetro por un cartel contextual (rojo `vencido` / ámbar `cerrado_esperando_pago`) con el CTA integrado a la derecha. `PaymentCTABlock` queda solo con `[Registrar consumo]`. Motivo: el botón ancho parecía acción de tarjeta cuando en realidad pagaba solo el período activo.

## 5. Storybook (si aplica)

- [~] 5.1 Story para `CardsThermometer`. **N/A en esta iteración**: en este monorepo Storybook solo cubre primitivas de `components/ui/` (`Button`, `Card`, `Alert`, etc.); ningún componente feature de `app/(app)/cards/_components/` tiene stories. Mantener la convención: si en el futuro se decide darle Storybook a feature components, este se agrega como parte de ese cambio.
- [~] 5.2 Story para `LimitSummary`. **N/A en esta iteración** por la misma razón.

## 6. Validación spec y archive

- [x] 6.1 Ejecutar `pnpm openspec:check` — pasa.
- [x] 6.2 Verificación visual en el browser por el owner (sesión de revisión): EN CURSO con cuotas distribuidas 10/10/10, POR PAGAR (banner ámbar), VENCIDO (banner rojo), tarjeta nueva (estado vacío), sin límite cargado (hint), archivada sin pendientes, sección "Archivadas" en el listado, y el bloqueo de archivado con deuda. Durante la verificación se detectaron y corrigieron divergencias spec↔implementación (USD oculto en 0, "sin movimientos", banner-CTA contextual, regla de archivado A) y el delta se realineó a lo implementado antes de integrar.
- [x] 6.3 Deltas integrados en `openspec/specs/cards/spec.md` (requirements de carrusel, detalle, resúmenes y mora reescritos en la sección plana `## Requirements`; sin secciones de delta en el master). Change movido a `openspec/changes/archive/2026-05-25-redesign-card-detail-page/`.
