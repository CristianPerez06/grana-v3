# Handoff — Detalle de movimiento, bloque compacto

**Bloque:** detalle de movimiento (`/transactions/[txId]`).
**Superficies:** N ≡ WM (idénticas) + WD.
**Naturaleza:** presentación. No toca reglas contables, ni schema, ni el contrato de
`useMovementForm`, ni la generación de instancias. Los dos ítems que sí cambian
comportamiento están aislados abajo, en "Decisiones ya tomadas".

Mockup: [`mockup.html`](./mockup.html) — canvas con los 15 estados.
Relevamiento que lo origina: [`../RELEVAMIENTO.md`](../RELEVAMIENTO.md) (oportunidad **P1**).

---

## 1. Por qué

Para el movimiento más frecuente — un gasto simple con descripción — el detalle actual
repite **tres de cuatro** datos:

| Dato | Se lee en | Y otra vez en |
|---|---|---|
| Descripción | título del hero | tile "Descripción" (full-width) |
| Fecha | chip del hero | fila "Fecha" del tile "Detalle" |
| Cuenta | chip del hero | tile "Pagado con" (badge de 52px) |

`heroTitle = description ?? title ?? categoría ?? tipo`, así que **siempre** que hay
descripción, el tile "Descripción" la duplica. Y el tile "Detalle" de un gasto simple
tiene exactamente **una fila**, que en la grilla de 2 columnas de WD ocupa media
pantalla para decir una fecha.

La dirección viene de Mobills, que fue la referencia de simplificación del alta: el
detalle se lee de un saque, cada dato aparece una vez, y la jerarquía la da el monto —
no una acumulación de tarjetas. Acá lo traducimos al vocabulario que ya cerramos en el
alta: **bloques compactos de 2 filas**.

## 2. Anatomía

Orden vertical, idéntico en las tres superficies:

```
Topbar                    ← + acciones
Hero (tonal)              ícono · título · monto · línea de contexto
Alert contextual          (condicional)
Bloque de tipo            (condicional: cuotas / compartido / reintegro / flujo)
Bloque "cuenta y fecha"   SIEMPRE — 2 filas
[Barra inferior "Editar"] solo N ≡ WM
```

### Reparto de datos — la regla que ordena todo

**Cada dato se lee una sola vez.**

| Dueño | Datos |
|---|---|
| **Hero** | monto · signo · moneda · título · tipo · categoría › subcategoría |
| **Bloque "cuenta y fecha"** | cuenta (+ tipo de cuenta) · fecha · estado o período |
| **Bloque de tipo** | lo específico: cuotas, split, neto del reintegro, flujo de la transferencia |
| **Alert** | pedagogía contable (off-ledger, reintegro pendiente, cuota hija, revisar) |

La fila de chips del hero **desaparece**. Su contenido se reparte: fecha y cuenta bajan
al bloque, categoría/subcategoría suben a la línea de contexto del hero.

### Hero

- Ícono: emoji de categoría; fallback al ícono lucide del kind.
- Título: descripción del movimiento; si no hay, la categoría; si no, la etiqueta del tipo.
- Monto: héroe, en `var(--tone)`, con símbolo opaco y decimales en superscript.
  USD imprime `USD` bajo el monto (nunca se fusiona con ARS).
- **Línea de contexto**: reemplaza a los chips. Patrón `{tipo} · {categoría} › {subcategoría}`,
  con la categoría en negrita. Cuando el título ya *es* la categoría, arranca en la
  subcategoría. En transferencia/cambio lleva el aviso contable en vez de la taxonomía.

### Bloque "cuenta y fecha" — el bloque compacto de 2 filas

Fila 1 — **cuenta**: badge de tipo (36px, color por tipo de cuenta) + rótulo contextual +
nombre de la cuenta, con el tipo de cuenta a la derecha.

| kind | Rótulo de la fila 1 |
|---|---|
| gasto, cuota | Pagaste con |
| compra en cuotas | Comprado con |
| ingreso, reintegro recibido | Se acreditó en |
| ajuste | Cuenta ajustada |
| pago de resumen | Pagaste desde |
| compartido pago por el otro | Lo pagó *(nombre del co-miembro, sin badge de cuenta)* |
| transferencia, cambio | *la fila 1 es el flujo `origen → destino`, no una cuenta sola* |

