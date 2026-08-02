# Design: cut-month-lenses-at-today

## Contexto

0052 dejó el sistema con **dos relojes**: el saldo cortaba en hoy y las lentes del mes no. Mientras las filas futuras eran raras el desacuerdo no se veía; con recurrencias sin confirmar (que nacen fechadas adelante) el mismo dashboard mostraba Disponible correcto y "Balance del mes" en −$1.992.744. No es un bug de cálculo: las dos lecturas respondían preguntas distintas sin decirlo.

## Decisión 1 — El corte es de CAJA, no universal

La tentación es cortar todo en hoy: una regla, fácil de explicar. Está mal para tarjeta.

| Lente | Unidad de acumulación | Corte |
|---|---|---|
| CAJA (`status IS NULL`) | el **día**: la plata salió o no salió de la cuenta | sí, en hoy inclusive |
| DEVENGADO (tarjeta, `status` 'pending'/'paid') | el **mes**: la cuota pertenece a su período | no |

Una cuota fechada el 20 de agosto ya está incurrida el 1 de agosto: la compra pasó, el compromiso existe, y `spending-by-category` lo tiene escrito ("cada cuota impacta el mes de la fecha de su transacción hija"). Cortarla haría que la dona arrancara casi vacía cada mes y se fuera llenando por un motivo que no es gasto nuevo. El usuario ya la ve como comprometida en la card "Comprometido"; esconderla en la dona sería mentir en la otra dirección.

Implementación del predicado, una sola vez:

```
.or('status.not.is.null,date.lte.<hoy>')   →   (status IS NOT NULL OR date <= hoy)
```

Se aplica en el servidor (PostgREST) y no en JS: el payload no viaja para después descartarse, y el read sigue siendo completo por construcción — el predicado **angosta** la ventana, nunca la trunca (a diferencia del `max-rows` silencioso que motivó `fix-balance-read-path-defects`).

## Decisión 2 — `hoy` se inyecta, no se lee de un reloj adentro

Cada read toma `todayISO` como parámetro con default `financialTodayISO()` (fecha calendario en `America/Argentina/Buenos_Aires`). Dos razones:

1. **Determinismo en tests.** Un test que dependa del día real pasa hoy y falla el mes que viene. Con el parámetro, los casos de borde (hoy, hoy+1, mes que no empezó) se fijan.
2. **Un solo "hoy" por request.** Es el mismo criterio que ya usa el RPC del saldo (`p_today`): el corte del saldo y el del mes tienen que caer en el mismo día o la reconciliación vuelve a romperse. Nunca `current_date` del servidor: Supabase corre en UTC y adelantaría el corte hasta 3 horas.

## Decisión 3 — Los días futuros no se dibujan

`buildMonthBalanceSeries` emite `days` hasta `cutoffDay` en vez de rellenar el mes. La alternativa (emitir los 31 días con el acumulado congelado) hace que un día que no llegó se vea idéntico a un día sin movimientos — una línea plana que el usuario lee como "no gasté", no como "todavía no pasó". Hoy ningún consumidor renderiza la serie diaria (`MonthBalanceChart` no existe en web ni en mobile), así que el cambio no toca UI; la decisión queda tomada para cuando exista el gráfico.

`cutoffDay` se clampea a `[0, díasDelMes]`: un caller no puede estirar la serie más allá del mes, y `0` (mes que todavía no empezó) da serie vacía en vez de un array raro. La agregación además descarta filas pasadas del cutoff aunque el caller se las pase — el corte de la query y el de la agregación son la misma regla aplicada dos veces, a propósito: si un read futuro olvida el predicado, el número igual sale bien.

## Decisión 4 — Alcance: los drills acompañan a la dona

`getMonthCategoryLines` y `getMonthSubcategoryBreakdown` no eran parte del síntoma, pero el spec exige que la lista drilleada sume exactamente el peso de la categoría que abre. Cortar la dona sin cortar sus drills rompía esa reconciliación de inmediato. `getMonthIncomeBreakdown` entra por simetría: es la misma pregunta ("qué pasó este mes") del lado de los ingresos, y un ingreso futuro tampoco llegó.

Fuera de scope, deliberadamente:

- **`summarizePeriod`** (`@grana/money-logic`): no tiene callers en producción. Tocarla sería cambiar código muerto sin poder verificar el efecto.
- **La card "Comprometido"**: es forward-looking por diseño — mira justamente lo que todavía no pasó. El corte la vaciaría de sentido.
- **Listados de movimientos**: una fila futura SIGUE siendo visible y editable. El corte es de agregados, no de visibilidad.

## Riesgo conocido

El mes en curso ahora es un número que crece durante el mes. Un usuario que compare "Balance del mes" contra lo que tenía anotado a fin de mes verá el total recién el último día. Es el comportamiento correcto (es lo que efectivamente pasó hasta hoy) y el mismo que ya tenía el Disponible desde 0052, pero es un cambio de lectura respecto de lo que la app mostraba ayer.
