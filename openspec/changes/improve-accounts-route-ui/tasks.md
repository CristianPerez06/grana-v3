# Tasks — `improve-accounts-route-ui`

> Este change es una propuesta de **estilo/layout**. La implementación visual web se ejecuta en pasos pequeños sobre componentes existentes; mobile queda fuera de alcance acá.

## 1. Alineación previa

- [x] 1.1 Confirmar con el usuario que `docs/design/accounts/` es la referencia normativa (no autoritaria pixel-a-pixel, sí en jerarquía y composición).
- [x] 1.2 Releer el inventario de componentes y datos en `docs/design/accounts/README.md` para validar que no aparecieron campos nuevos en las queries desde el handoff.

## 2. Web — refinamientos visuales sobre componentes existentes

> Todos los pasos modifican **solo** estilo / layout / tipografía. No tocan props públicas, no agregan estado, no agregan acciones, no agregan datos.

- [x] 2.1 `AccountSection` — alinear título de sección (caps + tracking + tamaño) y contador con el handoff; mantener `border-dashed` para archivadas y `divide-y` entre filas.
- [x] 2.2 `AccountRow` — afinar jerarquía: nombre principal, institución como subtítulo opcional, ARS primario semibold + USD subordinado muted, badge `Archivada` inline en el title-line, kebab pegado al borde derecho.
  - [x] 2.2.a Stacking responsive bajo `< sm`: el `<Link>` interno colapsa a columna con identidad arriba y balances debajo (ambos `items-start`), volviendo a layout horizontal con balances `items-end` a partir de `sm`. Evita que nombres largos + badge compitan con montos largos.
  - [x] 2.2.b Badge `Archivada` en su propia línea (debajo del nombre, sobre el metadato de institución) — ya no inline. Evita overflow cuando hay nombres largos.
  - [x] 2.2.c Fix layout shift al abrir el kebab: `DropdownMenu` primitivo expone prop `modal` y `AccountRowMenu` pasa `modal={false}` para que Radix evite `react-remove-scroll`, que comprimía el viewport y hacía wrap el `PageHeader`.
  - [x] 2.2.d Outer row passa a `items-start sm:items-center`: bajo `< sm` el avatar (y el kebab) se alinean al inicio vertical de la fila apilada, en vez de flotar al centro mientras la fila crece en altura por el contenido apilado.
  - [x] 2.2.e Wrap del nombre bajo `< sm`: el `<Link>` interno deja de forzar `items-start` (cross-axis vuelve a `align-items: stretch` default), de modo que la columna de identidad ocupa todo el ancho disponible y el `max-w-full` del nombre constraine a parent width real. El nombre y el subtítulo de institución usan `break-words sm:truncate` para wrappear a múltiples líneas bajo `< sm` y volver a truncate con elipsis a partir de `sm`.
- [x] 2.3 `AccountsHint` — alinear con el card neutral del handoff (radio, padding, link de descarte). Sin cambios de copy ni de comportamiento de descarte (sigue siendo client-only sobre `localStorage`).
- [x] 2.4 `EmptyAccountsState` — alinear card del estado vacío. Verificar que el CTA sigue siendo `<Button asChild><Link href="/accounts/new">…</Link></Button>`.
- [x] 2.5 `AccountsHeader` — verificar que el "+ Crear cuenta" sigue siendo el `Button` primitivo y que el `disabled` mientras carga `institutions` no se rompe.
  - [x] 2.5.a `PageHeader` (primitivo global): el contenedor del título + actions pasa a `flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2` para apilar las acciones debajo del título bajo `< sm`. Spec delta en `specs/page-header/spec.md`.
- [x] 2.6 `ActiveAccountsSkeleton` / `ArchivedAccountsSkeleton` — actualizar shapes para que matcheen los nuevos paddings y la separación entre secciones, manteniendo el `min-h` actual.

## 3. Web — auditoría de no-goals

- [x] 3.1 Confirmar que no se agregaron totales por moneda al pie de sección, ni resumen global, ni sumatoria cross-cuenta.
- [x] 3.2 Confirmar que no se introdujo búsqueda, filtros (toolbar / chips) ni ordenamiento (default sigue siendo `created_at asc` del query existente).
- [x] 3.3 Confirmar que `AccountRowMenu` mantiene el set actual de acciones (`Editar`, `Archivar`, `Eliminar`, `Reactivar`) según el matriz `(is_active, has_transactions)` ya specificado en `accounts`.
- [x] 3.4 Confirmar que la ARS sigue siendo la principal y USD la subordinada por fila — sin conversión, sin merge.

## 4. Mobile

- [x] 4.1 Marcar `docs/design/accounts/mobile/accounts.html` como referencia disponible para el change mobile equivalente.
- [x] 4.2 No implementar nada en `apps/mobile/` desde este change.

## 5. Validación

- [x] 5.1 `pnpm openspec validate improve-accounts-route-ui --strict` (o equivalente del CLI) pasa.
- [x] 5.2 `pnpm openspec:check` pasa.
- [x] 5.3 `pnpm --filter web lint` pasa.
- [ ] 5.4 Snapshot manual en navegador de `/accounts` con: cero cuentas (empty), una cuenta (hint visible), varias cuentas en cash + bank, sección archivadas presente, error simulado por sección, error de ruta global.
