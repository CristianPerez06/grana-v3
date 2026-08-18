# Grana · Bloque Compartir (mobile) — handoff

Bloque que se despliega al activar el chip **Compartir** en el form de nuevo movimiento.
Reemplaza el label “División” + fila del % + toggle “Es 100% de X” con su bajada
por **2 rows de 38 px = 79 px**.

Referencia visual: [`compartir-bloque-final.html`](./compartir-bloque-final.html) (canvas con estados + spec).

> **Alcance y decisiones a confirmar antes de implementar.** Este doc define **cómo se ve**; el
> **qué/por qué** (gasto compartido, `is_shared`, `shared_expense_split`, deuda derivada) vive en
> `openspec/` y la spec `shared`/`transactions`. Parte del rediseño del alta — ver el doc padre
> [`../README.md`](../README.md).
>
> ⚠️ **Este diseño reemplaza lo que la propuesta OpenSpec `simplify-movement-advanced-sections`
> tenía escrito para Compartido** (presets `Vos / Mitad / El otro` + disparador "Otro %"). El diseño
> cerrado es más rico y hay que actualizar la spec + los deltas cuando se implemente:
>
> **Atajos finales (decididos con el PO):** `Mitad · 70/30 · 75/25 · Todo suyo · Otro` — **5 chips en
> una sola fila**. Cambios respecto del canvas original:
> - Se **quita "80/20"** (para que los 5 entren en una fila con el label "Todo suyo", más ancho).
> - El chip "100%" se **renombra a "Todo suyo"**: pagás todo y te lo deben entero → **tu parte = 0**
>   (`splitFirstPct = 0`); reemplaza al toggle "Es 100% de X". (Los otros chips son *tu parte*; este es
>   el caso inverso, por eso el label explícito en vez de "100%".)
> - **No** hay chip "Vos"/todo-tuyo: si es 100% tuyo no se marca Compartido (confirmado con el PO).
>
> El resto, tal cual el canvas:
> - **Barra de reparto** (row 2) con el **nombre del integrante del Hogar** (dato ya existente) y,
>   opcionalmente, los montos (`te debe $ 9.000`). Es presentación sobre `splitFirstPct` + el total.
> - **"Otro"** transforma la row 1 en **dos campos %** (el tuyo editable con teclado del sistema; el
>   del otro se calcula solo, gris, no editable) escribiendo `splitFirstPct`.
>
> El estado del hook (`splitFirstPct` 0–100) alcanza; el rediseño es de presentación (mismo criterio
> que reintegro/recurrente: no tocar reglas contables). Nota: el canvas `compartir-bloque-final.html`
> muestra el set original de 6 chips con "100%" — la fuente de verdad para implementar es esta nota.

---

## Anatomía

```
┌────────────────────────────────────────────────────────────┐
│ [Mitad]  70/30  75/25  80/20  100%  Otro                   │  row 1 · 38 px
├────────────────────────────────────────────────────────────┤
│ ███████ Vos 50% ███████│███████ Cristian 50% ███████       │  row 2 · 38 px
└────────────────────────────────────────────────────────────┘
```

**Row 1 — atajos de división.** `Mitad · 70/30 · 75/25 · 80/20 · 100% · Otro`.
Selección única, default **Mitad**. Los porcentajes son **tu parte**.

**Row 2 — barra de reparto.** Dos segmentos proporcionales: **Vos** a la izquierda
(`#3A6B8A`) y el otro integrante del Hogar a la derecha (`#0E9E6E`).

El hogar tiene **dos integrantes**: siempre vos y el otro. El nombre lo trae el
registro de **Hogar** (funcionalidad que ya existe en Grana); no se escribe ni se elige acá.

---

## Comportamiento

| Acción | Resultado |
|---|---|
| Abrir el bloque | **Mitad** seleccionado, barra 50/50. |
| Tocar un atajo | Un tap, la barra se actualiza. Sin abrir nada. |
| **100%** | Pagás todo y te lo deben entero. La barra queda entera del otro lado y muestra el monto: `Cristian 100% — te debe $ 9.000`. **Reemplaza al toggle “Es 100% de X” y a su bajada.** |
| **Otro** | La row 1 pasa a mostrar **los dos porcentajes en una sola row**: `← Vos [__]% … Cristian [100]%`. Solo el tuyo es editable; el del otro se completa solo. |
| Tipear en el campo | La barra y el % del otro se recalculan en vivo. |
| Salir del campo | El chip **Otro** queda con el valor cargado (`65%`) y sigue tocable para reeditar. |
| CTA | `Registrar gasto` **siempre al final del form**. |

