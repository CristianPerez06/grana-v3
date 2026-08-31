# Handoff: Ahorro (Guardado + Propósitos)

## Overview

Rediseño completo de la pantalla de ahorro de Grana. Reemplaza la vista actual tipo lista/tabla por una pantalla que enseña el modelo mental (Guardado ≠ cuenta nueva, Sin destino ≠ propósito) y permite operar en un tap.

Alcance de este change: **Guardado**, **Propósitos**, **Sin destino** y las tres operaciones **Guardar / Volver a usar / Destinar**, más **Detalle de propósito** y **Nuevo propósito**.

Fuera de alcance (no implementar, ni dejar espacio visible): instrumentos, plazo fijo, FCI, broker, compra de USD, metas, barras de progreso, rendimiento y gráficos.

## Inventario de pantallas

**Mobile 390** — `Grana - Ahorro FINAL mobile.html` (8 frames)
1. Ahorro · con saldo
2. Ahorro · estado vacío (nada guardado)
3. Ahorro · con 7 propósitos (escala + orden por monto)
4. Detalle de propósito
5. Sheet Guardar
6. Sheet Volver a usar
7. Sheet Destinar
8. Nuevo propósito

**Web 1280 y tablet 834** — `Grana - Ahorro FINAL web y tablet.html` (9 frames)
1. Ahorro · desktop
2. Ahorro · desktop con panel de detalle
3. Ahorro · tablet 834 (misma card oscura que desktop)
4. Modal Guardar
5. Modal Volver a usar
6. Modal Destinar
7. Modal Nuevo propósito
8. Desktop · estado vacío
9. Desktop · con 7 propósitos

## About the Design Files

Los archivos HTML de este bundle son **referencias de diseño**: prototipos que muestran el aspecto y el comportamiento buscados, no código de producción para copiar. La tarea es **recrear estos diseños en el entorno del codebase** (React/Vue/native, lo que ya exista) usando sus componentes, tokens y patrones establecidos. Si no hay entorno todavía, elegir el framework más apropiado e implementarlos ahí.

## Fidelity

**High-fidelity.** Colores, tipografía, espaciados, radios y copy son finales. Recrear pixel-perfect con la librería de componentes del codebase. El copy en español está definido y no debe reescribirse.

## Invariante de jerarquía (corregido — manda sobre todo lo demás de este doc)

> **En responsive podés cambiar la cantidad de columnas. No podés cambiar la jerarquía conceptual.**
>
> **Guardado total es siempre el bloque padre. «Sin destino» y los propósitos son siempre desglose de
> ese total.**

El orden es el MISMO en mobile, tablet y desktop, y es una columna:

1. Header / título
2. Card principal de **Guardado total**, dominante y a todo el ancho
3. Botonera **Guardar / Volver a usar / Destinar**, pegada a esa card
4. Sección de desglose:
   - **Sin destino**, si existe
   - **Propósitos** como cards

Dos prohibiciones que se derivan y no se negocian:

- **Si hay dos columnas, van DENTRO del desglose** — nunca entre el total y sus partes. La card del
  total no comparte fila con nada: ni con la botonera, ni con un propósito, ni con «Sin destino».
- **El panel lateral es solo para el detalle del propósito seleccionado.** Nunca para poner Guardado
  al lado de un propósito.

El archivo `Grana - Guardado V1 compacta.html` viola esto en su frame de tablet y quedó marcado como
superado dentro del propio archivo. La referencia válida son los dos `FINAL`, que son una sola
columna en los tres tamaños.

## Regla de jerarquía (redacción original)

**Guardado es el total. Sin destino y los propósitos son partes de ese total.** El diseño tiene que hacer leer, en este orden:

1. "Tengo $1.150.000 guardados."
2. "Una parte está sin destino."
3. "El resto está repartido en estos propósitos."

Y nunca: "acá hay varias cards: Guardado, Sin destino, Viaje, Emergencia."

