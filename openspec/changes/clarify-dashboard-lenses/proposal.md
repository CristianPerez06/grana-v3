## Why

Después de dos meses de uso en producción, el Inicio no responde ninguna pregunta con claridad. La causa no es que muestre poca información ni que esté mal calculada — **está mal rotulada**. Cinco de los seis rótulos del Inicio nombran algo distinto de lo que el número mide, porque cada uno fue bautizado desde la lógica que lo calcula y no desde la pregunta que el usuario trae.

El caso testigo, con datos reales de julio 2026: la misma pantalla muestra `$425.151,40` (stock de hoy), `−$2.684.140,02` (flujo de caja del mes), `$2.726.350,40` rotulado "Gastos" (caja, **sin** tarjeta), `$985.201,62` rotulado "Pago de tarjeta" (caja de julio por consumos de mayo y junio) y `$3.300.931,03` bajo el título "¿En qué gasté este mes?" (devengado, **con** tarjeta). Los cinco son correctos. Ninguno es igual a otro. Dos de ellos usan la palabra "gasto" y difieren en **$574.580,63 (+21%)** sin que nada en pantalla lo explique.

La spec `dashboard` ya declara esa divergencia como intencional (*"son lentes distintas a propósito (...) el rótulo de la pregunta de cada card comunica que miran cosas distintas"*), pero los rótulos que deben sostener la distinción viven en 12,5px gris debajo de títulos de 18px. No alcanza: el propio autor de la spec abrió la exploración preguntando qué mide la card de "Balance del mes".

El resultado es que la app **delega en el usuario la decisión contable de qué número aplica a qué pregunta**. Eso es trabajo de la app. Mientras la capa base sea ambigua no se puede construir nada encima — ni un hero de "te queda libre", ni presupuestos, ni sobres: montarlos sobre un "disponible" que no significa nada da features que tampoco significan nada.

Este change no agrega funcionalidad. Hace que cada número diga lo que mide.

## What Changes

Todos los cambios son de **presentación y copy sobre datos que ya se consultan**. No hay queries nuevas, ni migraciones, ni cambios de agregación.

- **El Hero deja de prometer gastabilidad.** El eyebrow "Para gastar · hoy" nombra un stock como si fuera un presupuesto. Pasa a comunicar lo que realmente mide (el saldo de las cuentas propias, hoy). Este change lo vuelve **más honesto y deliberadamente menos útil**: el hueco que deja —"¿y entonces cuánto puedo gastar?"— es el que llena el change siguiente, una vez que el set de compromisos sea confiable (hoy cubre el 3,7% de los costos fijos de caja).
- **El Hero distingue un disponible negativo.** Hoy `hero-section.tsx` no tiene una sola condicional: un negativo se renderiza en el mismo blanco, peso y tamaño que un positivo, sobre navy. El único aviso existente es transaccional y de una sola vez (`balance.ts:348`), no de estado.
- **"Balance del mes" deja de nombrarse como stock.** El título de la card y el label del número grande ("Balance") pasan a nombrar un **flujo** — la variación de la plata en el mes — de forma que el rótulo no dependa de la línea secundaria para no engañar.
- **"Gastos" declara su lente en el rótulo, no en un subtítulo.** La fila comunica que cuenta solo gasto de **caja** y que el consumo con tarjeta no está adentro.
- **Las dos cards que hablan de gasto se reconocen entre sí.** "Balance del mes" comunica cuánto consumo de tarjeta del mes no está viendo y ofrece el paso a "¿En qué gasté?". Hoy conviven ignorándose y el usuario paga el costo de descubrir la diferencia.
- **"Pago de tarjeta" dice a qué período corresponde.** Es plata que sale este mes por consumos de meses anteriores; el rótulo actual no lo comunica.
- **Las filas de naturaleza distinta se ven distinto.** Hoy los siete baldes usan el mismo `FlowRow` (mismo dot, misma barra, mismo peso), afirmando visualmente que son lo mismo. Pasan a agruparse en tres naturalezas: **flujo real** (Ingresos, Gastos), **movimiento interno** (Pago de tarjeta, Cambio de moneda, Liquidaciones — plata que cambió de lugar o canceló deuda ya devengada) y **corrección de stock** (Ajustes).
- **`totalTransfer` renderiza fila cuando es distinto de cero.** Hoy mueve `finalBalance` sin renderizar nada, siendo el único balde excluido del patrón de filas condicionales que la card ya usa (`month-balance-section.tsx:121`). Es el único caso donde el neto no se explica con lo visible.
- **El aviso de ajustes deja de ser un reproche.** `dashboard.month.adjustment_note` dice hoy *"hacelos desaparecer"*. El ajuste es el mecanismo de reconciliación de la app; encuadrarlo como falta desincentiva la conducta que mantiene honestos los datos.

**No alcanza:** el cálculo de ningún número (la aritmética quedó verificada y correcta tras `fix-balance-read-path-defects`), el candidato "te queda libre" para el Hero, el calibrado del detector de recurrencias, `initial_balance_date`, el tipo de movimiento para préstamos recibidos, los períodos fantasma de tarjetas sin consumos, y `apps/mobile` (lo lleva el tech lead).

## Capabilities

### Modified Capabilities

- `dashboard`: los requirements de presentación del Hero, de "Balance del mes" y de la relación entre las dos lentes de gasto pasan a exigir que el rótulo comunique la lente y la naturaleza de cada monto, en vez de delegarlo a texto secundario. Se agrega el tratamiento visual del disponible negativo y la fila condicional de transferencias.

## Impact

- **Código**: `apps/web/app/(app)/dashboard/_components/` (`hero-section.tsx`, `month-balance-section.tsx`, `spending-section.tsx`) y `packages/i18n-messages/src/es.json`. Sin cambios de API, datos, queries ni migraciones.
- **Specs**: delta sobre `dashboard`.
- **Riesgo**: bajo. Es copy y presentación sobre datos ya consultados. El riesgo real es de producto, no técnico: el Hero queda más honesto y menos accionable hasta que aterrice el change siguiente. Es una decisión consciente — primero que el número sea verdad, después que sea útil.
- **Dependencias**: ninguna. `fix-balance-read-path-defects` (archivado 2026-07-30) ya dejó la aritmética correcta; este change asume esos números como buenos.
- **Contexto**: el razonamiento completo, los datos de producción que lo sustentan y los tres callejones donde el análisis se equivocó están en `exploration.md`.
