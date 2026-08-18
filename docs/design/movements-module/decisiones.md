# Movimientos — Decisiones de rediseño

> Documento de decisiones (no implementación). Captura lo acordado con la PO al
> desmenuzar el módulo Movimientos, parte por parte. Ancla los handoffs visuales
> de `docs/design/movements-module/` y los OpenSpec change proposals que deriven.
>
> **Estado:** cada decisión indica el suyo. Nada de esto está implementado todavía;
> `openspec/specs/transactions/spec.md` sigue reflejando el comportamiento actual
> hasta que cada change se mergee.
>
> Relevamiento que originó la conversación: [`RELEVAMIENTO.md`](./RELEVAMIENTO.md).

---

## D-000 · Principio: la app nativa y la web en vista mobile son idénticas

**Estado: cerrada.**

La app de Expo y `apps/web` en viewport mobile (`<768px`) deben ofrecer lo mismo:
mismas capacidades, mismos datos, mismos roles. Si algo se ve o se comporta distinto
entre esas dos, es un bug, no una decisión de plataforma.

El desktop **sí** puede divergir, pero solo para aprovechar el ancho — nunca para
tener o dejar de tener una capacidad.

**Consecuencia inmediata:** toda divergencia N↔WM catalogada en el relevamiento
(D1, D2, D4, D5, D6, D8) deja de ser "oportunidad de mejora" y pasa a ser deuda.
Y toda decisión de este documento se implementa en las tres superficies o en ninguna.

---

## D-001 · Buscar es una intención distinta de analizar un mes

**Estado: cerrada.** Cambia comportamiento. Alcance: las tres superficies.

### El problema

Hoy la búsqueda por texto está **encerrada en el mes seleccionado**, siempre.
`adaptFiltersForQuery` (`apps/web/lib/transactions/filters-state.ts`) proyecta
`month` en cada consulta, incluso cuando hay un término de búsqueda, y no existe
ninguna UI que permita un rango de fechas ni "todo el historial".

En la práctica: parada en marzo, buscás "Netflix", el movimiento es de febrero, y la
app responde **"No encontramos resultados"** — sin aclarar que buscó solo en marzo.
Es peor que no tener buscador: te lleva a concluir que el movimiento no está cargado,
y a cargarlo de nuevo. Un duplicado nacido de un buscador mal acotado.

### La decisión

La lupa **no es un filtro más: es un cambio de modo de la pantalla.**

- **Modo mes (por defecto).** El gráfico dice "Agosto" y el listado son los
  movimientos de agosto. Coherencia total entre gráfico y lista. **No se toca.**
- **Modo búsqueda.** Mientras hay texto en la lupa, el listado **abandona el mes** y
  muestra todo el historial que coincide, ordenado por fecha descendente. Al limpiar
  la búsqueda se vuelve al mes exactamente como estaba.

Nunca conviven los dos: o estás mirando un mes, o estás mirando una búsqueda.

### Durante la búsqueda, los encabezados pasan de día a mes

No es un extra opcional — es una **consecuencia forzada** de la decisión anterior.
El listado agrupa por día ("Hoy", "Ayer", "martes 12 de marzo"), lo cual funciona
dentro de un mes; sobre tres años de historial produce decenas de encabezados con una
sola fila debajo. En modo búsqueda el encabezado es el **mes**.

Y eso contesta las dos preguntas reales que motivaron la decisión:

- **"¿lo cargué todos los meses?"** — es una pregunta de *ausencia*. Agrupado por mes,
  el mes que falta es el que no aparece: si después de junio viene abril, mayo no está.
  **No se renderizan meses vacíos como placeholder** — agregan ruido y no agregan
  información.
- **"¿cómo evolucionó el precio?"** — los importes quedan alineados en columna y la
  progresión se lee de un vistazo.

### Reglas finas

- **Los demás filtros siguen aplicando.** Tipo, categoría, subcategoría, cuenta,
  moneda y rango de importe se respetan durante la búsqueda. El único que se suspende
  es el mes: los otros los eligió el usuario a propósito, el mes estaba por defecto.
- **Sin totales ni promedios por mes.** El requirement "El listado de movimientos no
  muestra totales agregados" se respeta. Los importes fila por fila ya muestran la
  evolución; abrir la puerta de los totales es otra decisión y no se toma de contrabando.
- La paginación ("cargar más") sigue igual: el modo búsqueda pagina como cualquier
  listado.

### Costo y viabilidad

- **Backend: ya está.** `get_movements_page` (migración 0042) aplica el filtro de
  fechas solo si recibe `from`/`to` (`and (f.date_from is null or t.date >= f.date_from)`).
  Si no se le mandan, devuelve todo el historial. La limitación es de cliente, no de base.
