# Design — `improve-accounts-route-ui`

## Contexto

`/accounts` ya existe y ya está specificada en dos requirements del capability `accounts`:

- `El usuario puede ver la lista de sus cuentas agrupadas por tipo` — agrupación, kebab por fila, datos requeridos (`has_transactions`), comportamiento de menú.
- `El header de /accounts se renderiza desde el primer paint y sus secciones cargan independientemente` — chrome de header en `layout.tsx`, `loading.tsx`, scaffold de `<Suspense>` con `<SectionFallback>` por sección, `AccountsErrorBoundary` como red de seguridad.

Lo que falta es **fijar el handoff visual** (`docs/design/accounts/`) como referencia normativa y dejar codificados los **límites de alcance** (no totales, no búsqueda, no filtros, no acciones nuevas, no datos nuevos). Sin esa codificación, cualquier siguiente vuelta visual queda libre de re-abrir esas discusiones.

## Decisión 1 — Agregar **una** sola requirement nueva, no modificar las existentes

**Alternativas evaluadas:**

- A. Modificar el requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo" para inyectar el handoff visual y los no-goals.
- B. Modificar ambos requirements existentes (`lista agrupada` + `header desde el primer paint`).
- C. **Elegida.** Agregar un requirement nuevo, focalizado en el handoff visual y los límites de alcance, complementario a los existentes.

**Por qué C:**

- Los requirements existentes ya describen comportamiento (datos, menú, scaffold). Mezclar handoff visual + no-goals en esos requirements los infla y los aleja de su propósito.
- Un requirement nuevo, focalizado, deja un lugar canónico al que apunta el archive futuro de este change y cualquier rediseño posterior.
- MODIFIED Requirements en OpenSpec exige reescribir el requirement completo (header + body + todos los scenarios), lo cual sería más superficie modificada por una mejora de estilo.

## Decisión 2 — Web y mobile como implementaciones nativas en paralelo

Se sigue la política `Web ↔ Mobile policy` de `AGENTS.md`:

- JSX **no** se comparte entre web y RN.
- La paridad se mantiene en **estructura** (header → hint condicional → sección activa → sección archivada → estados) y **jerarquía visual** (ARS primario, USD subordinado, badge `Archivada`, kebab al final de la fila).
- El handoff documenta web y mobile como dos archivos hermanos (`docs/design/accounts/web/accounts.html` y `docs/design/accounts/mobile/accounts.html`) sobre el mismo `shared.css` de referencia (no autoritativo).
- Este change **implementa solo web**. Mobile queda como follow-up.

## Decisión 3 — No-goals codificados explícitamente como parte del requirement

Para que el rediseño no se convierta en vector de scope creep, el requirement incluye una sección explícita de scenarios "NO". Cubre:

- No se agregan totales por moneda al pie de sección ni globales.
- No se agregan búsqueda, filtros ni ordenamiento.
- No se agregan métricas derivadas (e.g. "cuántas cuentas activas") más allá del contador de filas que ya existe en `AccountSection`.
- No se agregan acciones de cuenta más allá de las que ya expone `AccountRowMenu`.
- No se agregan cards de resumen ni hero overview.
- No se introducen nuevos datos en las queries (`getCashAndBankAccounts` y `getInstitutions` quedan idénticas).

Cualquier cambio que viole un no-goal exige un change nuevo y modificar este requirement (no se hace en este change).

## Decisión 4 — Mantener el `Button` primitivo y la regla bimoneda como restricciones del requirement

Estas dos reglas ya están en `AGENTS.md` como cross-cutting principles, pero quedan repetidas en el requirement por dos razones:

1. **Discoverability**: al releer el spec en frío en seis meses, no hay que cruzar con AGENTS.md para ver que la fila respeta bimoneda y que el header usa `Button`.
2. **Detectabilidad**: un scenario explícito hace que un futuro reviewer pueda apuntar a "este scenario lo prohíbe" si alguien intenta inline-stylizar el botón o sumar monedas.

## Decisión 5 — No tocar el shell de carga ni el error boundary

Los skeletons (`ActiveAccountsSkeleton`, `ArchivedAccountsSkeleton`) MAY actualizarse para matchear los nuevos paddings (tarea 2.6), pero el contrato del scaffold (header en `layout.tsx`, `loading.tsx` cubriendo el área de contenido, `<Suspense>` per sección, `SectionFallback` y `AccountsErrorBoundary`) NO cambia. Esa parte está specificada en el otro requirement de `accounts` (`El header de /accounts se renderiza desde el primer paint…`) y queda intacta.

## Riesgos y mitigaciones

- **Riesgo**: implementar el rediseño y a último momento agregar un "total por moneda al pie" porque visualmente cierra. **Mitigación**: scenarios "NO" del requirement nuevo + auditoría 3.x de tareas.
- **Riesgo**: el rediseño se aplica primero a web y mobile queda permanentemente desfasada. **Mitigación**: el requirement deja constancia de que la paridad mobile es responsabilidad de un change futuro, con referencia explícita al handoff en `docs/design/accounts/mobile/`.
- **Riesgo**: scope creep encubierto vía "ajustes menores al menú de fila". **Mitigación**: este change NO toca `AccountRowMenu` ni `account-confirm-dialog`; los items y la matriz `(is_active, has_transactions)` siguen specificados en el requirement existente.

## Out of scope

- `/accounts/new` (drawer de creación) — su look se mantiene como está.
- `/accounts/[id]` (detalle de cuenta) — rediseñado en `2026-06-06-redesign-account-detail-route`.
- Tarjetas de crédito (`/cards`).
- Cualquier cambio de query, action, o tipo en `lib/accounts/`.
- Mobile (`apps/mobile/`).
