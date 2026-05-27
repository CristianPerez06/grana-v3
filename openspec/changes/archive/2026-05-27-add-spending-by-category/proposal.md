## Why

El módulo Movimientos hoy responde "¿qué movimientos tuve?" (la lista) pero no "**¿en qué se fue mi plata?**" de un vistazo. Esa es una de las tres preguntas centrales del modo de usuario (cuánto tengo / qué viene / **en qué se fue**) y no tiene superficie todavía: no existe ninguna vista por categoría en toda la app.

grana-v2 sí tenía un **desglose de gastos por categoría** (en el dashboard, como barras rankeadas + un donut en household). Este change lo porta a v3 — pero mejorado y bien ubicado: como la **carta de presentación del módulo Movimientos** (un donut + ranking que muestra qué categoría pesa más), con la lista de movimientos a un tap de distancia.

Además, cierra el último pendiente del feature de reintegros: el **neto por categoría** (`computeCategoryNet` ya vive, puro y testeado, en `@grana/money-logic`). El desglose pesa por **neto** = gastos − reintegros recibidos, así "Supermercado" muestra lo que *realmente* te costó, no el bruto.

## What Changes

**Carta de presentación de Movimientos:**
- `/transactions` abre con un **overview por categoría del mes**: un **donut** (SVG liviano, sin librería de charts) como héroe que muestra el peso de cada categoría, y un **ranking** debajo (categoría · monto · % · barrita), ordenado de mayor a menor.
- **Tap en una categoría** → el listado de movimientos filtrado por esa categoría (reusa el filtro `?category=` que ya existe).
- **Navegación por mes** (‹ ›), default mes actual.
- El listado de movimientos sigue accesible (la carta de presentación no lo reemplaza, lo antecede).

**Métrica (reintegro-aware):**
- El peso de cada categoría es el **neto por moneda** = Σ gastos − Σ reintegros recibidos de esa categoría (`computeCategoryNet`). Bimoneda: ARS primaria, USD subordinada; nunca se suman.
- Es un desglose de **gastos** (los ingresos no entran — es "en qué se fue").

**Teaser en el dashboard:**
- El dashboard suma un bloque chico con las **3 categorías que más pesan** del mes, que linkea al overview completo en Movimientos. No es el desglose completo (eso vive en Movimientos), es un gancho.

## Capabilities

### Added Capabilities
- `spending-by-category`: el desglose de gastos por categoría del mes (neto, por moneda), su presentación como donut + ranking en la carta de presentación de Movimientos, el drill-down a la lista filtrada, la navegación por mes, y el teaser top-3 en el dashboard.

## Impact

- **`@grana/money-logic`**: reusa `computeCategoryNet` (ya existe). Posible helper puro nuevo para armar las tajadas del donut (porcentajes que suman 100, "Otros" para la cola). Sin duplicar cálculo.
- **Web — queries** (`apps/web/lib/`): nueva query que arma el desglose del mes por categoría (gastos + reintegros recibidos con categoría derivada), por moneda.
- **Web — UI**: `/transactions` gana la carta de presentación (donut + ranking); nuevo componente donut SVG; el dashboard gana el teaser top-3.
- **i18n**: claves del overview (título "En qué se fue", "Otros", labels del donut/ranking).
- **Sin migraciones**: es presentación + agregación derivada; no se persiste nada.
- **Sin cambios en mobile**: el helper puro queda en `money-logic`; mobile espeja después.

### Fuera de alcance (V1)
- Desglose de **ingresos** por categoría (esto es sólo gastos / "en qué se fue").
- Sub-categorías en el donut (se agrupa por categoría; la sub queda para el detalle).
- Comparativas mes-a-mes / tendencias / proyecciones.
- Presupuestos por categoría.
