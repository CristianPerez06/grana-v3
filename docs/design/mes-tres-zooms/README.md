# Mes · tres zooms — handoff visual

## Contexto

Baja a tierra el modelo de información definido en
[`docs/plans/ui-readability-simplification.md`](../../plans/ui-readability-simplification.md) §4bis:

> **Grana siempre te muestra un mes. Elegís cuál arriba, y el nivel de detalle abajo.**
>
> - **Inicio** → el mes RESUMIDO
> - **Informes** → el mes ANALIZADO
> - **Movimientos** → el mes en DETALLE

Disparadores: la PO ("está todo mostrado de forma compleja") y un usuario real que pedía
ver los gastos del mes siguiente, cosa que hoy la app no responde.

**Alcance de este bundle: mobile.** Por `D-000` del módulo Movimientos, la app nativa (N)
y la web en viewport mobile (WM) deben ser idénticas, así que un solo set de pantallas
cubre las dos. El desktop (WD) puede divergir **solo para aprovechar el ancho** y se
diseña en una segunda pasada.

## Estado

**Exploración para validar el modelo**, no handoff cerrado. Ninguna de estas pantallas
tiene todavía un OpenSpec change. Los datos son de ejemplo (tomados de la planilla real de
referencia). Los colores son representación: al implementar salen de `@grana/ui-tokens`.

## Las cinco pantallas

| # | Pantalla | Qué prueba |
|---|---|---|
| 1 | **Inicio · agosto** | El mes corriente con su parte hecha y su parte por venir. Tres bloques en vez de siete |
| 2 | **Inicio · septiembre** | La misma pantalla en un mes futuro = 100% previsión. Sin caso especial. **Es la planilla de Cristian, generada sola** |
| 3 | **Informes · agosto** | Dónde vive el análisis: serie diaria, ranking por categoría, top 10 movimientos |
| 4 | **Movimientos · agosto** | Lista y nada más. Sin dona, sin avisos apilados |
| 5 | **Movimientos · drill** | El aterrizaje desde Informes con la lente declarada (D-002) |

## Decisiones que los mocks materializan

### Un solo selector de mes, global

Las cinco pantallas comparten el control. Hoy hay dos sistemas independientes
(`dashboard-month-context.tsx` y `lib/transactions/filters-context.tsx`) y el del dashboard
gobierna solo 2 de 6 cards. Acá el contrato es total y sin excepciones.

**Requiere liberar `canGoForward`** — hoy `dashboard-month-context.tsx` capa la navegación
al pasado (`canGoForward = monthsBack > 0`), lo que hace la pantalla 2 literalmente
inalcanzable.

### El mes es el contenedor; `hoy` es una línea adentro

Una sola superficie cuya composición cambia sola con el calendario: mes anterior = 100%
hecho · mes corriente = hecho + previsión · mes siguiente = 100% previsión. Una regla, cero
casos especiales, nada que se teletransporte en un borde de fecha.

La porción previsión se dibuja **rayada y con borde punteado**, y nunca entra en
`disponible`. El principio "el futuro no es un hecho" se mantiene intacto.

### Stock ≠ flujo

"Tengo hoy" incorpora **Deudas** y **Neto** (el patrimonio): ahí vive el stock de deuda de
tarjeta. El mes solo muestra el **pago** que cae en él. Al salir del mes corriente el
bloque se **colapsa a una línea**, porque un stock no cambia con el mes que mirás — la
separación se enseña con el layout, sin copy explicativa.

### El chip ⇄ usa el vocabulario ya fijado

`Caja ⇄ Consumo` no es vocabulario nuevo: está cerrado en
[`movements-module/decisiones.md`](../movements-module/decisiones.md) D-002 —
*"**Consumo** = devengado, impacta al comprar → es el gráfico. **Caja** = impacta cuando la
plata se mueve → es el listado. **Compromiso** = proyección."*

Esto resuelve la pregunta abierta #1 del brief: no hay que inventar dos palabras, hay que
**mostrar las que el proyecto ya eligió**.

