## Context

### Estado actual

- Auth (signup → OTP → login) está completo. El usuario autenticado aterriza en `/dashboard` sin contexto ni configuración mínima.
- El trigger `on_auth_user_created_default_account` ya crea una cuenta `Efectivo` (tipo `cash`) con `account_currencies` en ARS y USD, ambas con `initial_balance=0`.
- Existe un componente `NovatoOnboardingForm` y la función `completeNovatoOnboarding` que crean cuentas adicionales hardcodeadas (`"Mi plata"` cash duplicando Efectivo + `"Mi tarjeta"` credit). Esta lógica es deuda — no se puede mantener.
- `profiles` solo tiene `id`, `full_name`, `email`, `created_at`. No hay forma de saber qué tipo de usuario es, ni si terminó el onboarding.
- La ruta `/onboarding/*` NO está protegida en el middleware (`apps/web/lib/supabase/middleware.ts`).
- 17 categorías system se insertan en `0006_seed_categories.sql` con `user_id IS NULL` (son compartidas, no por usuario).

### Constraints

- **Bimoneda inviolable**: ARS y USD son ledgers separados — el onboarding NO puede mezclar ni convertir. Cada input de saldo es por moneda.
- **`disponible ≥ 0` invariante**: el saldo inicial que el usuario ingrese alimenta `account_currencies.initial_balance`. Como es saldo inicial (no resta de algo), no rompe el invariante.
- **I-CRED-1**: `initial_balance=0` siempre en credit cards. El onboarding no debe permitir ingresar saldo para tarjetas.
- **I-CRED-12**: cada credit card activa debe tener ≥1 período abierto/cerrado. Esta restricción condiciona la pregunta de cómo creamos tarjetas con datos incompletos.
- **Migrations are the schema truth**: cambios a `profiles` se hacen vía migración SQL en `supabase/migrations/`, aplicada online en el SQL Editor de Supabase.
- **`getTodayAR()` para fechas financieras**: `onboarding_completed_at` es `timestamptz` (instante técnico de auditoría), no fecha contable — usa `now()` normal.

### Stakeholders

- Fundador/PO (contador): quiere el flujo simple, sin condescender, con el repo como memoria.
- Usuarios nuevos: hoy ven la app vacía sin guía. Esta change resuelve ese punto.

## Goals / Non-Goals

**Goals:**

- Establecer el primer flujo guiado de la app post-signup.
- Persistir `profiles.mode` para que toda UI futura sepa qué exponer/esconder.
- Dejar saldos iniciales reales (ARS + USD) en cuentas existentes (Efectivo) y nuevas (banco si corresponde) — el `/dashboard` no aparece en cero.
- Eliminar la deuda de `NovatoOnboardingForm` y "Mi plata" / "Mi tarjeta".
- Proteger `/onboarding/*` con middleware y forzar la complitud (`onboarding_completed_at`) antes de acceder al resto de la app.
- Mantener la change contenida: NO tocar el módulo `cards`, NO modificar invariantes de tarjeta.

**Non-Goals:**

- Preguntar por tarjeta de crédito durante el onboarding o crearla (ver Decisión 3).
- Panel "primeros pasos" en `/dashboard` (otra change futura).
- Toggle "ocultar USD" en settings (otra change futura).
- Permitir cambiar `mode` desde settings (otra change futura).
- Re-onboarding al cambiar de modo (otra change futura).
- Onboarding mobile (depende del scaffolding de `apps/mobile`).
- Validación de límites máximos de saldo (cualquier saldo positivo o cero es válido en V1).
- Soporte de monedas distintas a ARS y USD.

## Decisions

### Decisión 1: Wizard server-rendered, una pantalla por ruta, persistencia por paso

**Decision:** Cada pantalla del wizard es una ruta separada con Server Components. Cada paso commitea su cambio inmediatamente al servidor vía server action (no se mantiene estado intermedio en cliente entre pantallas). El usuario puede cerrar el navegador entre paso y paso y el progreso queda persistido en DB.

**Alternativas consideradas:**

- *Wizard single-page con estado en cliente, commit al final*: más complejo en JS, viola "Server Components by default" del CLAUDE.md, vulnerable a pérdida de progreso por refresh.
- *Wizard SPA con guardado en localStorage*: cross-platform inconsistente, datos sensibles, viola la regla de que el "repo es la memoria" (los datos deben vivir en DB desde el momento que se commitean).

**Rationale:** Más simple, alineado con el stack (Next App Router + RSC), y robusto frente a interrupciones.

### Decisión 2: Inferencia de modo solo desde la pregunta principal de `/perfil`

