## Context

Grana v3 hereda de v2 un dominio bien pensado pero parcialmente endeudado. El módulo `accounts` de v2 (`apps/web/src/modules/accounts/` en `D:/src/grana-v2`) tiene una spec madura (`docs/specs/cuentas/SPEC-CUENTAS.md` + `SPEC-v2.md`) y ya migró un par de veces (D13, fechas variables de tarjetas, reagrupación por tipo). Este change traduce ese aprendizaje a v3 pero **deliberadamente recorta el scope**: solo Efectivo y Bancarias/débito en este paso. Tarjetas de crédito vienen en un change separado, ya que arrastran complejidad propia (períodos, off-ledger, cuotas hijas, alertas) que no debe contaminar las decisiones de la base.

Estado actual de v3 cuando entra este change:

- `supabase/migrations/0001..0006` ya proveen `profiles`, `currencies` (ARS, USD, EUR), `institutions` (23 entidades AR como catálogo inmutable), `card_networks`, `categories` y `subcategories`.
- `packages/supabase/src/types.ts` está generado contra esas tablas. Después de aplicar este change hay que regenerar.
- `apps/web/` es un Next.js App Router con auth funcionando. No hay rutas de dominio todavía.
- `packages/validation/` tiene schemas Yup de auth. No tiene nada de dominio.
- `CLAUDE.md` documenta los invariantes cross-cutting (bimoneda, `Money`, `getTodayAR()`, `disponible ≥ 0`, derived balances) que este módulo debe respetar desde la migración inicial.
- `transactions` todavía no existe — eso restringe varias decisiones (ver Decisions §3).

## Goals / Non-Goals

**Goals:**

- Cerrar el modelo de datos de `accounts` y `account_currencies` de forma que las próximas extensiones (`credit`, `investment`, `transactions`) sumen sin renombrar columnas existentes ni romper queries.
- Garantizar que un usuario recién registrado pueda registrar transacciones inmediatamente, sin pasar por un onboarding obligatorio (modo `novato` funciona out of the box).
- Enforced en DB: bimoneda (solo ARS + USD habilitables como `currency_code` en v1), RLS por `user_id`, integridad referencial entre `accounts` ↔ `institutions` y `accounts` ↔ `account_currencies`.
- Mantener el patrón de validaciones cross-platform: schemas Yup en `@grana/validation` consumibles desde web hoy y desde mobile cuando exista.
- Preservar coherencia con v2 en la **forma del schema** (mismas tablas, mismos nombres de columnas) salvo donde el contrato explícito de v3 manda otra cosa.

**Non-Goals:**

