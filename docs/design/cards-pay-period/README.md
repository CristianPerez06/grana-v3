# Handoff: Pagar resumen de tarjeta de crédito (Grana · módulo Tarjetas)

## Overview
Rediseño de **una** pantalla: el **pago de resumen** de una tarjeta de crédito
(`/cards/[id]/periods/[periodId]/pay`). Es un **formulario de confirmación**: el
usuario registra que pagó (total o parcial) el resumen, confirma el **impuesto de
sellos** que le cobró el banco, indica **desde qué cuenta** sale la plata y **en
qué fecha**, y de paso confirma las **fechas reales (cierre/vencimiento)** del
ciclo en curso que ese resumen anuncia. Español rioplatense, bimoneda ARS/USD.

La pantalla actual funciona pero está cruda (labels sueltos, `<select>` nativo,
`<button>` con clases inline, avisos sin jerarquía). Acá se la lleva al **sistema
visual del módulo Tarjetas** (consistente con `/cards`, `/accounts/[id]`,
`/dashboard`) y se la reconstruye con los **primitivos de la librería**.

> Las capturas que acompañan este handoff (`uploads/…`) son referencia de
> **inventario y comportamiento**, NO de estética. El campo "Impuesto de sellos"
> todavía no está en el código: la captura es la fuente de verdad de ese bloque.

## About the Design Files
Prototipos en **HTML/CSS/JS vanilla** — referencia de look & feel y comportamiento,
**no** código de producción. Recrear en el codebase real (React/Next) con sus
componentes, design system y estado. El shell (sidebar 300px + main 1040px) **ya
existe en v3: no reconstruirlo**; implementar acá la pantalla de pago. Los montos,
cuentas y fechas son **mock** para ilustrar estados.

## Fidelity
**Alta fidelidad.** Colores, tipografía, spacing e interacciones son los
definitivos del sistema de Tarjetas. Plus Jakarta Sans (usar la del repo si
difiere). Todos los importes con `font-variant-numeric: tabular-nums`.

---

## Decisión clave: ¿el sello se suma al total a debitar?
**Sí — el impuesto de sellos es un cargo aparte que se debita de la MISMA cuenta.**
Por eso, en todo el rediseño:

```
Total a debitar = Monto a pagar (del resumen)  +  Impuesto de sellos
```

- El **Monto a pagar** salda la deuda del resumen (puede ser parcial).
- El **Impuesto de sellos** es lo que el banco cobra por el resumen; sale de la
  cuenta junto al pago.
- El **aviso de saldo negativo** se calcula con el **total a debitar** (monto +
  sellos), no solo con el monto. Esta es la cifra que tiene que poder responder
  "¿de dónde sale?" — la dejamos explícita en cada variante (nota inline en V1,
  helper del hero en V2, fila navy del recibo en V3).

> En la captura actual el negativo se calcula solo con el monto (ignora sellos):
> lo tratamos como una imprecisión a corregir. La regla contable correcta es que
> ambos cargos salen de la cuenta.

---

## Inventario real (datos + componentes de la librería)
Se muestran **todos** los datos/estados que la pantalla maneja. No se agregan
totales, queries ni acciones nuevas.

### Sección "Datos del pago"
| # | Dato | Primitivo | Notas |
|---|---|---|---|
| 1 | **Impuesto de sellos** (NUEVO, primer campo) | **MoneyChipPicker** (nuevo) + `MoneyAmountInput` | Chips de montos sugeridos por la app (calculados del resumen) + "No me cobraron sellos" ($0) → pre-rellenan el input editable. Variante **primera vez** (explicación larga, "solo esta vez") vs **ya aprendido** (sugerencia compacta + editable). |
| 2 | **Monto a pagar** | `MoneyAmountInput` | Pre-llenado con el total pendiente, editable (pago parcial). Helper con el total entre paréntesis. NUNCA `<input type=number>` para plata. |
| 3 | **Caso USD** (solo si el período tiene deuda en USD) | `MoneyAmountInput` (fx) + `Alert info` + box de desglose | Banner que anuncia "Consumos en dólares: US$ X". Campo **cotización del día** (fx) + desglose "pendiente ARS + (USD × fx) = total"; el monto se autocompleta con ese total. ARS dominante, USD subordinado y etiquetado. |
| 4 | **Cuenta de débito** | `Select` | Nombre + saldo ARS por opción. NO `<select>` nativo. |
| 5 | **Aviso de saldo negativo** | `Alert · warning` | No bloqueante: disponible proyectado + "Podés registrarlo igual". |
| 6 | **Fecha del pago** | `DatePicker` | Default hoy (AR). |

