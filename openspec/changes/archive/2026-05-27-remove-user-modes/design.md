## Context

El modo de usuario (`profiles.mode`, `'novato' | 'experto'`, default `'novato'`) es un flag **solo de UI**: el server nunca lo enforcea (`CLAUDE.md`). Hoy gatea:

- **Onboarding (perfil):** dos cards "Vista simple"/"Vista detallada" + pregunta de banco condicional (solo experto). Persiste `profiles.mode` y, si experto+banco, crea una cuenta `type='bank'`.
- **Onboarding (saldo inicial):** novato (y experto sin banco) ven un grupo único; experto con banco ve dos grupos (banco + efectivo).
- **Cuentas:** `isNovato` oculta el botón "Crear cuenta" y `/accounts/new` redirige (change `2026-05-26-hide-account-creation-novato`).
- **Tarjetas:** novato usa `CreateNovatoCreditCardForm` + `createNovatoCreditCard` (1 fecha, 1 período); experto usa el form de 4 fechas (2 períodos).
- **Transacciones:** `showAccount = profile.mode === 'experto'` controla el filtro y la columna de cuenta en el listado.

El gate de onboarding (`onboarding_completed_at`) y el cálculo de balances **no** dependen del modo. La columna `mode` no aparece en triggers ni en CHECKs de otras tablas (solo en su propio CHECK en `0012`).

## Goals / Non-Goals

**Goals:**
- Una sola app para todos: eliminar el flag `profiles.mode` de DB, código, validación, i18n y specs.
- Alta de tarjeta de 4 fechas para todos (corrección de estimados).
- No romper: gate de onboarding, RLS de profiles, cálculo de balances, ni las tarjetas ya creadas en modo novato.
- Dejar el repo coherente (sin concepto-fantasma de modos) — "el repo es la memoria".

**Non-Goals:**
- Rediseñar el look del onboarding o del dashboard.
- Un switcher de modo en settings (queda sin sentido — no hay modos).
- Renombrar rutas en masa.
- `shared` / `savings` u otros módulos futuros.

## Decisions

- **D1 — Drop de la columna + secuencia segura.** Nueva migración: `ALTER TABLE public.profiles DROP COLUMN mode;` (solo esa columna). Para no romper prod, el orden es: (1) mergear el código que **deja de leer y escribir** `mode`; (2) recién entonces aplicar el `DROP COLUMN` en el SQL Editor de Supabase; (3) regenerar `types.ts`. Si se dropea antes de quitar el `UPDATE ... mode` de `saveProfileAction`, ese write falla. La migración incluye un comentario explicando que el flag fue retirado.

- **D2 — Destino del paso `/onboarding/profile` (DECIDIDO: D2-a, eliminar).** Al quitar modo + banco, el paso queda sin inputs.
  - **(D2-a) ELEGIDA — Eliminar el paso.** Wizard pasa a 3 pantallas: `welcome → initial-balance → done`. `welcome` navega directo a `initial-balance`; se borra `saveProfileAction`, el schema de perfil, y las rutas `profile` (web + mobile). Hay que actualizar el gate/middleware y los escenarios de "reanudar wizard". Razón: el gate real es `onboarding_completed_at` (no la lista de pasos), así que quitar la pantalla es seguro y acotado; una pantalla sin inputs es fricción de bajo valor (`welcome` ya es la intro); y una ruta `profile` que no captura perfil es deuda semántica.
  - **(D2-b) Alternativa considerada — Reconvertir el paso en pantalla-concepto** (sin inputs, como `welcome`): mantiene 4 pantallas, menor riesgo de navegación, pero deja la ruta `profile` como misnomer y dos pantallas-intro seguidas. Descartada.

- **D3 — Hint de primer uso.** Ayuda contextual, no muro de onboarding: (1) una línea en el copy de `welcome` ("arrancás con una Billetera; podés sumar cuentas cuando quieras"); (2) nota dismissible en el listado de cuentas, donde el botón "Crear cuenta" siempre está visible. Copy de la nota: "Tenés toda tu plata en la Billetera. Si querés ver en qué cuentas la tenés, creá cuentas; si no, dejá todo acá."