**Decision:** `profiles.mode` se setea exclusivamente según qué card eligió el usuario en `/perfil`:

```
Vista simple    → profiles.mode = 'novato'
Vista detallada → profiles.mode = 'experto'
```

La pregunta secundaria (banco) **NO** afecta el modo. La tarjeta es feature transversal — novato y experto pueden tener tarjeta, pero NO se pregunta durante el onboarding (ver Decisión 3).

**Alternativas consideradas:**

- *Inferir modo desde múltiples preguntas combinadas*: hace la inferencia opaca para el usuario y para el debugging. La pregunta principal ya captura la intención.
- *Etiquetas "novato/experto" visibles en UI*: rechazada en `openspec-explore` — los usuarios no se autodefinen así.

**Rationale:** Una sola pregunta → un solo seteo. Transparente, fácil de cambiar después.

### Decisión 3: La tarjeta de crédito NO se pregunta ni se crea en el onboarding

**Decision:** El onboarding NO incluye ninguna pregunta sobre tarjeta de crédito. El usuario descubre el módulo `cards` orgánicamente desde el dashboard (CTA visible para todos en el panel post-onboarding de próxima change, o directamente en el menú principal). Cuando el usuario quiera crear una tarjeta, usará el wizard de creación de tarjetas del módulo `cards` (que ya existe y pide los datos completos: red, nombre, día cierre, día venc, límite).

**Alternativas consideradas:**

- *(a) Crear shell `setup_status='pending'` que evade I-CRED-12*: requiere agregar enum `setup_status` a `accounts`, modificar el invariante I-CRED-12 (en CLAUDE.md, en spec de `cards`, y en el trigger de períodos), y agregar lógica de "tarjeta no usable hasta completar setup" en el módulo `cards`. Esto rompe la contención de esta change — toca módulo cards y un invariante.
- *(b) Crear con defaults (cierre=5, venc=20) marcado como `needs_review`*: el usuario puede no darse cuenta y los cálculos arrancan con datos incorrectos. Contradice "el repo es la memoria" — escondemos suposiciones.
- *(c) Generar períodos placeholder*: ensucia el módulo cards con "períodos fake". Las queries de saldos pueden devolver mal.
- *(d) Preguntar `tarjeta sí/no` y guardar la intención en `profiles.intends_to_use_card`*: el flag termina siendo data muerta. Lo que pretendía habilitar (CTA personalizado en panel post-onboarding) se puede mostrar a todos sin distinción — quien no usa tarjeta lo ignora. No hay beneficio funcional vs costo de mantener un campo más.
- *(e) NO preguntar nada sobre tarjeta* (elegida): el onboarding queda mínimo. La tarjeta es feature transversal y se descubre desde el dashboard. Mantiene la change contenida y evita data muerta.

**Trade-off conocido:** un usuario que se beneficiaría de cargar tarjeta desde el primer momento no tiene un CTA explícito en el wizard. Lo aceptamos porque el dashboard y el módulo `cards` ya son descubribles; la pedagogía explícita sobre tarjetas vivirá en el panel post-onboarding (próxima change) sin necesitar un flag previo.

**Rationale:** Cero data muerta. Cero scope creep. El onboarding hace exactamente lo mínimo que debe: setear modo + cuentas básicas + saldos iniciales.

### Decisión 4: Cuenta bancaria — solo se pregunta y se crea si `mode='experto'`

**Decision:** La pregunta "¿Tenés cuenta en algún banco?" en `/perfil` aparece solo cuando el usuario eligió "Vista detallada". Si la respuesta es sí, se pide institución (selector con bancos AR) + nombre, y se crea inmediatamente:

- Una fila en `accounts` con `type='bank'`, `user_id=auth.uid()`, `institution_id` apuntando al banco elegido (o NULL si "Otra"), `name` igual al ingresado.
- Filas en `account_currencies` para ARS y USD con `initial_balance=0` (el saldo se llenará en `/saldo-actual`).

Para "Otra" en el selector, se requiere también un campo "Nombre del banco" (texto libre). En esta change NO permitimos crear instituciones nuevas en `institutions` — esa "Otra" se persiste como nombre dentro de `accounts.name` o `accounts.institution_label` (a definir en specs de `accounts`); si esto requiere modificar `accounts`, lo evaluamos al armar specs.

**Alternativas consideradas:**

- *Preguntar también a novato*: contradice el modelo mental — el novato no piensa en cuentas, solo en "su plata".
- *Crear la cuenta cuando se ingresa el saldo en `/saldo-actual`*: separa información lógicamente unida (qué banco / cuánto hay), confunde al usuario.

