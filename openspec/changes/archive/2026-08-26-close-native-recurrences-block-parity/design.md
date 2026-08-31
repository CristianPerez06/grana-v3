# Design: close-native-recurrences-block-parity

## Context

Este change es el espejo de `close-native-reimbursements-block-parity` (archivado el 2026-08-26), un componente más arriba en el mismo feed. Tres de sus decisiones transfieren sin cambios y se resumen acá con puntero al original; las que siguen son las que **no** transfieren, porque el acento de este bloque es dorado y el dorado tiene en el repo una historia distinta a la del slate.

El estado de partida: `PendingRecurrencesBlock.tsx` (131 líneas) hace el read correcto, confirma, omite e invalida. Su presentación es un label en mayúsculas sobre una card plana, y su feedback de éxito no existe.

Los dos bloques son **adyacentes** en el feed (`apps/mobile/app/(app)/transactions/index.tsx:367-368`), así que después de este change quedan dos cards con anillo apiladas — dorada arriba, slate abajo. Es exactamente lo que dibuja `/transactions` en web, y es la razón por la que el color no se unifica.

## Goals / Non-Goals

**Goals:**

- Que confirmar u omitir la última pendiente deje una explicación en pantalla en vez de desmontar el bloque.
- Paridad **estructural** con el bloque web: card, header accionable, colapso, aviso, `all_clear`.
- Traducir el acento dorado de web a los tokens del repo, sin copiar hex literal.

**Non-Goals:**

- Paridad de **color** con el bloque de reintegros. El dorado es deliberado: este bloque habla de algo que **vence**; el de reintegros es informacional. El comentario en el código de reintegros ya lo dice explícito.
- Paridad de **contenido de fila** con web (edición inline, urgencia, picker de cuenta, calculadora, aviso de saldo negativo). El requirement vigente fija la slice de snapshot; ver `proposal.md`.
- Arreglar el `RecurrenceSuggestionBanner`, que tiene su propia variante del mismo bug.

## Decisions

### 1. Las tres decisiones heredadas de reintegros

Se aplican tal cual, sin volver a discutirlas. El razonamiento completo está en `openspec/changes/archive/2026-08-26-close-native-reimbursements-block-parity/design.md`; acá va lo mínimo para leer el código sin abrir el otro archivo.

**El aviso es la condición de montaje, no un estado paralelo.**

```ts
if (instances.length === 0 && !notice) return null
```

El aviso **es** el flag de "actuaste en esta sesión": un solo `useState`, sin forma de desincronizarse de una segunda bandera. Corolario que importa: el aviso **no puede** autodescartarse por temporizador, porque al expirar se llevaría puesto el bloque cuando el usuario ya no está mirando.

**El colapso se deriva, no se sincroniza.**

```ts
const [openOverride, setOpenOverride] = useState<boolean | null>(null)
const isOpen = openOverride ?? instances.length <= 1
```

Web calcula el default en el `useState` inicial porque `pending` llega por prop desde RSC. Acá llega por `useQuery`: en el primer render la lista está vacía, así que un `useState(length <= 1)` se congelaría en `true`. Un `useEffect` que lo resetee pisaría la elección del usuario en cada refetch-on-focus, que esta app tiene activo.

**El acento no se pinta desde el `className` del `Card`.** `border-border` (del primitivo) y un `border-warning/25` son dos utilidades del mismo tipo: cuál gana lo decide el orden en el CSS que genera Tailwind, no el orden en el string. El override se pierde en silencio. Por eso el acento lo carga un anillo externo y el `Card` conserva su borde y su radio.

### 2. El anillo usa `warning-bg`, no `warning-soft`

Acá el espejo con reintegros **se rompe**, y conviene decir por qué. En reintegros, `slate-soft` servía para las tres superficies (anillo, badge, pill) y coincidía con lo que web pedía vía `var(--slate-soft)`. Web, en cambio, pinta este bloque con **dos dorados distintos**:

```
badge + pill   →  var(--warning-bg)        rgba(196, 154, 60, 0.10)
halo de 4px    →  rgba(181, 138, 30, 0.06)   ← ni siquiera es el mismo hue
```

El segundo es un valor a mano que no sale de ningún token — la propia web se salteó el design system ahí. Así que no hay un "mismo token para todo" que copiar, y hay que elegir. Compuestos sobre la página (`#F6F7F9`):

| Candidato | Valor | Resultado sobre `page` |
|---|---|---|
| halo de web | `rgba(181,138,30,.06)` | ≈ `#F2F1EC` |
| **`warning-bg`** | `rgba(196,154,60,.10)` | ≈ **`#F1EDE4`** |
| `warning-soft` | `rgba(196,154,60,.12)` | ≈ `#F0ECE2` |

