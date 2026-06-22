## Why

La card "Comprometido" del dashboard (1) inflaba su número en producción —sumaba la deuda `pending` de TODOS los resúmenes de tarjeta impagos, incluidas cuotas y períodos que vencen meses adelante (~2,7× en datos reales)— y (2) tiene problemas de UX: tiles con íconos cuadrados poco claros, USD inconsistente (presente en una sección y no en otra ni en el total), y espacio en blanco porque la card se estira para igualar "Balance del mes". Un fix interino del cálculo ya está en branch; este cambio rehace el modelo y el diseño de la card de forma coherente.

## What Changes

- **BREAKING (significado del número):** "Comprometido" deja de ser "lo del próximo mes (stock de deuda total + recurrentes mes+1)" y pasa a responder **"¿qué tengo que pagar y todavía no pagué?"** — modelo "obligaciones pendientes".
- **Tarjeta · a pagar:** la deuda de tarjeta usa la MISMA definición/número que el header del módulo Tarjetas ("A pagar": resúmenes cerrados/vencidos impagos = suma de consumos `pending` menos reintegros recibidos). Se quita la suma de resúmenes futuros y NO se incluye "en curso".
- **Recurrencias · pendientes de confirmar:** sólo las instancias `recurrence_instances.status='pending'`. NO se proyectan "fijos del próximo mes": una recurrencia, al llegar su momento, se vuelve pendiente de confirmar (y si va con tarjeta, su deuda ya está en la sección Tarjeta), así que una proyección futura no es obligación presente.
- **Total a pagar** = tarjeta a pagar + recurrencias pendientes de confirmar.
- **Contexto "Ya entra":** se conserva el ingreso recurrente del mes próximo + la banda de cierre neto; es contexto y NO suma al total.
- **UI:** se reemplazan los tiles cuadrados por secciones con filas; cada sección lista sus **3-4 movimientos de mayor monto** (rellena el espacio en blanco). **USD consistente** en el total y en cada sección (bimoneda por defecto). Chip de aviso "incluye $X vencido" sólo cuando hay deuda vencida.
- **Paridad mobile:** `CommittedSection` nativa adopta el mismo modelo (consume la misma query compartida de `@grana/dashboard`).

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `dashboard`: cambian los requerimientos de la card "Comprometido" — qué suma (a pagar de tarjeta + recurrencias pendientes de confirmar, no el stock total ni futuros), cómo presenta el desglose (secciones con top-movimientos), la consistencia de USD, el aviso de vencido, y la paridad de contenido entre web y mobile.

## Impact

- **Specs:** `openspec/specs/dashboard/spec.md` (requerimientos de la card Comprometido: cálculo, contenido, layout web+mobile).
- **Datos (`packages/dashboard`):** `getCommittedOutlook` / `CommittedOutlook` types — reusar la lógica de "A pagar" de `apps/web/lib/cards/month-summary.ts` (mover/compartir a `@grana/dashboard` o `@grana/money-logic` para que mobile la consuma), traer recurrencias `status='pending'`, y los top-N movimientos por sección.
- **Web:** `apps/web/app/(app)/dashboard/_components/committed-section.tsx` + `committed-skeleton.tsx`.
- **Mobile:** `apps/mobile/components/dashboard/CommittedSection.tsx` + `CommittedSkeleton.tsx`.
- **i18n:** claves nuevas/renombradas en `packages/i18n-messages` (es/en): "a pagar", "pendientes de confirmar", "fijos del próximo mes", aviso de vencido.
- **Handoff:** `docs/design/dashboard-comprometido/` (mockup web aprobado; falta mockup mobile).
- **Relación:** depende conceptualmente del fix interino en `fix/dashboard-cards-polish`; encaja en el roadmap de lentes COMPROMISO.