- **Web: chico.** Dejar de proyectar `month` cuando hay `query`, y cambiar el
  agrupador del listado en modo búsqueda.
- **Nativo: es construir, no arreglar.** La app hoy **no tiene buscador ni filtros**
  en el feed global. Por D-000 esta decisión no puede salir solo en web. La buena
  noticia es que el sheet de filtros nativo ya existe, montado en el detalle de cuenta
  (`apps/mobile/components/accounts/MovementFiltersSheet.tsx`): hay que moverlo y
  parametrizarlo, no inventarlo.

### Lo que esta decisión NO resuelve

Quedan fuera, explícitamente, para tratar por separado:

- **No se puede buscar por subcategoría.** El texto se compara contra título,
  descripción, nombre de la cuenta y cuenta destino (solo en transferencias). La
  subcategoría no entra en la comparación, ni en el servidor (`get_movements_page`)
  ni en el cliente (`movementMatchesText`).
- **No se puede buscar por importe.** Buscar "48000" no trae nada, aunque para un ojo
  contable el importe suele ser el dato más recordable.
- **Riesgo menor de idioma:** la comparación se hace contra `categories.name`, que está
  sembrada en español, mientras que la UI de una categoría de sistema muestra la
  traducción de `categories.{canonical_name}`. En español coinciden; en inglés el
  usuario buscaría la etiqueta que ve y la base compararía contra la española.

---

## D-002 · El filtro de categoría y el drill del gráfico son dos informes distintos

**Estado: cerrada.** Cambia presentación y rotulado, **no** cambia ninguna base contable.
Alcance: las tres superficies.

### El problema

Filtrar por categoría devuelve **un conjunto distinto de movimientos** según si hay o no
otro filtro activo, y el cambio es silencioso.

Con **solo** la categoría (`MovementListContainer`, estado `pureCategoryDrill`) el listado
sale de `getMonthCategoryLines`: lente **devengada**, que es la del gráfico. Al agregar
cualquier otro filtro (cuenta, tipo, importe, texto) cae a `get_movements_page`: lente
**caja**.

Ejemplo real — heladera en 12 cuotas de $145.000 ($1.740.000) con la Visa, categoría Hogar:

| Filtro | marzo | abril |
|---|---|---|
| solo "Hogar" | una cuota de **$145.000** | otra cuota de $145.000 |
| "Hogar" + cuenta "Visa" | la compra completa, **$1.740.000** | nada |

Y lo mismo en otros tres puntos: un gasto compartido de $620.000 con parte propia de
$310.000 muestra $310.000 en el drill y $620.000 en el feed; un reintegro recibido de la
categoría aparece en el drill (netcando) y no en el feed; un movimiento con fecha futura
aparece en el feed y no en el drill (corte temporal CAJA).

**Las dos contabilidades son correctas.** Lo que falta es que la pantalla diga en cuál estás.

### La decisión

Se descartaron unificar todo a caja (rompería la conciliación con el gráfico) y unificar
todo a devengado (rompería el listado como registro, y chocaría con los saldos).

Se separan los dos actos y se les pone nombre:

- **Tocar una categoría en el gráfico** abre una vista con encabezado propio —
  *"Hogar en agosto — composición"*— que aclara qué incluye (las cuotas imputadas al mes,
  la parte propia de los gastos compartidos, los reintegros restando). **Su suma sigue
  dando exactamente el peso de la categoría en la torta**: esa garantía se preserva, es
  lo primero que la PO confirmó querer.
- **El filtro de categoría del panel** es siempre lente caja, como cualquier otro filtro.
- Si estando en la composición se agrega otro filtro, la app **avisa** que se sale de esa
  vista, en vez de cambiar los números en silencio.

### El gráfico NO se toca

Queda explícito porque se discutió y se descartó: el gráfico conserva su base **devengada**
(lente Consumo). Una cuota se imputa al mes que corresponde, no cuando se paga el resumen.
Cambiar eso sería tocar el corazón contable de la app y está fuera de este barrido.

Vocabulario del proyecto, para no confundirlo (ver `docs/design/shared/decisiones-rediseno.md`):
**Consumo** = devengado, impacta al comprar → es el gráfico. **Caja** = impacta cuando la
plata se mueve → es el listado. **Compromiso** = proyección.

---

## D-003 · Insignias de la fila: bandera → ícono, valor → texto

**Estado: cerrada.** Solo presentación.

### La regla

- **Insignia que es una bandera de sí/no** → en **mobile (nativo y web-vista-mobile)** va
  **solo el ícono**; en **desktop** va **ícono + palabra**.