Fila 2 — **fecha**: fecha larga, con la derecha **contextual**:
- movimiento on-ledger → `✓ Impactado` / `✓ Acreditado` / `✓ Completada`
- consumo o cuota de tarjeta → `Resumen · {período}`
- gasto con reintegro pendiente → `Reintegro · Pendiente` (en `--warning-deep`)

Fila 3 — **solo cuando aplica**, y es la única variante que rompe el "2 filas":
`Nota` (descripción larga), `Regla` (recurrencia, navegable), `Gasto de origen`
(reintegro, navegable), `Composición` (pago de resumen).

## 3. Comportamiento

- **Topbar.** WD: `←` icon-button + `Eliminar` (icon, hover en tono peligro) + `Editar`
  (sólido navy). N ≡ WM: `←` + `···` con las secundarias, y `Editar` como barra inferior
  fija full-width, respetando `safe-area-inset-bottom`.
- **Sin permisos de gestión** (movimiento compartido pago por el otro, cuota hija, pago
  de resumen): la topbar no renderiza slot de acciones **y la barra inferior no existe**.
  No se deja un CTA deshabilitado ocupando lugar.
- **Editar** abre el drawer en contexto cuando está disponible; si no, navega a `[txId]/edit`.
- **Eliminar** mantiene el `AlertDialog` con copy contextual y el flujo de dos salidas
  cuando el movimiento sembró una recurrencia. Nada de esto cambia.
- **Filas navegables** (Regla, Gasto de origen, Compra original) llevan `›` a la derecha
  y todo el alto de la fila es el área táctil (mínimo 56px).
- **Grilla de WD**: 1 bloque ⇒ full width. ≥2 bloques ⇒ 2 columnas, con el bloque de tipo
  a la izquierda (es el protagonista) y cuenta/fecha a la derecha. **Nunca** una columna
  con un bloque de una sola fila.

## 4. Specs

### Medidas

| Elemento | N ≡ WM | WD |
|---|---|---|
| Panel | ancho completo, padding lateral 16 | `max-w-[760px]`, centrado |
| Icon-button de topbar | 36×36, radio 10 | 36×36 (era 42×42) |
| Hero — ícono | 60×60, radio 19, emoji 28 | 68×68, radio 21, emoji 32 |
| Hero — título | 19px / 850 / −0.025em | 21px |
| Hero — monto | 38px / 850 / −0.045em | 46px |
| Hero — línea de contexto | 13px / 700 | 13px |
| Hero — padding | 26 / 22 / 22 | 32 / 36 / 26 |
| Bloque — radio | 18 | 20 |
| Fila del bloque | min-height 56, padding 13/16 | padding 14/20 |
| Badge de cuenta | 36×36, radio 11 | igual |
| Rótulo / valor de fila | 12px / 750 · 14.5px / 800 | igual |
| Separador entre filas | 1px `--border-soft` | igual |
| Gap entre bloques | 12 | 12 / 16 en grilla |
| Barra inferior CTA | alto 48, radio 14 | no aplica |

El hero baja de 72–88px de ícono y 46–60px de monto a 60–68 y 38–46: sigue siendo el
protagonista, pero deja de comerse la primera pantalla entera.

### Tokens

Todos de `@grana/ui-tokens`. **Ningún hex suelto.**

- Tono, vía `toneVars()` — ya existe: gasto → `--terracotta{,-soft,-deep}`;
  ingreso → `--emerald-deep` / `--emerald-soft`; transfer → `--slate{,-soft,-deep}`.
- Superficies: `--card`, `--border`, `--border-soft`, `--page`.
- Texto: `--text`, `--text-muted`, `--text-soft`.
- Badges de cuenta: efectivo `--emerald-deep`, banco/débito `--slate`, crédito `--navy`,
  neutro `--border-soft` + ícono `--slate`.
- Alert informativo: `--slate-soft` / `--slate-deep`. Alert de revisar: `--warning-bg` /
  `--warning-deep` / borde `--warning-soft`.
- Estado ok: `--emerald-deep`. CTA de editar: `--navy` / `--white`.

