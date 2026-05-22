# Diseño — Redesign card detail page

## Contexto

Sesión de exploración de diseño en mayo 2026. El owner reportó que la página `/cards/[id]` se sentía "desordenada" y, conversando, lo concretó: la pregunta que vive en la página es **"¿cómo vienen mis tarjetas?"** — específicamente, "¿puedo hacer un gasto no esencial hoy, o me conviene esperar al cierre del resumen para que caiga en el período siguiente?". Esto desplaza el foco de la página de mirada contable retrospectiva ("qué debo pagar") a mirada decisional prospectiva ("cómo se proyecta la carga").

## Decisiones

### 1. Layout — termómetro horizontal de 3 columnas

Estructura del detalle, de arriba hacia abajo (caso "normal" con período `actual`, límite cargado, USD activo):

```
┌─────────────────────────────────────────────────────────┐
│ ← Tarjetas                                              │
│                                                         │
│ Visa Galicia · Banco Galicia · Límite $200.000          │
│                                                         │
│ CÓMO VIENE TU TARJETA                                   │
│                                                         │
│   EN CURSO          PRÓXIMO          SIGUIENTE          │
│   cierra 05/06      cierra 05/07     cierra 05/08       │
│   vence  22/06      vence  22/07     vence  22/08       │
│                                                         │
│   ▓▓▓▓▓▓▓░░ 78%    ▓▓░░░░░░░ 20%    ▓░░░░░░░░ 13%       │
│   $156.000         $40.000          $25.000             │
│   USD 50,00        USD 0,00         USD 0,00            │
│                                                         │
│   Disponible $14.000 de $200.000                        │
│                                                         │
│   [ Registrar consumo ]                                 │
│                                                         │
│ ── Movimientos del resumen actual ──  Ver todos los     │
│                                       resúmenes →       │
│ 18/05  Supermercado Día              $ 42.300           │
│ 16/05  Netflix                        $ 4.500           │
│ ...                                                     │
│                                                         │
│ ⋯ Detalles · Editar · Archivar                          │
└─────────────────────────────────────────────────────────┘
```

Las tres columnas comparten el límite total como denominador. La suma de los % de las columnas puede exceder 100% si hay muchas cuotas comprometidas; eso es señal explícita y se refleja en la línea total ("por encima del límite", color de alerta).

**Por qué tres columnas y no más/menos:**

- Dos columnas (solo en curso + próximo) no muestra el efecto compuesto de cuotas largas; pierde el valor decisional.
- Cuatro o más rompe el grid en mobile y la información se vuelve abrumadora.
- Tres es predecible: el usuario aprende dónde caen las cosas y cuánto se proyecta hacia adelante.

**Cuándo se generan los próximos períodos:** la infraestructura lazy ya existe por el invariante `I-CRED-12`. Si los períodos "PRÓXIMO" o "SIGUIENTE" no existen, se generan al renderizar el detalle.

### 2. Etiqueta y color de la columna activa según estado

| Estado derivado del período activo | Etiqueta en columna 1 | Color de columna |
| --- | --- | --- |
| `tarjeta_nueva` (sin history) | (no aplica — usa estado vacío, no termómetro) | — |
| `actual` (con history o sin) | `EN CURSO` | neutral |
| `cerrado_esperando_pago` | `POR PAGAR` | ámbar |
| `vencido` | `VENCIDO` | rojo |
| `pagado` | `PAGADO` | gris/verde |

Las columnas 2 y 3 (próximo y siguiente) son típicamente `futuro` cuando tienen cuotas comprometidas, o vacías (`$0 · sin cuotas`). En cualquier caso su etiqueta es estable: `PRÓXIMO` y `SIGUIENTE`.

### 3. Comportamiento del límite

Hoy la página repite tres veces el mismo dato: barra de uso + texto "78% utilizado" + texto "$44k disponible". Es ruido. La decisión:

- **La barra dentro de cada columna** comunica `% usado` de ese período sobre el límite total. Una barra que se llena = carga; encaja con verde/ámbar/rojo y con la metáfora "cómo viene".
- **Una sola línea total debajo del termómetro** muestra disponible como cifra absoluta (dato accionable directo: "¿puedo gastar este consumo de $30k?").
- Se elimina el texto "% utilizado" suelto (redundante con la barra).

Las cuatro variantes de la línea total:

| Caso | Texto |
| --- | --- |
| Normal | `Disponible $X de $Y` |
| Sin compromisos en ningún período | `Disponible $Y de $Y` |
| Excede el límite (`comprometido > limit`) | `Comprometido $X — $Z por encima del límite` (color de alerta) |
| Sin límite cargado | `"Cargá el límite para ver cuánto te queda"` + link `[Cargar]` |

**Por qué "por encima del límite" en lugar de "Disponible -$X":** los disponibles negativos son confusos. Cuando se excede, le doy vuelta el mensaje y nombro lo que está pasando ("estás $X por encima"). Más claro semánticamente.

**Bimoneda y límite:** el límite es ARS-only. Los consumos USD subordinados en cada columna NO entran al cálculo de la barra ni del disponible. Esto es coherente con el principio **Bimoneda** (ledgers separados) y con `I-CRED-9` (cuotas ARS-only).

**Colores de la barra (umbrales sobre el % de cada columna individual):**

- ≤69%: color primario.
- 70%–89%: ámbar.
- ≥90%: rojo.
- Excede 100% en una columna sola: rojo + (opcional) franja de exceso visible.

### 4. Movimientos del período activo

Se muestran todos sin paginación. El período activo tiene típicamente entre 5 y 30 movimientos; rara vez más. Paginarlo agrega complejidad sin pagar nada (no estoy mostrando movimientos de toda la historia, solo del período actual).