Consecuencias obligatorias en todos los breakpoints:
- El bloque de Guardado va **arriba y a todo el ancho**, con el monto más grande de la pantalla (34px en web y tablet, 27px en mobile) y la botonera como zócalo de la misma card.
- Los propósitos van **debajo**, con montos de 16.5px. La diferencia de escala es ~3×.
- `UnassignedBlock` va **entre** el total y los propósitos, a todo el ancho, con formato distinto: nunca dentro de la grilla de propósitos.
- La columna/panel lateral es **solo** para el propósito seleccionado o información secundaria. **Nunca** para el total.
- Prohibido poner una `PurposeCard` al lado del total, o convertir Guardado en una card del mismo tamaño que un propósito.
- El título del desglose declara la relación en palabras: **"En qué está repartido"** + `Las partes de tus $ 1.150.000 guardados`.

## Nomenclatura (definida)

| Elemento | Texto |
|---|---|
| Menú / ruta | **Ahorro e inversión** |
| Título de pantalla | **Ahorro** |
| Overline sobre el título | `AHORRO E INVERSIÓN` (10px, 800, letter-spacing .15em, uppercase, color `--faint`) |

Inversiones no entra en este change, pero vivirá **dentro del mismo módulo**: la ruta ya lo anticipa. No crear una sección separada.

## Screens / Views

### 1. Ahorro (principal)

**Purpose:** ver cuánto hay guardado, en qué monedas, para qué, y operar.

**Layout mobile (360–767):** columna única, padding `8px 16px 20px`, `gap: 11px` entre bloques.

Orden en el DOM — **idéntico en mobile, tablet y desktop**:
1. `SavingsCard` — Guardado (total) + `ActionBar`
2. `UnassignedBlock` — Sin destino, **solo si monto > 0**
3. Header del desglose ("Para qué guardaste" en mobile / "En qué está repartido" en web) + link "Nuevo"
4. `PurposeCard` × n
5. Nota al pie: "Los dólares se muestran aparte y nunca se suman a los pesos."

Cambian anchos y tamaños de número. **No cambian el orden ni el nivel jerárquico.**

**Componentes:**

`SavingsCard` — **card oscura**: `bg --ink #1B2A33`, sin borde, `radius 22px`, `overflow hidden`. Es el único bloque oscuro de la pantalla: así el total queda anclado por tratamiento y no solo por escala.
- Interior: padding `18px 18px 16px`.
- Label "Guardado": 10.5px / 800 / ls .13em / uppercase / `--soft #5F6A70`.
- Par de monedas: `display grid; grid-template-columns: 1fr 1px 1fr; gap 16px; margin-top 15px`. La columna central es un `<div>` de fondo `--line #F1EDE5` que hace de divisor.
  - Monto: 27px / 800 / ls -.045em / **#FFFFFF**, `font-variant-numeric: tabular-nums`, `white-space: nowrap`.
  - Símbolo (`$`, `US$`): `font-size .8em`, 700, `rgba(255,255,255,.5)`. El símbolo es el único indicador de moneda.
  - Divisor central: `rgba(255,255,255,.14)`. Label "Guardado": `rgba(255,255,255,.55)`. Frase de apoyo: `rgba(255,255,255,.66)`.
  - Con saldo en cero: montos `rgba(255,255,255,.42)` y símbolos `rgba(255,255,255,.32)`.
  - **Sin rótulos "Pesos"/"Dólares".** El símbolo y el divisor comunican la separación.
- Frase de apoyo: 12px / 600 / `--muted` / `line-height 1.45` / `margin-top 15px` — "Plata apartada: sigue en tus cuentas, pero no cuenta para gastar."
- `ActionBar` al pie de la misma card (no un bloque aparte), **siempre clara sobre la card oscura**: `grid 3 cols`, fondo `#FCFBF8`, sin border-top (el cambio de color ya separa), botón `min-height 48px`, ícono 16px + label 12px/800 en una fila, separadores `border-left 1px --line`. Labels: **Guardar**, **Volver a usar**, **Destinar**.