### Primitivos a reusar

`Alert`, `Drawer`, `Button`, `DropdownMenu`, `AlertDialog` en web; `Drawer`,
`PageHeader`, `Pressable` en nativo. El bloque es una composición de `Tile` + `DetailRow`
que ya existen (`_components/detail/glance.tsx`) — se aprieta el padding y se reparte el
contenido, no se crea un primitivo nuevo.

## 5. Estados cubiertos por el mockup

1. Gasto simple en efectivo con descripción · 2. Gasto sin descripción · 3. Descripción
larga (fila "Nota") · 4. Consumo de tarjeta off-ledger · 5. Cuota hija · 6. Compra en
cuotas (madre) · 7. Gasto compartido · 8. Gasto con reintegro pendiente · 9. Ingreso ·
10. Transferencia · 11. Cambio de moneda · 12. Generado por recurrencia · 13. Pago de
resumen · 14. Reintegro y Ajuste · 15. Borde: "Revisar", y compartido sin permisos.

**Umbral de la descripción larga:** más de 72 caracteres **o** más de 3 líneas
renderizadas ⇒ el hero cae a la categoría y la descripción baja a la fila "Nota".

## 6. Qué NO hacer

- **No dejar el tile "Descripción"** cuando el hero ya muestra ese mismo texto. Es el
  origen de la mitad de la duplicación (decisión DC-1, ya cerrada).
- **No conservar la fila de chips del hero.** Si un chip sobrevive, el bloque de abajo lo
  repite y volvemos al punto de partida.
- **No usar la grilla de 2 columnas de WD con un solo bloque.** Un bloque solo va full width.
- **No inventar hex.** Si falta un color, se agrega a `@grana/ui-tokens`.
- **No fusionar ARS y USD** en ningún monto, total ni composición. Van lado a lado.
- **No mostrar número de tarjeta.** Grana es gestión, no opera pagos: solo nombre de la
  cuenta + tipo.
- **No convertir el bloque en formulario.** El detalle es lectura; toda edición pasa por
  "Editar".
- **No agregar totales agregados** al detalle ni a ninguna lista (la spec los prohíbe).
- **No divergir N de WM.** Si algo se ve distinto entre la app nativa y la web en vista
  mobile, es un bug del handoff, no una decisión.
- **No tocar** atomicidad, deuda derivada, generación de instancias ni el corte temporal.

## 7. Decisiones ya tomadas

- **DC-1 — cerrada.** La descripción deja de tener tile propio cuando ya es el título del
  hero. Excepción: descripción larga → fila "Nota".
- **DC-2 — cerrada como principio general.** N ≡ WM: la app nativa y la web en vista
  mobile son idénticas. Se aplica a todo el módulo, no solo a este bloque.

### Cambios de comportamiento que este handoff introduce

Son dos, y los dos son consecuencia directa de N ≡ WM:

1. **La pedagogía contextual aparece en la app nativa.** Hoy no existe, y el requirement
   "El detalle ofrece pedagogía in-context sobre off-ledger y reintegros pendientes" no
   tiene tag de plataforma: nativo está **fuera de spec**. Esto lo corrige.
2. **La composición ARS/USD del pago de resumen aparece en la app nativa.** Mismo motivo.

### Pendiente de confirmar antes de implementar

- **DC-4** — el back del detalle: la spec pide **ícono solo, sin label "Volver"**; el
  código actual lo renderiza con label. El mockup dibuja el ícono solo (sigue la spec).
  Si preferís conservar el label en WD, hay que corregir la spec, no el código.
- El banner "Generado por una regla" hoy se pinta **arriba del botón Volver**. El mockup
  lo baja a una fila navegable del bloque. Es mejora clara, pero mueve un elemento que
  hoy tiene posición propia.

## 8. Impacto esperado

Gasto simple con descripción, N ≡ WM: de **4 superficies apiladas** (hero con 4 chips +
3 tiles) a **2** (hero + 1 bloque). Estimado ~40% menos de alto. En WD la grilla pasa de
4 tiles desparejos —uno de ellos con una sola fila— a 1 bloque full-width, o 2 bloques
parejos cuando el tipo lo justifica.
