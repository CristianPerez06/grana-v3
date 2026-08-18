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

## Pendientes de la conversación

Anotados para no perderlos, en el orden en que los vamos a tratar:

1. **El panel de filtros.** Incluye un tema contable fino ya detectado: filtrar por
   categoría **cambia el conjunto de movimientos** según si hay otro filtro activo o
   no. Con solo la categoría, el listado muestra lo que compone el peso de esa
   categoría en el gráfico (lente devengado: cuotas por mes de imputación, la parte
   propia de un gasto compartido, reintegros netcados). Al agregar cualquier otro
   filtro, cae al feed general (lente caja). Mismo filtro, distinto resultado.
2. El resto del inventario del relevamiento (detalle, fila, recurrencias, embebidos).