### 5. Unificación de links

- En el detalle: un único link `"Ver todos los resúmenes →"` dentro del encabezado de la sección Movimientos.
- En la página destino (`/cards/[id]/periods`): `<h1>Resúmenes`, sin "historial" en el título (la lista incluye pasados, presente y futuros).

Por qué "Resúmenes" a secas y no "Todos los resúmenes": ya estás en el contexto de la tarjeta, el título corto se lee como heading natural.

### 6. Banners full-width arriba del hero

- **Banner rojo "Resumen vencido"**: se mantiene. Vencido es urgencia, justifica romper la jerarquía visual.
- **Banner ámbar "El vencimiento se acerca"**: se elimina. La columna `EN CURSO` ya muestra `vence DD/MM`; el dato está. Un banner ámbar persistente las dos semanas previas al vencimiento es ruido.

### 7. Tarjeta nueva (sin un solo consumo histórico)

El termómetro con tres ceros no comunica nada. Reemplazo por estado vacío específico:

```
┌──────────────────────────────────────────────────┐
│ ← Tarjetas                                       │
│                                                  │
│ Visa Galicia · Banco Galicia                     │
│                                                  │
│ Tu tarjeta está lista.                           │
│ Registrá el primer consumo para empezar a ver    │
│ cómo viene cada resumen.                         │
│                                                  │
│ [ Registrar primer consumo ]                     │
│                                                  │
│ ⋯ Detalles · Editar · Eliminar                   │
└──────────────────────────────────────────────────┘
```

El termómetro aparece recién cuando hay al menos un movimiento (o un pago) en cualquier período. Una vez "encendido", no se vuelve a apagar.

### 8. Tarjeta archivada

Dos sub-casos diferentes:

- **Archivada con pendientes** (cuotas todavía corriendo en períodos futuros, o resúmenes sin pagar): termómetro normal arriba + banner inactiva. CTA `[Pagar resumen]` cuando corresponde, sin `[Registrar consumo]` (no se puede gastar más). Reactivar disponible como acción.
- **Archivada sin pendientes** (todo pago, sin deuda corriendo): estado vacío "Tarjeta archivada · sin pendientes" + opción `[Reactivar]`. Sin termómetro.

> **Nota de implementación:** el design original contemplaba también `[Eliminar definitivamente]` para este caso. Pero la server action `deleteAccount` bloquea el borrado de toda cuenta con transacciones, y "archivada sin pendientes" tiene historial pagado por definición (no podés llegar al estado archivada sin haber tenido movimientos). Eliminar definitivamente quedaría reservado para un cambio futuro que defina si se rompe la regla de integridad contable y bajo qué condiciones. Por ahora el estado vacío ofrece solo `[Reactivar]`.

### 9. CTAs por estado

Matriz completa:

| Estado del período activo | CTA primario | CTA secundario |
| --- | --- | --- |
| `tarjeta_nueva` | `[Registrar primer consumo]` (estado vacío) | — |
| `actual` | `[Registrar consumo]` | — |
| `pagado` (el activo está pagado, no hay otro pendiente) | `[Registrar consumo]` | — |
| `cerrado_esperando_pago` | `[Pagar resumen]` | `[Registrar consumo]` |
| `vencido` | `[Pagar ahora]` rojo | `[Registrar consumo]` |
| Inactiva con pendientes | `[Pagar resumen]` si aplica | — |
| Inactiva sin pendientes | `[Reactivar]` | `[Eliminar definitivamente]` |

El botón `[Cuotas — Próximamente]` desaparece sin reemplazo. Cuando exista la feature, vuelve como nuevo requirement.

### 10. Acciones administrativas

`Editar`, `Archivar` / `Eliminar`, `Detalles` (límite, fecha de alta, fecha de archivado) bajan a un footer discreto al pie. La idea: no compiten visualmente con el contenido decisional ni con el CTA primario.

## Trade-offs considerados y descartados

| Opción descartada | Por qué |
| --- | --- |
| Tabs (Resumen actual · Próximos · Historial) | Rompe el scroll lineal y mete state en una página mayormente de lectura. |
| Mostrar el resumen actual grande y los próximos como mini lista debajo (lo más parecido a hoy, solo limpiado) | Pierde la pregunta "cómo viene" — el usuario tiene que leer una lista para inferir abultamiento. |
| Barra de carga sobre disponible (verde grande cuando hay margen, rojo chico cuando no) | Confunde porque rompe la convención "barra llena = carga". |
| Ocultar la columna que está en $0 | Rompe la predictibilidad: el usuario no sabe si la columna falta porque no hay datos o porque no se calculó. Mejor mostrarla con "sin cuotas". |
| Mostrar USD solo en columnas con USD > 0 | Inconsistente con **Bimoneda por defecto**: si la tarjeta opera en USD, USD se muestra siempre. USD 0,00 es información ("no comprometiste USD en este período"), no ruido. |
| Repetir "78% utilizado" como texto debajo de la barra | La barra ya comunica eso. Sumarlo en texto es ruido. |

## Out of scope

- **Vista análoga en el listado `/cards`**: la pregunta nació plural ("cómo vienen mis tarjetas") pero la conversación se acotó al detalle. La lista del listado de tarjetas puede merecer un termómetro reducido en un change posterior.
- **Mobile (`apps/mobile`)**: aplicar el mismo IA en RN queda para un change posterior. El web es la versión canónica del rediseño.
- **Feature "Cuotas"**: este change elimina el botón "Cuotas — Próximamente" sin reemplazo. La funcionalidad de cuotas viene en otro change.
- **Flow de carga del límite**: el link `[Cargar]` del estado "sin límite cargado" se asume conectado al flow de edición existente; no se agrega UI nueva acá.
