# Brief de iniciativa — Rediseño mobile con reducción de taps

_Status: en curso. Brief vivo, pensado para continuar en conversaciones nuevas sin depender del historial de chat. El repo es la memoria._
_Origen: pase de simplificación disparado por una comparativa con Mobills (la app "se sentía más simple"). El diagnóstico separó "simplicidad de superficie" (tomable, gratis) de "simplicidad conceptual" (el foso contable de Grana, no se toca)._

## Intención

Un pase de simplificación **módulo por módulo, pantalla por pantalla**, con un objetivo único y medible: **reducir la cantidad de taps** de cada flujo. Es rediseño de UX de superficie — **no se toca ninguna regla contable**.

## Scope — CRÍTICO, leer antes de tocar nada

**Dentro (las vistas que se rediseñan):**

- **Web abierta desde un dispositivo móvil** = el viewport mobile de `apps/web` (el layout responsive por debajo del breakpoint móvil).
- **App mobile** = `apps/mobile` (Expo).

**Fuera (no se toca):**

- **La web desktop NO se rediseña.** Ninguna vista desktop cambia. Si un ajuste de lógica compartida pudiera afectar desktop, se preserva su comportamiento actual (el desktop es una restricción, no un objetivo).

**Nota arquitectónica.** La lógica vive en `@grana/*` (hook compartido `@grana/movement-form`, `@grana/money-logic`, etc.) y se propaga a ambas plataformas; el **JSX de pantalla es por plataforma**. "Mobile-first" acá significa diseñar las screens móviles (web-mobile y `apps/mobile`) reusando la lógica compartida — nunca duplicarla. Cuidado: el mismo componente web sirve al desktop y al mobile-web; los cambios de layout deben ir gateados por breakpoint para no alterar desktop.

## Método (cómo se trabaja cada pantalla)

1. **Auditoría de taps.** Contar los taps del flujo real **leyendo el código**, no de memoria. Anotar qué campo cuesta cuántos taps y por qué (popover, drill, etc.).
2. **Presupuesto de taps.** Fijar un techo por flujo (ej. gasto simple ≤3 taps) como meta y como test anti-regresión.
3. **Modelo en capas.** Capa 0 = lo que todos usan (mínimo, siempre visible). Capa 1 = avanzado, colapsado y a demanda, ya gateado por contexto. El simple no paga el costo del avanzado; el avanzado paga solo lo mínimo por cada feature que enciende.
4. **Recortar sin quitar capacidades.** La simplicidad se deriva de los datos del usuario (cuántas cuentas, historial), nunca de un flag ni de un modo.

## Principios que NO se rompen (de `AGENTS.md`)

- **Sin modos de usuario.** La profundidad sigue a los datos, no a un flag guardado (no hay novato/experto, no hay "orden de campos configurable").
- **Rigor contable intacto.** Bimoneda ARS/USD como ledgers separados, tarjetas off-ledger, corte temporal ("el futuro no es un hecho"), `Money`/`decimal.js`.
- **Primitivos compartidos + paridad por contrato** (`@grana/ui-contracts`). No duplicar lógica hand-synced.
- **Superficies de formulario en mobile:** usar los contenedores de `apps/mobile/components/layout` (`FormScreen`, `FormSheetBody`, `FormSheetKeyboardView`), nunca un `ScrollView` a mano ni `KeyboardAvoidingView` (ver spec `mobile-app-shell`).

## Estado actual — módulo Movimientos (la base)

El change **`openspec/changes/simplify-movement-form-surface/`** es la base del módulo. Redactado y validado (`pnpm openspec:check` en verde), **sin implementar, sin PR**.

Decisiones ya cerradas (ver su `design.md`):

- **Monto primero**, con autofocus (D5). Descartado descripción-primero (edge case; se atiende con "captura en borrador", change futuro).
- **Descripción opcional** (D6). Dos aceleradores que conviven: chips (sin escribir) y sugerencia por texto (`suggestCategoryFromHistory`).
- **Chip de categoría nivel 2** (D0): un tap resuelve categoría **+ cuenta habitual**. Meta: gasto simple de ~7 → ≤3 taps.
- Ocultar la dimensión cuenta con una sola cuenta elegible (D2); tipos primarios (gasto/ingreso/transferencia) vs secundarios (ajuste/cambio) (D1); secciones avanzadas colapsadas (D4); preselección de cuenta más probable (D3).

## Dónde mirar el código

| Capa | Ruta |
|---|---|
| Lógica compartida | `packages/movement-form/` (`use-movement-form.ts`, `types.ts`), `packages/money-logic/` (`category-suggestion.ts`, `temporal-cut.ts`) |
| Web (sirve desktop **y** mobile-web) | `apps/web/lib/transactions/components/movement-form.tsx` (drawer) |
| App mobile — alta | `apps/mobile/app/(app)/transactions/new.tsx` |
| App mobile — edición | `apps/mobile/app/(app)/transactions/[txId]/edit.tsx` |
| App mobile — form + pickers | `apps/mobile/components/transactions/MovementForm.tsx`, `.../form-pickers.tsx`, `apps/mobile/components/movements/` |
| Referencia de paridad web↔mobile | `docs/mobile-web-parity.md` |

## Orden de trabajo propuesto

Módulos por frecuencia de uso: **Movimientos** (en curso) → Dashboard → Cuentas → Tarjetas → Recurrencias → Compartido.

Dentro de Movimientos, pantalla por pantalla:
1. **Alta simple (Capa 0)** — chips de categoría + cuenta derivada. *[base ya modelada]*
2. **Capa 1** — reintegro · compartido · repetir · cuotas: contar taps de cada una y definir su presentación (propuesta: una fila "Agregar…" con chips que expanden inline).
3. **Edición** de movimiento.
4. **Listado / feed** de movimientos.

## Preguntas abiertas de producto (a resolver con el PO)

- **Dimensión comercio/payee.** ¿Chips/labels que digan "Kiosco" (comercio) o se queda a nivel categoría ("Almacén")? Separa el nivel 2 del nivel 3 de los chips. Decisión de producto, parkeada.
- **Extender `suggestCategoryFromHistory`** para que también recuerde la cuenta habitual del texto.
- **Cantidad de chips** (3 vs 5) y orden (recencia vs frecuencia).
- **"Última cuenta usada"** como default de cuenta (D3).
- **Captura en borrador** — guardar incompleto y completar el monto en la caja (atiende "cargo mientras compro, el monto lo sé al final").

## Cómo continuar

- **Nueva conversación, MISMA branch** `claude/mobills-grana-comparison-bmr5g0` (o branches por módulo si el trabajo crece y se busca PRs más chicos).
- Arrancar leyendo **este brief** + el change `simplify-movement-form-surface`. No se necesita el historial de chat.
- Método por pantalla: auditar taps sobre el código → fijar presupuesto → rediseñar Capa 0/Capa 1 → escribir/actualizar el spec del módulo → implementar en mobile-web y `apps/mobile`.

### Kickoff sugerido para la conversación nueva

> Continuamos el pase de simplificación de Grana con foco en reducir taps. Scope: **solo** el viewport mobile de `apps/web` y la app `apps/mobile` — la web desktop no se toca. Leé `docs/plans/mobile-tap-reduction-redesign.md` y el change `openspec/changes/simplify-movement-form-surface/` para el contexto (ya está todo ahí, no hace falta historial). Seguimos sobre la branch `claude/mobills-grana-comparison-bmr5g0`. Arranquemos por [PANTALLA]: primero auditá los taps reales leyendo el código, después proponé el rediseño.