### Sección "Ciclo en curso"
| # | Dato | Primitivo | Notas |
|---|---|---|---|
| 7 | **Confirmación de fechas** | `Card` + `badge` "fechas estimadas" + 2× `DatePicker` | Microcopy de contexto (cerró el dd/mm) + **Cierre** y **Vencimiento**. Validan: cierre posterior al cierre del resumen pagado; vencimiento posterior al cierre. |
| 8 | **Aviso de irreversibilidad** | `Alert · muted` (informativo, no warning) | "Una vez confirmado no se puede revertir → ajuste de saldo". |
| 9 | **CTA "Confirmar pago"** | `Button` (full-width primario) | Estado **"Procesando…"** (spinner). "← Resumen" es **link de texto**, no botón. |

### Estados
`loading` (skeleton, `loading.tsx`) · `error de validación por campo` (monto > 0,
vencimiento posterior al cierre) · `error de form` (banner). Ver `web/pay.html`
(sección Estados) y `components/index.html`.

---

## Primitivo nuevo propuesto: `MoneyChipPicker`
El bloque de sellos no encaja en `Segmented` (overlay-primitives) porque combina
**chips de opción** con un **input editable acoplado**. Propuesta:

```
<MoneyChipPicker
  value={number}                  // valor actual (en el input)
  onChange={(n) => …}
  suggestions={[                  // chips calculados por la app
    { label: '$604',    value: 604 },
    { label: '$503,33', value: 503.33 },
    { label: '$50,33',  value: 50.33 },
  ]}
  zeroOption="No me cobraron sellos"   // chip $0 (estilo muted)
  currency="ARS"
  learned={boolean}               // false = "primera vez" (texto largo);
                                  // true  = "ya aprendido" (compacto)
/>
```

