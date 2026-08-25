## Context

`CardsCompactView` es la única vista de la billetera en `apps/web`: `wallet.tsx:38` la renderiza sin condición de ancho. Hoy modela los controles con un solo `useState<ViewFilter>`, donde `ViewFilter = 'by-bank' | 'all' | 'in-use' | 'due-soon' | 'with-balance'` mezcla el modo de vista con los predicados.

El nativo (`apps/mobile/components/cards/Wallet.tsx`) ya tiene el modelo correcto —`mode` + `filter`, chips con conteo, efecto de guarda— y la lógica pura vive compartida en `@grana/cards`. Este design resuelve la única pregunta abierta que quedaba: **cómo convive la composición nativa bajo `md` con el segmentado de cinco opciones que desktop conserva**, sin duplicar el estado ni bifurcar el componente.

La decisión de alcance ya está tomada: el patrón de dos controles entra **solo bajo `md`**; desktop mantiene su composición actual.

## Goals / Non-Goals

**Goals:**

- Que `by-bank` deje de ser excluyente con los predicados: espiar el agrupado no cuesta la selección, en ningún ancho.
- Que a 390px ninguna etiqueta de filtro se corte ni se aplaste.
- Que los conteos salgan de `countByFilter` de `@grana/cards`, sin recontar en el componente.
- Que la composición de desktop siga siendo la de hoy.
- Un solo estado para las dos composiciones: nada que reconciliar al cruzar el breakpoint.

**Non-Goals:**

- Cambiar la composición de desktop (sigue el `Segmented` de cinco opciones en una fila).
- Persistir el modo o el filtro entre sesiones o en la URL (el no-goal de persistencia del requirement sigue vigente).
- Tocar `packages/cards`, `packages/ui-contracts` o las strings: `CardPredicateFilter`, `countByFilter`, `SegmentedOption.disabled` y `cards.compact.filters.list` ya existen.
- Búsqueda de texto libre (sigue fuera de alcance por el requirement de no-goals).

## Decisions

### 1. Un estado, dos proyecciones — no dos estados

`mode: 'by-bank' | 'list'` y `filter: CardPredicateFilter` son la única fuente de verdad, en las dos composiciones. El segmentado de desktop se deriva:

```
value = mode === 'by-bank' ? 'by-bank' : filter
onValueChange(next):
  next === 'by-bank' ? setMode('by-bank')
                     : (setMode('list'), setFilter(next))
```

**Alternativa descartada:** mantener `ViewFilter` en desktop y `mode`+`filter` bajo `md`, cada composición con su estado. Obliga a sincronizarlos en cada render y deja al usuario varado al cambiar de ancho (rotar el teléfono, achicar la ventana): el control que aparece no refleja lo que el otro tenía seleccionado. El costo de la proyección es una función de cuatro líneas; el costo de dos estados es un bug de sincronización permanente.

Nótese que la proyección es **total pero no biyectiva**: `mode === 'list'` con `filter === 'all'` y el segmento `Todas` son el mismo punto. Eso es exactamente lo que hace que cruzar el breakpoint sea continuo en las dos direcciones.

### 2. Bifurcar por CSS, no por JS

Las dos composiciones se montan siempre; se alternan con `md:hidden` / `hidden md:block`. Es la convención que fija `web-responsive-layout` ("el ajuste se logra con clases responsive (mobile-first), preservando el render de desktop existente") y no tiene costo de primer paint.

**Alternativa descartada:** `useIsMobile()` (`apps/web/lib/use-is-mobile.ts`). Existe y tiene un consumidor, pero su docstring acota el caso de uso: devuelve `false` hasta montar, lo cual es inocuo para un drawer que se abre por interacción y **no** lo es para un control que forma parte del primer paint de `/cards`. En un teléfono mostraría el segmentado de cinco opciones aplastado por un frame — justo el síntoma que este change viene a sacar. Además choca con la regla de chrome visible desde el primer paint.

El costo es que el DOM lleva las dos composiciones. La oculta queda con `display: none`, que la saca del árbol de accesibilidad, así que no hay `radiogroup` duplicado expuesto ni foco alcanzable en el control invisible.