- **No** se implementan tarjetas de crédito ni nada relacionado (`credit_card_configs`, `card_periods`, `period_payments`, alertas, períodos pendientes/pagos).
- **No** se implementa el Chanchito (`is_savings`) ni la función D13 (`funcion: operativa | mixta | ahorro`). Quedan para el módulo `savings` (#7).
- **No** se permite a usuarios crear `institutions` custom. El catálogo precargado en `0003_seed_institutions.sql` es la única fuente.
- **No** se introduce la tabla `transactions` ni se calcula saldo "real". En este change el saldo derivado de una cuenta es exactamente `account_currencies.initial_balance` (la suma sobre `transactions` es de cero filas).
- **No** se crea una pantalla de onboarding guiado. El trigger DB se encarga.
- **No** se agrega configuración global `user_currencies` (toggle de monedas a nivel usuario). Si en el futuro entra EUR como moneda habilitable, ese cambio agregará el concepto.

## Decisions

### §1 · Tipo de cuenta: enum extensible, no string libre

`account_type` se modela como `CREATE TYPE account_type AS ENUM ('cash', 'bank');`. Decisión clave: el enum se crea con los **dos valores que se usan hoy**, no se pre-popula con `'credit'` ni `'investment'` "por si acaso". Cuando `add-accounts-credit-cards` aterrice, esa migración hará `ALTER TYPE account_type ADD VALUE 'credit'` y el cambio se contiene.

**Alternativas consideradas:**

- *Pre-popular el enum con `'credit'` y `'investment'`*: rechazado porque crea un check-constraint en columnas dependientes (`accounts.type`) que admite valores que el código no sabe manejar. Tener `'credit'` válido en DB sin lógica de períodos en código es un foot-gun.
- *Columna `type TEXT NOT NULL CHECK (type IN (...))`*: rechazado. Enum es más estricto, más rápido en compare, y `ALTER TYPE ADD VALUE` es operación segura en Postgres reciente.

### §2 · Multi-divisa: tabla `account_currencies`, no columnas en `accounts`

Una cuenta puede operar en ARS, USD, o ambas. El modelo es `account_currencies(account_id, currency_code, initial_balance, initial_balance_date, is_active)`. **Una fila por (cuenta × moneda) habilitada**, con UNIQUE constraint.

Pros del approach:
- Agregar/quitar monedas no requiere migración ni mover datos.
- Cada moneda tiene su propio saldo inicial y su propia fecha de captura, lo que respeta la regla "los ledgers ARS y USD son separados".
- Cuando exista `transactions`, las queries de saldo agrupan por (`account_id`, `currency`) sin joins extra.

**Alternativas consideradas:**

- *Columnas `initial_balance_ars NUMERIC, initial_balance_usd NUMERIC` en `accounts`*: rechazado. Asume bimoneda permanente y rompe asimetría con `cash` (que típicamente es una moneda). Cuando entre EUR el modelo se vuelve insostenible.
- *Cuenta single-currency, una fila en `accounts` por moneda*: rechazado. El usuario piensa "mi caja del Galicia" como **una** entidad con dos sub-balances (pesos y dólares), no como dos cuentas separadas. La asimetría con v2 también sería gratuita.

### §3 · Saldo inicial: columna inmutable, no transacción

`account_currencies.initial_balance NUMERIC(18,2) NOT NULL DEFAULT 0` + `initial_balance_date DATE`. Ambos **inmutables post-creación**.

Motivación del approach (y por qué no viola la regla "no balance column" de CLAUDE.md):

- La regla prohíbe **balances derivados cacheados** (`accounts.balance` actualizada en cada write). Eso es el anti-patrón clásico que se desincroniza.
- `initial_balance` es un **input estable** a la derivación, no un cache. La fórmula final, cuando `transactions` exista, será: `balance(account, currency) = initial_balance + Σ transactions.amount`. Sin `initial_balance`, esa suma arranca desde cero y el usuario tendría que crear una transacción artificial para representar el dinero que ya tenía antes de empezar a usar Grana.

**Alternativas consideradas:**

- *Insertar una transacción `adjustment` 'opening balance' al crear cuenta*: rechazado por bloqueo técnico. La tabla `transactions` todavía no existe (módulo #5), y crearla parcialmente en este change para soportar solo opening balance contamina la spec de transactions con una forma comprometida desde el inicio. Re-evaluar cuando ese módulo aterrice: si entonces tiene sentido migrar `initial_balance` a transacciones, se hace con un script idempotente.
- *Diferir el soporte de saldo inicial a v1*: rechazado. Casi todos los usuarios reales arrancan con saldo > 0; obligarlos a esperar al módulo `transactions` para "cargar" su efectivo rompe la UX de onboarding.
- *Permitir editar `initial_balance` post-creación*: rechazado. Si el saldo inicial es mutable, cualquier "corrección posterior" rompe el historial. La regla de v2 (correcciones = `adjustment`) es la correcta. Por ahora la regla se enforce vía falta de UI; cuando `transactions` exista, el formulario de corrección produce un adjustment.

### §4 · Default account vía trigger DB, no vía cliente

El handle_new_user actual (`0001_profiles.sql`) inserta la fila de `profiles`. Este change agrega una **función separada** `handle_new_user_default_account()` con su propio trigger `on_auth_user_created_default_account` sobre `auth.users`. La nueva función inserta:

1. Una fila en `accounts` con `name='Efectivo'`, `type='cash'`, `institution_id=NULL`.
2. Dos filas en `account_currencies` (ARS y USD) con `initial_balance=0` e `initial_balance_date = today()`.

**Por qué dos triggers separados (uno por módulo) en lugar de modificar `handle_new_user`:**

- Cada migración es self-contained y se puede leer en aislamiento.
- Si un módulo futuro necesita rollbackear su parte del bootstrap, solo dropea su propia función + trigger sin tocar el resto.
- El nombre `handle_new_user_default_account` documenta la intención sin obligar al lector a saltar a `0001_profiles.sql`.

**Por qué no hacerlo desde la action de signup del lado del cliente:**

- Si la action falla a mitad de camino (perfil creado, cuenta no creada), el usuario queda en estado inconsistente.
- El trigger DB en `SECURITY DEFINER` garantiza atomicidad: o se crea todo o nada.
- El comportamiento es el mismo independientemente del cliente (web ahora, mobile después).

### §5 · RLS: estricto por `user_id`

```sql
-- accounts
USING (user_id = auth.uid())            -- SELECT, UPDATE, DELETE
WITH CHECK (user_id = auth.uid())       -- INSERT, UPDATE

-- account_currencies
USING (EXISTS (
  SELECT 1 FROM accounts a
  WHERE a.id = account_currencies.account_id AND a.user_id = auth.uid()
))
```

`account_currencies` no tiene `user_id` propio (lo deriva de `accounts`). El subselect agrega un cost mínimo y mantiene el modelo normal. Si el costo se vuelve problemático con datos reales, se denormaliza `user_id` a `account_currencies` en un change posterior — pero hoy no hay evidencia para hacerlo.

### §6 · Validación de currency_code a nivel DB

`account_currencies.currency_code TEXT NOT NULL REFERENCES currencies(code)` + check constraint:

```sql
CONSTRAINT chk_account_currencies_supported
  CHECK (currency_code IN ('ARS', 'USD'))
```

El check explícito es una **invariante v1**: aunque `currencies` tenga `'EUR'` como fila activa, no se puede crear una `account_currencies` con `'EUR'` en este change. Cuando `add-accounts-currency-eur` (o similar) aterrice, dropea el check.

Alternativa: no poner el check y delegar la validación a la action. Rechazado porque las invariantes de dominio deben vivir en DB cuando es barato — así una migración accidental o un cliente con bug no puede colar EUR.

### §7 · Reglas de archivar / eliminar

Tres operaciones distintas en server actions, mapeadas a tres estados DB:

| Action            | Efecto DB                                    | Cuándo se permite                                                     |
|-------------------|----------------------------------------------|------------------------------------------------------------------------|
| `deleteAccount`   | `DELETE FROM accounts WHERE id = ?`          | Nunca tuvo `transactions`. Hoy: cualquier cuenta (no hay transactions). |
| `archiveAccount`  | `UPDATE accounts SET is_active = false`      | Cuenta tiene transactions (futuro) o el usuario simplemente la "guarda". Bloqueado si saldo derivado ≠ 0 en cualquier moneda. |
| `reactivateAccount` | `UPDATE accounts SET is_active = true`     | Siempre, sobre cuentas archivadas.                                    |

El bloqueo "saldo ≠ 0 → no archivar" se chequea con la fórmula final `initial_balance + Σ transactions`. Hoy `Σ transactions = 0`, así que el chequeo se simplifica a `initial_balance ≠ 0` por moneda. La action implementa la fórmula completa desde el inicio para no tener que cambiar nada cuando exista `transactions`.

**Edge case del default Efectivo:** si el usuario archiva su Efectivo en modo experto y después vuelve a novato, el sistema busca la última cuenta `cash` activa del usuario; si no encuentra ninguna, **re-activa** la Efectivo archivada (no crea una nueva — preserva su historial). Si la Efectivo fue **eliminada físicamente** (cosa que solo es posible cuando no tiene transactions), el sistema crea una nueva. Esta lógica vive en el flujo de switch novato/experto, no en este módulo, pero la mencionamos acá porque los scenarios de `accounts` la cubren.

### §8 · Currencies habilitadas por cuenta: defaults + edit

Al crear una cuenta `cash` o `bank`, el usuario elige **al menos una** moneda. Por convención, el formulario propone ARS por default y permite tildar USD. Si elige solo ARS, solo se inserta esa fila en `account_currencies`. Si después quiere habilitar USD, lo hace desde el detalle (`addCurrencyToAccount`).

`deactivateCurrencyFromAccount` marca `is_active = false` en la fila correspondiente. No se borra la fila (similar a categorías archivadas) para mantener el historial cuando exista `transactions`. Una currency desactivada no aparece en selectores nuevos pero sigue mostrándose en el saldo de la cuenta si `initial_balance ≠ 0` o si hay transactions históricas.

**Default Efectivo del trigger:** se crea con ambas filas (ARS y USD activas) porque el usuario novato registra movimientos en ambas sin tener que tocar el módulo.

### §9 · Edición permitida vs prohibida

| Campo                              | Editable post-creación? |
|------------------------------------|--------------------------|
| `name`                             | Sí                       |
| `type` (cash ↔ bank)               | **No**                   |
| `institution_id` (solo bank)       | Sí                       |
| `is_active` (archivar/reactivar)   | Sí (vía actions, no edit form) |
| `account_currencies.initial_balance` | **No**                 |
| `account_currencies.initial_balance_date` | **No**            |
| `account_currencies.is_active`     | Sí                       |

El tipo es inmutable porque cambiar de `cash` ↔ `bank` cambia el dominio de validación (institution_id NULL vs NOT NULL) y la semántica (efectivo no tiene resúmenes, banco eventualmente sí). Si el usuario se equivoca al crear, el camino correcto es archivar y crear de nuevo.

### §10 · Numérico: `decimal.js` desde el cliente, NUMERIC(18,2) en DB

`initial_balance` viaja como string en el wire (JSON-safe) y se construye como `Money` en cliente vía la factory de `packages/validation` o un helper local en `apps/web`. Nunca se hace `parseFloat` para operaciones; se hace solo para validación de "es-un-número-positivo" antes de pasar a `Money`. La inserción en DB es vía Supabase client con el string serializado a 2 decimales.

Esto ya está sentado en `schema-base` como invariante; el módulo lo aplica desde la primera línea.

## Risks / Trade-offs

**[Riesgo] Saldo derivado siempre = `initial_balance` mientras no exista `transactions`.**
Mitigación: la query `getAccountDetail` implementa la fórmula completa `initial_balance + COALESCE((SELECT SUM(amount) FROM transactions WHERE …), 0)` desde el inicio. La parte de SUM hoy fallaría porque la tabla no existe; por eso se envuelve en un SQL function placeholder o se hace la suma "0 hardcoded" detrás de una función del lado del cliente que sabe leer la tabla cuando exista. Decisión concreta: en este change la query hace `RETURN initial_balance` sin tocar transactions. El cambio del módulo `transactions` agregará el JOIN.

**[Trade-off] `account_currencies` no denormaliza `user_id` → la RLS hace subselect.**
La performance es aceptable para volúmenes esperados (un usuario tiene ~5 cuentas, ~10 currency rows). Si en el futuro un read masivo (export, reporting) muestra problemas, se denormaliza con migración.

**[Riesgo] Trigger DB que crea Efectivo puede fallar si la migration corre antes de que `accounts`/`account_currencies` existan en producción.**
Mitigación: el trigger se crea en la **misma migración** que las tablas (`0007_accounts.sql`). Si la migration se aplica de forma idempotente, todo aparece junto. El self-check al final verifica que el trigger existe y que dispara la función.

**[Riesgo] Backfill de Efectivo para usuarios que ya existen al momento de aplicar la migración.**
Hay usuarios reales en `auth.users` (los actuales testers) que no tienen cuentas. El trigger solo dispara en INSERT, no aplica retroactivamente. Mitigación: la migración incluye un bloque `DO $$ ... $$` que itera sobre `auth.users` y, para cada uno sin cuentas, le crea su Efectivo default. Idempotente (verifica que no exista ya).

**[Trade-off] El check `currency_code IN ('ARS', 'USD')` se duplica con el catálogo `currencies`.**
Es deliberado: el catálogo es "monedas que el sistema conoce", el check es "monedas que este módulo soporta". Cuando entre EUR como soportada por accounts, se dropea el check con un ALTER, sin tocar el catálogo.

**[Riesgo] El test de la migración no puede correr en CI local sin Supabase remoto.**
Mitigación: la migración incluye un bloque self-check (estilo `0001_profiles.sql`) que valida tabla, RLS, policies, función, trigger e índices. Si algo falla, levanta exception. Para validación funcional end-to-end del trigger, se documenta el procedimiento manual en `SUPABASE_SETUP.md` (crear user de prueba en dashboard, verificar que se creó Efectivo).

**[Open question diferida — no bloquea este change]** El comportamiento exacto del switch `novato → experto` cuando la Efectivo default fue archivada o eliminada. Spec lo cubre en alto nivel (§7) pero la UI del switch vive en otro módulo (`profiles` o `user-mode`). Cuando ese módulo aterrice, sus tests deben cubrir los scenarios de "no hay cash activa" y "Efectivo archivada existe pero deshabilitada".