`UnassignedBlock` (Sin destino) — deliberadamente distinto de un propósito:
- `background: linear-gradient(180deg,#FDF6E8,#FCF2DF)`, `border 1px #F0DFBB`, `radius 20px`, padding 15–16px.
- Ícono en **círculo punteado** 40px (`border 1.5px dashed #C79B45`, `border-radius 50%`), color `--amber-deep #845714`.
- Rótulo en versalitas (no nombre propio): "SIN DESTINO", 11px / 800 / ls .11em / `--amber-deep`.
- Monto: 22px / 800 / `#5F3D0B`.
- Botón **Destinar**: `bg --amber-deep`, texto blanco, `radius 13px`, `min-height 44px`.
- Explicación adentro, tras un `border-top 1px dashed #E3CFA4`: "Resto sin asignar, no es un propósito. Está guardado, pero todavía no dijiste para qué." (11.5px / 600 / `#7A5A20`)
- **Regla de visibilidad:** si `unassigned.ars === 0 && unassigned.usd === 0` → el bloque no se renderiza y su explicación pasa a la línea gris del pie de la lista.

`PurposeCard` — `min-height 72px`, `radius 18px`, padding `13px 14px`, `display flex; align-items center; gap 13px`, fondo blanco, `border 1px` en el tinte del emblema.
- Emblema: contenedor 42px, `radius 15px`, fondo tinte sólido, ícono 22px `stroke-width 1.9`.
- Nombre 14.5px/800; subtítulo (fecha o "Sin fecha") 11.5px/600 `--muted`.
- Monto ARS 16.5px/800 alineado a la derecha; USD 11.5px/700 `--muted` debajo — **si USD es 0, la línea no se renderiza** (nunca "US$ 0").
- Chevron 18px `--faint`. Toda la card es tappable → abre el detalle.

Paleta de emblemas (ciclar sobre estos 5, no un color por propósito):

| Tinte | Fondo | Ícono/texto | Borde card |
|---|---|---|---|
| Slate | `#E4EEF3` | `#27505F` | `#E1EBF0` |
| Emerald | `#DDF4EA` | `#0B7F58` | `#D8F0E4` |
| Violet | `#EBE5F6` | `#544485` | `#E6E0F2` |
| Terracota | `#F7E7DF` | `#8A4530` | `#F2E1D8` |
| Clay | `#F1EFE9` | `#6B6053` | `#E4E1D8` |

### 2. Sheet · Guardar

Un paso. Anatomía común de los tres sheets: `radius 28px 28px 0 0`, padding `10px 20px 22px`, grabber 42×4, sombra `0 -14px 44px -14px rgba(27,42,51,.45)`, overlay `rgba(27,42,51,.5)`.
- Rótulo `GUARDAR` (10.5px/800/ls .14em/`--soft`) → pregunta 20px/800 → línea de movimiento 12.5px/600 con ícono de intercambio en `--emerald-deep`.
- Segmentado Pesos / Dólares (`min-height 44px`).
- Monto grande centrado 42px/800 con cursor emerald de 2.5px.
- Disponible: "Podés guardar hasta $ 842.300".
- Chips de atajo (`min-height 44px`): +10.000 / +50.000 / Todo.
- Teclado numérico 3×4, teclas `min-height 46px`, fondo `#F4F1EA`.
- CTA con el monto escrito: "Guardar $ 50.000", `min-height 52px`, `bg --emerald`.
- Nota: "La plata **no se mueve de tus cuentas**. Solo deja de contar como disponible."

**El sheet nunca pregunta lo que el tap ya contestó** (origen, destino, propósito).

### 3. Sheet · Volver a usar
Igual anatomía. Chips = **De Sin destino** / **De un propósito**. Disponible muestra ambos: "Sin destino: $160.000 · Guardado: $1.150.000". Nota: "Primero sale de lo que no tiene propósito. Si querés más, elegís de cuál sacarlo."

