## Context

`apps/mobile/components/cards/Wallet.tsx` es un port casi literal de `apps/web/app/(app)/cards/_components/cards-compact-view.tsx`. El port trajo la composición de web pero no sus defensas de ancho angosto: web trunca el nombre del banco (`min-w-0 truncate`), esconde el meta del grupo bajo `sm` (`hidden sm:inline`) y marca todo lo demás `shrink-0`. Mobile no tiene `numberOfLines` en ningún `<Text>` del encabezado ni ninguna regla de shrink, y corre siempre a ancho de teléfono.

Presupuesto de ancho real, iPhone 390pt: 390 − 48 (padding de la `ScrollView`, `px-6`) − 32 (padding de la card, `px-4`) ≈ **310pt útiles**. El encabezado actual pide ~420pt (chevron 16 + dot 10 + nombre ~95 + meta ~110 + monto ~75 + chip ~85 + 5 gaps de 10). Los controles de vista piden 5 opciones `flex-1` de ~62pt cada una para labels de hasta ~95pt ("Vencen pronto").

La lógica de vista pura ya vive en `@grana/cards` (`groupCardsByBank`, `applyFilter`, `sortCardsByDue`, `cardTone`, `cardUsePercent`) y la comparten ambas plataformas. Este change es de presentación: no toca esa lógica salvo para **agregar** un helper de conteo.

## Goals / Non-Goals

**Goals:**

- Que el encabezado de grupo entre a ancho de teléfono sin aplastar texto ni cortar el chip, conservando la misma información.
- Que los controles de vista sean legibles y separen modo de vista (agrupado vs plano) de filtro (predicado).
- Que el tono "por vencer" sea visible (hoy no lo es, por clases de color inexistentes).
- Que la divergencia con web quede documentada en el spec con escenarios etiquetados, no como drift silencioso.

**Non-Goals:**

- Tocar `apps/web`. Web tiene ancho de sobra en desktop y ya resolvió su caso angosto escondiendo el meta; su composición no cambia.
- Cambiar semántica contable, queries, orden, auto-colapso, filas de 2 líneas por tarjeta, hero del mes o sección Archivadas.
- Búsqueda de texto libre (sigue fuera de alcance, como fija el spec actual).
- Migrar `text-amber-700` de `RecurrenceInstancesList.tsx` (misma familia de problema, otra ruta; se resuelve donde corresponda).

## Decisions

### 1. Encabezado a dos líneas, chevron centrado

El encabezado pasa a `flex-row` externo `[chevron | bloque de dos líneas]`, con el chevron alineado al centro vertical del bloque:

```
┌────────────────────────────────────────────┐
│ ▾  ● Banco Galicia              $284.500   │
│      3 tarjetas · 2 en uso    [vence 25/06]│
└────────────────────────────────────────────┘
```

- Línea 1: dot (`shrink-0`) + nombre (`numberOfLines={1}`, `flex-1`/`min-w-0`) + monto (`shrink-0`, `tabular-nums`).
- Línea 2: meta (`numberOfLines={1}`, `flex-1`) + chip (`shrink-0`).
- La indentación de la línea 2 se logra con el gap del contenedor (el bloque de dos líneas ya arranca después del chevron); el dot **no** empuja la línea 2 — se acepta que el meta arranque alineado con el dot y no con el nombre, para no meter un spacer artificial.

**Alternativa descartada**: mantener una línea y esconder el meta como hace web (`hidden sm:inline`). En mobile no hay breakpoint superior donde el meta reaparezca, así que esconderlo sería perderlo siempre. Dos líneas conserva la información y da aire a nombres de banco largos.

**Alternativa descartada**: encabezado que cambia de forma al expandir (meta solo cuando está colapsado). El encabezado saltaría de alto al togglear, y el toggle es la interacción principal de la vista.

### 2. Chip de urgencia condicional

Se renderiza solo cuando `group.tone !== 'ok'` (misma condición que web ya usa para decidir si el badge muestra fecha o el texto "Al día"; mobile simplemente no renderiza nada en el caso `ok`). El estado "al día" queda expresado por la ausencia de chip, por el monto en $0 y por los dots por fila.

Web sigue mostrando el badge "Al día" siempre: en desktop el ancho sobra y el badge da simetría a la fila. La divergencia es deliberada y va al spec con escenarios `(mobile)` / `(web)`.

### 3. Modo de vista y filtro son dos estados, no uno

Hoy hay un `useState<ViewFilter>` único donde `'by-bank'` compite con los predicados. Mobile pasa a dos estados locales:

```ts
const [mode, setMode] = useState<'by-bank' | 'list'>('by-bank')
const [filter, setFilter] = useState<CardPredicateFilter>('all')
```

