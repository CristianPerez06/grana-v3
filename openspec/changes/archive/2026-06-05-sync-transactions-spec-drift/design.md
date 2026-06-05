## Context

Este change es **higiene de spec sin código**. No hay arquitectura, ni dependencias nuevas, ni migración. El propósito es alinear `openspec/specs/transactions/spec.md` con el código que ya está en `main`.

Se documenta porque la spec-driven schema lo requiere como pre-requisito de `tasks`, no porque las decisiones lo ameriten.

## Goals / Non-Goals

**Goals:**

- Eliminar de la spec la requirement "Guardar y cargar otro" — sin código que la respalde tras `c0580e36`.
- Documentar en la spec la fila sintética "Saldo inicial" — comportamiento ya en código tras `5b6c3819` que ningún requirement cubre.

**Non-Goals:**

- No tocar código (`apps/`, `packages/`, schemas, locales).
- No revisar otras secciones de la spec que pudieran estar desactualizadas — solo las dos derivas concretas que detectamos durante el rebase de `feat/drawer-only-movement-create`.
- No revisar la spec `accounts`. La fila sintética es un comportamiento del listado de movimientos del detalle de cuenta, pero el listado en sí ya está descripto en `transactions` (Requirement "El usuario puede ver la lista de transacciones de una cuenta") — la requirement nueva vive ahí por proximidad temática.

## Decisions

### Decisión 1: dónde vive la nueva requirement — `transactions`, no `accounts`

**Elegimos** ubicar la requirement nueva en `openspec/specs/transactions/spec.md`, cerca de la requirement existente "El usuario puede ver la lista de transacciones de una cuenta" (~ línea 101).

**Razonamiento:** el listado scoped por cuenta ya está cubierto por `transactions`; la fila sintética es una extensión de ese listado. Los helpers del código (`isInitialBalanceMovement`, `toInitialBalanceMovement`, `INITIAL_BALANCE_ID_PREFIX`) viven en `apps/web/lib/transactions/movements.ts`, no en un módulo de accounts. Además, el contrato `Movimiento` (la unión discriminada) está definido bajo `transactions`.

**Alternativa considerada:** ubicarla en `openspec/specs/accounts/spec.md`. **Rechazada** porque introduce ping-pong: el lector tendría que saltar entre dos specs para entender un único concepto.

### Decisión 2: cómo encodear el "kind" de la fila sintética

**Elegimos** documentar que la fila reutiliza `kind: 'adjustment'` (lo que el código hace) y se distingue del adjustment real por su `id` prefijado (`initial-balance:<currency>`) y `detail_href: null`.

**Razonamiento:** el código optó por NO introducir un nuevo `kind` para la unión `Movimiento`, sino reusar `AdjustmentMovement` con campos sentinel. La spec debe reflejar esa decisión literal, no proponer una alternativa.

**Alternativa considerada:** describir la fila como un nuevo `kind: 'initial_balance'`. **Rechazada** porque la spec describiría algo que el código no implementa.

### Decisión 3: nivel de detalle de la requirement nueva

**Elegimos** un nivel "comportamiento observable" — cuándo aparece, dónde NO aparece, qué propiedades funcionales tiene (no navegable, excluida del recurrence-link lookup, una por moneda con saldo inicial distinto de cero). NO se documentan detalles de implementación como el prefijo literal del id ni las funciones helper.

**Razonamiento:** la spec describe contratos, no APIs internas. El prefijo `initial-balance:` y los nombres de funciones son detalles de implementación que pueden cambiar sin invalidar el contrato.

**Alternativa considerada:** documentar el prefijo literal y los nombres de helpers. **Rechazada** porque endurece el código sin agregar claridad al usuario de la spec.

## Risks / Trade-offs

| Riesgo | Mitigación |
| --- | --- |
| El comportamiento descripto difiere sutilmente de la implementación actual (ej. orden cronológico exacto, fecha exhibida). | Cross-check uno a uno entre la requirement y `toInitialBalanceMovement` + `MovementListAccountContainer`. Si surge una sutileza nueva, la requirement se ajusta antes del archive. |
| Otras derivas similares quedaron sin detectar y este change da una falsa sensación de "todo sync". | Out-of-scope explícito. Una auditoría más amplia es un change distinto. Este resuelve dos items concretos detectados durante el rebase de `feat/drawer-only-movement-create`. |

## Migration Plan

N/A — sin código, sin schema, sin estado. Un PR único con dos commits (implementación de las edits + archive) o un commit único. Rollback = revert.

## Open Questions

Ninguna.