**Rationale:** El novato no piensa en bancos. El experto sí — pedírselo en `/perfil` es coherente.

### Decisión 6: `/saldo-actual` impacta `account_currencies.initial_balance`, no crea transactions

**Decision:** Los montos ingresados en `/saldo-actual` se aplican directamente sobre `account_currencies.initial_balance` de las cuentas existentes (Efectivo y, si corresponde, la cuenta bancaria creada en `/perfil`). NO se crean filas en `transactions`.

**Alternativas consideradas:**

- *Crear una `transaction` tipo `adjustment` o `initial_balance`*: el modelo actual de transactions no contempla un tipo "saldo inicial", y forzarlo embarra el ledger con movimientos sintéticos. El campo `initial_balance` existe justamente para esto.
- *Crear una `transaction` tipo `income` con categoría "Saldo inicial"*: distorsiona los reportes de ingresos del usuario, que verán un "ingreso" inexistente.

**Rationale:** `initial_balance` es la herramienta del schema para esto. Es el camino más limpio.

### Decisión 6: Migración de `profiles` + rename de cuenta default

**Decision:** Una sola migración nueva en `supabase/migrations/` con tres acciones:

```sql
-- 1. Agregar columnas a profiles
ALTER TABLE public.profiles
  ADD COLUMN mode text NOT NULL DEFAULT 'novato' CHECK (mode IN ('novato','experto')),
  ADD COLUMN financial_timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  ADD COLUMN onboarding_completed_at timestamptz NULL;

-- 2. Modificar el trigger on_auth_user_created_default_account
--    para que cree la cuenta con name='Billetera' en lugar de 'Efectivo'.
CREATE OR REPLACE FUNCTION public.handle_new_user_default_account() ...
  -- INSERT INTO accounts (..., name) VALUES (..., 'Billetera')
  ...

-- 3. Renombrar cuentas existentes
UPDATE public.accounts
  SET name = 'Billetera'
  WHERE name = 'Efectivo' AND type = 'cash';
```

Si `handle_new_user` referencia columnas explícitas, actualizar la función para que siga compilando con el nuevo schema (los DEFAULT del ALTER cubren las inserciones nuevas).

**Backfill:** usuarios existentes obtienen los defaults automáticamente al aplicar el `ALTER`. `onboarding_completed_at` queda NULL → al próximo ingreso ven el wizard.

**Sobre el rename de la cuenta:** aceptamos el riesgo mínimo de que algún usuario haya creado manualmente una cuenta cash llamada `Efectivo` distinta de la que crea el trigger; con un solo usuario activo (el dueño) y sin reportes de tal cuenta, el `UPDATE` masivo es seguro.

**Rationale:** Una migración, atómica. Cubre los cambios de profiles y el rename de la cuenta en un solo paso.

### Decisión 7: Middleware redirect

**Decision:** Modificar `apps/web/lib/supabase/middleware.ts` para:

1. Agregar `/onboarding` a `protectedPrefixes` (requiere sesión).
2. Después de validar sesión en cualquier ruta protegida que no sea `/onboarding/*`, consultar `profiles.onboarding_completed_at`. Si es NULL, emitir redirect a `/onboarding/welcome`.
3. Si el usuario está autenticado y `onboarding_completed_at IS NOT NULL` y la ruta destino empieza con `/onboarding/*`, dejar pasar (no redirect — el usuario puede revisitar `/done` por ejemplo).

**Trade-off:** la consulta a `profiles` por cada request a una ruta protegida agrega latencia. Mitigación: cachear el flag en la cookie de sesión (a evaluar en implementación; si la latencia es despreciable en producción, no es prioridad).

**Rationale:** Forzar el flujo es la única forma de garantizar que `mode` esté seteado antes de que cualquier UI lo use.

### Decisión 8: El wizard es bloqueante — no se pueden saltar pasos

**Decision:** Ni `/perfil` ni `/saldo-actual` exponen botón "Saltar este paso". El usuario SHALL completar cada formulario para poder avanzar. En `/saldo-actual` además el monto en pesos del primary account es obligatorio (puede ser 0, pero hay que declararlo explícitamente).

**Alternativas consideradas:**

- *Skip libre en cada paso* (versión previa de este design): el usuario podía saltar todo y llegar a `/done` con `initial_balance=0` en todas sus cuentas. Resultaba en un dashboard arrancando "vacío" — sin disponible, sin nombres de cuentas asignados — que no le sirve al usuario para empezar a operar. Decidido por el owner: "rompe como arrancar".
- *Forzar `primary_ars > 0`*: garantiza que el dashboard nunca arranca en cero, pero obliga al usuario que genuinamente está en cero a inventar un número. Inaceptable — viola "pedagogía sin condescendencia".
- *Permitir blank pero validar al menos uno > 0 entre todos los campos*: semánticamente similar a skip, agrega complejidad. Descartado.
- *Pedir `primary_ars` obligatorio (puede ser 0)* (elegido): el usuario debe pasar por cada pantalla y declarar al menos su monto en pesos. Si su realidad es 0, pone 0. La declaración explícita es preferible a un default silencioso porque deja registrada la decisión.