- `CardPredicateFilter = Exclude<ViewFilter, 'by-bank'>` se exporta desde `@grana/cards`. **El tipo `ViewFilter` no cambia** — web lo sigue usando tal cual, así que no hay ruptura de contrato.
- `applyFilter` acepta esos cuatro valores sin modificaciones.
- El chip elegido persiste al alternar a `Por banco` y volver: el agrupado siempre muestra todas las tarjetas, y volver a `Lista` recupera el último filtro. No se resetea a `Todas` porque perder la elección al mirar el agrupado un segundo es fricción gratuita.

**Alternativa descartada**: agregar `'list'` a `ViewFilter` en el package. Contaminaría el tipo compartido con un concepto que solo mobile tiene, y web tendría que excluirlo a mano.

### 4. Chips con conteo, en fila con scroll horizontal

Los cuatro chips con su conteo ("Todas 7", "En uso 3", "Vencen pronto 2", "Con saldo 4") suman ~330–360pt: entran justo o no entran, según el idioma y el ancho del device. Se renderizan en un `ScrollView horizontal` con chips **dimensionados por contenido** (`showsHorizontalScrollIndicator={false}`, `contentContainerClassName` con gap). Nunca se aplastan, y si mañana se agrega un filtro o se traduce a un idioma más largo, sigue funcionando.

**Alternativa descartada**: `flex-wrap` a dos filas. Se come alto vertical de forma impredecible (1 o 2 filas según el ancho) justo arriba del contenido que importa.

**Conteos**: helper puro nuevo en `packages/cards/src/grouping.ts`:

```ts
export const countByFilter = (cards: CreditCardSummary[]): Record<CardPredicateFilter, number>
```

Implementado sobre `applyFilter` para que el conteo no pueda divergir del filtrado (una sola definición de cada predicado). Vive en el package porque es lógica de vista pura y el spec del repo prohíbe duplicarla en `apps/`.

**Chips en 0**: se renderizan `disabled` (mismo tratamiento visual que la opción disabled del primitivo `Segmented`: `opacity-40`, sin `onPress`), para no ofrecer un camino a una lista vacía. Si el filtro seleccionado cae a 0 tras un refetch, el componente vuelve a `'all'` — `'all'` solo puede ser 0 cuando no hay tarjetas, caso que ya corta antes con el empty state.

### 5. Componente de chips: local a cards

El row de chips nace como `WalletFilterChips` en `apps/mobile/components/cards/`, no en `components/ui/`. Es feature-shared de un solo consumidor; extraerlo a primitivo (y por lo tanto a `@grana/ui-contracts` con gemelo web) solo se justifica cuando aparezca un segundo consumidor real.

### 6. Tokens del tono "por vencer"

`bg-amber` / `bg-amber/10` / `text-amber` no existen: `@grana/ui-tokens` no define `amber` y la paleta default de Tailwind solo expone escalas (`amber-500`), no el color pelado. NativeWind no emite esas clases, así que el dot "por vencer" es transparente y el chip de grupo "soon" sale sin fondo ni color. Se reemplazan por los tokens reales del sistema:

| uso | antes | después |
|---|---|---|
| dot de fila, tono `soon` | `bg-amber` | `bg-warning` |
| fondo de chip, tono `soon` | `bg-amber/10` | `bg-warning-soft` |
| texto de chip, tono `soon` | `text-amber` | `text-warning-deep` |

`warning-soft` ya es un `rgba(...)` con alpha propio, así que no necesita el sufijo `/10`.

## Risks / Trade-offs

- **[La vista deja de ser idéntica a web]** → Es intencional y se documenta con escenarios etiquetados `(mobile)` / `(web)` en el spec de `cards`. La política del repo exige paridad de API vía contracts, no de composición visual; los datos mostrados son los mismos.
- **[El encabezado crece de alto]** → De ~48pt a ~64pt por grupo. Con pocos bancos no se nota; con muchos, el auto-colapso de grupos `ok` (regla existente, sin cambios) sigue conteniendo el largo de la página.
- **[Un chip fuera de pantalla es menos descubrible que uno visible]** → Solo aplica al último chip en devices angostos; el corte parcial del chip que asoma es la señal de scroll. Alternativa peor: aplastar los cuatro.
- **[El helper `countByFilter` corre `applyFilter` 4 veces por render]** → Listas de tarjetas de crédito de un usuario personal (unidades, no miles) y memoizado con `useMemo` sobre `cards`. Costo irrelevante frente a la garantía de que conteo y filtro no divergen.
- **[Cambiar los tokens del tono `soon` cambia el color en pantalla]** → Es el punto: hoy no hay color. `warning` es el token que el resto de mobile ya usa para ese estado (`PeriodStatusPill` documenta el mapeo web blue/amber/green → mobile slate/warning/emerald).
