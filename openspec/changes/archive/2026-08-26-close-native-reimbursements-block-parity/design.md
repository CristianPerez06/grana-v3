# Design: close-native-reimbursements-block-parity

Tres decisiones que no se leen del issue.

## 1. El aviso de éxito es la condición de montaje, no un estado paralelo

La tentación obvia es tratar el aviso como decoración: un banner que aparece, y aparte una condición que decide si el bloque vive. Con eso el bug sigue vivo — el bloque se desmonta con el aviso adentro y el usuario ve exactamente lo que ve hoy.

Web ya resolvió esto y la solución es una sola línea:

```ts
if (pending.length === 0 && !successMessage) return null
```

El aviso **es** el flag de "actuaste en esta sesión". No hace falta un segundo `useState` que lo duplique, y no hay forma de que se desincronicen. El nativo copia la condición tal cual:

- entra sin pendientes → `notice` es `null` → `return null`. Igual que hoy, igual que web, igual que el bloque de recurrencias.
- la lista se vacía después de confirmar → `notice` tiene copy → el bloque sigue montado y el cuerpo muestra `all_clear`.
- el usuario cierra el aviso con la lista ya vacía → `notice` vuelve a `null` → recién ahí el bloque se desmonta. Eso es correcto y es lo que hace web: cerrar el aviso es decir "ya lo vi".

Corolario: el aviso **no puede** autodescartarse por timer. Un toast de 3 segundos que se lleva puesto el bloque al expirar es peor que no tener nada, porque desmonta la pantalla cuando el usuario ya no está mirando la acción. La spec vieja pedía "un aviso de éxito transitorio"; el delta lo corrige.

## 2. El default del colapso se deriva, no se sincroniza

Web calcula el default en el `useState` inicial (`useState(pending.length <= 1)`) y le alcanza, porque `pending` llega por prop desde el server component: en el primer render ya sabe cuántos hay.

En nativo la lista llega por `useQuery`. En el primer render `items` es `[]`, así que `useState(items.length <= 1)` se congelaría en `true` — abierto siempre, incluso con seis pendientes. El arreglo reflejo sería un `useEffect` que resetea el estado cuando llegan los datos, y eso trae los problemas de siempre: un render de más, y un efecto que pisa la elección del usuario si vuelve a correr (p. ej. tras un refetch on-focus, que esta app tiene activo).

Se deriva en vez de sincronizar:

```ts
const [openOverride, setOpenOverride] = useState<boolean | null>(null)
const isOpen = openOverride ?? items.length <= 1
```

Mientras el usuario no tocó el header, el estado sigue a los datos y el default se aplica solo cuando la lista ya se conoce. En cuanto toca, `openOverride` deja de ser `null` y ningún refetch le mueve el panel. Sin efectos, sin render extra.

## 3. El acento slate se traduce a tokens; el hex de web no se copia

Web pinta el contenedor con dos valores inline: `borderColor: '#C7D8E2'` y `boxShadow: '0 0 0 4px rgba(58,107,138,0.06)'`. Ninguno de los dos sale de un token — es la propia web la que se salteó el design system ahí.

La convención del repo prohíbe copiar hex literal al nativo, así que el bloque traduce la **intención** (acento slate, informacional, distinto del dorado de recurrencias) con los tokens que existen:

- **El halo** de 4px se vuelve un anillo real: un `View` exterior con `bg-slate-soft` y padding de 1, con el `Card` adentro. `slate-soft` es `#EAF1F6`; el halo de web sobre la página (`#F6F7F9`) resuelve a `≈#EDF1F4`. Prácticamente el mismo color, y el anillo se dibuja con layout en vez de con una sombra — que en RN no tiene `spread` y no se puede expresar. `rounded-2xl` afuera con `p-1` adentro deja el radio interior en los 12px del `Card`, así que los dos bordes quedan concéntricos.
- **El borde de la card se queda en el `border-border` del primitivo**, y el acento slate lo carga el anillo. Teñirlo desde `className` sería tirar una moneda: `border-border` y un `border-slate/25` son dos utilidades del mismo tipo, y cuál gana lo decide el orden en el CSS que genera Tailwind —que sigue el orden de la paleta, donde `slate` viene **antes** que `border`— y no el orden en el string. Ganaría el default y el tinte no se vería, en silencio. Por la misma razón el `Card` conserva su `rounded-xl` en vez de pelearlo con un `rounded-[18px]`.
- **El badge del ícono y la pill de count** usan `bg-slate-soft` + `text-slate`, que es literalmente lo que web pide vía `var(--slate-soft)` / `var(--slate)`. Ahí no hay conflicto: son views nuevas, no overrides.

El chevron rota con `style={{ transform: [{ rotate: … }] }}`, el patrón que ya usa el header colapsable de `Wallet.tsx`, y no con la clase `-rotate-90`.

## Lo que no se toca y por qué

`PendingRow` conserva su lógica entera: expandir in-place, parsear el monto, `Alert` destructivo, error inline, `busy` por fila. El único cambio de su API es que `onDone` pasa a recibir cuál acción salió bien, porque es el bloque —no la fila— el que elige entre `confirmed_success` y `cancelled_success` y el que es dueño del aviso. Si el aviso viviera en la fila, se iría con la fila cuando la lista se vacía, que es el bug del que arranca todo esto.
