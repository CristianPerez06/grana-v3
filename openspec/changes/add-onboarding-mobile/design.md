## Context

### Estado actual

- La change `add-onboarding-post-signup` (web) está implementada y mergeada. El wizard vive en `apps/web/app/(onboarding-wizard)/onboarding/{welcome,perfil,saldo-actual,done}/` y la lógica de redirect en `apps/web/lib/supabase/middleware.ts`.
- La migración 0012 ya está aplicada en el proyecto Supabase remoto: `profiles.mode`, `profiles.financial_timezone`, `profiles.onboarding_completed_at` existen; el trigger `on_auth_user_created_default_account` ahora crea una cuenta `Billetera` (renombrada desde `Efectivo`) con `account_currencies` en ARS y USD, ambas `initial_balance=0`.
- La capability `onboarding` aún no fue archivada (sigue dentro de `openspec/changes/add-onboarding-post-signup/specs/onboarding/spec.md`). Sus scenarios están escritos con verbos web — son implícitamente `(web)`.
- `apps/mobile/` tiene: `_layout.tsx` raíz con `onAuthStateChange` que redirige a `(app)/dashboard` o `(auth)/login`; `index.tsx` con splash + `getSession()` + redirect; `(auth)/{login,signup,forgot-password,signup-verify,recovery-verify,new-password}`; `(app)/dashboard.tsx` placeholder.
- Componentes UI mobile existentes: `Button`, `TextInput`, `FormError`, `Card`, `Label`, `PasswordField`, `Input`, `FormField`, `Alert`, `Spinner`, `CurvedNavyContainer/Header`. NO hay equivalente de `SelectableCard` ni de un picker modal de instituciones.
- Mobile NO consume `@grana/i18n-messages` — los strings de auth están hardcodeados (`signup.tsx`, etc.). `lib/yup-locale.ts` traduce mensajes Yup manualmente al ES.
- Mobile NO usa `react-hook-form`. El patrón establecido es `useState` por campo + `schema.validate(values, { abortEarly: false })` + mapeo manual de `err.inner` a `fieldErrors`.
- `hasRecoveryClaim(access_token)` ya existe en `apps/mobile/lib/recovery.ts` y se respeta en `_layout.tsx` y `index.tsx` para no patear a usuarios de recovery a dashboard.

### Constraints

- **Bimoneda inviolable**: ARS y USD son ledgers separados. Mobile no puede convertir, mezclar ni preguntar "¿manejás dólares?".
- **Bimoneda por defecto**: ya garantizado por la migración 0012 (trigger crea ambas monedas al alta).
- **`disponible ≥ 0` invariante**: `/saldo-actual` solo escribe `initial_balance` (no resta nada), así que no aplica.
- **Migrations are the schema truth**: esta change NO toca DB — la 0012 ya cubrió todo.
- **`getTodayAR()` para fechas financieras**: `onboarding_completed_at` es `timestamptz` (instante técnico), se setea con `new Date().toISOString()` igual que web.
- **Atomicidad sin transacciones JS**: Supabase JS no expone transacciones. La creación de cuenta bancaria sigue el patrón del web (rollback manual).
- **RLS**: las queries directas desde el cliente respetan RLS automáticamente — un usuario solo lee/escribe sus propias filas de `profiles`, `accounts`, `account_currencies`.
- **Expo Router no tiene middleware**: la lógica de "interceptar y decidir destino" vive en código cliente (splash + layout gates).
- **Hermes soporta Intl**: `Intl.NumberFormat('es-AR', ...)` funciona para formatear los totales en `/done`, igual que web.

### Stakeholders

- Fundador/PO: quiere paridad funcional con el web wizard, sin scope creep ni infraestructura nueva (no react-hook-form, no react-query, no librerías nuevas).
- Usuarios mobile nuevos: hoy aterrizan en dashboard placeholder sin contexto. Esta change los manda al wizard exactamente como en web.

## Goals / Non-Goals

**Goals:**

- Paridad funcional con el web wizard: misma cantidad de pantallas, mismos requirements de negocio, misma persistencia por paso, mismo bloqueo (no "Saltar"), misma obligatoriedad de ARS primary.
- Spec `onboarding` queda plataforma-neutral en sus reglas SHALL y se enriquece con scenarios `(mobile)` paralelos a los `(web)`.
- Spec `auth` queda con dos requirements paralelos: middleware (web) + gate dual (mobile).
- Introducir el primer consumo de `@grana/i18n-messages` en mobile, dejando plantado el camino para que otras pantallas (auth) migren después.
- Reutilizar al máximo: schemas Yup (`perfilSchema`, `saldoActualSchema`), `parseMoneyInput`, `hasRecoveryClaim`.
- Componentes nuevos (`SelectableCard`, `InstitutionPickerModal`) viven en `components/ui/` para futuro reuso, no en una carpeta de onboarding.

