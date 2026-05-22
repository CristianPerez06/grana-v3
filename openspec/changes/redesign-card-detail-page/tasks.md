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

## 5. Storybook (si aplica)

- [~] 5.1 Story para `CardsThermometer`. **N/A en esta iteración**: en este monorepo Storybook solo cubre primitivas de `components/ui/` (`Button`, `Card`, `Alert`, etc.); ningún componente feature de `app/(app)/cards/_components/` tiene stories. Mantener la convención: si en el futuro se decide darle Storybook a feature components, este se agrega como parte de ese cambio.
- [~] 5.2 Story para `LimitSummary`. **N/A en esta iteración** por la misma razón.

## 6. Validación spec y archive

- [x] 6.1 Ejecutar `pnpm openspec:check` — pasa.
- [ ] 6.2 Verificación visual en el browser de los casos: período actual con cuotas en próximo, vencido, tarjeta nueva, sin límite cargado, archivada con pendientes. **Bloqueado en este entorno** (remoto sin browser). El owner debe correr `pnpm dev` y validar antes del merge.
- [ ] 6.3 Archivar el change con el skill `openspec-archive-change` antes del merge a `main`. Integrar los deltas en `openspec/specs/cards/spec.md` (sección 3 del checklist del CLAUDE.md). Se hace cuando el owner confirme la verificación visual de 6.2.