**Trade-off conocido:** un usuario apurado que no quiere completar nada del wizard no tiene escape — debe ir y volver. Aceptado porque la fricción es chica (1 input obligatorio en saldo, 1 selección en perfil) y el beneficio es evitar dashboards arrancando vacíos.

**Rationale:** El wizard existe para resolver "cómo arrancar". Si se puede saltar, no resuelve nada. La barra de obligatoriedad es lo más baja posible (cero como respuesta válida) para no condescender.

### Decisión 9: Cuenta default `Billetera` (rename desde `Efectivo`) — el trigger sigue siendo la fuente de creación

**Decision:** El trigger `on_auth_user_created_default_account` sigue creando una cuenta cash con ARS+USD e `initial_balance=0` al alta de cada usuario, pero su nombre cambia de `Efectivo` a `Billetera`. La migración renombra las cuentas existentes. En `/saldo-actual`:

- Novato y experto-sin-banco: el input "¿Cuánta plata tenés hoy?" se aplica a `account_currencies.initial_balance` de `Billetera` (por moneda). La UI NO menciona el nombre "Billetera" al novato — solo dice "tu plata".
- Experto con banco: dos inputs separados (banco + Billetera). Cada uno aplica al `initial_balance` de la cuenta correspondiente. El input de Billetera es opcional (skip = $0). La UI sí muestra "Billetera" como label en este caso, porque el experto ve cuentas con nombre.

**Alternativas consideradas para el nombre:**

- *`Efectivo`* (actual): preciso pero frío.
- *`Mi plata`* (v2): cálido pero ambiguo cuando coexiste con cuenta bancaria.
- *`Caja`*: corto y contable; raro para novato.
- *`Billetera`* (elegida): cálido, claro, sin ambigüedad. Implica "lo que tengo en mano". Funciona en novato (invisible en UI) y experto (claro junto a bancos).

**Rationale:** Mantenemos el trigger porque cubre el caso simple. Cambiamos el nombre porque "Efectivo" suena duro y "Billetera" es la metáfora más natural en español rioplatense.

### Decisión 10: Selector de instituciones — usar el existente del módulo `accounts`

**Decision:** Reutilizar el selector ya existente (`InstitutionSelector` o equivalente) que el módulo `accounts` usa para crear cuentas. Si no existe componente reutilizable, crearlo en `apps/web/app/(app)/_components/` o en `packages/` si se proyecta uso cross-platform.

**Rationale:** Evitar duplicación. Las instituciones son las mismas en cualquier creación de cuenta.

## Risks / Trade-offs

- **[Riesgo] Latencia del middleware**: chequear `onboarding_completed_at` en cada request agrega un SELECT.
  → Mitigación: medir en dev primero; si es problemático, cachear el flag en cookie firmada en el momento del login (revalidar cada N requests o al cambiar). Si la solución requiere cambios, queda fuera de esta change.

- **[Riesgo] Backfill silencioso**: usuarios existentes verán el wizard al próximo ingreso aunque ya estén usando la app.
  → Mitigación aceptada: hoy somos un solo usuario (el dueño). Al desplegar, completar manualmente `onboarding_completed_at` para ese usuario con un `UPDATE` en SQL Editor. Documentar el paso en la migración como comentario.

- **[Riesgo] Rename masivo de cuentas `Efectivo` → `Billetera`**: improbable pero posible que algún usuario hubiera creado manualmente otra cuenta cash llamada `Efectivo`.
  → Mitigación aceptada: somos un solo usuario activo y no existe tal cuenta. Documentado en la migración como riesgo conocido.

- **[Trade-off] Tarjeta NO se pregunta ni se crea en onboarding**: scope sacrificado a cambio de contención. El usuario descubre cards desde el dashboard (Decisión 3).

- **[Trade-off] Bimoneda fuerza UI bicolumna en `/saldo-actual` aun para usuarios solo-ARS**: el toggle "ocultar USD" llegará en otra change. Hasta entonces, el usuario sin USD simplemente deja $0 en USD y sigue.

## Migration Plan