### 3. Deshabilitar las opciones vacías en las dos composiciones

El efecto de guarda del nativo es `if (counts[filter] === 0) setFilter('all')`, con dependencias `[counts, filter]`. En mobile solo se dispara por un refetch, porque el chip vacío está deshabilitado y el usuario nunca puede seleccionarlo. Portado tal cual a un desktop cuyos cinco segmentos son todos seleccionables, el mismo efecto se dispararía **por la selección del usuario**: elegís "Con saldo", la vista rebota a "Todas" y no hay nada que explique por qué.

Por eso el segmentado de desktop pasa a marcar `disabled: counts[value] === 0` en las opciones de predicado (nunca en `by-bank`, que no es un predicado y siempre tiene algo que mostrar). Con eso, en las dos composiciones el efecto queda reducido a lo que el nativo ya asume: una red de contención para el refetch.

**Alternativa descartada:** dejar desktop sin `disabled` y sin guarda, y aplicar la guarda solo bajo `md`. No es implementable sin volver a bifurcar el estado por ancho — el efecto vive en el componente, no en el CSS — y produciría la incoherencia de que la misma app se comporta distinto según el ancho con el mismo estado adentro.

**Alternativa descartada:** poner conteos también en los segmentos de desktop. Es el camino a que desktop termine adoptando los chips de a poco, que es precisamente lo que la decisión de alcance descartó. `disabled` alcanza para que el filtro vacío se vea antes de tocarlo.

### 4. `WalletFilterChips` web: mismo nombre, mismas props, implementación propia

Nuevo `apps/web/app/(app)/cards/_components/wallet-filter-chips.tsx`, con la firma del nativo (`value`, `counts`, `onValueChange`). Espejo por nombre y contrato, no por JSX — es la política Web ↔ Mobile del repo, y la misma que ya siguen los dos `Wallet`.

Traducción de mecanismos, no de clases: el `ScrollView horizontal` del nativo es `overflow-x-auto` + `flex-nowrap` con `shrink-0` por chip; el `Pressable` es un `<button type="button">` con `role="radio"` dentro de un `role="radiogroup"`, `aria-checked` y `disabled` nativo. Los tokens (`bg-navy`, `border-border`, `bg-card`, `text-text-muted`, `text-text-soft`) son los que ya usa el nativo y existen en la punta web.

En `md+` la fila simplemente no necesita scroll: los cuatro chips entran. No hace falta una variante.

### 5. Los chips se renderizan solo en modo Lista

Igual que el nativo. En modo `by-bank` el predicado no está aplicado —la vista agrupada muestra todas las tarjetas— así que mostrar chips ahí sería ofrecer un control que no hace nada. El filtro sigue vivo en el estado, invisible, esperando la vuelta a Lista.

## Risks / Trade-offs

- **[El DOM lleva las dos composiciones]** → `display: none` las excluye del árbol de accesibilidad y del orden de tabulación. El peso extra es un `Segmented` de cinco items o un `Segmented` de dos más cuatro botones: irrelevante frente a la lista de tarjetas que acompañan.
- **[Desktop cambia de comportamiento al deshabilitar segmentos vacíos]** → Es aditivo y no altera el layout: un segmento que hoy lleva a una lista vacía pasa a verse no seleccionable con el `disabled:opacity-40` que el primitivo ya define. Está declarado en el proposal y speceado en el scenario `(web)` nuevo, no es un efecto colateral silencioso.
- **[La guarda podría pelear con una selección legítima]** → Solo puede disparar cuando `counts[filter] === 0`, y en ese estado el control que llevó ahí está deshabilitado en las dos composiciones. La única entrada posible es un refetch que vacía el predicado activo, que es exactamente el caso que la guarda existe para cubrir.
- **[El conteo podría divergir de la lista]** → No puede: `countByFilter` está construido sobre `applyFilter`, la misma función que arma la lista, y eso está cubierto por tests en `packages/cards/src/__tests__/grouping.test.ts`. El componente no recuenta.
- **[`ViewFilter` queda con un consumidor menos]** → El tipo sigue exportado y usado por `applyFilter`, que acepta el union completo. No se borra nada de `@grana/cards` en este change.