`warning-bg` gana por dos motivos: es el más cercano al halo de web, y es el token que web **nombra** para este bloque. Que sea `rgba` y no un sólido como `slate-soft` es indistinto: el `Card` que va encima es opaco (`bg-card`), así que el anillo sólo se ve contra la página.

Geometría igual que en reintegros: `rounded-2xl` afuera con `p-1`, lo que deja el radio interior en los 12px del `Card` y los dos bordes concéntricos.

### 3. El foreground es `warning` (#C49A3C), no `warning-deep` (#B45309)

Esta es la decisión propia de este change, y va contra la costumbre del repo, así que necesita argumento.

Todo el foreground warning que existe hoy en mobile usa `warning-deep`: `PeriodStatusPill`, `CardStatusPill`, `Wallet`, `OutlookSection`, `SpentCard`. Seguir esa costumbre sería lo cómodo. Se elige `warning` igual, por tres razones:

- **Es lo que web pide.** El badge y la pill de este bloque son `var(--warning)`, no `var(--warning-deep)`.
- **No son matices del mismo tono.** `#C49A3C` es dorado; `#B45309` es naranja quemado. No es un ajuste de contraste, es otro color.
- **`warning-deep` arrastra semántica que este change dejó fuera de alcance.** En mobile ese tono es el de "vencido / por vencer" (`soon`, `overdue`), y la línea de urgencia por fila es explícitamente un non-goal. Pintar el header con el color de la urgencia insinuaría una información que el bloque no está dando.

Los precedentes existentes no se tocan: siguen siendo estados de vencimiento y `warning-deep` les corresponde.

Consecuencia concreta: `apps/mobile/lib/colors.ts` suma `warning: '#C49A3C'`. El mirror JS existe porque RN no lee variables CSS y el `Clock` de `lucide-react-native` necesita el valor en su prop `color`; el token ya existía como clase de NativeWind (`bg-warning` se usa en `Wallet.tsx`), sólo faltaba del lado JS. Cuando aterrice el codegen TS desde `theme.css` el archivo entero desaparece, así que no se está creando deuda nueva — se está completando una fila de una tabla que ya está marcada como temporal.

### 4. El aviso vive en el bloque, no en la fila

`PendingRow` cambia una sola cosa de su API: `onDone` pasa de `() => void` a `(action: 'confirmed' | 'skipped') => void`. El bloque es el dueño del aviso porque un aviso montado en la fila se iría **con la fila** justo cuando la lista se vacía — que es el único momento que el aviso existe para explicar.

### 5. La frase del deep-link se parte en dos (decisión de spec, no de código)

El requirement vigente afirma: *"El bloque de pendientes y el banner SHALL ofrecer un deep-link al hub / a la regla."* Son dos afirmaciones y las dos están incumplidas en nativo.

- **El bloque.** La afordancia al hub existe, pero vive en el `PageHeader` de la pantalla (`transactions/index.tsx:288`, ícono `Repeat`). Web hace lo mismo: su bloque tampoco linkea. Acá la spec describe mal una decisión de diseño que ya está tomada y es correcta, así que **se reescribe** para decir dónde vive la afordancia y que ninguno de los dos componentes la duplica.
- **El banner.** `acceptRecurrenceSuggestion` crea la regla, invalida y termina: no navega a la regla creada ni avisa que salió bien. Eso **no** es una decisión de diseño mal escrita, es un gap. Se deja la frase **intacta**, como `SHALL` incumplido con ticket propio.

La regla implícita, que vale la pena dejar escrita: un delta puede corregir una spec que describe mal la realidad, pero no puede reescribir un `SHALL` incumplido para que la realidad pase el examen. Lo primero es sincronizar; lo segundo es lavar drift.

## Risks / Trade-offs

- **`warning` rompe la costumbre de `warning-deep` en mobile** → El precedente queda acotado por escrito a este caso: acento de sección, no estado de vencimiento. Los cinco consumidores existentes de `warning-deep` son todos estados de vencimiento y no se tocan.

- **Dos cards con anillo apiladas pueden leerse como ruido** → Es el mismo apilamiento que web ya tiene en `/transactions` y ahí funciona; el paso 6 de la validación del ticket es justamente comparar contra esa pantalla. Si en el dispositivo real se ve cargado, el ajuste es de espaciado en el feed, no del bloque.

- **El anillo es `rgba` y asume que el fondo detrás es `page`** → Hoy es cierto: el bloque se monta en un único lugar, dentro del scroll de `bg-page`. Si algún día se monta sobre otro fondo, el anillo se tiñe. Es el mismo compromiso que ya aceptaron `emerald-soft`, `warning-soft` y el resto de los tokens `*-soft` del repo.

- **El cálculo de composición del anillo se hizo a mano, no se verificó en dispositivo** → La diferencia contra el halo de web es de ~1-2 puntos por canal, por debajo de lo perceptible sobre un área de 4px. El paso 6 de validación lo confirma a ojo.
