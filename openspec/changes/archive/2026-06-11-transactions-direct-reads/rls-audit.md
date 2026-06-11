# RLS Audit — read path de /transactions

**Fecha**: 2026-06-11 · **Task**: 1.4 · **Resultado**: sin hallazgos — no se requieren migraciones correctivas (task 1.5 vacía).

## Criterio

Para cada tabla que `/transactions` lee desde el browser: (a) RLS habilitado, (b) policy de SELECT presente, (c) predicado owner/household correcto, (d) sin aperturas mayores al contrato server previo.

Sobre (d): el contrato previo era **idéntico** — los reads server-side ya usaban el client anon de `@supabase/ssr` con el JWT del usuario (cookies), nunca el service role. RLS ya era la frontera efectiva de todos los reads del producto; mover el caller al browser no cambia qué filas son visibles.

## Tablas auditadas

| Tabla | RLS | Policy SELECT | Predicado | Migración |
|---|---|---|---|---|
| `transactions` | ✅ | users select own transactions | `user_id = auth.uid()` OR (`is_shared` AND member del household) | 0008, ampliada 0023 |
| `accounts` | ✅ | users select own accounts | owner | 0007 |
| `account_currencies` | ✅ | users select own account currencies | owner vía EXISTS sobre `accounts` | 0007 |
| `categories` | ✅ | authenticated users can read categories | `user_id IS NULL` (sistema) OR owner | 0005 |
| `subcategories` | ✅ | authenticated users can read subcategories | sistema OR owner | 0005 |
| `recurrences` | ✅ | users select own recurrences | owner | 0011 |
| `recurrence_instances` | ✅ | users select own recurrence_instances | owner | 0011 |
| `recurrence_suggestion_dismissals` | ✅ | users select own recurrence_suggestion_dismissals | owner | 0011 |
| `card_periods` | ✅ | users select own card_periods | owner vía EXISTS sobre `accounts` | 0010 |
| `period_payments` | ✅ | users select own period_payments | owner vía `card_periods → accounts` | 0010 |
| `household` | ✅ | members select own household | creator OR `is_household_member(id)` | 0023, 0025 |
| `household_member` | ✅ | members select household members | `is_household_member(household_id)` | 0023 |
| `profiles` | ✅ | users read own profile (+ co-member read) | owner + co-members del household | 0001, 0024 |

Notas:

- `is_household_member()` es `SECURITY DEFINER` + `STABLE` con `search_path = public` fijado — patrón correcto para evitar la recursión de RLS sobre `household_member`.
- Los embeds de PostgREST (`category:categories(...)`, `source_account:accounts(...)`, `period_payments → card_periods → accounts`) aplican la policy de la tabla embebida: para una fila shared de otro miembro, los embeds de recursos ajenos (su cuenta) resuelven `null` — mismo comportamiento que ya existía server-side.
- Las migraciones 0007/0008/0010/0023 incluyen self-checks `DO $$` que cuentan policies y verifican RLS habilitado; un drop accidental rompería el deploy de la migración siguiente que los re-asserte.

## Para futuros changes (otras rutas)

Tablas del producto **fuera** de este read path que deberán auditarse cuando su ruta migre: `currencies`, `institutions`, `card_networks` (catálogos, ya con policy de lectura authenticated), `credit_cards`/extensiones de cards, `shared_expense_split`, `settlement`, `household_invite`.
