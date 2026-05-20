## Why

Hoy, después de signup + OTP + login, el usuario aterriza en `/dashboard` sin contexto ni configuración mínima. No hay forma de saber qué tipo de usuario es (novato/experto), no se carga ningún saldo inicial, y existe deuda técnica visible: `NovatoOnboardingForm` crea una cuenta "Mi plata" que duplica la cuenta `Efectivo` que el trigger ya inserta. El usuario llega a una app vacía sin pedagogía ni datos para arrancar.

Esta change incorpora el primer flujo guiado de la app — un wizard corto, ramificado y skippable que persiste el modo del usuario, deja saldos iniciales reales en sus cuentas, y elimina la deuda existente. Es prerequisito para que el dashboard sea útil y para que módulos posteriores (panel "primeros pasos", settings) tengan dónde apoyarse.

## What Changes

- **NEW** Wizard de onboarding post-signup de 3 a 4 pantallas según perfil: `/onboarding/welcome` → `/onboarding/perfil` → `/onboarding/saldo-actual` → `/onboarding/done`.
- **NEW** `/onboarding/perfil`: el usuario elige entre dos cards visuales (Vista simple / Vista detallada) que infieren `profiles.mode`. En la misma pantalla, si eligió Vista detallada, una pregunta secundaria condicional sobre cuenta bancaria.
- **NEW** `/onboarding/saldo-actual`: reemplaza la idea de "cargar primer movimiento". Pregunta "¿Cuánta plata tenés hoy?" — bimoneda (ARS + USD), una columna por moneda. Los montos impactan `account_currencies.initial_balance` de las cuentas creadas (Efectivo + bancaria si corresponde).
- **NEW** Inferencia de modo a partir del card elegido en `/perfil`: Vista simple → `novato`, Vista detallada → `experto`. La tarjeta es feature transversal y NO afecta el modo.
- **NEW** Creación condicional en `/perfil`:
  - Si dijo "tengo banco" (solo Vista detallada): crea cuenta `type='bank'` (institución + nombre) con `initial_balance=0` en ARS y USD.
  - La tarjeta de crédito NO se pregunta ni se crea en el onboarding. El usuario la descubre orgánicamente desde el dashboard / módulo `cards` (ver `design.md` Decisión 3 para alternativas evaluadas).
- **NEW** El wizard es bloqueante: NO se exponen botones "Saltar este paso". El usuario debe completar `/perfil` (al menos elegir modo) y `/saldo-actual` (al menos declarar su monto en ARS — puede ser 0) antes de llegar a `/done`. Razón: arrancar con datos vacíos rompe el dashboard.
- **NEW** Cross-cutting principle "Bimoneda por defecto": todo usuario arranca con ARS + USD habilitados sin preguntar. El toggle "ocultar USD" queda fuera de esta change (irá en settings futuro).
- **MODIFIED** `profiles`: agregar columnas `mode` (`'novato'` | `'experto'`), `financial_timezone` (`text`, default `'America/Argentina/Buenos_Aires'`), `onboarding_completed_at` (`timestamptz`, nullable). Backfill: usuarios existentes quedan con defaults y `onboarding_completed_at=NULL` (les aparece el wizard al próximo ingreso, salvo update manual del owner ya activo — ver `design.md` Migration Plan).
- **MODIFIED** Middleware (`auth` spec): agregar redirect a `/onboarding/welcome` cuando el usuario está autenticado pero `onboarding_completed_at IS NULL` y la ruta destino NO empieza con `/onboarding`. Agregar `/onboarding/*` a las rutas protegidas (requieren auth).
- **BREAKING** Eliminar `NovatoOnboardingForm`, `completeNovatoOnboarding` y todo el flujo hardcodeado actual que crea las cuentas "Mi plata" y "Mi tarjeta". Toda lógica de creación en onboarding pasa por el nuevo wizard.
- **BREAKING** Renombrar la cuenta default creada por el trigger `on_auth_user_created_default_account` de `Efectivo` a `Billetera`. Esto implica modificar el trigger y migrar las cuentas existentes (UPDATE en `supabase/migrations/`).
- **MODIFIED** `project-conventions`: añadir "Bimoneda por defecto" como principio cross-cutting. Actualizar `CLAUDE.md` correspondientemente.