### 4. Sheet · Destinar
Único que suma selección de destino, porque desde la botonera no hay propósito elegido: lista de opciones `min-height 60px` con emblema, nombre, montos y radio 22px (`on` → `border/bg --emerald`). CTA: "Destinar $ 60.000 a Viaje a Bariloche" en `--amber-deep`. Nota: "Tu total guardado **no cambia**: le pusiste nombre a una parte."
**Si se entra desde la card de un propósito o desde su detalle, el bloque de selección no se muestra** (destino ya resuelto).

### 5. Detalle de propósito
- Header horizontal (no centrado): emblema 46px + nombre 18px/800 + "Julio 2027 · creado en marzo" 11.5px/600.
- Par de monedas igual que en `SavingsCard` (25px), tras `border-top 1px --line`.
- Dos acciones `grid 1fr 1fr`, `min-height 50px`: **Destinar acá** (emerald, primaria) / **Sacar de acá** (blanca con borde).
- Movimientos: filas 13px/700 con ícono 34px, fecha y origen en 11.5px `--muted`, monto a la derecha (`+` en `--emerald-deep`, `−` en `--terracota #C97A5F`).
- Pie: "Sacar de acá devuelve la plata a Sin destino. Para poder gastarla, usá Volver a usar en Ahorro."
- **Sin barras de progreso ni porcentajes** (no hay metas todavía).

### 6. Nuevo propósito
Cuatro cards; las dos últimas marcadas como *opcional* en el label.
1. **Nombre** — campo con foco al entrar, 19px/800, `border-bottom 2px --emerald`. Ayuda: "Con que se entienda para qué es, alcanza."
2. **Emblema** — fila de 5 opciones 56×52, `radius 16px`, seleccionada con `border 2px --ink`. No paleta libre.
3. **¿Para cuándo?** *(opcional)* — dos chips: Sin fecha / Elegir mes.
4. **¿Le destinás algo ahora?** *(opcional)* — monto **inicial en 0**, en `--faint` hasta que el usuario escriba. Ayuda: "Arranca en cero. Si querés, podés destinarle algo de Sin destino, donde tenés $160.000 — o dejarlo así y destinarle después."
5. CTA "Crear propósito".

**Regla:** no prellenar monto salvo que el usuario venga del flujo **Destinar**. Entrando por "Nuevo propósito", arranca en 0 y se puede crear tocando solo nombre + CTA.

### 7. Web / desktop / tablet
Ver `Grana - Ahorro FINAL web y tablet.html`. Es la jerarquía mobile **escalada**, no reorganizada.

- **Desktop ≥1120:** sidebar 236px con `Ahorro e inversión` activo (pill `--ink`). Stage `max-width 1000px`, padding `26px 32px 30px`, `gap 18px`, columna única.
  1. Overline + h1 27px.
  2. Card de total **oscura y a todo el ancho**, en una sola columna:
     - `.in` con `padding: 24px 28px 22px`, `display: flex; flex-direction: column; gap: 14px`.
     - Label "Guardado" → par de monedas de **34px** con divisor de 1px → frase de apoyo debajo, alineada a la izquierda (`max-width 620px`).
     - `ActionBar` de 3 columnas × 60px como zócalo, **cruzando todo el ancho de la card**, sobre fondo claro `#FCFBF8`.
     - Los montos miden **34px en todas las vistas web** (desktop, panel abierto, tablet, modales, vacío, escala): la card es idéntica en todas.
  3. Header del desglose: "En qué está repartido" 17px + sub "Las partes de tus $ 1.150.000 guardados" + link "Nuevo propósito".
  4. `UnassignedBlock` a todo el ancho (ícono, monto, explicación y botón Destinar en una fila).
  5. Grilla de propósitos `repeat(auto-fill, minmax(330px, 1fr))`, gap 11px, + card punteada "Nuevo propósito".