---

## Especificaciones

**Contenedor**
- `background #FFFFFF`, `border 1px #E6EAEF`, `border-radius 14px`, sin sombra.
- Dos rows de **38 px exactos**, separador `1px #EEF1F4`, padding `0 10px`.
- Gap de la row de chips: `4px`. Gap de la row de porcentajes (modo Otro): `6px`.

**Chips de atajo**
- `height 26px`, `radius 999px`, `padding 0 8px`, `border 1px #E6EAEF`, `11.5px/500`, `#6B7683`.
- Activo: `background #E7F8F0`, `border #BFE9D6`, `color #0E9E6E`, `600`.
- Los seis entran justo en los 343 px útiles: **no aumentar el padding ni agregar un séptimo chip**.
- Números con `font-variant-numeric: tabular-nums`.

**Barra de reparto**
- `height 26px`, `radius 9px`, `overflow hidden`, `flex 1`, fondo base `#F1F3F6`.
- Segmento propio: `background #3A6B8A`, texto `Vos NN%`. Segmento del otro: `background #0E9E6E`, texto `Nombre NN%`, alineado a la derecha.
- Texto `11px/600 #FFF`, padding `0 9px`, `white-space: nowrap`, `overflow hidden`, `text-overflow ellipsis`.
- **Degradación por ancho:** si el segmento no alcanza para `nombre + %`, se cae primero el nombre y queda solo el `%` (ej. el 20% de `80/20` muestra `20%`). Nunca partir el texto en dos líneas.
- Los segmentos pueden mostrar pesos en lugar de porcentajes (`Vos $ 4.500`) si se prefiere; misma pieza.

**Modo Otro (row 1 transformada)**
- Ícono `←` de volver a la izquierda, `15px #AEB6C0`.
- `Vos` como clave `11.5px/400 #8C97A4` + campo editable: `h 28 · radius 9 · border 1px #E6EAEF`, `min-width 58px`, `justify-content: space-between`, valor `12.5px/600`.
  Foco: `border #BFE9D6` + `box-shadow 0 0 0 2px #E7F8F0`.
- `Cristian` + campo calculado: mismo tamaño pero `background #F1F3F6`, `border transparent`, valor en `#6B7683`. **No editable.**
- Con el campo vacío, el del otro muestra `100`.
- El input usa `inputmode="numeric"`: **teclado del sistema, no un teclado propio en pantalla.**

**Tipografía** — Plus Jakarta Sans
- Valores `600`, claves y labels `400/500`. **Nada en 700/800 dentro del bloque.**
- Chips `11.5px`, texto de la barra `11px`, valores de los campos `12.5px`.

**Tokens**
```
--ink #142231     --muted #6B7683   --soft #8C97A4    --faint #AEB6C0
--border #E6EAEF  --border-soft #EEF1F4  --field #F1F3F6
--emerald #10B981 --emerald-deep #0E9E6E  --emerald-soft #E7F8F0
--slate #3A6B8A
```

---

## Estados a implementar

1. Base — Mitad, barra 50/50.
2. 70/30.
3. 80/20 — el nombre del segmento chico se cae, queda `20%`.
4. 100% — barra entera del otro lado con el monto.
5. Barra con pesos (variante de contenido).
6. Otro — campo vacío en foco, el otro en `100`.
7. Otro — un dígito (`6` / `94`).
8. Otro — dos dígitos (`65` / `35`), barra recalculada.
9. Otro cerrado — el chip muestra `65%`.

---

## Qué NO hacer

- No volver al toggle **“Es 100% de X”** ni a su bajada de dos líneas: `100%` es un atajo más.
- No usar el label **“División”** arriba de la card.
- No hacer editable el % del otro integrante: se calcula a partir del tuyo.
- No dibujar un teclado numérico propio al entrar en Otro.
- No agregar un séptimo chip ni ampliar el padding de los existentes (la row queda justa).
- No usar pesos 700/800 dentro del bloque.
- No poner el CTA dentro o antes del bloque.