## Capabilities

### New Capabilities

- `onboarding`: cubre el flujo post-signup que persiste modo del usuario, crea cuentas iniciales (bancaria y/o tarjeta shell), registra saldos iniciales en `account_currencies.initial_balance`, y marca `profiles.onboarding_completed_at`. Capability plataforma-neutral (mismo nombre para web y mobile cuando se construya).

### Modified Capabilities

- `profiles`: agrega columnas `mode`, `financial_timezone`, `onboarding_completed_at`. Define el comportamiento del trigger `handle_new_user` para que rellene `mode='novato'`, `financial_timezone='America/Argentina/Buenos_Aires'` y `onboarding_completed_at=NULL` por defecto.
- `auth`: extiende el middleware con dos reglas nuevas — (1) `/onboarding/*` requiere sesión autenticada, (2) redirect a `/onboarding/welcome` cuando `profiles.onboarding_completed_at IS NULL` y el destino es una ruta del app (no es `/onboarding/*`, no es `/auth/*`).
- `project-conventions`: añade el principio cross-cutting "Bimoneda por defecto" — ARS + USD habilitados para todos los usuarios al alta; ocultar USD es opt-out futuro desde settings, no opt-in en onboarding.

## Impact

**Código (apps/web)**:

- Crear `apps/web/app/(app)/onboarding/welcome/`, `apps/web/app/(app)/onboarding/perfil/`, `apps/web/app/(app)/onboarding/saldo-actual/`, `apps/web/app/(app)/onboarding/done/`.
- Crear server actions para cada paso.
- Modificar `apps/web/lib/supabase/middleware.ts`: agregar `/onboarding` a `protectedPrefixes`, agregar lógica de redirect cuando `onboarding_completed_at IS NULL`.
- Eliminar `apps/web/app/(app)/onboarding/_components/novato-onboarding-form.tsx` y los componentes/actions relacionados.
- Eliminar `completeNovatoOnboarding` y la creación de "Mi plata" / "Mi tarjeta" en credit-cards.ts.

**Código (packages)**:

- `packages/validation/`: nuevos esquemas Yup para el form de `/perfil` y `/saldo-actual`.
- `packages/i18n-messages/`: nuevas claves para todos los strings de copy del wizard (4 pantallas + validaciones + estados de error).
- `packages/supabase/`: regenerar `types.ts` después de la migración de `profiles`.

**Base de datos**:

- Una migración nueva en `supabase/migrations/` que: (1) agrega `mode`, `financial_timezone`, `onboarding_completed_at` a `profiles`; (2) modifica el trigger `on_auth_user_created_default_account` para crear la cuenta con nombre `Billetera` en lugar de `Efectivo`; (3) renombra las cuentas existentes mediante `UPDATE accounts SET name='Billetera' WHERE name='Efectivo' AND type='cash'`.
- Migración debe aplicarse online (pegar SQL en SQL Editor de Supabase).
- NO se modifican `accounts` ni `cards` ni sus invariantes — la decisión técnica de no crear tarjeta en onboarding mantiene la change contenida (ver `design.md` Decisión 3).

**Documentación**:

- Actualizar `CLAUDE.md` agregando el principio "Bimoneda por defecto" en la tabla de cross-cutting principles.
- README de Supabase setup (si menciona el flujo post-signup) puede requerir actualización.

**Fuera de alcance (futuras changes)**:

- Panel "primeros pasos" en `/dashboard` (recordatorios de tarjeta pendiente, primer movimiento, etc.).
- Toggle "ocultar USD" en módulo settings.
- Cambio de modo desde settings.
- Re-onboarding por cambio de modo.
- Onboarding mobile (depende del scaffolding de `apps/mobile`).
- Modal de completar tarjeta cuando se intenta usar una tarjeta shell — vive en módulo `cards`.
