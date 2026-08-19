# Mapa de acceso a la información

> **Objetivo:** que Grana muestre la información de forma SIMPLE, legible de un vistazo y
> fácil de consultar. La información **ya existe y está bien calculada** — el problema es
> dónde vive y cuánto cuesta llegar a ella.

_Estado: análisis. **No se implementó nada.** Fecha: 2026-08-19, sobre `main` (`1a5bf42`)._

_Toma como dado el handoff `docs/design_handoff_inicio_definitivo/` (Inicio está diseñado a
alta fidelidad y no se rediscute acá) y el `clarify-dashboard-lenses` recuperado._

## Cómo leer las tablas

- **Taps** = desde abrir la app, en **mobile** (donde el costo es real). `0` = está en la
  landing. Web desktop siempre cuesta uno menos porque la sidebar es permanente.
- **Diagnóstico**: 🟢 accesible · 🟡 existe pero lejos o escondido · 🔵 duplicado · 🔴 no existe.

---

## A · STOCK — "¿qué tengo y qué debo?"

| Dato | Pregunta que responde | Dónde vive hoy | Taps | Dx |
|---|---|---|---|---|
| Disponible ARS + USD | ¿cuánto tengo? | Inicio, hero | **0** | 🟢 |
| Saldo por cuenta | ¿dónde está mi plata? | Inicio "Dónde está" · `/accounts` | 0 / **2** | 🟢 |
| **Deuda de tarjeta** (A pagar + En curso) | ¿cuánto debo? | `/cards`, hero navy — bimoneda, bien construido | **2** | 🟡 |
| Límite usado por tarjeta | ¿cuánto me queda de límite? | `/cards`, wallet | **2** | 🟡 |
| **Patrimonio neto** (disponible − deuda) | ¿cuánto tengo de verdad? | — | — | 🔴 |

**Lo que salta:** el número de deuda existe, está bien hecho y en bimoneda — pero vive en un
módulo al que se llega por un bottom sheet. **Inicio muestra los activos y no los pasivos.**
Nunca, en ninguna pantalla, los dos números se ven juntos.

---

## B · FLUJO DEL MES — "¿cómo me fue?"

| Dato | Pregunta que responde | Dónde vive hoy | Taps | Dx |
|---|---|---|---|---|
| Entró / Salió / Neto | ¿cómo se movió mi plata? | Inicio, "Balance del mes" | **0** | 🟢 |
| Gasto por categoría | ¿en qué se me fue? | Inicio (teaser top-3) **+** `/transactions` (dona completa) | 0 / **1** | 🔵 |
| Ingresos por categoría ("De dónde vino") | ¿de dónde vino? | Solo `/transactions`, tras un toggle | **2** | 🟡 |
| Gasto caja vs. devengado | ¿cuánto gasté de verdad? | Dos cards distintas de Inicio, con rótulos casi iguales | 0 | 🔵 |
| Movimientos del mes | ¿qué cargué? | `/transactions`, bajo 3 avisos + la dona | **1** + scroll | 🟡 |
| Serie diaria de gasto | ¿cuándo gasté? | — (el tipo `MonthBalanceDay` existe y no se renderiza) | — | 🔴 |
| **Top movimientos del mes** | ¿por qué gasté tanto? | — | — | 🔴 |
| Comparación con el mes anterior | ¿estoy peor que el mes pasado? | — | — | 🔴 |

**Lo que salta:** el desglose por categoría se calcula con la **misma query**
(`getMonthCategoryBreakdown`) y se pinta en **dos superficies distintas** — Inicio y
Movimientos — sin que ninguna sea la autoritativa. Es la única función del repo con dos
puertas visuales.

Y falta la pregunta más frecuente después de un mes caro: *"¿por qué gasté tanto?"*. La
respuesta casi nunca es una categoría; son dos o tres movimientos grandes. **No hay ninguna
vista que los muestre.**

---

## C · COMPROMISO — "¿qué se viene?"

| Dato | Pregunta que responde | Dónde vive hoy | Taps | Dx |
|---|---|---|---|---|
| Resúmenes a pagar | ¿qué tengo que pagar? | Inicio "Comprometido" · `/cards` hero | 0 / **2** | 🟢 |
| Próximos cierres y vencimientos | ¿cuándo vence? | `/cards` hero (capado en 3) | **2** | 🟡 |
| **Cuotas en curso** | ¿en cuántas cuotas estoy metida? | Solo **dentro de cada tarjeta**, un pane con total propio | **4 × tarjeta** | 🟡 |
| Recurrencias pendientes de confirmar | ¿qué tengo que confirmar? | Inicio · `/transactions` · `/transactions/recurring` | 0 / 1 / **2** | 🔵 |
| Mis gastos fijos (reglas activas) | ¿qué pago todos los meses? | `/transactions/recurring` | **2** | 🟡 |
| Próximas ocurrencias | ¿qué viene la semana que viene? | `/transactions/recurring` | **2** | 🟡 |
| Gastos fijos del mes que viene | ¿cuánto me va a salir septiembre? | — | — | 🔴 |