**Non-Goals:**

- Modificar el wizard web. La paridad la garantizamos copiando la lógica, no compartiéndola en runtime.
- Introducir `react-hook-form` solo para estos forms.
- Migrar pantallas de auth a `@grana/i18n-messages` en esta change. Deuda preexistente, separada.
- Implementar tests E2E mobile. No hay infra E2E en el repo y agregarla excede el alcance.
- Reemplazar el rollback manual por un RPC Postgres atómico. Vale para ambas plataformas pero es change separada.
- Cachear `onboarding_completed_at` en el cliente (SecureStore/Zustand/etc.) para evitar las dos lecturas por arranque. Diferido a medición.
- Crear pantalla settings para cambiar `mode`. Otra change.
- Soportar idioma distinto a español en mobile.

## Decisions

### Decisión 1: Spec plataforma-neutral con scenarios `(mobile)` paralelos

**Decision:** Los requirements (las reglas SHALL en mayúsculas) de la capability `onboarding` son plataforma-neutrales y NO cambian. Cada scenario actualmente existente se re-taggea `(web)` y se agrega un scenario `(mobile)` paralelo con el verbo correcto (navegación con `expo-router`, gate en lugar de middleware, persistencia vía `supabase.from(...).update(...)` directo en lugar de server actions).

Idéntica estrategia para la capability `auth`: el requirement "El middleware redirige al wizard cuando el onboarding no fue completado" se re-taggea `(web)` y se agrega un requirement gemelo `(mobile)`: "El gate de mobile redirige al wizard cuando el onboarding no fue completado", con sus propios scenarios sobre splash gate, layout gate, y respeto a recovery session.

**Alternativas consideradas:**

- *Crear capability mobile-only `mobile-onboarding`*: rompe el principio de project-conventions de "una capability por business behavior". Multiplica la mantención. Rechazada.
- *Dejar los scenarios actuales sin tag y agregar mobile sin tag también*: ambiguo. Los scenarios actuales hablan de "middleware" — eso es web-específico. Necesitan tag.

**Rationale:** Respeta la convención del repo. El comportamiento de negocio queda en un único lugar; las divergencias técnicas quedan explícitas en scenarios separados.

### Decisión 2: Gate dual (splash + layout) en lugar de middleware único

**Decision:** Hay dos caminos por los que un usuario llega a `(app)/`:

1. **Arranque en frío** (`expo-router` evalúa `app/index.tsx` primero): el splash gate lee `profiles.onboarding_completed_at` y decide entre `(onboarding)/welcome`, `(app)/dashboard`, `(auth)/login`, o `(auth)/new-password`.
2. **Login/signup en runtime**: `_layout.tsx` raíz suscribe `onAuthStateChange`. Cuando emite `SIGNED_IN`, hoy hace `router.replace('/(app)/dashboard')`. Eso bypassea el splash. La solución es que el handler también consulte `onboarding_completed_at` antes de elegir destino.

Para defender contra cualquier camino futuro que escape ambos, agregamos un tercer gate en `(app)/_layout.tsx` que re-chequea al entrar al grupo y emite `router.replace('/(onboarding)/welcome')` si NULL.

**Alternativas consideradas:**

- *Solo splash gate*: queda el caso post-signup donde `SIGNED_IN` empuja directo a dashboard sin pasar por splash.
- *Solo layout gate*: arranque en frío sigue evaluando `index.tsx` que hoy decide `(app)/dashboard`; el redirect tardío del layout flickea.
- *Solo handler de `onAuthStateChange`*: no cubre el arranque en frío con sesión persistida (no emite `SIGNED_IN` al hidratar).

**Rationale:** Defensa en profundidad. Tres puntos del flujo que potencialmente pueden traer al usuario al área protegida; los tres consultan el mismo flag con la misma lógica. Costo: hasta dos SELECTs por arranque (uno en splash, uno en layout). Aceptado — diferido a medición si fuese problemático.

### Decisión 3: i18n vía helper minimalista que consume `@grana/i18n-messages`