- **Panel de detalle (420px):** solo para el propósito seleccionado. `border-left 1px --border`, sombra `-26px 0 50px -30px`. Con el panel abierto el stage recibe `padding-right: 452px`, la grilla baja a una columna, la card seleccionada queda resaltada (`border #CFE0E8`, fondo `#FBFDFE`) y **el total sigue arriba** (monto a 38px). No navega a otra página.
- **Tablet 768–1119:** sin sidebar (barra inferior como mobile). **Idéntica a desktop**: misma card oscura a todo el ancho, montos a 34px, frase de apoyo debajo y `ActionBar` cruzando la card. Solo cambian el ancho disponible (los propósitos entran en dos columnas) y el h1, que baja a 24px.
- Grilla de propósitos: `repeat(auto-fill, minmax(330px, 1fr))`. La cantidad de columnas la decide el ancho disponible, no el breakpoint, así el nombre no se parte en dos líneas (con `text-overflow: ellipsis` como red de seguridad).
- La `PurposeCard` es **el mismo componente** en los tres tamaños: cambia el ancho de grilla, nunca se convierte en fila de tabla.
- **Modales web:** centrados sobre scrim `rgba(27,42,51,.45)`, `radius 26px`, padding 24px, sombra `0 30px 70px -30px rgba(27,42,51,.6)`. Ancho **430px** (Guardar, Volver a usar) y **470px** (Destinar, Nuevo propósito, que llevan lista de selección o formulario). Misma anatomía que el sheet mobile — rótulo, pregunta, línea de movimiento, segmentado de moneda, monto, atajos, CTA con el monto escrito y nota al pie — **menos el teclado numérico**: en web se escribe con el teclado físico. Botón de cierre 34px arriba a la derecha; `Esc` y click en el scrim cierran.
- **Estado vacío web:** card de total oscura con `$ 0 / US$ 0` en `rgba(255,255,255,.42)`, sin botonera, y debajo una card centrada con ícono 64px, título 23px, explicación (`max-width 520px`) y CTA "Guardar por primera vez" de 300px. Sin desglose: no hay nada que desglosar.
- **7 propósitos web:** la grilla suma columnas y el total **no cambia de tamaño**; el orden es por monto descendente. Es la prueba de que la jerarquía aguanta la escala.

## Interactions & Behavior

- Tap en `PurposeCard` → detalle (mobile: pantalla; web/tablet: panel lateral).
- Tap en Guardar / Volver a usar / Destinar → sheet de un paso; el foco entra en el monto con teclado numérico abierto.
- Chips de monto suman al valor actual; "Todo" completa el máximo disponible.
- CTA deshabilitado con monto 0 o mayor al disponible; el texto del CTA refleja siempre el monto y el destino actuales.
- Al confirmar: cerrar sheet, actualizar montos con transición de 200ms y mostrar confirmación breve. Sin pantalla de éxito intermedia.
- Hover (web): `PurposeCard` → `border-color #D8D2C6` + `box-shadow 0 8px 20px -14px rgba(27,42,51,.4)`.
- Hit targets ≥ 44px en todo lo tappable. Los links de texto usan un `::after` invisible de 44px para no inflar el alto de la fila.

## Estados

| Estado | Regla |
|---|---|
| Guardado = 0 (primera vez) | No mostrar propósitos ni Sin destino. Estado vacío: "Todavía no guardaste nada" + explicación de qué es Guardado + CTA "Guardar por primera vez". |
| Guardado > 0, sin propósitos | Mostrar `SavingsCard` + `UnassignedBlock` con todo el monto + CTA "Crear un propósito". |
| Sin destino = 0 | Ocultar `UnassignedBlock`; su explicación baja al pie de la lista. |
| Propósito sin USD | No renderizar la línea USD. Nunca "US$ 0". |
| Propósito sin fecha | Subtítulo "Sin fecha". |
| ≥ 6 propósitos | Ordenar por monto descendente. |
| ≥ 8 propósitos | Mostrar los 5 mayores + "Ver todos" a una pantalla con la lista completa. |
| Moneda sin saldo | La columna muestra `$ 0` / `US$ 0` en la `SavingsCard` (ahí sí, porque el par es fijo), pero nunca en propósitos. |