- Tocar un chip pre-rellena el `MoneyAmountInput` de abajo y lo deja **editable**.
- `learned=false`: muestra la explicación larga ("Te lo preguntamos solo esta vez…").
- `learned=true`: chip sugerido pre-seleccionado + microcopy compacto ("Aprendido
  de tus pagos · editable"). El input va en su variante `sm`.
- Si el equipo prefiere no crear un primitivo, se puede componer con
  `Segmented` (sin el input) + `MoneyAmountInput`, pero pierde el acople visual.

---

## Variantes (espectro)
Cada variante se ve completa en `web/pay.html` y `mobile/pay.html`, etiquetada y
con una línea de racional.

- **V1 · Mínima — al sistema.** Misma estructura de dos secciones ("Datos del
  pago" / "Ciclo en curso") llevada a Card / Alert / Select / chips con jerarquía
  clara. Muestra: **solo ARS** + sellos **ya aprendido** (compacto).
- **V2 · Foco en el monto — héroe.** Monto a pagar como héroe; sellos y resto
  subordinados; **ciclo en curso plegado** hasta que se necesita. Muestra: **caso
  USD** (banner + cotización + desglose, en el orden real: banner → cotización →
  desglose → sellos → monto) + sellos **primera vez** (explicación larga).
- **V3 · Recibo — revisá antes de confirmar.** Paso de confirmación tipo recibo
  con el **total desglosado** (monto + sellos = total a debitar, fila navy)
  bien explícito. Muestra: **solo ARS**, paso 2 de 2.

**Recomendación:** **V1 como base de implementación** (es la traducción 1:1 del
comportamiento actual al sistema, menor riesgo) **incorporando dos cosas de las
otras**: (a) la **nota de relación sellos↔total a debitar** de V3 — es la pieza
que más sube la confianza— y (b) el **banner + orden cotización-primero** de V2
para el caso USD. El recibo de V3 queda como mejora futura (paso 2 opcional para
pagos grandes o que dejan la cuenta en negativo).

---

## Dirección visual: web vs mobile
**Mismos tokens y primitivos (`shared.css`), dos layouts pensados por separado.**

- **Web (`web/pay.html`)** — columna de formulario centrada (~660px) dentro del
  `main` del shell v3. Secciones en `Card`. El caso USD usa un desglose de dos
  columnas (label / monto). Ciclo en curso con los dos DatePicker lado a lado.
  CTA full-width al final del flujo.
- **Mobile (`mobile/pay.html`)** — pantalla de app **nativa, NO el web angostado**:
  - **una sola columna**, cada bloque en su `Card`;
  - **header sticky** con back + identidad de la tarjeta;
  - **avisos full-width**, chips que envuelven, desglose apilado;
  - **CTA fijo abajo** (`app-foot`) con el **total a debitar siempre visible** +
    "Confirmar pago"; en V3 el "Volver a editar" va como link debajo del CTA.
  - Nada de "label largo + monto grande" en una sola línea.

---

## Principios duros (innegociables)
- **Bimoneda:** ARS y USD nunca se mezclan. ARS protagonista (tipografía grande),
  USD subordinado y etiquetado. El pago del resumen **siempre se liquida en ARS**.
- **Precisión contable + pedagogía:** cada cifra responde "¿de dónde sale?". El
  impuesto de sellos, el desglose USD×fx y el aviso de negativo son el corazón de
  la confianza. Microcopy que explica sin condescender.
- **Aviso, no bloqueo:** el saldo negativo se advierte (`Alert warning`), nunca se
  impide. Regla transversal de Grana para toda salida de plata.
- **Tarjetas off-ledger:** microcopy aclara que **recién este pago** (gasto sobre
  la cuenta de débito) mueve el disponible; el consumo de la tarjeta no lo movía.
- **Responsive de verdad:** mobile es un archivo y un layout aparte, no un
  breakpoint del web.

---

## Design Tokens (`shared.css`)
Tokens **canónicos de la librería** (def3.css / compartido `shared.css`), no los del
módulo Tarjetas viejo. Plus Jakarta Sans (400–800).

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#EEF1F4` | fondo de la pantalla |
| `--card` | `#FFFFFF` | superficies (Card) |
| `--field` | `#FAFBFC` | fondos de box/desglose |
| `--navy` / `--ink` | `#0B1A2B` / `#142231` | texto, fila total del recibo (superficie navy) |
| `--muted` `--soft` `--faint` | `#6B7683` `#8A94A3` `#AEB6C0` | jerarquía de texto secundario |
| `--border` / `--line` | `#E8ECF1` / `#EEF1F5` | bordes / divisores |
| `--emerald` / deep / soft | `#11B981` `#0E9E6E` `#E7F8F0` | **acción primaria** (CTA, foco de inputs/Select, chip seleccionado), positivo, etiqueta USD |
| `--terracota` / deep / soft | `#C2705C` `#9A4B38` `#F7ECE7` | "a pagar", hero del monto (V2), errores |
| `--slate` / soft | `#3A6B8A` `#EAF1F6` | acento, badge "estimadas", `Alert info` |
| `--amber` / soft | `#E79A2B` `#FBF0DD` | `Alert warning` (saldo negativo) |
| `--cc-accent` | por marca (Amex `#3A6B8A`) | marca de la tarjeta en el PageHeader |

> **CTA "Confirmar pago" = verde de marca (`--emerald`)**, consistente con la
> acción primaria del resto de la app (Saldar, Registrar movimiento) — que es el
> flujo análogo de sacar plata de una cuenta. No navy.

**Forma:** Card 20px · inputs/datefield/Select 13px · chips 11px · botón 14px ·
badge 999px. **Montos es-AR:** miles `.`, decimales `,` (ej. `$50.836,67`); USD
como `US$ 120,00`, siempre etiquetado.

---

## Archivos de trabajo
```
design_handoff_pagar_resumen/
├── PROMPT_para_Claude_Code.md · brief copiable para implementar en el repo
├── web/pay.html         · mock desktop, standalone (V1 · V2 USD · V3 recibo · Estados)
├── mobile/pay.html      · mock mobile nativo, archivo separado (3 screens, CTA fijo)
├── components/index.html· galería de bloques reutilizables (cada uno → su primitivo)
├── shared.css           · tokens + primitivos visuales (lo cargan web y mobile)
└── README.md            · este documento
```

> **Web y mobile son dos implementaciones**, no un breakpoint: el repo es un
> monorepo con `apps/web` (Next/React) y `apps/mobile` (React Native), cada uno con
> sus propios primitivos en `components/ui/`. `web/pay.html` → `apps/web`;
> `mobile/pay.html` → `apps/mobile` (pantalla nativa, no el web angostado).
Interacciones vivas en los prototipos (vanilla, mover a estado del repo al
implementar): chips de sellos (selección + pre-relleno) y `Select` (abrir/elegir).

## Assets
- **Fuente:** Plus Jakarta Sans (Google Fonts) — usar la del repo.
- **Íconos:** todos SVG inline estilo line (stroke 2, round). Equivalentes 1:1 a
  Lucide/Feather: chevron, tarjeta, calendario, triángulo de aviso, candado
  (irreversible), info, estrella (aprendido), check. Sustituir por el set del repo.
- Sin imágenes raster. Sin números de tarjeta (la app no los almacena).
