## Why

Recibimos feedback de un usuario real sobre **cómo se ven los importes** de cada movimiento en "Últimos movimientos" del home de Compartido, y sobre las **leyendas "tu parte" / "parte de {nombre}"** debajo.

El problema es real. Hoy el monto grande de cada fila **no es lo que te costó a vos**: es "la parte que le importa a tu saldo", y cambia de significado según quién pagó (`shared/(home)/page.tsx:529-540`):

```
perspectiveAmount = youPaid ? (total − tuParte) : tuParte
                              └ la parte del OTRO   └ TU parte
```

Con un gasto de **$10.000, mitad y mitad**, esto produce dos filas visualmente idénticas (`−$5.000`, rojo) que significan lo **opuesto**:

- **Pagaste vos** → el número grande es *lo que el otro te debe* (plata que te **entra**), pero pintado de rojo con `−` como si fuera una pérdida.
- **Pagó el otro** → el número grande es *lo que vos le debés* (plata que te **sale**). Acá el `−` sí corresponde.

Tres defectos concretos:

1. **El número responde dos preguntas distintas en filas contiguas** — a veces es "mi consumo", a veces es "la deuda del otro hacia mí". El usuario no sabe qué significa el número sin leer la leyenda chica.
2. **El signo y el color mienten en la mitad de los casos** — todo sale `−` y `text-expense` (rojo), incluso cuando el monto es plata que te entra.
3. **La leyenda está saturada** — la línea de abajo mezcla dos datos (`parte de {nombre} · total $X`) y arriba a la izquierda ya dice `· Pagaste`/`· Pagó {nombre}`.

El "quién le debe a quién" **ya vive, una sola vez y sin ambigüedad, en la card de balance del home** (`page.tsx:314-347`: "le debés a X" / "X te debe" por moneda, con Saldar y Ver el detalle). No hace falta repetirlo —contradictoriamente— en cada fila.

## What Changes

**Solo presentación en `shared/(home)/page.tsx` + i18n. Cero lógica de dominio, cero modelo, cero infra, cero cambios en la capa `@grana/shared`.** No toca la paridad mobile (el tech lead mantiene su propio render).

El listado de movimientos es un **log de gastos**, no la pantalla de saldo. La fila muestra dos cifras fijas —invariantes a quién pagó—: el **total del movimiento como protagonista** (grande) y la **parte propia del usuario como detalle secundario** (chico, debajo). El "quién le debe a quién" queda una sola vez, arriba, en la franja de deuda.

> Nota de iteración: la primera versión hacía protagonista a la parte propia (`ownShare`) y ocultaba el total. Evaluándolo en la app, se invirtió: como log de gastos, el usuario quiere ver primero **cuánto salió el movimiento** y luego su parte. La consistencia (dos cifras que no cambian de significado según quién pagó) se conserva.

Reglas de la fila:

| Elemento | Antes | Ahora |
|---|---|---|
| **Monto grande** | `youPaid ? total−tuParte : tuParte` (cambia de significado) | **Siempre el total del movimiento** (`amount`), como gasto (`−`, `text-expense`; reintegro `+`/`text-income`) |
| **Leyenda derecha** | `tu parte`/`parte de {nombre}` **·** `total $X` | **`Tu parte: $X`** (`ownShare`), y solo cuando hubo reparto real (`ownShare ≠ amount`) |
| **Labels `parte de {nombre}` / significado según quién pagó** | Se muestran | **Se eliminan** — las dos cifras son fijas; el label secundario es siempre "Tu parte" |
| **Quién pagó** | Subtítulo izquierdo (`· Pagaste`/`· Pagó {nombre}`) | Igual, sin cambios |

**Reintegros:** el monto grande es el total del reintegro (verde si recibido), y "Tu parte" abajo muestra la parte propia del reintegro. Coherente con las filas de gasto.

**Borde `ownShare = 0`** (split 100/0, pagaste todo del otro): el protagonista es el total (sin artefactos, ya que nunca fue la parte propia); "Tu parte: $0" se muestra abajo como cualquier otra fila con reparto. El problema del `−$0` desaparece por diseño al no ser el total nunca la cifra chica.

## Capabilities

### Modified Capabilities
- `shared`: la lista "Últimos movimientos" del home muestra por fila dos cifras fijas e invariantes a quién pagó — el **total del movimiento como protagonista** y la **parte propia como detalle secundario** ("Tu parte: $X"); se elimina el framing de deuda por fila que cambiaba de significado según el pagador ("parte de {nombre}"), ya cubierto por la franja de deuda del home. No cambia el modelo de deuda ni la derivación.