- **D4 — Filtro de cuenta derivado de la data.** En `transactions/page.tsx`, reemplazar `showAccount = profile.mode === 'experto'` por `showAccount = (cantidad de cuentas del usuario) >= 2`. Los props `isExpert` / `showAccount` de `movement-filters`, `movement-list`, `movement-row` se mantienen (solo cambia la fuente del booleano y se actualizan los comentarios que dicen "expert mode"). Un filtro con una sola cuenta es ruido; con ≥2 tiene sentido.

- **D5 — Tarjeta: un único flujo de 4 fechas.** Borrar `CreateNovatoCreditCardForm`, la rama novato de `cards/new/page.tsx`, `createNovatoCreditCard` (action) y `createNovatoCreditCardSchema` (validación) + sus exports. Todos usan el form de 4 fechas → 2 períodos. Las tarjetas ya creadas en modo novato (1 período) siguen funcionando por el rolling automático (`I-CRED-12`); no requieren data migration.

- **D6 — Saldo inicial: flujo único.** Eliminar la rama de dos grupos (experto+banco). Todos ven "¿Cuánta plata tenés hoy?" (ARS + USD) impactando `account_currencies.initial_balance` de la `Billetera`. Se mantiene la regla: no inserta `transactions`, ARS obligatorio (puede ser 0).

- **D7 — Paridad mobile.** Todo cambio de onboarding/cuentas/tarjetas se espeja en `apps/mobile` (`profile.tsx`, `initial-balance.tsx`). El contrato de props compartido no cambia.

- **D8 — Limpieza de i18n.** Borrar claves muertas (`mode_simple_*`, `mode_detailed_*`, `description_experto`, `group_experto` si existe, `subtitle_novato`, `novato_close_date`, `novato_close_helper`). Las claves que sobreviven con sufijo `_novato` (p.ej. `description_novato`, `group_novato`) se renombran a neutral (`description`, `group_total`) y se actualizan sus consumidores, para no dejar nombres con concepto de modo.

- **D9 — RLS de profiles.** La policy de update de `profiles` es a nivel de fila (`auth.uid() = id`), no enumera columnas, así que dropear `mode` no la rompe. El spec de profiles enumera `mode` en el texto del requirement de RLS y en escenarios → se actualizan esos textos (no hay cambio de policy SQL salvo que exista un GRANT a nivel de columna; verificar en `0012` — no lo hay).

## Risks / Trade-offs

- **Usuarios existentes con `mode` seteado.** Al dejar de leerlo y dropear la columna no pasa nada: nadie lo consume. Sin backfill ni data migration.
- **Tarjetas novato con 1 período.** Quedan válidas; el rolling automático garantiza ≥1 período abierto. No se tocan datos.
- **Eliminar el paso de onboarding (D2-a)** toca navegación, middleware/splash y los escenarios de "reanudar". Mitigación: tareas explícitas de actualización del gate y de los specs de onboarding; el gate real es `onboarding_completed_at`, que no cambia.
- **Secuencia DB/código (D1).** Si se invierte el orden, `saveProfileAction` falla al escribir una columna inexistente. Mitigación: D1 fija el orden; además, si se aplica D2-a, `saveProfileAction` se borra y el riesgo desaparece.
- **Renombrar claves i18n (D8)** puede dejar referencias colgadas. Mitigación: grep de cada clave renombrada antes de cerrar; `tsc` + lint.

## Migration / sequencing

1. Código: quitar lecturas/escrituras de `mode` (web + mobile + validación + i18n + tarjeta novato).
2. `tsc --noEmit` + lint + tests en verde.
3. QA manual: onboarding completo, crear cuenta, alta de tarjeta (4 fechas), filtro de transacciones con 1 y con ≥2 cuentas.
4. Aplicar la migración `DROP COLUMN mode` en Supabase (online) y regenerar `types.ts`.
5. Actualizar specs (deltas → master en el archive) y `CLAUDE.md`. `pnpm openspec:check` en verde antes del merge.
