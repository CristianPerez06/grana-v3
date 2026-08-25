## 1. Chips de filtro (web)

- [x] 1.1 Crear `apps/web/app/(app)/cards/_components/wallet-filter-chips.tsx` con la firma del nativo: `{ value: CardPredicateFilter, counts: Record<CardPredicateFilter, number>, onValueChange: (next: CardPredicateFilter) => void }`. Iterar `CARD_PREDICATE_FILTERS` de `@grana/cards`; reusar el mapa `FILTER_KEY` de labels (`all`/`in_use`/`due_soon`/`with_balance`) contra `t('compact.filters.*')`.
- [x] 1.2 Traducir los mecanismos del nativo a web: `<div role="radiogroup">` con `overflow-x-auto` + `flex-nowrap` y `shrink-0` por chip; cada chip un `<button type="button" role="radio" aria-checked={active} disabled={count === 0}>`. Tokens: activo `border-navy bg-navy` + texto blanco y conteo `text-navy-muted`; inactivo `border-border bg-card` + `text-text-muted` y conteo `text-text-soft`; deshabilitado `opacity-40`.
- [x] 1.3 Comentar en el componente por qué los chips se dimensionan por contenido y scrollean en vez de repartir el ancho (es la razón de no usar `Segmented`), como hace el nativo.

## 2. Estado de dos ejes en `CardsCompactView`

- [x] 2.1 Reemplazar `useState<ViewFilter>('by-bank')` por `mode: 'by-bank' | 'list'` (default `'by-bank'`) y `filter: CardPredicateFilter` (default `'all'`). Borrar la constante `FILTERS` de cinco elementos; el mapa `FILTER_KEY` queda para las labels.
- [x] 2.2 Agregar `counts = useMemo(() => countByFilter(cards), [cards])`. No recontar en el componente.
- [x] 2.3 Portar el efecto de guarda del nativo: `useEffect(() => { if (counts[filter] === 0) setFilter('all') }, [counts, filter])`, con el comentario que explica que cubre el refetch.
- [x] 2.4 Cambiar el render del cuerpo de `filter === 'by-bank'` a `mode === 'by-bank'`, y la rama plana a `sortCardsByDue(applyFilter(cards, filter))`.

## 3. Composición bajo `md`

- [x] 3.1 Montar el bloque `md:hidden`: `Segmented` de dos opciones (`by-bank` / `list`, labels `compact.filters.by_bank` y `compact.filters.list`) sobre `mode`.
- [x] 3.2 Renderizar `<WalletFilterChips>` dentro de ese bloque **solo** cuando `mode === 'list'`, pasando `filter`, `counts` y `setFilter`.

## 4. Composición en `md+`

- [x] 4.1 Montar el bloque `hidden md:block` con el `Segmented` de cinco opciones, derivando `value = mode === 'by-bank' ? 'by-bank' : filter` y despachando en `onValueChange`: `'by-bank'` → `setMode('by-bank')`; cualquier otra → `setMode('list')` + `setFilter(next)`.
- [x] 4.2 Marcar `disabled: counts[value] === 0` en las cuatro opciones de predicado (nunca en `by-bank`), para que la guarda de 2.3 solo pueda dispararse por un refetch y no por una selección del usuario.
- [x] 4.3 Dejar un comentario en el componente explicando que las dos composiciones son proyecciones del mismo estado y por qué la bifurcación es por CSS y no por `useIsMobile` (flash en el primer paint).

## 5. Verificación

- [x] 5.1 `pnpm typecheck` y `pnpm lint` en verde.
- [x] 5.2 Revisar a 390px: las dos opciones del segmentado y las cuatro etiquetas de chip se leen completas, sin recorte ni aplastado, y la ruta no scrollea horizontal.
- [x] 5.3 Revisar el ida y vuelta: elegir `En uso`, pasar a `Por banco`, volver a `Lista` → sigue `En uso`; y cruzar el breakpoint con un predicado activo → el otro control aparece con la misma selección.
- [x] 5.4 Revisar un predicado sin resultados: chip deshabilitado bajo `md` y segmento deshabilitado en `md+`, en ambos casos no seleccionable.

## 6. Cierre del change

- [x] 6.1 Archivar el change en la branch: mover a `openspec/changes/archive/YYYY-MM-DD-split-web-wallet-filter-axes/` y aplicar los deltas sobre `openspec/specs/cards/spec.md` (integrar los dos requirements MODIFIED en la sección plana, sin dejar secciones de delta).
- [x] 6.2 `pnpm openspec:check` en verde.