- **Insignia que lleva un valor o un estado** → **texto siempre**, en las tres superficies.
  Ningún ícono puede decir "Cuota 2 de 6" ni distinguir tres estados de reintegro.

Es una regla general, no una lista: cuando aparezca una insignia nueva, se clasifica y se
aplica sola.

| Insignia | Clase | Mobile | Desktop |
|---|---|---|---|
| Compartido | bandera | 👥 solo | 👥 + "Compartido" |
| Recurrente | bandera | ↻ solo | ↻ + "Recurrente" |
| **Revisar** | **excepción** | ⚠ + "Revisar" | ⚠ + "Revisar" |
| Cuotas ("3 cuotas" / "Cuota 2 de 6") | valor | texto | texto |
| Estado del reintegro (pendiente / recibido / cancelado) | estado | texto | texto |

### Por qué "Revisar" es la excepción

Técnicamente es una bandera, pero no es una etiqueta descriptiva: es **la única insignia
que pide una acción**. Un triángulo amarillo solo comunica "algo raro", no "falta la
categoría". Conserva la palabra en las tres superficies. Queda escrito para que nadie lo
"corrija" después en nombre de la consistencia.

### Esto cumple D-000

Las dos superficies mobile quedan idénticas entre sí. El desktop diverge **solo en
densidad** —muestra lo mismo con más letra—, nunca en capacidad. Es exactamente la
excepción que D-000 permite.

### Obligatorio: etiqueta de accesibilidad

Un ícono sin texto visible **debe** llevar su etiqueta accesible (`aria-label` en web,
`accessibilityLabel` en nativo). Sin ella, quien usa lector de pantalla no tiene forma de
saber qué significa. Es una línea de código y por eso mismo se olvida.

### Beneficio de rebote: se descomprime la fila

El relevamiento marcaba que con dos o más insignias el título se trunca en 360px. Pasar
Compartido y Recurrente a ícono lleva cada una de ~90px a ~16px. **El problema de
saturación se resuelve casi entero sin esconder ninguna insignia**, que era la salida fea
(un "presupuesto de badges" con colapso). Esa propuesta queda descartada por innecesaria.

### Consecuencias a resolver al implementar

1. **La app nativa no muestra "Recurrente".** La insignia no existe en
   `apps/mobile/components/movements/MovementRow.tsx`. Por D-000 hay que agregarla — como
   ícono solo, según esta regla.
2. **El gate `showFeedBadges` de nativo contradice a web.** En web las insignias de
   compartido y revisar se muestran siempre, en los cuatro contextos donde vive la fila.
   En nativo están detrás de un flag que solo el feed global activa, así que el panel de
   período de tarjeta no las muestra. O las muestran las dos plataformas o ninguna; hoy
   difieren, y eso viola D-000.
3. **Prerrequisito: unificar la fila nativa.** El detalle de cuenta en nativo usa otra fila
   (`apps/mobile/components/accounts/MovementRow.tsx`, 72 líneas) que no muestra ninguna
   insignia. Esta decisión no puede aterrizar ahí sin unificar antes las dos filas en una
   sola, como ya hace web. Deja de ser limpieza opcional y pasa a ser prerrequisito.

### Considerado y descartado (por ahora)

**Mostrar "tu parte $310.000" bajo el importe de un gasto compartido.** Se evaluó a fondo
y se dio de baja. Queda registrado para que no vuelva dentro de tres meses como idea nueva,
junto con lo que se aprendió analizándolo:

- Mostrar **solo** la parte propia como importe de la fila **no** es viable: el saldo de las
  cuentas se calcula con el **monto completo** (verificado: `get_account_balance_sums`,
  migración 0051, no tiene ninguna noción de `is_shared` ni de splits). En el detalle de
  cuenta, donde cada fila lleva su saldo corriente al lado, la columna dejaría de cerrar.
- Si algún día se retoma, el lugar correcto es **debajo del importe, en la columna de
  números** — no en el subtítulo, que en 360px ya se trunca con `categoría · cuenta`.
- El total con el desglose por persona vive en el módulo **Compartido**. Movimientos no lo
  duplica.

---

## Pendientes de la conversación

Anotados para no perderlos, en el orden en que los vamos a tratar:

1. El resto del panel de filtros: el toggle "mostrar compartidos" (hoy es un ícono en la
   toolbar que no suma al conteo de "Filtros (N)" y cuyo estado activo se lee al revés),
   y los dos huecos de búsqueda que D-001 dejó abiertos (subcategoría e importe).
2. El resto del inventario del relevamiento: detalle del movimiento (hay un handoff
   preliminar en `detalle-compacto/`, escrito antes de estas decisiones — **revisarlo
   contra D-003 antes de darlo por bueno**), recurrencias y contextos embebidos.
