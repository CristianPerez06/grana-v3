# Hoy vs. propuesta — misma información, otra lectura

## Premisa

De la PO: *"es posible que toda la info y las funcionalidades estén; en lo que hay que
enfocarse es en cómo mostrar para que la info sea fácil de leer y sirva al instante."*

Este bundle toma esa premisa literalmente. **Los dos lados de cada comparación muestran los
mismos datos.** No hay features nuevas, ni queries nuevas, ni cálculos nuevos. Cambia el
orden, la jerarquía, qué se suma y cómo se nombra.

## El criterio de lectura

Cada pantalla lleva una línea punteada que marca **dónde termina el primer viewport**. Todo
lo que queda debajo exige scroll. El test es simple: *¿qué respondés sin mover el dedo?*

## Los tres casos

| Ruta | Qué muestra hoy sin scrollear | Qué mostraría |
|---|---|---|
| `/transactions` | Un banner, dos avisos y media dona. **Cero movimientos** | 7 movimientos con día, categoría, cuenta y monto |
| `/transactions/recurring` | Una descripción de qué es una recurrencia + 3 cards. **Ningún total** | El total mensual, el corte caja/tarjeta y 5 fijos |
| `/cards` | Hero + lista de tarjetas — **ya está bien** | Lo mismo + cuotas en curso global |

## Qué cambia en cada uno

### 1 · `/transactions` — la lista empieza abajo del scroll

Los tres avisos (`RecurrenceSuggestionBanner`, `PendingRecurrencesBlock`,
`PendingReimbursementsBlock`) son **tareas**; el desglose por categoría es **análisis**.
Ninguno de los dos es "mis movimientos", y los cuatro ocupan la primera pantalla entera.

- Los avisos se funden en **una línea** (`4 cosas por confirmar ›`). El detalle sigue a un tap.
- El selector de mes sube al tope. Hoy vive **dentro** de la card del gráfico.
- El gráfico se muda a la superficie de análisis (ver `mapa-acceso-informacion.md`).
- La toolbar baja de 4 íconos sin etiqueta a 2: el ↻ duplica un link del header y el 👥 es un
  filtro disfrazado de ícono (ya anotado como pendiente en `movements-module/decisiones.md`).

### 2 · `/transactions/recurring` — veinte filas sin un total

El hub está bien construido y **no se le saca nada**. Se le agregan tres cosas que ya están
en los datos:

- **El total mensual arriba de todo** — es el número por el que entrás, y hoy hay que sumar
  20 filas a mano. Es exactamente lo que la planilla de Excel sí da.
- **Corte caja vs. tarjeta** — lo único que decide si un fijo te pega en el disponible o te
  llega por resumen. Sale de `accounts.type`, ya consultado.
- **Un nombre que el usuario reconozca**: "Gastos fijos", no "Recurrencias".

Las cards "Próximos 7 días" y "Más adelante este mes" se comprimen en la misma línea de
pendientes, con la fecha más urgente visible.

### 3 · `/cards` — casi todo se conserva

Verificado contra el código: el hero (`cards-month-hero.tsx`) y la lista agrupada por banco
con cierre, vencimiento y uso del límite (`cards-compact-view.tsx`) **están bien y no se
tocan**.

Lo único que se agrega es el bloque de **cuotas en curso global**. Hoy `CuotasEnCursoPane`
suma las cuotas por tarjeta, dentro del detalle de cada una: con 4 tarjetas, responder
"¿cuánto debo en cuotas?" cuesta 16 taps y una calculadora.

## Lo que este bundle NO propone

- Ninguna query nueva, ningún cálculo nuevo, ninguna migración.
- No toca Inicio (ya resuelto en `design_handoff_inicio_definitivo`).
- No toca reglas contables: bimoneda sin sumar, tarjetas off-ledger, corte temporal.
- No proyecta el futuro (bloqueado por cobertura de datos — ver
  `ui-readability-simplification.md` §6bis).

## Archivos

- `shared.css` — base de `design_handoff_inicio_definitivo/cards/cards.css` + chrome + comparador
- `index.html` — los tres casos, lado a lado

## Preguntas abiertas

1. **¿Los avisos van a Inicio o quedan como línea en Movimientos?** El mock los deja en
   Movimientos; el mapa sugiere Inicio (son tareas, no listado).
2. **¿"Gastos fijos" es ruta propia o el hub renombrado?** El delta es el mismo; cambia el costo.
3. **¿El corte caja/tarjeta es la agrupación correcta**, o conviene agrupar por día del mes
   (que es como se lee un calendario de pagos)?