## State Management

```
savings: { ars: number, usd: number }
unassigned: { ars: number, usd: number }
purposes: [{ id, name, emblem, date|null, ars, usd, movements[] }]
spendable: { ars, usd }        // solo lo consume el sheet como máximo; NO se muestra en Ahorro
ui: { sheet: 'save'|'reuse'|'assign'|null, currency: 'ARS'|'USD',
      amount: number, targetPurposeId: string|null, detailOpen: string|null }
```

Transiciones: `Guardar` → spendable−, savings+, unassigned+. `Volver a usar` → savings−, unassigned− (y si falta, del propósito elegido), spendable+. `Destinar` → unassigned−, purpose+ (**totales sin cambio**).

## Design Tokens

```
--bg:#F5F2EC   --card:#FFFFFF  --ink:#1B2A33
--muted:#6F7A80 --soft:#5F6A70 --faint:#7C858A
--border:#EAE5DC --line:#F1EDE5
--emerald:#11B981 --emerald-deep:#0B7F58 --emerald-soft:#EFFAF4
--terracota:#C97A5F
--amber:#E0A03F --amber-deep:#845714 --amber-soft:#FDF7EC
--slate:#4A7B92 --slate-deep:#27505F
--clay:#8C7A66 --violet:#7E6BB0 --violet-deep:#544485
```

- Tipografía: **Plus Jakarta Sans** 400–800. Montos siempre con `font-variant-numeric: tabular-nums`.
- Escala de texto: 27 / 25 / 22 / 19 / 18 / 16.5 / 14.5 / 13.5 / 12.5 / 11.5 / 10.5 px.
- Radios: card 22–24 · bloque 20 · card de propósito 18 · botón 13–15 · sheet 28 (arriba) · modal 26.
- **Card del total:** ink `#1B2A33` en mobile, tablet y desktop, en todos los estados (incluido el vacío). Ningún otro bloque del módulo es oscuro.
- Espaciado: 4 / 8 / 9 / 11 / 13 / 16 / 18 / 22 px. Gap entre bloques 11px (mobile), 14px (tablet), 22px (desktop).
- Sombras: card en hover `0 8px 20px -14px rgba(27,42,51,.4)`; CTA emerald `0 10px 22px -10px rgba(17,185,129,.75)`; sheet `0 -14px 44px -14px rgba(27,42,51,.45)`.
- Contraste mínimo verificado 4.5:1 en todo texto informativo. `--faint` solo para cromo no informativo.

## Assets

**Marca.** En los prototipos el logo del sidebar es el wordmark tipográfico que ya usan los mocks de Grana: la palabra `grana` en Plus Jakarta Sans 800, `letter-spacing -.045em`, seguida de un punto en `--emerald #11B981`. **No es un asset**: si el codebase tiene un componente de logo o un SVG oficial, usar ese y descartar esta versión tipográfica. En el proyecto de diseño existen `grana-cuenta-isotipo.svg` y `grana-cuenta-wordmark.svg`, pero pertenecen a otra exploración de marca ("grana cuenta") y su tipografía depende de CSS externo, así que **no deben usarse como fuente**.

Ningún bitmap. Todos los íconos son SVG inline `stroke`, `fill: none`, `stroke-linecap/linejoin: round`; `stroke-width 2–2.5` en UI y **1.9 en emblemas** de propósito. Si el codebase ya tiene set de íconos, usar el equivalente y mantener el grosor diferenciado de los emblemas.

## Qué reemplaza de `/savings`