**Decision:** Crear `apps/mobile/lib/i18n.ts` con esta forma:

```ts
import esMessages from '@grana/i18n-messages/src/es.json'

type Messages = typeof esMessages

export const t = (path: string, params?: Record<string, string | number>): string => {
  const parts = path.split('.')
  let current: unknown = esMessages
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path // fallback: missing key → return the key itself
    }
  }
  if (typeof current !== 'string') return path
  if (!params) return current
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    current,
  )
}
```

Las cuatro pantallas del wizard consumen `t('onboarding.welcome.title')`, `t('onboarding.welcome.greeting', { name: firstName })`, etc. Las claves ya existen en `packages/i18n-messages/src/es.json` (las agregó la change web).

**Alternativas consideradas:**

- *Hardcodear strings en cada pantalla* (mismo patrón que auth screens): inconsistente con la spec plataforma-neutral; duplica copy en dos lugares (web ya consume desde el catalog).
- *Integrar una librería i18n full (i18next, lingui, etc.)*: overkill. El catalog es JSON estático y mobile es ES-only por ahora.
- *Exportar el helper desde `@grana/i18n-messages`*: tentador pero el package decidió ser "JSON only, sin runtime". Romper esa decisión amerita su propia conversación.

**Rationale:** 30 líneas de código, cero dependencias nuevas, plantado el seam para que auth migre en otra change. No bloquea nada.

### Decisión 4: Selector de banco — modal con search + FlatList

**Decision:** Crear `components/ui/InstitutionPickerModal.tsx`:

- Props: `visible: boolean`, `onClose: () => void`, `institutions: Array<{id: string, name: string}>`, `onSelect: (institution: {id: string, name: string}) => void`, `selectedId?: string | null`.
- Implementación: `Modal` de RN (`animationType="slide"`, `presentationStyle="formSheet"` iOS / default Android), header con título y close button, `TextInput` de búsqueda case-insensitive sobre `name`, `FlatList` con `Pressable` por item.
- En `perfil.tsx`, el campo "Banco" se renderiza como un `Pressable` con apariencia de input que abre el modal. Una vez seleccionada una institución, muestra su nombre.

**Alternativas consideradas:**

- *Picker nativo (`@react-native-picker/picker`)*: dep nueva, UI fea, sin search.
- *Bottom sheet (`@gorhom/bottom-sheet`)*: dep nueva, animaciones más ricas pero overkill.
- *Pantalla full screen `(onboarding)/perfil/institution.tsx`*: rompe el flow del form (pierde state al navegar).

**Rationale:** Cero deps nuevas, búsqueda incluida (28 instituciones — sin search es navegable, pero con search es mucho mejor UX), idiomático mobile.

### Decisión 5: Atomicidad de creación de cuenta bancaria — rollback manual

**Decision:** Mismo patrón que `apps/web/app/_actions/onboarding.ts:savePerfilAction`:

1. `INSERT INTO accounts (user_id, name, type='bank', institution_id) RETURNING id`.
2. Si falla → mostrar error, no avanzar.
3. `INSERT INTO account_currencies (account_id, currency_code, initial_balance) VALUES ('ARS', 0), ('USD', 0)`.
4. Si falla → `DELETE FROM accounts WHERE id = $1` y mostrar error.

El paso de UPDATE de `profiles.mode` se hace antes y NO se revierte si la creación de cuenta falla — porque el modo elegido sigue siendo válido aunque el banco haya fallado. El usuario puede reintentar el form (que volverá a UPDATE mode con el mismo valor y reintentar el INSERT) o cambiar a "No tengo banco" y avanzar.

**Alternativas consideradas:**

- *RPC Postgres atómico*: la solución correcta pero amerita change separada que beneficie a ambas plataformas.
- *Cliente: ignorar el error de account_currencies y dejar la cuenta huérfana*: rompe invariantes implícitas (toda cuenta debería tener al menos una currency activa).

**Rationale:** Paridad exacta con web. Hace lo mejor que se puede sin transacciones expuestas. El RPC queda como mejora futura visible en ambas plataformas.

### Decisión 6: Form handling — `useState` manual + `schema.validate({abortEarly:false})`

**Decision:** Replicar el patrón de `apps/mobile/app/(auth)/signup.tsx`:

- Un `useState` por campo lógico (mode, hasBankAccount, institutionId, bankAccountName, primaryArs, primaryUsd, cashArs, cashUsd).
- `fieldErrors: FieldErrors` en `useState`.
- `formError: string | null` en `useState`.
- `loading: boolean` en `useState`.
- Función `handleSubmit` que: limpia errores, ejecuta `schema.validate(values, {abortEarly: false})`, mapea `err.inner` a `fieldErrors` con `translateValidationMessage`, llama supabase, redirige o muestra error.

**Alternativas consideradas:**

- *react-hook-form + yupResolver*: lo que usa el web. Lib nueva en mobile solo para 2-3 forms. Desproporcionado.
- *Formik*: lo mismo pero peor.

**Rationale:** Consistencia con lo que ya hay en mobile. Mínima superficie nueva.

### Decisión 7: Route group `(onboarding)/` paralelo a `(app)/` y `(auth)/`

**Decision:** `apps/mobile/app/(onboarding)/` con `_layout.tsx` independiente. Stack con `headerShown: false`, similar a `(app)/_layout.tsx`. Las 4 pantallas son archivos sueltos: `welcome.tsx`, `perfil.tsx`, `saldo-actual.tsx`, `done.tsx`.

Path final: `/(onboarding)/welcome`, `/(onboarding)/perfil`, etc. Los paréntesis no aparecen en la URL — el path "real" es `welcome`, `perfil`, etc. — pero por convención usamos siempre `router.replace('/(onboarding)/welcome')` con el grupo explícito.

**Alternativas consideradas:**

- *Pantallas dentro de `(app)/onboarding/*`*: heredarían el layout futuro de `(app)` (cuando tenga tab bar, header, etc.). Mismo problema que el web tuvo y resolvió con el route group separado.
- *Pantallas top-level (`app/onboarding/*` sin grupo)*: no se puede separar el layout del wizard del de las otras áreas.

**Rationale:** Paralelo al patrón web. Aislamiento total del layout del wizard respecto del de la app principal.

### Decisión 8: Done page calcula y muestra disponible agregado por moneda

**Decision:** `done.tsx` es la única pantalla con lógica de fetch además de auth. Hace:

1. Llamar a un helper local equivalente a `completeOnboardingAction`: SELECT actual de `onboarding_completed_at`; si ya está seteado, no escribe; si no, UPDATE con `new Date().toISOString()`.
2. SELECT de `account_currencies` joineado con `accounts` filtrando por `user_id` (RLS lo garantiza) y `accounts.is_active=true` y `accounts.type IN ('cash','bank')`. Sumar `initial_balance` por `currency_code`.
3. Render: card con total ARS grande, total USD chico si > 0, copy condicional según `hasData`, CTA "Ir al dashboard" que hace `router.replace('/(app)/dashboard')`.

Formateo: `Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` para ambos. Prefijo `$` para ARS, `US$` para USD.

**Rationale:** Paridad exacta con `apps/web/app/(onboarding-wizard)/onboarding/done/page.tsx`. Idempotencia explícita: si el usuario revisita `/done` después de completar, no se reescribe el flag.

### Decisión 9: Recovery session — corte temprano en cada gate

**Decision:** En los tres puntos del gate (splash, `_layout.tsx` handler, `(app)/_layout.tsx`), el primer chequeo es `hasRecoveryClaim(session.access_token)`. Si es true, NO se consulta `profiles.onboarding_completed_at` y se redirige a `(auth)/new-password` (splash, handler) o se hace `router.replace('/(auth)/new-password')` (layout). Esto preserva exactamente la lógica actual de mobile y evita el bug donde un usuario en recovery sea pateado al wizard de onboarding.

**Rationale:** Recovery sessions tienen capacidades restringidas (`amr=otp`); meterlas al wizard puede romper las UPDATE de `profiles` si la policy de RLS las bloquea. Cortar antes es lo correcto.

## Risks / Trade-offs

- **[Riesgo] Latencia: hasta 2 SELECTs por arranque**: splash + `(app)/_layout.tsx` consultan `profiles.onboarding_completed_at`.
  → Mitigación aceptada: medir en uso real. Si supera el umbral aceptable, cachear el flag en SecureStore al completarlo (escribir junto con el UPDATE en `done.tsx`), invalidar al `signOut`. Diferido. Documentado como Open Question.

- **[Riesgo] Flash de pantalla equivocada**: el handler de `_layout.tsx` hace `router.replace('/(app)/dashboard')` antes de saber si el usuario completó onboarding. El layout gate de `(app)` lo redirige inmediatamente pero puede haber un frame de dashboard pintado.
  → Mitigación: el handler también consulta `onboarding_completed_at` antes de elegir destino. El layout gate queda como red de seguridad, no como primer barrera. En el flujo normal, el frame de dashboard no se llega a pintar.