1. **Pre-deploy**: revisar manualmente el SQL Editor de Supabase que no hay conflicto con `profiles` (nadie está usando los nombres `mode`, `financial_timezone`, `onboarding_completed_at`) ni con cuentas adicionales llamadas `Efectivo` (más allá de la creada por el trigger).
2. **Aplicar migración** (`supabase/migrations/<n>_profiles_onboarding_and_default_account.sql`) pegándola en el SQL Editor. La migración incluye: ALTER de profiles + UPDATE del trigger + UPDATE masivo de accounts.
3. **Update manual al usuario existente** (dueño): `UPDATE profiles SET onboarding_completed_at = now() WHERE id = '<dueño>';` para evitar que vea el wizard.
4. **Regenerar types**: `supabase gen types typescript --project-id <id>` → actualizar `packages/supabase/src/types.ts`.
5. **Deploy del código web** con las pantallas nuevas, la limpieza de NovatoOnboardingForm y la adaptación del selector de cuenta de pago del módulo cards (que pasa de "Mi plata" a "Billetera").
6. **Verificación post-deploy**: crear un usuario de prueba nuevo y recorrer el flujo entero (welcome → perfil novato → saldo-actual → done → dashboard). Verificar también que el flujo de pago de resumen del módulo cards apunta correctamente a `Billetera`.
7. **Rollback**: la parte de profiles es aditiva (ADD COLUMN) — segura. El rename de cuentas se puede revertir con `UPDATE accounts SET name='Efectivo' WHERE name='Billetera' AND type='cash'` si fuese necesario, aunque rompería el código nuevo que asume `Billetera`.

## Open Questions

- **Q1**: ¿El selector de instituciones acepta input libre ("Otra") con texto en `name`, o también permite crear filas en `institutions`? Necesitamos revisar el módulo `accounts` durante implementación. Si requiere crear instituciones nuevas y eso afecta el spec de `accounts`, lo agregamos al proposal antes de implementar.
- **Q2**: ¿Las categorías system (17 compartidas en `user_id IS NULL`) deben mostrarse al novato de forma diferenciada (subset)? Esta change asume que NO (mismas 17 para todos) — la categorización por modo queda para una change futura específica del módulo `categories`.
- **Q3**: Cuando el usuario tipea un monto en `/saldo-actual` con formato local (puntos como miles, coma como decimal) — ¿lo manejamos con un parser de `Money` ya existente o creamos uno nuevo? Verificar en `packages/validation/` durante implementación. _(Resuelto: se reutilizan `parseMoneyInput` y `normalizeMoneyAmount` ya existentes en `packages/validation/src/money.ts`.)_

- **Q4 (deferred)**: Latencia del middleware con SELECT extra a `profiles`. Medir en producción; si supera el umbral aceptable (~50ms p95), implementar cache del flag en cookie firmada al momento del login. Fuera de scope de esta change.

- **Q5 (deferred)**: Tests unitarios para `savePerfilAction`, `saveSaldoActualAction`, `completeOnboardingAction` y el middleware. Hoy hay solo tests de schemas porque mockear el cliente SSR de Supabase requiere infra que no está montada. Si se invierte en esa infra (factory de Supabase mockeada, fixtures de DB en memoria), las actions/middleware pueden cubrirse sin cambios de spec.

- **Q6 (deferred)**: Tests E2E del wizard completo (welcome → perfil → saldo-actual → done) para perfiles novato puro y experto con banco. Requiere Playwright o Cypress, no instalados en el repo. Cobertura actual: QA manual del owner (§12 en tasks.md).

- **Q7 (deferred)**: Test de regresión del trigger SQL `on_auth_user_created_default_account` para asegurar que crea `Billetera` con ARS+USD. Requiere DB de prueba con migraciones aplicadas; la migración 0012 incluye self-checks que validaron esto al aplicarla, así que la cobertura efectiva ya existe en el momento del deploy.

- **Q8 (resuelto)**: Naming del wizard route group. Para que el onboarding no herede `Header` del `(app)` layout, el wizard vive en `(onboarding-wizard)/onboarding/` con su propio layout minimalista. El path final es el mismo (`/onboarding/welcome`, etc.) porque los paréntesis se omiten en las rutas. La carpeta vieja `(app)/onboarding/` se eliminó.

- **Q9 (resuelto)**: Selector de instituciones. Como NO existe un `InstitutionSelector` reusable, se implementó un `<select>` nativo simple en `perfil-form.tsx` que itera sobre las 28 instituciones AR pre-cargadas desde la tabla `institutions` (sin permitir crear nuevas). La opción "Otra" no se incluyó en V1 por no complicar el path — si el usuario tiene un banco no listado, lo agregará desde el módulo `accounts` después.
