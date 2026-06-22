## Context

La card "Comprometido" vive en `packages/dashboard` (query `getCommittedOutlook` + tipos `CommittedOutlook`) y se renderiza en web (`apps/web/app/(app)/dashboard/_components/committed-section.tsx`) y mobile (`apps/mobile/components/dashboard/CommittedSection.tsx`), ambos consumiendo la misma query compartida. Hoy la deuda suma TODOS los resúmenes impagos (infla con cuotas futuras) y el "A pagar" canónico vive en el módulo Tarjetas (`apps/web/lib/cards/month-summary.ts`, función `summarizeCardsMonth` sobre `derivePeriodStatus` de `@grana/money-logic`). Las recurrencias pendientes se leen con `getPendingRecurrenceInstances` (`apps/web/lib/recurrences/queries.ts`) sobre `recurrence_instances.status='pending'`. Mockup web aprobado en `docs/design/dashboard-comprometido/web/comprometido.html`.

## Goals / Non-Goals

**Goals:**
- Que el número "a pagar" de tarjeta de Comprometido sea EXACTAMENTE el mismo que el header del módulo Tarjetas (una sola fuente de verdad).
- Modelo "obligaciones pendientes": total = tarjeta a pagar + recurrencias pendientes de confirmar.
- Desglose con top-3/4 movimientos por sección; USD consistente; aviso de vencido.
- Paridad web/mobile vía la query compartida.

**Non-Goals:**
- Rediseñar otras cards del dashboard, ni la tira "Compartido".
- Mover/redefinir "en curso" (sigue siendo del módulo Tarjetas).
- Un pronóstico de caja multi-mes (esta card es presente + mes+1, no un forecast).

## Decisions

- **Reusar "A pagar" del módulo Tarjetas, no duplicar la matemática.** Extraer la lógica pura de `month-summary.ts` (suma de `pending` − reintegros sobre resúmenes cerrados/vencidos) a un lugar compartido (`@grana/money-logic` o `@grana/dashboard`) para que `getCommittedOutlook` y el módulo Tarjetas (web) la consuman, y mobile también. Alternativa descartada: recalcular en `getCommittedOutlook` con otro filtro → riesgo de divergencia con el header de Tarjetas.
- **Recurrencias pendientes = `status='pending'`.** Es estado concreto y barato (un read), no matcheo de reglas vs transacciones generadas. La proyección "fijos del mes próximo" reusa `projectUpcomingOccurrences` (ya en uso). 
- **`getCommittedOutlook` devuelve el desglose + top-N.** El tipo `CommittedOutlook` crece para incluir, por moneda: `cardToPay`, `recurringPending`, `recurringNextMonth`, `overdue` (para el aviso), y `topItems` por sección (3-4, ordenados por monto desc). El cálculo de "top-N" se hace en la query/aggregations (puro y testeable).
- **El total NO incluye fijos del mes próximo ni ingresos.** Decisión de producto ya tomada.
- **Fix interino vs rediseño.** El fix de la branch `fix/dashboard-cards-polish` (deuda = vencido + mes próximo) corta la inflación YA; este rediseño lo reemplaza por "A pagar" del módulo Tarjetas. Al implementar, partir de `main` ya con el fix mergeado.

## Risks / Trade-offs

- **[Mover lógica de `apps/web/lib/cards` a un paquete]** → puede arrastrar dependencias; mitigar extrayendo SÓLO la función pura (sin Supabase) y dejando el fetch en cada app.
- **[Top-N consumos exige traer transacciones por resumen]** → más datos en la query del dashboard; mitigar limitando a los resúmenes "a pagar" y a top-N por monto.
- **[Paridad mobile]** → la UI nativa hay que rehacerla a la par; mitigar manteniendo todo el cálculo en la query compartida, así mobile sólo cambia presentación.
- **[Cambio de significado del número en producción]** → comunicar; el subtítulo nuevo ("lo que tenés que pagar") ayuda a que el cambio se entienda.

## Resolved

- **NO se proyectan "fijos del próximo mes"** (confirmado). Una recurrencia, al llegar su momento, se vuelve "pendiente de confirmar"; al confirmarla deja de ser obligación (o, si va con tarjeta, su deuda ya está en la sección Tarjeta). Una proyección futura no es obligación presente. La sección Recurrencias = sólo "pendientes de confirmar".
- **Ingreso recurrente ("Ya entra" + banda de cierre neto): SE CONSERVA** (confirmado). Contexto cuando hay ingreso recurrente el mes próximo; NO suma al total a pagar. (Asimetría aceptada: es la única proyección que queda, justificada como cierre tranquilizador.)
- **Wording final (es):** subtítulo "Plata que ya está comprometida"; titular "Total a pagar"; "Tarjeta · a pagar"; "Recurrencias · pendientes de confirmar"; aviso "Incluye $X vencido sin pagar".
- **Mockup mobile: aprobado** (`docs/design/dashboard-comprometido/mobile/comprometido.html`). Misma estructura en una columna; top-3 consumos de tarjeta y top-2 recurrencias.

## Open Questions

- **Paralelo en inglés** del wording final (en.json).
