## 1. Capa pura compartida (`@grana/cards`)

- [x] 1.1 En `packages/cards/src/grouping.ts`, exportar `CardPredicateFilter = Exclude<ViewFilter, 'by-bank'>` sin tocar el tipo `ViewFilter` (web lo sigue usando tal cual).
- [x] 1.2 En el mismo archivo, agregar `countByFilter(cards): Record<CardPredicateFilter, number>`, implementado sobre `applyFilter` para que conteo y filtrado no puedan divergir.
- [x] 1.3 Re-exportar ambos desde `packages/cards/src/index.ts`.
- [x] 1.4 Cubrir `countByFilter` en `packages/cards/src/__tests__/grouping.test.ts`: lista vacía (los cuatro conteos en 0), tarjetas que caen en más de un predicado, y paridad `countByFilter(cards)[f] === applyFilter(cards, f).length` para los cuatro predicados.

## 2. i18n

- [x] 2.1 Agregar `cards.compact.filters.list` a `packages/i18n-messages/src/es.json` (`"Lista"`) y a `en.json` (`"List"`). Los cuatro labels de predicado y `by_bank` se reutilizan sin cambios.

## 3. Chips de filtro (mobile)

- [x] 3.1 Crear `apps/mobile/components/cards/WalletFilterChips.tsx`: recibe filtro activo, conteos y `onChange`; renderiza los cuatro chips con su conteo dentro de un `ScrollView horizontal` (`showsHorizontalScrollIndicator={false}`), chips dimensionados por contenido.
- [x] 3.2 Chip con conteo 0 → deshabilitado (`opacity-40`, sin `onPress`), mismo tratamiento que la opción disabled del primitivo `Segmented`.
- [x] 3.3 Estilar con tokens existentes (`bg-card` / `bg-border-soft` / `border-border` / `text-text` / `text-text-muted`), sin hex literales ni aliases shadcn (`bg-muted`, `bg-primary`) que en mobile renderizan transparente.
- [x] 3.4 `accessibilityRole="radio"` por chip con `accessibilityState={{ selected, disabled }}`, dentro de un contenedor `radiogroup`.

## 4. `Wallet.tsx` (mobile)

- [x] 4.1 Partir el estado: `mode: 'by-bank' | 'list'` + `filter: CardPredicateFilter`; el `Segmented` pasa a dos opciones (`by_bank`, `list`) y los chips se renderizan solo en modo `list`. La selección de chip persiste al ir y volver a `Por banco`.
- [x] 4.2 Si el filtro seleccionado queda en 0 resultados tras un refetch, volver a `'all'`.
- [x] 4.3 Memoizar `countByFilter(cards)` con `useMemo` sobre `cards`.
- [x] 4.4 Reescribir el encabezado de `BankGroupMobile` a dos líneas: contenedor `[chevron centrado | bloque de 2 líneas]`; línea 1 = dot + nombre (`numberOfLines={1}`, `flex-1`/`min-w-0`) + total a pagar (`shrink-0`, `tabular-nums`); línea 2 = meta (`numberOfLines={1}`, `flex-1`) + chip de urgencia (`shrink-0`).
- [x] 4.5 Renderizar el chip de urgencia solo cuando `group.tone !== 'ok'`.
- [x] 4.6 Reemplazar los colores inexistentes del tono `soon`: `bg-amber` → `bg-warning` (dot de fila), `bg-amber/10` → `bg-warning-soft` (fondo de chip), `text-amber` → `text-warning-deep` (texto de chip).

## 5. Verificación

- [x] 5.1 `pnpm --filter @grana/cards test` (el `pnpm test` de la raíz solo corre `apps/web/lib/**`), `pnpm typecheck:mobile` y `pnpm lint:mobile` en verde.
- [x] 5.2 `pnpm typecheck` y `pnpm lint` (web) en verde — garantiza que el agregado a `@grana/cards` no rompió el consumidor web.
- [ ] 5.3 Chequeo visual en device/simulador de `/cards`: encabezado de dos líneas con banco de nombre largo, grupo al día sin chip, tono "por vencer" visible en dot y chip, modo `Lista` con chips y conteos, chip en 0 deshabilitado. PENDIENTE: el simulador de la máquina está ocupado por otro proyecto (Metro en 8081) y el deep link del dev-client abrió esa app; lo corre el usuario.
- [x] 5.4 Confirmar que `apps/web/app/(app)/cards/_components/cards-compact-view.tsx` quedó sin cambios.

## 6. Cierre

- [ ] 6.1 Archivar el change siguiendo el checklist post-archive de `AGENTS.md` (mover a `openspec/changes/archive/YYYY-MM-DD-cards-mobile-density/`, aplicar los deltas sobre `openspec/specs/cards/spec.md` sin dejar secciones delta, `pnpm openspec:check` en verde).
