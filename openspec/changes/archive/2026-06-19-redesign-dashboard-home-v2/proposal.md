## Why

El dashboard ya entrega las lentes correctas (CAJA / CONSUMO / COMPROMISO), pero varias secciones todavía comunican el dato como **lista o texto** cuando el principio rector del producto es que **lo visual comunique el número sin tener que leerlo**. El handoff `apps/web/prototypes/dashboard-redesign-v1/` define una iteración hi-fi: concentración del saldo de un vistazo, compromiso como tiles con cierre neto cuando hay sueldo, gasto caja-vs-tarjeta como barra, y la presencia del Hogar visible desde el Inicio. Es una mejora de legibilidad sobre el dashboard existente, solo web (la paridad nativa queda diferida como otras secciones).

## What Changes

- **"Dónde está" deja de ser una lista** y pasa a un callout de concentración (`%` grande de la cuenta dominante) + una **barra de concentración** con segmentos proporcionales por cuenta + una **grilla compacta de 2 columnas** para el resto + la fila "En dólares". (web)
- **"Comprometido" deja de usar filas `FlowRow`** y pasa a **dos mini-tiles** de egreso ("Resúmenes tarjeta", "Gastos recurrentes"). Cuando hay ≥1 ingreso recurrente, se agrega una **tile verde "Ya entra"** a ancho completo y una **banda de cierre neto** ("arrancás con **+X** a favor"), con `neto = ingresos recurrentes − total comprometido a salir`. Sin ingreso recurrente, no aparecen ni la tile verde ni el cierre. (web)
- **Nueva tira "Compartido"** condicional: una fila fina con el neto **derivado** del Hogar (una sola dirección: te deben / debés), que se renderiza **solo si hay actividad** compartida. (web)
- **"Financiado en tarjeta" deja de ser una nota de texto** y se promueve a la sección **"Gastaste este mes"**: una **barra proporcional caja vs tarjeta** con el total del mes y los dos segmentos rotulados. Conserva la reconciliación `total = caja + financiado` y el rótulo "se paga en los próximos resúmenes". (web)
- **La leyenda de "¿En qué gasté?" suma una barra proporcional por categoría** (ancho = monto / máximo), además del monto y el `%` ya existentes. (web)
- **La fila "Ajustes" de "Balance del mes" suma un chip "SIN REGISTRAR"** junto al monto, reforzando el aviso educativo ya presente. (web)

Sin cambios de data model ni de queries: todos los anchos/segmentos se derivan de los payloads ya disponibles (`getDashboardHero`, `getMonthBalanceSeries`, `getMonthCategoryBreakdown`, `getCommittedOutlook`) y del neto del Hogar ya derivado en `apps/web/lib/shared/queries.ts`. Barras, tramos y anchos son **data-driven**, nunca hardcodeados.

## Capabilities

### New Capabilities

_(ninguna — el módulo `dashboard` ya existe; este change itera su capability)_

### Modified Capabilities

- `dashboard`: 
  - MODIFIED "La card 'Dónde está' desglosa las cuentas del usuario" — el desglose web pasa de lista a callout de concentración + barra de concentración + grilla compacta (mobile conserva la lista).
  - MODIFIED "La card 'Comprometido' muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)" — egresos como dos mini-tiles; ingreso recurrente como tile "Ya entra" + banda de cierre neto.
  - MODIFIED "El dashboard muestra cuánto del gasto del mes se financió en tarjeta" — la tira de texto pasa a la sección "Gastaste este mes" (barra proporcional caja vs tarjeta con total).
  - MODIFIED "La sección 'En qué se fue' muestra el desglose de gastos por categoría con dona y toggle de moneda" — cada fila de la leyenda suma una barra proporcional.
  - MODIFIED "La sección 'Balance del mes' muestra el neto del mes con barras de ingresos y gastos" — la fila "Ajustes" suma el chip "SIN REGISTRAR".
  - ADDED "El dashboard muestra el neto del Hogar cuando hay actividad compartida (web)" — tira "Compartido" condicional.
  - MODIFIED "El dashboard usa un layout multi-columna en desktop (web)" — orden de secciones full-width actualizado (Compartido → Gastaste este mes → ¿En qué gasté?).

## Impact

- **Solo `apps/web`** (paridad mobile diferida). Componentes afectados en `apps/web/app/(app)/dashboard/_components/`: `accounts-card.tsx` (rediseño), `committed-section.tsx` (tiles + neto), `financed-on-card-note.tsx` → nueva `spent-this-month-section.tsx` (barra), `spending-section.tsx` (barras de leyenda), `month-balance-section.tsx` (chip Ajustes), `dashboard-content.tsx` (orden + nueva tira Compartido), y un nuevo `shared-strip-*.tsx`.
- **i18n**: nuevas keys (chip "SIN REGISTRAR", "Ya entra", cierre neto, labels de la tira Compartido y de "Gastaste este mes") en `packages/i18n-messages`.
- **Queries/data model**: sin cambios. Se reutiliza el neto del Hogar de `apps/web/lib/shared/queries.ts`.
- **Prototipos de referencia**: `apps/web/prototypes/dashboard-redesign-v1/`.
- **Riesgo**: bajo. Cambios presentacionales sobre datos existentes; el principal trabajo nuevo es la tira Compartido (consume una query ya existente) y la barra de concentración (cálculo de anchos puro).