- La lista/tabla de propósitos → grilla de `PurposeCard`.
- Cualquier total combinado ARS+USD → par de columnas separadas por divisor.
- "Sin destino" como fila de la lista → `UnassignedBlock` propio, arriba de la lista y condicionado a monto > 0.
- Acciones en menú contextual o footer suelto → `ActionBar` integrada en la `SavingsCard`, **en los tres tamaños** (nunca en la barra de título ni flotando).
- Cualquier navegación multi-paso para operar → un sheet de un paso por operación.
- Salida de "Para gastar" de esta pantalla: pertenece al mes, se muestra en la home.

## Qué NO debe cambiar de lógica

1. **ARS y USD nunca se suman ni se convierten.** No hay total unificado, ni cotización, ni "equivalente en pesos".
2. **Guardar no mueve plata entre cuentas.** Es una reclasificación: la plata sigue en las mismas cuentas.
3. **Destinar no cambia el total guardado.** Solo reparte dentro de Guardado.
4. **Sin destino no es un propósito.** No tiene ícono propio, ni fecha, ni detalle; es el resto sin asignar.
5. **Volver a usar sale primero de Sin destino**; recién si falta se elige de qué propósito.
6. **Sacar de acá** (en el detalle) devuelve al Sin destino, no a Para gastar.
7. Sin instrumentos, plazo fijo, FCI, broker, compra de USD, metas, barras de progreso, rendimiento ni gráficos.

## Orden sugerido de implementación

1. `SavingsCard` (card oscura + `ActionBar`) y el layout de la pantalla con el orden DOM fijo.
2. `PurposeCard` y la grilla `repeat(auto-fill, minmax(330px,1fr))`.
3. `UnassignedBlock` con su regla de visibilidad (monto > 0).
4. Los tres flujos de operación: sheet en mobile, modal en web. Misma anatomía y mismo copy.
5. Detalle de propósito: pantalla en mobile, panel lateral en web/tablet.
6. Nuevo propósito.
7. Estados: vacío, sin propósitos, sin USD, escala ≥ 6 y ≥ 8 propósitos.

## Decisiones ya cerradas (no reabrir)

| Decisión | Resultado |
|---|---|
| Lista vs. cards | Cards. La lista fría de `/savings` es lo que este change reemplaza. |
| "Destinar" vs. "Repartir" | **Destinar** en botones y CTAs; *repartir* solo como verbo en copy explicativo. |
| "Para gastar" en Ahorro | Fuera. Pertenece al mes y se muestra en la home. |
| Rótulos "Pesos"/"Dólares" en la card del total | Fuera: el `$` y el `US$` más el divisor ya lo dicen. En el panel de detalle sí se rotulan. |
| Card del total | **Oscura** (ink), a todo el ancho, mensaje debajo de los importes y botonera cruzando la card. Es el único bloque oscuro del módulo. |
| Corte en dos columnas de la card del total | Descartado. |
| Botonera como cards grandes de acción | Descartada: ocupaba 100px y le robaba protagonismo al total. |
| Acciones por propósito en la card | No. La card solo abre el detalle. |
| Sin destino dentro de la lista de propósitos | No. Va arriba, con forma propia. |

## Files

| Archivo | Contenido |
|---|---|
| `Grana - Ahorro FINAL mobile.html` | Mobile 390 · 8 pantallas: módulo con saldo, estado vacío, 7 propósitos, detalle, sheets Guardar / Volver a usar / Destinar, y nuevo propósito |
| `Grana - Ahorro FINAL web y tablet.html` | Desktop 1280, desktop con panel de detalle y tablet 834 — jerarquía total → desglose |
| `Grana - Guardado V1 compacta.html` | **SUPERADO — no usar.** Estudio previo. Su frame de tablet pone Guardado y la botonera lado a lado, contra el invariante de jerarquía |

> Las versiones anteriores de la vista web (`Grana - Ahorro web y tablet.html`) quedaron **sin efecto**: ponían el total como card hermana de un propósito. No usarlas como referencia.