### Exacto vs. Estimado: un campo, no una entidad

Las líneas de "Los fijos de septiembre" se etiquetan `Exacto` / `Estimado`. Es el campo
`amount_is_estimated` sobre la tabla `recurrences` que ya existe — **una columna, no un
módulo nuevo de "gastos fijos"**. Solo las estimadas se editan.

Verificado en `docs/design/mobills-comparison.md`: en Mobills "Gasto fijo" **no** es un
concepto de proyección separado de recurrencia — su motor de proyección es un flag
Realizado/Pendiente por transacción, que ese mismo documento recomienda **no** traer
(rompería el corte temporal).

### La previsión es editable — como override, nunca como movimiento

Editar una línea proyectada **no crea una transacción**. Guarda un *override del estimado*
para ese mes, que solo afecta la previsión:

```
recurrence_amount_overrides (recurrence_id, year_month, amount)
```

Cuando la instancia se genera de verdad, el override pasa a ser el **monto sugerido** y
deja de proyectar. El ledger nunca ve un hecho futuro.

Sin esta separación, "editable" se desliza sola hacia "creo ya el alquiler de septiembre",
y ahí el futuro entra al libro y `disponible` miente. El override es lo que da la
flexibilidad de la planilla **sin romper el foso contable**.

### Movimientos pierde el gráfico

`/transactions` queda como lista + filtros. El desglose por categoría se muda a Informes,
que es donde el análisis tiene casa. Se conserva el **vínculo**: Informes explora,
Movimientos aterriza filtrada con la lente declarada en un chip navy (pantalla 5).

Los tres avisos "por confirmar" (`RecurrenceSuggestionBanner`, `PendingRecurrencesBlock`,
`PendingReimbursementsBlock`) se mudan a Inicio en una sola línea: son **tareas**, no
análisis.

## Compatibilidad con decisiones ya cerradas

| Decisión | Estado en estos mocks |
|---|---|
| **D-000** · N ≡ WM | ✅ Un solo set de pantallas mobile |
| **D-001** · Buscar abandona el mes | ✅ La lupa está en el topbar de Movimientos; no se toca su comportamiento |
| **D-002** · Drill devengado vs. filtro caja | ⚠️ **Refinado, requiere OK de la PO** — ver abajo |
| **D-003** · Bandera → ícono, valor → texto | ✅ Pantalla 4: `↻` `👥` como íconos, "Cuota 2 de 12" como texto |
| **D-004** · Export a Excel (solo WD) | ✅ No afectado (es desktop) |

### El refinamiento sobre D-002

D-002 se escribió asumiendo que el gráfico vive en Movimientos. Estos mocks lo mudan a
Informes. **La sustancia de D-002 se cumple y se refuerza**: las dos lentes siguen
separadas, nombradas, y la composición conserva su encabezado propio y su garantía de sumar
exactamente el peso de la torta.

Lo que cambia es que la separación pasa a ser **por pantalla** (Informes = Consumo,
Movimientos = Caja) en vez de convivir en la misma vista. Es más limpio, pero es un cambio
de alcance sobre una decisión ya cerrada y **no se da por aprobado**.

## Riesgo abierto — la previsión subestima

La pantalla 2 dice "Te queda $473.884" contando **solo lo fijo**. No incluye comida, nafta
ni salidas. Decisión tomada: **mostrarlo con el aviso explícito** (fase 1) y, cuando haya
3+ meses de historial, sumar una línea de gasto variable promedio (fase 2).

## Archivos

- `shared.css` — tokens y chrome de los mocks
- `mobile/screens.html` — las cinco pantallas en una hoja

## Siguiente paso

1. Validar el modelo con la PO sobre estos mocks.
2. Resolver el refinamiento de D-002.
3. Diseñar la pasada desktop (WD) — el ancho permite Inicio en dos columnas e Informes con
   el ranking al lado del gráfico.
4. Recién ahí, los OpenSpec changes.