- **[Riesgo] Rollback manual de cuenta bancaria deja race condition**: entre el INSERT en `accounts` y el DELETE compensatorio, otro proceso podría leer la cuenta huérfana.
  → Mitigación aceptada: mismo riesgo que el web. Un único usuario por sesión, no hay procesos concurrentes leyendo cuentas a medio crear en este intervalo de milisegundos. RPC atómico queda como mejora futura.

- **[Riesgo] `Modal` de RN con `presentationStyle="formSheet"` en iOS es modal a la altura completa**: si el teclado se abre con el search, puede tapar el FlatList.
  → Mitigación: el modal usa `KeyboardAvoidingView` interno igual que `CurvedNavyContainer`. Verificar manualmente en QA.

- **[Trade-off] `t()` no es type-safe sobre las claves del catalog**: si una clave se renombra, no rompe el typecheck. Solo se nota en runtime cuando la pantalla muestra el path en lugar de la traducción.
  → Mitigación aceptada: el costo de un wrapper type-safe (codegen del shape, helpers tipados) supera el beneficio para un primer consumer. Si más pantallas adoptan el helper, vale la pena revisitar.

- **[Trade-off] `InstitutionPickerModal` no soporta "Otra" (banco no listado)**: igual que web V1.
  → Mitigación aceptada: el usuario crea esa institución desde el módulo `accounts` después del onboarding. Documentado.

- **[Trade-off] No hay tests automatizados del wizard mobile**: igual que web (que solo cubre schemas).
  → Mitigación aceptada: QA manual del owner. Schemas Yup ya están cubiertos por los tests existentes en `apps/web/lib/__tests__/onboarding-schemas.test.ts` y aplican a mobile porque el package es el mismo.

## Migration Plan

1. **Pre-deploy**: revisar manualmente que la migración 0012 está aplicada (debería estarlo — la cuenta default del usuario debería llamarse `Billetera` y `profiles.onboarding_completed_at` debería existir como columna). Comando rápido:
   ```sql
   SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('mode','financial_timezone','onboarding_completed_at');
   ```
2. **Implementar el código mobile** (ver `tasks.md`).
3. **Smoke test en simulador**: arranque en frío con sesión completada → dashboard; signup nuevo → wizard; arranque en frío con `onboarding_completed_at IS NULL` → wizard desde la primera pantalla que tocara.
4. **No hay rollback de schema** porque no hay cambios de schema. Si el código mobile rompe algo, basta con revertir el commit/branch — los usuarios mobile siguen pudiendo loguearse en web sin problema.

## Open Questions

- **Q1 (deferred)**: ¿Cache del flag `onboarding_completed_at` en SecureStore para eliminar el segundo SELECT (layout gate)? Medir primero. Documentar la mitigación específica si la latencia es problemática.
- **Q2 (deferred)**: ¿Migrar las pantallas de auth a consumir `@grana/i18n-messages` ahora que el helper existe? Change separada de cleanup — no parte de esta.
- **Q3 (deferred)**: ¿Reemplazar el rollback manual de bank account creation por un RPC `create_bank_account_with_currencies(user_id, name, institution_id)`? Beneficia a ambas plataformas. Change separada.
- **Q4 (deferred)**: ¿Helper i18n type-safe (codegen de literales desde el JSON)? Solo vale si más pantallas adoptan el helper. Posponer hasta que haya al menos 3-4 consumers en mobile.
- **Q5 (deferred)**: ¿Tests E2E mobile del wizard con Detox o Maestro? Requiere infra E2E mobile, decisión transversal del proyecto. Cobertura actual: QA manual del owner.
- **Q6 (resuelto)**: ¿Dónde viven los componentes nuevos? En `components/ui/` para reuso futuro, no en una subcarpeta de onboarding. Mismo patrón que el resto de UI mobile.
- **Q7 (resuelto)**: ¿El gate consulta `profiles` con `maybeSingle()` o `single()`? Con `maybeSingle()` — si por alguna razón el row de profiles no existe (debería existir por el trigger `handle_new_user`), no rompemos el arranque; tratamos el caso como "no completó onboarding" y mandamos al wizard, donde el primer UPDATE volverá a crearlo si fuese necesario (vía RLS upsert pattern, a evaluar al implementar).