**Lo que salta:** *"¿cuántas cuotas tengo activas y cuánto suman?"* es una pregunta central en
Argentina, la app tiene el dato, y **para responderla hay que entrar a cada tarjeta y sumar
de cabeza.** Con 7 tarjetas son ~28 taps y una calculadora.

Y **"Mis gastos fijos" —la lista que Cristian mantiene a mano en la planilla— está enterrada
dos niveles dentro de Movimientos**, un módulo que no la nombra.

---

## D · HISTÓRICO — "¿puedo consultar?"

| Dato | Pregunta que responde | Dónde vive hoy | Taps | Dx |
|---|---|---|---|---|
| Meses anteriores | ¿cómo me fue en junio? | Selector de mes de Inicio (12 meses atrás) | 0 | 🟡 |
| Meses futuros | ¿qué se viene en septiembre? | — (`canGoForward` lo prohíbe por diseño) | — | 🔴 |
| Buscar un movimiento | ¿dónde está ese gasto? | `/transactions`, **encerrado en el mes** | 1 | 🟡 |
| Un concepto en el tiempo | ¿cuánto aumentó el alquiler? | — | — | 🔴 |
| Llevarme los datos | quiero verlo en Excel | — | — | 🔴 |

**Lo que salta:** **no existe ninguna superficie de consulta.** El selector de mes de Inicio
es todo lo que hay, y solo alcanza a las cards de Inicio. Las decisiones `D-001` (buscar
abandona el mes) y `D-004` (export a Excel) del módulo Movimientos atacan dos de estos
huecos y están cerradas sin implementar.

---

## Las tres listas accionables

### 1 · Existe, está bien calculado, y no se muestra en ningún lado

| Dato | Ya lo calcula | Costo de exponerlo |
|---|---|---|
| Patrimonio neto (activos − deuda) | `get_account_balance_sums` + `getCreditCardDebtCheck` | Bajo — es una resta de dos números que ya se piden |
| Total de cuotas en curso, todas las tarjetas | `CuotasEnCursoPane` ya lo suma **por tarjeta** | Bajo — falta la vuelta global |
| Serie diaria de gasto | `MonthBalanceDay` en el tipo, sin consumidor | Bajo — el dato viaja y se descarta |
| Top movimientos del mes | Ordenar lo que ya trae `get_movements_page` | Muy bajo |

### 2 · Se muestra dos veces, sin dueño

| Dato | Puerta A | Puerta B | Hay que decidir |
|---|---|---|---|
| Gasto por categoría | Inicio (teaser) | `/transactions` (dona + ranking) | Cuál es la autoritativa |
| Gasto caja vs. devengado | "Balance del mes → Gastos" | "Gasté este mes" | Fusionar o rotular (lo resuelve `clarify-dashboard-lenses`) |
| Recurrencias pendientes | Inicio + `/transactions` + hub | | Una sola |

### 3 · Está lejos y debería estar cerca

| Dato | Hoy | Debería |
|---|---|---|
| Deuda de tarjeta | 2 taps (sheet → Tarjetas) | Junto al disponible, en Inicio |
| Cuotas en curso (global) | 4 taps × tarjeta | 1 tap |
| Mis gastos fijos | 2 taps, dentro de Movimientos | Módulo propio o 1 tap |
| Cuentas y Tarjetas (mobile) | 2 taps, dentro de un sheet | Tab |

---

## La pregunta de fondo

Grana tiene **cuatro lentes** bien construidas y **cada una vive en un módulo distinto**:

```
STOCK        →  Cuentas + Tarjetas   (2 taps, en un sheet)
FLUJO        →  Inicio                (0 taps)
COMPROMISO   →  Inicio + Cards + Recurrencias  (repartido en 3)
HISTÓRICO    →  no existe
```

El usuario no piensa en módulos: piensa en preguntas. Y hoy **una pregunta puede requerir
tres módulos**, o no tener respuesta.

Tres caminos posibles, para discutir:

**A · Traer los datos a Inicio.** El `Inicio Definitivo` ya hace parte de esto (Compromisos
entra/sale). Faltaría la deuda junto al disponible. Barato, pero Inicio tiene techo: no puede
absorber la consulta histórica.

**B · Crear una superficie de consulta ("Informes").** Absorbe el histórico, el top de
movimientos, la serie diaria y la comparación entre meses. Le saca a Movimientos el gráfico
que hoy tiene por ausencia de otro lugar. Es un módulo nuevo.

**C · Reordenar el acceso sin crear nada.** Cuentas y Tarjetas suben a tab, los gastos fijos
salen de Movimientos, el total de cuotas se expone. Cero features nuevas, solo ruteo y
navegación. Es el más barato de los tres y resuelve toda la lista 3.

No son excluyentes; el orden natural sería **C → A → B**.

## Lo que este mapa NO cubre

Alta de movimientos (lo lleva `docs/plans/mobile-tap-reduction-redesign.md`), detalle de
movimiento (fuera de scope por decisión de producto), y el rediseño de Inicio (ya resuelto en
su handoff).
