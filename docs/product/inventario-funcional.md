# Inventario funcional de Grana v3

> Fuente: `openspec/specs/*/spec.md` (29 specs canónicos), `openspec/changes/archive/` (176 changes),
> `docs/design/`, `apps/web/app/`, `apps/mobile/app/`, `packages/`.
> Fecha de corte: **2026-08-07**. Rama: `main` (`e40b6617`).
>
> **Convención de las columnas Web / Mobile:**
> - **Sí** — especificado *y* con ruta/componente que lo implementa.
> - **Parcial** — implementado con recortes explícitos (se detalla en la fila).
> - **No** — no existe en esa plataforma.
> - **N/A** — no aplica a esa plataforma por diseño (p. ej. server actions).
>
> Cuando el spec contempla algo que **no** encontré en el código, la fila dice `Sí (spec) / No (código)`
> y se repite en la sección **E. Huecos**.

---

# A. Tabla maestra de features

## A.1 · Autenticación (`auth`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| AUTH-01 | auth | Alta de usuario | Crea el usuario en Supabase Auth con `full_name` en metadata, sin `emailRedirectTo` | Sí | Sí | `auth` — "Registro de usuario con confirmación de email" |
| AUTH-02 | auth | Detección de email ya registrado | Inspecciona `identities: []` (enumeration protection) y muestra `auth.errors.user_already_exists` sin navegar ni enviar mail | Sí | Sí | `auth` — "Registro de usuario con confirmación de email" |
| AUTH-03 | auth | Validación de signup compartida cliente/servidor | Nombre 2–60, password ≥8 con letra y número, confirmación coincidente; mismo schema Yup en form y action | Sí | Sí | `auth` — "Schemas de validación unificados compartidos entre cliente y server" |
| AUTH-04 | auth | Verificación OTP de signup (8 dígitos) | `verifyOtp({type:'signup'})` en pantalla dedicada; el email viaja por estado in-app | Sí | Sí | `auth` — "Verificación del código OTP de signup" |
| AUTH-05 | auth | Sign-out inmediato post-verify + mensaje one-shot | Tras verificar, desloguea y manda a login con "tu cuenta fue confirmada, iniciá sesión" | Sí | Sí | `auth` — "Verificación del código OTP de signup" |
| AUTH-06 | auth | Reenvío de código con cooldown de 60 s | Botón deshabilitado con contador; `resend` (signup) / `resetPasswordForEmail` (recovery) | Sí | Sí | `auth` — "Reenvío del código OTP con cooldown" |
| AUTH-07 | auth | Reenvío de confirmación desde el login | Detecta `email_not_confirmed` y ofrece acción inline que reenvía y navega a verify | Sí | Sí | `auth` — "Reenvío del código de confirmación desde el login" |
| AUTH-08 | auth | Login email + password | `signInWithPassword`; error genérico en el form, nunca `?error=` en la URL | Sí | Sí | `auth` — "Login con email y password" |
| AUTH-09 | auth | Persistencia de sesión | Web: cookies HTTP-only vía `@supabase/ssr`. Mobile: `expo-secure-store` | Sí | Sí | `auth` — "Login con email y password" |
| AUTH-10 | auth | Logout | Web: botón en el header del shell `(app)`. Mobile: dentro del dashboard/menú | Sí | Sí | `auth` — "Logout desde el área autenticada" |
| AUTH-11 | auth | Solicitar reset de password | `resetPasswordForEmail` sin `redirectTo`; navega a verify aunque el mail no exista (anti-enumeration) | Sí | Sí | `auth` — "Solicitar reset de password" |
| AUTH-12 | auth | Verificación OTP de recovery | `verifyOtp({type:'recovery'})` → sesión con claim `amr=otp` | Sí | Sí | `auth` — "Verificación del código OTP de recovery" |
| AUTH-13 | auth | Setear password nuevo (100 % client-side) | Gate por claim `amr=otp`; `updateUser` + `signOut` desde el browser para evitar el race de re-render de Next | Sí | Sí | `auth` — "Setear password nuevo durante recovery" |
| AUTH-14 | auth | Enforcement de sesión de recovery | Middleware redirige toda request con `amr=otp` a `/reset-password` (sin cookies, solo el claim del JWT) | Sí | Sí (gates de splash/layout) | `auth` — "Enforcement de sesión de recovery en el middleware" |
| AUTH-15 | auth | Rutas protegidas | Request anónima a `(app)/*` o `/onboarding/*` → `/login` | Sí | Sí | `auth` — "Las rutas protegidas redirigen a usuarios no autenticados" |
| AUTH-16 | auth | Gate de onboarding incompleto | `onboarding_completed_at IS NULL` + ruta `(app)` → `/onboarding/welcome`. Mobile lo hace en 3 puntos (splash, `SIGNED_IN`, layout) | Sí | Sí | `auth` — "El middleware redirige al wizard…" / "El gate de mobile redirige al wizard…" |
| AUTH-17 | auth | Errores de Supabase localizados | Mapeo código → clave i18n con fallback `auth.errors.generic` | Sí | Sí | `auth` — "Mensajes de error de Supabase localizados" |
| AUTH-18 | auth | Server actions con resultado tipado | `{ ok } \| { ok:false, fieldErrors?, formError? }`; nunca `redirect('/login?error=')` | Sí | N/A | `auth` — "Los server actions devuelven un resultado tipado…" |
| AUTH-19 | auth | Templates de email versionados en el repo | `supabase/templates/*.html` es la fuente de verdad; el dashboard es mirror manual | N/A | N/A | `auth` — "Los templates de email viven versionados en el repo" |
| AUTH-20 | auth | Templates OTP sin links | `{{ .Token }}` visible, prohibido cualquier `<a href>` al sitio | N/A | N/A | `auth` — "Los templates de email muestran el código OTP de 8 dígitos sin links" |
| AUTH-21 | auth | Shell de auth dedicado | Tarjeta centrada con `GranaLogo`; web cardless bajo `sm`, mobile siempre cardless con `KeyboardAvoidingView` | Sí | Sí | `auth` — "El route group de auth tiene un layout dedicado" |
| AUTH-22 | auth | Schema de OTP compartido | `packages/validation` exporta el schema de 8 dígitos numéricos usado por las 4 pantallas de verify | Sí | Sí | `auth` — "Schema de validación del código OTP" |

## A.2 · Onboarding (`onboarding`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| ONB-01 | onboarding | Wizard de 3 pantallas con persistencia por paso | `welcome` → `initial-balance` → `done`; el progreso vive en DB, no en estado de cliente | Sí | Sí | `onboarding` — "El wizard de onboarding tiene tres pantallas con persistencia por paso" |
| ONB-02 | onboarding | Pantalla de bienvenida sin inputs | Saludo con `full_name`, promesa de valor y CTA "Empezar"; no persiste nada | Sí | Sí | `onboarding` — "La pantalla de welcome muestra una bienvenida sin inputs" |
| ONB-03 | onboarding | Captura del saldo inicial | Dos inputs (ARS/USD) que hacen `UPDATE account_currencies.initial_balance`; **no** inserta transacciones | Sí | Sí | `onboarding` — "La pantalla de saldo actual impacta initial_balance, no crea transacciones" |
| ONB-04 | onboarding | ARS obligatorio, cero válido | El input ARS del primary es requerido; `0` es una declaración válida | Sí | Sí | `onboarding` — "El wizard NO permite saltar pasos intermedios" |
| ONB-05 | onboarding | Sin botón "saltar paso" | No existe escape en `initial-balance` | Sí | Sí | `onboarding` — "El wizard NO permite saltar pasos intermedios" |
| ONB-06 | onboarding | Cierre idempotente del onboarding | `done` hace `UPDATE profiles.onboarding_completed_at = now()` una sola vez | Sí | Sí | `onboarding` — "La pantalla done marca el onboarding como completado y muestra resumen" |
| ONB-07 | onboarding | Resumen del disponible en `done` | Agrega `initial_balance` por moneda y lo muestra | Sí | Sí | `onboarding` — "La pantalla done…" |
| ONB-08 | onboarding | Bifurcación "Tu Grana, tu decisión" | Card A ("Una billetera y listo") vs Card B ("Mis cuentas, al detalle"); sin escape | Sí | **No** (mobile usa CTA único "Ir al dashboard") | `onboarding` — "La pantalla done…" |
| ONB-09 | onboarding | Paso de confirmación cálido | Al elegir card, la pantalla reemplaza todo su contenido por la confirmación + "Vamos 🚀"; "Volver" no navega | Sí | No | `onboarding` — "La pantalla done…" |
| ONB-10 | onboarding | Camino A → primer movimiento | Navega a `/dashboard?nuevo=1`, que abre el drawer de alta y dispara el tour guiado | Sí | No | `onboarding` + `transactions` — "El drawer de alta de movimiento se abre automáticamente desde un query param" |
| ONB-11 | onboarding | Camino B → primera cuenta | Navega a `/accounts?nuevaCuenta=1`, que abre el drawer de alta de cuenta | Sí | No | `onboarding` + `accounts` — "El drawer de alta de cuenta se abre automáticamente desde un query param" |
| ONB-12 | onboarding | Bimoneda por defecto | Todo usuario nuevo arranca con ARS **y** USD habilitadas; ocultar USD es opt-out futuro desde `settings` | Sí | Sí | `onboarding` — "Bimoneda por defecto — todo usuario arranca con ARS y USD habilitados" |
| ONB-13 | onboarding | Revisita de `done` post-completado | Renderiza normal sin re-ejecutar el UPDATE; la bifurcación sigue disponible | Sí | Sí | `onboarding` — "Usuario revisita done después de completar" |

## A.3 · Perfil y cimientos (`profiles`, `schema-base`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| PROF-01 | profiles | Profile espejo de `auth.users` | Trigger `handle_new_user` (`SECURITY DEFINER`) inserta la fila en cada signup | Sí | Sí | `profiles` — "La tabla profiles refleja a los usuarios de auth" |
| PROF-02 | profiles | RLS de profiles | Select/update solo sobre `auth.uid() = id`; sin policy de insert ni delete | Sí | Sí | `profiles` — "Row Level Security sobre profiles" |
| PROF-03 | profiles | `financial_timezone` | Default `America/Argentina/Buenos_Aires`; base del "hoy" contable | Sí | Sí | `profiles` — "La tabla profiles persiste la zona horaria financiera…" |
| PROF-04 | profiles | `onboarding_completed_at` | NULL = wizard pendiente; gobierna todos los gates | Sí | Sí | `profiles` — idem |
| BASE-01 | schema-base | Catálogo de monedas | `currencies` pre-cargado (ARS, USD), inmutable por RLS | Sí | Sí | `schema-base` — "Monedas del sistema disponibles" |
| BASE-02 | schema-base | Catálogo de instituciones AR | ≥23 entidades con `brand_color` e `icon_type`; inmutable | Sí | Sí | `schema-base` — "Instituciones financieras argentinas pre-cargadas" |
| BASE-03 | schema-base | Instituciones custom por usuario | Filas con `user_id = auth.uid()`; indistinguibles del catálogo aguas arriba | Sí | Sí | `schema-base` — idem |
| BASE-04 | schema-base | Catálogo de redes de tarjeta | 7 redes AR (Visa, Mastercard, Amex, Cabal, Naranja, Naranja X, Mercado Pago) | Sí | Sí | `schema-base` / `card-networks` |
| BASE-05 | schema-base | Aritmética monetaria con `Money` | Branded type sobre `decimal.js`; prohibido `+ - * /` nativo en el motor contable | Sí | Sí | `schema-base` — "Aritmética monetaria con tipo Money" |
| BASE-06 | schema-base | Fecha contable vs `created_at` | `date` = `DATE` sin timezone (hecho económico); `created_at` = `TIMESTAMPTZ` (auditoría y desempate) | Sí | Sí | `schema-base` — "Fecha contable y zona horaria financiera" |
| BASE-07 | schema-base | "Hoy" financiero centralizado | `getTodayAR()`; prohibido `new Date()` directo en código financiero | Sí | Sí | `schema-base` — idem |

## A.4 · Cuentas (`accounts`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| ACC-01 | accounts | Cuenta cash por defecto al signup | Trigger `SECURITY DEFINER` crea la cuenta con ARS+USD en 0. **Nombre real hoy: `Billetera`** (mig. 0012) | Sí | Sí | `accounts` — "Cuenta Efectivo por defecto en el signup" (texto desactualizado, ver E) |
| ACC-02 | accounts | Backfill de cuenta default | La migración crea retroactivamente la cuenta para usuarios previos | N/A | N/A | `accounts` — idem |
| ACC-03 | accounts | Crear cuenta de efectivo | `type='cash'`; sin institución (`chk_cash_no_institution`), sin columnas de crédito | Sí | Sí | `accounts` — "El usuario puede crear una cuenta de efectivo" |
| ACC-04 | accounts | Crear cuenta bancaria/débito | `type='bank'` con institución obligatoria (`chk_bank_has_institution`) | Sí | Sí | `accounts` — "El usuario puede crear una cuenta bancaria/débito" |
| ACC-05 | accounts | Crear institución custom inline | Sub-form dentro del dropdown (nombre + color de la paleta); `icon_type` siempre `bank` | Sí | Sí | `accounts` — "Crear institución custom desde el form de cuenta" |
| ACC-06 | accounts | Sub-saldos por moneda | `account_currencies` una fila por moneda; UNIQUE `(account_id, currency_code)`; solo ARS/USD | Sí | Sí | `accounts` — "Una cuenta puede tener saldos en múltiples monedas" |
| ACC-07 | accounts | Agregar moneda a una cuenta | Upsert sobre `(account_id, currency)`: reactiva y actualiza `initial_balance` | Sí | Sí | `accounts` — "El usuario puede agregar una moneda a una cuenta existente" |
| ACC-08 | accounts | Desactivar una moneda | Solo si el saldo derivado es exactamente 0 **y** queda ≥1 moneda activa | Sí | Sí | `accounts` — "El usuario puede desactivar una moneda de una cuenta" |
| ACC-09 | accounts | Editar nombre e institución | `updateAccountSchema` en modo `strict`: solo `name` e `institution_id` | Sí | Sí | `accounts` — "El usuario puede editar nombre e institución de una cuenta" |
| ACC-10 | accounts | Archivar cuenta | `is_active=false`; siempre disponible en cash/bank; en credit aplica el guard de deuda | Sí | Sí | `accounts` — "El usuario puede archivar una cuenta" |
| ACC-11 | accounts | Reactivar cuenta | Sin validaciones adicionales | Sí | Sí | `accounts` — "El usuario puede reactivar una cuenta archivada" |
| ACC-12 | accounts | Eliminar cuenta sin historial | Solo si nunca tuvo transacciones (propias ni entrantes); cascadea a `account_currencies` | Sí | Sí | `accounts` — "El usuario puede eliminar permanentemente una cuenta sin historial" |
| ACC-13 | accounts | Menú kebab por fila | Items según la matriz `(is_active, has_transactions)`: Editar / Archivar / Eliminar / Reactivar | Sí | Sí (action sheet nativo) | `accounts` — "El usuario puede ver la lista de sus cuentas agrupadas por tipo" |
| ACC-14 | accounts | Confirm dialog para archivar/eliminar | `Dialog` con nombre de la cuenta, copy por acción, error tipado inline y CTA `destructive` | Sí | Sí (`Alert.alert`) | `accounts` — idem |
| ACC-15 | accounts | Listado agrupado por tipo | Secciones "Efectivo" y "Bancarias" con contador; las `credit` **no** aparecen | Sí | Sí | `accounts` — idem |
| ACC-16 | accounts | Sección Archivadas | Solo si existen; borde `dashed`, pill "Archivada", sin `opacity` global | Sí | Sí | `accounts` — idem |
| ACC-17 | accounts | Avatar visual de cuenta | `color_key`/`icon_key` nullable; bank hereda **en vivo** de la institución, cash usa `hash(id)`, fallback monograma | Sí | Sí | `accounts` — "Cada cuenta tiene un avatar visual (color + ícono)" |
| ACC-18 | accounts | Saldo derivado por (cuenta, moneda) | `initial_balance + Σ movimientos` con corte a `hoy_AR`; sin columna cacheada | Sí | Sí | `accounts` — "El sistema computa el saldo de cada cuenta en cada moneda…" |
| ACC-19 | accounts | Saldo negativo visible | No se clampea a cero | Sí | Sí | `accounts` — idem |
| ACC-20 | accounts | Detalle de cuenta (4 tarjetas) | Hero navy de identidad → reembolsos pendientes (condicional) → link `+ Agregar moneda` (condicional) → tarjeta de movimientos | Sí | Sí | `accounts` — "El usuario puede ver el detalle de una cuenta" |
| ACC-21 | accounts | Hero navy con radial gradient tokenizado | `--hero-navy-from/-to/-origin` en `@grana/ui-tokens`; prohibido el gradient inline | Sí | Parcial (equivalente RN) | `transactions` — "El hero card de /accounts/[id] usa una superficie navy…" |
| ACC-22 | accounts | Guard: cuenta `credit` redirige | `/accounts/[id]` de una tarjeta hace `redirect('/cards/[id]')` server-side | Sí | Sí | `accounts` / `transactions` |
| ACC-23 | accounts | Hint de primer uso | Solo con exactamente 1 cuenta activa y sin descartar; dismissible por `localStorage` | Sí | No | `accounts` — "El estilo visual de /accounts (raíz)…" |
| ACC-24 | accounts | Empty state "Todavía no tenés cuentas" | Se muestra aun cuando existan archivadas | Sí | Sí | `accounts` — idem |
| ACC-25 | accounts | Drawer de alta por query param | `/accounts?nuevaCuenta=1` abre el drawer una vez y limpia el param | Sí | No | `accounts` — "El drawer de alta de cuenta se abre automáticamente desde un query param" |
| ACC-26 | accounts | Drawer de edición desde la lista | `Editar` del kebab abre el drawer, sin navegar a `/accounts/[id]/edit` | Sí | No (pantalla pusheada) | `accounts` — "El usuario puede ver la lista…" |
| ACC-27 | accounts | Fallback no-JS de alta/edición | `/accounts/new` y `/accounts/[id]/edit` siguen resolviendo como página | Sí | N/A | `accounts` |
| ACC-28 | accounts | RLS de accounts / account_currencies | `user_id = auth.uid()`; las monedas heredan por join | Sí | Sí | `accounts` — "Solo el dueño de una cuenta puede leerla y modificarla" |
| ACC-29 | accounts | Toolbar de filtros en el detalle | Navegación por mes, búsqueda, acceso a recurrencias y hoja de filtros con chips activos | Sí | Sí | `accounts` — "El detalle de cuenta en mobile filtra los movimientos con un toolbar" + `transactions` |
| ACC-30 | accounts | Carga independiente por sección | Cada tarjeta del detalle fetchea sola con TanStack y entrega loading/error in-place | Sí | Sí | `transactions` — "Cada sección de /accounts/[id] fetchea independientemente…" |
| ACC-31 | accounts | Estado de filtros en React state | La URL canónica de `/accounts/[id]` no acepta query params; F5 resetea | Sí | Sí | `transactions` — "El estado de filtros y navegación de /accounts/[id] vive en React state, no en URL" |
| ACC-32 | accounts | Mutator mobile con error neutro | `AccountMutationResult` → `errorKey` resuelto con `useT`; `23505 → accounts.errors.duplicate` | N/A | Sí | `accounts` — "El mutator de cuentas en mobile traduce el contrato de error neutro con useT" |
| ACC-33 | accounts | Cuentas como stack pusheado desde Menú | No es tab; `Stack{headerShown:false}` + `PageHeader` propio por pantalla | N/A | Sí | `accounts` — "El módulo de cuentas en mobile se pushea desde Menú" |
| ACC-34 | accounts | Header persistente + secciones aisladas | `layout.tsx` monta el header; `loading.tsx` skeletons shape-matched; containers con `try/catch` | Sí | Sí | `accounts` — "El header de /accounts se renderiza desde el primer paint…" |

## A.5 · Tarjetas de crédito (`cards`, `card-networks`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| CARD-01 | cards | Alta de tarjeta | Banco + red (catálogo o custom) + monedas (ARS obligatoria) + límite opcional + **2 fechas** del resumen actual | Sí | Sí | `cards` — "El alta de tarjeta captura solo las fechas del resumen actual…" |
| CARD-02 | cards | Nombre autogenerado | `"<red> <banco>"` → `"Tarjeta <banco>"` → `"<red>"` → `"Mi tarjeta"` | Sí | Sí | `cards` — "El sistema garantiza que el nombre de tarjeta autogenerado se compone de red y banco" |
| CARD-03 | cards | El alta crea P1 real + P2 estimado | P1 `start = cierre − 30d`, `is_estimated=false`; P2 `start = cierre + 1d`, `is_estimated=true` | Sí | Sí | `cards` — idem |
| CARD-04 | cards | Red inmutable post-creación | XOR `network_id` / `other_network_name`; chip read-only con candado en edición | Sí | Sí | `card-networks` — "La red de una tarjeta es inmutable post-creación" |
| CARD-05 | card-networks | Metadata visual de la red | `brand_color` + `icon_key` para el chip; red custom se muestra con color neutro | Sí | Sí | `card-networks` — "La metadata visual de la red se usa en el render…" |
| CARD-06 | cards | Período con 4 fechas | `card_periods(start_date,end_date,due_date,is_estimated)`; `chk_period_dates`; UNIQUE `(account_id,start_date)`; **sin columna `status`** | Sí | Sí | `cards` — "El sistema modela cada resumen de tarjeta como un período con cuatro fechas" |
| CARD-07 | cards | Estado del período derivado | `paid` → `open` → `closed` → `overdue`, vía `derivePeriodStatus(period, today, hasPayment)` | Sí | Sí | `cards` — "El estado del período se deriva sin persistir" |
| CARD-08 | cards | Rolling lazy de períodos (I-CRED-12) | Toda tarjeta activa mantiene ≥1 período `open`; se genera al vuelo con `is_estimated=true` | Sí | Sí | `cards` — "El sistema mantiene siempre al menos un período abierto por delante de hoy" |
| CARD-09 | cards | Algoritmo de sugerencia de fechas | Promedia duración y separación de los últimos 3 períodos; fallback `hoy+30 / hoy+45` | Sí | Sí | `cards` — "El algoritmo de sugerencia de fechas usa el promedio de períodos previos" |
| CARD-10 | cards | Asignación de consumo a período | `transactions.card_period_id` calculado al insertar; solapamiento → rechazo | Sí | Sí | `cards` — "La asignación de una transacción a un período se persiste como FK" |
| CARD-11 | cards | Rechazo de consumo previo al historial | Error que nombra la fecha de inicio del historial; no crea períodos hacia atrás | Sí | Sí | `cards` — idem |
| CARD-12 | cards | Rechazo de consumo en período pagado | Error tipado `period_already_paid` | Sí | Sí | `transactions` — "El sistema rechaza registrar un consumo con fecha dentro de un período pagado" |
| CARD-13 | cards | Edición de fechas de período + cascada del borde | Extender/achicar `end_date` cascadea `next.start_date` y **reasigna** los consumos afectados | Sí | Sí (sheet nativo) | `cards` — "Las fechas de un período `open` se pueden editar; las de un período `paid` no" |
| CARD-14 | cards | Bloqueos de la cascada | Rechaza si el próximo está pagado o si `new_end_date >= next.end_date` | Sí | Sí | `cards` — idem |
| CARD-15 | cards | Preview ámbar / bloqueo rojo en el sheet de fechas | Cartel ámbar describiendo la cascada; cartel rojo + Guardar deshabilitado si el próximo está pagado | Sí | Parcial (bloqueo sí; preview no especificado) | `cards` — idem |
| CARD-16 | cards | Listado `/cards` como vista compacta por banco | Grupos collapsible con chevron, dot del banco, "N tarjetas · M en uso", total a pagar y badge de urgencia | Sí | Sí | `cards` — "El listado de tarjetas se muestra como wallet con hero de pago mensual" |
| CARD-17 | cards | Auto-colapso de grupos | Colapsa solo si **todas** las tarjetas del banco están al día y en $0 | Sí | Sí | `cards` — idem |
| CARD-18 | cards | Hero navy con dos cifras | "A pagar (ahora)" (cerrados e impagos) + "En curso" (abiertos con saldo, caption "se sigue sumando hasta el cierre"), bimoneda, nunca sumados | Sí | Sí | `cards` — idem |
| CARD-19 | cards | Próximos cierres | Una fila por tarjeta (`fecha · nombre`, **sin monto**), ordenada por cierre, capada en `NEXT_CLOSES_CAP` (6) | Sí | Sí | `cards` — idem |
| CARD-20 | cards | Controles de vista | Web: un segmented de 5 (`Por banco`/`Todas`/`En uso`/`Vencen pronto`/`Con saldo`). Mobile: segmented de 2 + chips con conteo visibles solo en `Lista` | Sí | Sí | `cards` — idem |
| CARD-21 | cards | Chip de filtro sin resultados deshabilitado | Conteo 0 → no seleccionable; la selección sobrevive al ida y vuelta a `Por banco` | N/A | Sí | `cards` — idem |
| CARD-22 | cards | Indicador de estado por fila | `pillTone(alert, variant)` siempre visible; tokens de `@grana/ui-tokens` (una clase inexistente viola el requirement) | Sí | Sí | `cards` — idem |
| CARD-23 | cards | Stat "Uso" del resumen vigente | `min(100, round(pendingARS / credit_limit × 100))`; sin límite → texto "Sin límite" | Sí | Sí | `cards` — idem |
| CARD-24 | cards | Grupo fallback "Sin banco" | Tarjetas con `institution_id` null, siempre último | Sí | Sí | `cards` — idem |
| CARD-25 | cards | Sección Archivadas colapsable | Cerrada por defecto, solo si existe ≥1; web `<details>`, mobile `Pressable` | Sí | Sí | `cards` — idem |
| CARD-26 | cards | Timeline de ciclo de vida | `Pagado → [A pagar] → En curso → Próximo` con dots de color; los pasos seleccionan el período mostrado | Sí | Sí | `cards` — "El detalle de tarjeta muestra el resumen actual, próximo, y acciones primarias" |
| CARD-27 | cards | Hero terracota "RESUMEN A PAGAR" | Monto grande, "Cerró el X · vence el Y", countdown y CTA "Registrar pago" | Sí | Sí | `cards` — idem |
| CARD-28 | cards | Card "En curso" con panel de ciclo | Badge "Sumando consumos" (dot verde con pulso), acumulado, stats y barra "Día X de N" | Sí | Sí | `cards` — idem |
| CARD-29 | cards | Mini fila "Próximo" | Borde punteado, "ya comprometido en cuotas", monto y chevron | Sí | Sí | `cards` — idem |
| CARD-30 | cards | Panel de límite | Usado/total/% + disponible, o CTA "Cargar límite" cuando `credit_limit` es null (cálculo ARS-only) | Sí | Sí | `cards` — idem |
| CARD-31 | cards | Pestañas del detalle | `Movimientos del período` + `Cuotas en curso · N` (segmented en mobile) | Sí | Sí | `cards` — "El detalle de tarjeta muestra movimientos del período y cuotas en curso en pestañas" |
| CARD-32 | cards | Estado "tarjeta nueva" | Sin timeline ni resúmenes; CTA "Registrar primer consumo" con la tarjeta preseleccionada | Sí | Sí | `cards` — idem |
| CARD-33 | cards | Estado "archivada sin pendientes" | Estado informativo con acción **reactivar** | Sí | Sí | `cards` — "La ruta de detalle de tarjeta nativa (mobile)…" |
| CARD-34 | cards | Pantalla de resúmenes | `/cards/[id]/periods` titulada **"Resúmenes"** (no "Historial"), orden `start_date` desc, badge por variante | Sí | Sí | `cards` — "El sistema muestra una pantalla con todos los resúmenes de una tarjeta" |
| CARD-35 | cards | Detalle de período | Rango, total, movimientos ordenados, info de pago, link "Editar fechas" cuando aplica | Sí | Sí | `cards` — "El detalle de período muestra movimientos del período e info del pago" |
| CARD-36 | cards | El total del período netea reintegros en resumen | `total = Σ consumos − Σ reintegros recibidos` por moneda; pendientes/cancelados no descuentan | Sí | Sí | `cards` — idem |
| CARD-37 | cards | Mora visible | Badge `Vencido`, hero terracota con "vencido hace N días", pill urgente en el listado | Sí | Sí | `cards` — "El sistema muestra mora visible cuando un resumen vence sin pago" |
| CARD-38 | cards | Archivar tarjeta con guard de deuda | Bloquea si hay período no-paid con transacciones → error tipado `pending_debt` + dialog | Sí | Sí | `cards` — "El usuario puede archivar una tarjeta sin deuda; con deuda es bloqueado" |
| CARD-39 | cards | Reactivar tarjeta | Sin validaciones adicionales | Sí | Sí | `cards` — "El usuario puede reactivar una tarjeta archivada" |
| CARD-40 | cards | Editar tarjeta | Nombre, institución, `credit_limit` y fechas del ciclo (actual y próximo), persistiendo actual→próximo | Sí (drawer) | Sí (pantalla pusheada) | `cards` — "El usuario puede editar campos mutables de una tarjeta" |
| CARD-41 | cards | Vista previa en vivo en el drawer de edición | Nombre, inicial del avatar, red, banco, límite con barra y mini-diagrama cierre→vence | Sí | No | `cards` — idem |
| CARD-42 | cards | Eliminar tarjeta | Solo si nunca tuvo movimientos; si tuvo, deshabilitado con copy y se ofrece archivar | Sí | Sí | `cards` / `accounts` |
| CARD-43 | cards | Señalización de fechas estimadas | Marca discreta en el timeline y en el drawer de edición; **no** en el hero de `/cards` ni en el dashboard | Sí | Sí | `cards` — "Los períodos estimados se señalizan en el detalle y la edición de la tarjeta" |
| CARD-44 | cards | Pago de resumen atómico | `payCardPeriod`: expense en cuenta de pago + `period_payments` + consumos a `paid` + próximo período; rollback total ante fallo | Sí | Sí | `transactions` — "El usuario paga un resumen de tarjeta como operación atómica" |
| CARD-45 | cards | El pago confirma las fechas de P(n+1) | Pisa el estimado (`is_estimated=false`) con las fechas del extracto y reasigna consumos si el cierre real es anterior | Sí | Sí | `cards` — "El pago de un resumen confirma las fechas del período en curso y crea el siguiente estimado" |
| CARD-46 | cards | P(n+2) eager | Tras confirmar P(n+1), garantiza que exista P(n+2) estimado | Sí | Sí | `cards` — idem |
| CARD-47 | cards | Re-proyección en vez de bloqueo | Si P(n+2) es estimado, vacío y sin pago, se re-proyecta en lugar de rechazar la confirmación | Sí | Sí | `cards` — idem |
| CARD-48 | cards | Cotización USD al pagar, no al consumir | El consumo USD no pide FX; el pago exige cotización (6 decimales) cuando `pendingAmountUSD > 0` | Sí | Sí | `cards` — "La cotización de la deuda USD se captura al pagar el resumen…" |
| CARD-49 | cards | Desglose ARS + USD×TC = total | Total sugerido autocompletado y editable (permite pago parcial) | Sí | Sí | `cards` — idem |
| CARD-50 | cards | FX persistido en el pago | `fx_rate_to_ars` en la transacción de pago, para trazabilidad | Sí | Sí | `cards` — idem |
| CARD-51 | cards | Pagado por moneda | `paidAmountARS` / `paidAmountUSD` en la lista y el detalle; el detalle del pago muestra la composición | Sí | Sí | `cards` — idem |
| CARD-52 | cards | Cuenta de débito sugerida por banco | Preselecciona una cuenta activa con ARS de la misma institución; fallback a la primera disponible | Sí | Sí | `cards` — "El pago de resumen sugiere la cuenta de débito del mismo banco" |
| CARD-53 | cards | Alícuota de sellos por tarjeta | `accounts.stamp_tax_rate` **oculta** al usuario; NULL = todavía no conocida; solo en cuentas credit | Sí | Sí | `cards` — "Cada tarjeta recuerda su alícuota de impuesto de sellos" |
| CARD-54 | cards | Selector de monto de sello (primera vez) | Chips de montos en pesos calculados de alícuotas comunes + monto libre + "No me cobraron sellos"; **nunca menciona el porcentaje** | Sí | Sí | `cards` — "El pago de un resumen incorpora el impuesto de sellos" |
| CARD-55 | cards | Sello pre-cargado en pagos siguientes | `round(base × stamp_tax_rate)`, siempre editable | Sí | Sí | `cards` — idem |
| CARD-56 | cards | El sello es un movimiento del período | Gasto en la tarjeta con fecha = `end_date`, categoría `impuestos` / subcategoría `impuesto-de-sellos`, ARS, en estado `paid` | Sí | Sí | `cards` — "El impuesto de sellos se registra como movimiento dentro del resumen pagado" |
| CARD-57 | cards | La base del sello excluye el propio sello | Total ARS del resumen **antes** de insertar el movimiento de sello | Sí | Sí | `cards` — idem |
| CARD-58 | cards | Vínculo pago ↔ movimiento de sello | `period_payments.stamp_tax_transaction_id` (`ON DELETE SET NULL`) | Sí | Sí | `cards` — "El pago de un resumen registra el vínculo con su movimiento de impuesto de sellos" |
| CARD-59 | cards | **Deshacer pago de resumen** | Atómico: borra `period_payments`, devuelve movimientos a `pending`, borra el sello y el gasto-débito | Sí | **No** | `cards` — "El usuario puede deshacer el pago de un resumen" |
| CARD-60 | cards | Deshacer NO revierte el calendario | Fechas confirmadas, período estimado creado y reasignaciones **permanecen** | Sí | No | `cards` — idem |
| CARD-61 | cards | Deshacer NO borra la alícuota aprendida | `stamp_tax_rate` sobrevive a la reversión | Sí | No | `cards` — idem |
| CARD-62 | cards | Guard de orden cronológico inverso | No se puede deshacer si un resumen posterior de la misma tarjeta ya está pagado (`SQLSTATE GRN02`) | Sí | No | `cards` — "Deshacer un pago exige orden cronológico inverso" |
| CARD-63 | cards | Heurística de sello para pagos viejos | Sin vínculo: identifica por período + subcategoría y borra **solo si hay exactamente un** candidato | Sí | No | `cards` — "El pago de un resumen registra el vínculo…" |
| CARD-64 | cards | Acción "Deshacer pago" con confirmación enumerada | El diálogo lista monto que vuelve, cuenta, cantidad de movimientos y el sello a eliminar | Sí | No | `cards` — "El detalle de período expone la acción «Deshacer pago»" |
| CARD-65 | cards | Off-ledger (I-CRED-1) | Las tarjetas tienen `initial_balance=0` y sus `expense` se excluyen del saldo **en cualquier status** | Sí | Sí | `cards` — "Las tarjetas no descuentan disponible hasta el pago del resumen" |
| CARD-66 | cards | I-CRED-6: toda tx de tarjeta tiene período | `card_period_id NOT NULL` y `status ∈ {pending, paid}` | Sí | Sí | `cards` — "Toda transacción en tarjeta tiene un período asignado" |
| CARD-67 | cards | I-CRED-7: patrón madre/hija off-ledger | Madre `is_parent=true`, `account_id=NULL`; hijas con `installment_n`/`installments_total` | Sí | Sí | `cards` — "Las cuotas N>1 usan el patrón madre/hija con la madre off-ledger" |
| CARD-68 | cards | I-CRED-9: cuotas solo en ARS | Rechaza cualquier compra en cuotas en moneda ≠ ARS | Sí | Sí | `cards` — "Las cuotas N>1 solo aplican a transacciones en ARS" |
| CARD-69 | cards | RLS de `card_periods` / `period_payments` | Herencia por join con la cuenta padre | Sí | Sí | `cards` — "Solo el dueño puede leer y modificar sus card_periods y period_payments" |
| CARD-70 | cards | Mutaciones de tarjeta compartidas | `@grana/cards` con `CardMutationResult` neutral (`messageKey`/`errorCode`/`fieldErrors`); web y mobile son shells finos | Sí | Sí | `cards` — "Las mutaciones de tarjeta viven en `@grana/cards` con contrato neutral…" |
| CARD-71 | cards | Archive/reactivate delega en `@grana/accounts` | Una tarjeta **es** una cuenta; no existe mutación de archive duplicada | Sí | Sí | `cards` — "El archive y la reactivación de una tarjeta se realizan vía las mutaciones de cuentas" |
| CARD-72 | cards | Priorización del período activo | Vencido con deuda → cerrado esperando pago → abierto → último no pagado | Sí | Sí | `cards` — "El período activo mostrado en el detalle de tarjeta MUST priorizar la deuda sobre la apertura" |
| CARD-73 | cards | Header + secciones aisladas en `/cards` | Header desde el layout; hero, wallet y archivadas con fallback propio de carga y error | Sí | Sí | `cards` — "El header de `/cards` se renderiza desde el primer paint…" |

## A.6 · Movimientos — alta, edición y contrato funcional (`transactions`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| TX-01 | transactions | Registrar ingreso | `type='income'` en cuenta cash/bank; requiere moneda activa, monto > 0, fecha y categoría | Sí | Sí | `transactions` — "El usuario puede registrar un ingreso en una cuenta" |
| TX-02 | transactions | Registrar gasto | `type='expense'`, `status=NULL` en cash/bank; categoría obligatoria; en credit se dispatcha al flujo de tarjeta | Sí | Sí | `transactions` — "El usuario puede registrar un gasto en una cuenta" |
| TX-03 | transactions | Backdating permitido | Fecha anterior a hoy es válida | Sí | Sí | `transactions` — idem |
| TX-04 | transactions | Gasto con fecha futura | Se persiste pero **no** descuenta saldo hasta que la fecha llegue | Sí | Sí | `transactions` — "El saldo de la cuenta refleja las transacciones en tiempo real" |
| TX-05 | transactions | Registrar transferencia | Origen ≠ destino, moneda activa en **ambas**, sin categoría; sin conversión automática | Sí | Sí | `transactions` — "El usuario puede registrar una transferencia entre dos cuentas propias" |
| TX-06 | transactions | Registrar ajuste de saldo | Monto ≠ 0 con signo; sin categoría; positivo suma, negativo resta | Sí | Sí | `transactions` — "El usuario puede registrar un ajuste de saldo en una cuenta" |
| TX-07 | transactions | Registrar cambio de moneda (exchange) | Monto+moneda origen y monto+moneda destino distintas; la cuenta destino puede ser la misma; solo cash/bank | Sí | Sí | `transactions` — "El usuario puede registrar un cambio de moneda (exchange)" |
| TX-08 | transactions | Cotización del exchange derivada | `amount / destination_amount` calculado al vuelo; **no** se persiste ninguna columna de cotización | Sí | Sí | `transactions` — idem |
| TX-09 | transactions | Exchange no es ingreso ni gasto | Resta del ledger origen y suma al destino, por moneda; no infla ninguna métrica de flujo | Sí | Sí | `transactions` — "El cambio de moneda impacta los saldos por moneda y no cuenta como ingreso ni gasto" |
| TX-10 | transactions | Registrar consumo en tarjeta | `status='pending'`, `due_date` del período, `card_period_id`; sin impacto en disponible | Sí | Sí | `transactions` — "El usuario puede registrar un consumo en una tarjeta de crédito" |
| TX-11 | transactions | Registrar compra en N cuotas | Madre off-ledger + N hijas; reparto `floor` con residuo a la primera; una cuota por mes | Sí | Sí | `transactions` — "El usuario puede registrar un consumo en cuotas en una tarjeta de crédito" |
| TX-12 | transactions | Rolling automático para cuotas largas | Auto-genera los períodos faltantes (`is_estimated=true`) e inserta la compra atómicamente | Sí | Sí | `transactions` — idem |
| TX-13 | transactions | Aviso no bloqueante de saldo negativo | Compara contra el disponible de **esa cuenta** y **esa moneda**; cubre gasto, transferencia saliente, ajuste negativo, confirmar recurrencia y pago de resumen | Sí | Parcial (diferido en confirmar-recurrencia) | `transactions` — "El sistema avisa sin bloquear cuando una operación dejaría el disponible…" |
| TX-14 | transactions | Los consumos de tarjeta no disparan el aviso | Off-ledger, no afectan el disponible de ninguna cuenta | Sí | Sí | `transactions` — idem |
| TX-15 | transactions | Formulario único crear/editar | Un solo form para los 5 tipos; en edición tipo/moneda/cuenta son contexto inmutable | Sí | Sí | `transactions` — "El sistema usa un formulario único para crear y editar movimientos" |
| TX-16 | transactions | `getEditableFields` como fuente de verdad | Función pura en `@grana/money-logic` que decide qué campos son editables por tipo y estado | Sí | Sí | `transactions` — idem |
| TX-17 | transactions | Selector de cuenta con saldo por moneda | Muestra el disponible bimoneda; las tarjetas no muestran saldo (off-ledger) | Sí | Sí | `transactions` — idem |
| TX-18 | transactions | Alta en drawer lateral (sin URL) | El alta vive **solo** en el drawer; `openCreate(preselectedAccountId?)`; `/transactions/new` no existe en web | Sí | N/A (mobile usa `/transactions/new` full-screen) | `transactions` — "El alta y edición de movimientos se presenta como drawer lateral en desktop" |
| TX-19 | transactions | Loader del drawer a nivel app-shell | `MovementDrawerLoader` dentro de `AppShell`: alcanzable desde cualquier ruta `(app)` y sin re-montar al navegar | Sí | N/A | `transactions` — "El loader del drawer de movimiento se monta a nivel app-shell" |
| TX-20 | transactions | La chrome no ofrece alta | Sidebar, top-bar y menú mobile quedan **fuera** del provider y no exponen CTA de alta | Sí | N/A | `transactions` — idem |
| TX-21 | transactions | Alta con cuenta preseleccionada | Desde detalle de cuenta o tarjeta; si es tarjeta, arranca en el tipo Gasto | Sí | Sí | `transactions` — "El usuario puede registrar un movimiento desde el módulo global" |
| TX-22 | transactions | Al guardar: cierra drawer + `router.refresh()` | Sin navegación derivada de `?from=`; el listado embebido de la ruta actual refleja el alta | Sí | N/A | `transactions` — idem |
| TX-23 | transactions | Monto como hero del form | `MoneyAmountInput` con formato es-AR en vivo; color por tipo (gasto/transferencia navy, ingreso verde, ajuste con signo) | Sí | Sí | `transactions` — "El monto es el elemento hero del drawer con formato AR en vivo y color por tipo" |
| TX-24 | transactions | Selector de categoría con drill de 1 nivel | Nivel 0 categorías, nivel 1 "Toda la categoría" + subcategorías; chip "Sugerida" que desaparece al elegir manual | Sí | Sí | `transactions` — "El selector de categoría del drawer permite drill a subcategorías" |
| TX-25 | transactions | El selector solo ofrece ítems activos | Ni categorías ni subcategorías archivadas; el indicador de drill deriva de las subcategorías **ofrecibles** | Sí | Sí | `transactions` + `categories` |
| TX-26 | transactions | Excepción de edición: el ítem archivado asignado se conserva | Se muestra identificado como archivado; guardar sin tocarlo no borra la clasificación; al cambiar, deja de ofrecerse | Sí | Sí | `transactions` — idem |
| TX-27 | transactions | Atajos de teclado del drawer | `Esc` cierra el popover antes que el drawer; `⌘/Ctrl+Enter` envía | Sí | N/A | `transactions` — "Atajos de teclado en el drawer" |
| TX-28 | transactions | Modo edición | Tipo deshabilitado, CTA "Guardar cambios", borrado sujeto a las reglas existentes | Sí (drawer) | Sí (`/transactions/[txId]/edit`) | `transactions` — "El drawer en modo edición ajusta chrome y CTA" |
| TX-29 | transactions | Drawer abierto por query param | `?nuevo=1` abre el alta una vez y limpia el param; reintenta si el provider no está listo | Sí | No | `transactions` — "El drawer de alta de movimiento se abre automáticamente desde un query param" |
| TX-30 | transactions | Editar ingreso/gasto | Monto, fecha, descripción, categoría y subcategoría; `type`/`account_id`/`currency_code` inmutables | Sí | Sí | `transactions` — "El usuario puede editar una transacción" |
| TX-31 | transactions | Editar transferencia | Monto, fecha y descripción; cuentas y moneda inmutables | Sí | Sí | `transactions` — "El usuario puede editar una transferencia" |
| TX-32 | transactions | Editar ajuste | Monto con signo (cambio de signo válido), fecha y descripción | Sí | Sí | `transactions` — "El usuario puede editar un ajuste" |
| TX-33 | transactions | Editar exchange | Montos origen/destino, fecha y descripción; cuentas y monedas inmutables | Sí | Sí | `transactions` — "El usuario puede editar y eliminar un cambio de moneda" |
| TX-34 | transactions | Editar consumo de tarjeta `pending` | Monto, fecha, descripción, categoría; recalcula el período si cambia la fecha | Sí | Sí | `transactions` — "El usuario puede editar una transacción" |
| TX-35 | transactions | Consumo `paid`: solo descripción y categoría | Monto y fecha bloqueados post-pago | Sí | Sí | `transactions` — idem |
| TX-36 | transactions | Editar la madre de cuotas | Categoría/descripción se propagan a las hijas; monto/fecha/N solo si **ninguna** cuota está `paid` | Sí | Sí | `transactions` — "Editar una compra en cuotas propaga campos no monetarios…" |
| TX-37 | transactions | Re-reparto al cambiar el total en cuotas | Re-divide el nuevo total entre las N cuotas (residuo a la primera) | Sí | Sí | `transactions` — "Una cuota individual es inmutable…" |
| TX-38 | transactions | Cuota hija inmutable | Sin "Editar" ni "Eliminar"; nota + link "Ir a la compra original"; el action lo rechaza como defensa en profundidad | Sí | Sí | `transactions` — idem |
| TX-39 | transactions | Cuenta de débito editable **solo** en pago de resumen | Mueve el débito y recalcula ambos saldos; `period_payments` y el estado `paid` no se tocan | Sí | Sí | `transactions` — "La cuenta de débito de un pago de resumen es editable" |
| TX-40 | transactions | Eliminar movimiento con confirmación | Recalcula saldos; copy contextual (default / madre de cuotas / pago de resumen) | Sí | Sí (`Alert.alert` destructivo) | `transactions` — "El usuario puede eliminar una transacción" |
| TX-41 | transactions | Guards de borrado | Cuota hija → desde la madre; consumo pagado → no; pata de liquidación → desde cuenta corriente; **pago de resumen → desde el período** | Sí | Sí | `transactions` — idem |
| TX-42 | transactions | Eliminar compra en cuotas | Solo si **todas** las hijas están `pending`; cascadea por FK | Sí | Sí | `transactions` — "Eliminar una compra en cuotas sólo es posible si todas las hijas están pending" |
| TX-43 | transactions | `deleteTransaction` compartido | Thin mutation en `@grana/transactions-mutations` con los guards; una sola implementación para web y mobile | Sí | Sí | `transactions` — "La app nativa expone la edición y el borrado de un movimiento" |
| TX-44 | transactions | Contrato funcional `Movimiento` | Unión discriminada (ingreso, gasto, transferencia, ajuste, cuota, pago de resumen…) mapeada por un mapper puro | Sí | Sí | `transactions` — "El listado global usa un contrato funcional de Movimiento" |
| TX-45 | transactions | El pago de resumen no se muestra como gasto común | Se titula "Pago de resumen" y no se marca "Sin categoría" aunque `category_id` sea NULL | Sí | Sí | `transactions` — idem |
| TX-46 | transactions | La compra en cuotas no se duplica en el listado global | Se muestra la madre en la fecha de compra; las hijas no aparecen por defecto | Sí | Sí | `transactions` — idem |
| TX-47 | transactions | RLS con lectura cross-user de compartidos | SELECT propio + `is_shared=true` del hogar; escritura siempre owner-only | Sí | Sí | `transactions` — "Solo el dueño de la transacción puede leerla y modificarla" |
| TX-48 | transactions | `I-CRED-11` — `fx_rate_to_ars` acotado | Solo en consumos de tarjeta no-ARS; enforced por CHECK con subquery + validación en las actions | Sí | Sí | `transactions` — "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente…" |
| TX-49 | transactions | Ordenamiento determinístico dual | Cálculo `date ASC, created_at ASC, id ASC`; display `date DESC, created_at DESC, id DESC` | Sí | Sí | `transactions` — "El ordenamiento de transacciones en queries distingue uso de cálculo y uso de display" |
| TX-50 | transactions | Rutas canónicas bajo `/transactions` | Detalle `/transactions/<id>`, edición `/transactions/<id>/edit`; el árbol `/accounts/<id>/transactions/*` **no existe** | Sí | Sí | `transactions` — "Las rutas de movimiento son canónicas bajo `/transactions`" |
| TX-51 | transactions | Thin mutations compartidas | `createIncome/Expense/Transfer/Adjustment/Exchange`, `updateX`, `updateInstallmentParent`; auth y caché quedan en el shell | Sí | Sí | `transactions` — "La lógica del formulario vive en `@grana/movement-form`…" |
| TX-52 | transactions | Orquestadores con rollback | `registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement` como funciones puras isomórficas | Sí | Sí | `transactions` — idem |
| TX-53 | transactions | Contrato `Mutators` como drift detector | Una action nueva en el dispatcher falla en compilación en los consumers que no la implementen | Sí | Sí | `transactions` — idem |
| TX-54 | transactions | Invalidación granular por familia | `invalidateAfterMovementMutation`, `…RecurrenceInstanceMutation`, `…ReimbursementMutation`, `…SuggestionMutation` | Sí | Sí | `transactions` — "Las mutations invalidan caches granulares vía helpers semánticos…" |
| TX-55 | transactions | `revalidatePath` centralizado | Las server actions que afectan `/dashboard`, `/accounts`, `/cards` revalidan desde `app/_actions/_helpers.ts` | Sí | N/A | `transactions` — idem |

## A.7 · Movimientos — listado, detalle y desglose (`transactions`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| TX-56 | transactions | Módulo global `/transactions` | Listado cronológico único de todos los movimientos, accesible desde la navegación como "Movimientos" | Sí | Sí | `transactions` — "El usuario puede ver un módulo global de movimientos" |
| TX-57 | transactions | Paginación limit+1 lookahead | `{ movements, hasMore, nextLimit }`; el `limit` vive en React state, no en la URL | Sí | Sí | `transactions` — "El listado global está paginado" |
| TX-58 | transactions | Navegación por mes | Mes actual por defecto (`getTodayAR()`); prev/next; en mobile resetea el límite al cambiar | Sí | Sí | `transactions` — "El módulo global de movimientos permite búsqueda y filtros" |
| TX-59 | transactions | Búsqueda instantánea con debounce | Busca en **todo el historial**, no solo en la página cargada | Sí | **No** | `transactions` — idem |
| TX-60 | transactions | Filtros de contenido | Tipo, categoría, subcategoría, cuenta (solo con ≥2 cuentas), moneda y rango de monto | Sí | **No** (fuera de alcance declarado) | `transactions` — idem |
| TX-61 | transactions | Chips de filtro removibles + "Limpiar todo" | Con contador de filtros activos en el botón "Filtros" | Sí | No | `transactions` — idem |
| TX-62 | transactions | Micro-toolbar de íconos circulares | Search (expande a input full-width) · Recurrencias · Filtros (sheet desde la derecha con badge de conteo) | Sí | No | `transactions` — "Las acciones del listado viven en una micro-toolbar de íconos circulares" |
| TX-63 | transactions | Encabezado pelado de `/transactions` | Solo el `h1` "Movimientos"; sin subtítulo, sin mes, sin CTA | Sí | N/A | `transactions` — "El encabezado de Movimientos es minimalista y pelado" |
| TX-64 | transactions | Rango personalizado de fechas | Tiene prioridad sobre el mes seleccionado | Sí | No | `transactions` — "El módulo global de movimientos permite búsqueda y filtros" |
| TX-65 | transactions | Empty states diferenciados por motivo | Bienvenida (nunca registró) / mes vacío contextual / sin resultados de búsqueda / sin resultados de filtro | Sí | Parcial (bienvenida y mes vacío) | `transactions` — "El listado global distingue el motivo de un resultado vacío" |
| TX-66 | transactions | Toggle de visibilidad de compartidos | En la toolbar, **encendido por defecto**, con preferencia **persistida por usuario**; no es chip ni cuenta en el contador | Sí | No | `transactions` — "El listado global permite mostrar u ocultar los movimientos compartidos" |
| TX-67 | transactions | Fila única resuelta por perspectiva | `resolveMovementView(movimiento, perspectiva)`; perspectiva `global` vs perspectiva de cuenta (egocéntrica) | Sí | Sí | `transactions` — "El listado de movimientos usa una fila única resuelta por perspectiva" |
| TX-68 | transactions | Anatomía de la fila | Ícono (emoji de categoría o ícono de estructura), título = descripción, subtítulo `categoría · cuenta`, monto con color semántico | Sí | Sí | `transactions` — "La fila de movimiento muestra ícono de categoría, jerarquía y color semántico" |
| TX-69 | transactions | Tokens de color de monto | `text-income` / `text-expense` (terracota, **no** rojo Tailwind) / `text-neutral-amount` / `text-pending` | Sí | Sí | `transactions` — idem |
| TX-70 | transactions | Etiqueta de moneda bimoneda | ARS sin etiqueta (es la primaria), USD siempre etiquetada | Sí | Sí | `transactions` — idem |
| TX-71 | transactions | Marcadores de estado en la fila | Chip "Recurrente" (slate, ícono `Repeat`), "Revisar" (warning), cuota `3/6`, "pendiente" | Sí | Sí | `transactions` — "La fila de movimiento muestra marcadores de estado" |
| TX-72 | transactions | Grupos de fecha relativos | "Hoy", "Ayer" y fecha para días previos | Sí | Sí | `transactions` — idem |
| TX-73 | transactions | El listado **no** muestra totales por día | El panorama del período es responsabilidad del dashboard | Sí | Sí | `transactions` — "El listado de movimientos no muestra totales agregados" |
| TX-74 | transactions | Running balance por fila (perspectiva de cuenta) | Se muestra con navegación por mes; se **oculta** con filtros de contenido; nunca en el listado global | Sí | **No** (la columna no se renderiza en mobile) | `transactions` — "El listado de una cuenta muestra el saldo corriente por fila" |
| TX-75 | transactions | Fila sintética "Saldo inicial" | Una por moneda con `initial_balance != 0`; no navegable, fuera del recurrence-link lookup, solo en el detalle de cuenta | Sí | No | `transactions` — "El detalle de cuenta inyecta una fila sintética «Saldo inicial»…" |
| TX-76 | transactions | Skeleton de filas en la carga inicial | Dos day-groups simulados con la grilla real; nunca un spinner centrado | Sí | Sí | `transactions` — "El listado global muestra un esqueleto de filas durante la carga inicial" |
| TX-77 | transactions | Detalle `/transactions/[txId]` | Anatomía fija: TOPBAR + HERO tonal + grilla "de un vistazo"; "Peso en el mes" siempre al final | Sí | Parcial | `transactions` — "El usuario puede ver el detalle de una transacción" |
| TX-78 | transactions | Hero editorial centrado | Banda con `radial-gradient` por tono, ícono 88/72 px, monto 60/46 px, símbolo de moneda reducido y opaco, chips de contexto | Sí | Sí | `transactions` — "El detalle del movimiento usa un hero editorial centrado…" |
| TX-79 | transactions | Tono y signo por tipo | Gasto terracota `−`, ingreso emerald-deep `+`, transferencia slate **sin signo** + eyebrow "Transferencia interna" | Sí | Sí | `transactions` — idem |
| TX-80 | transactions | Tiles por tipo | Gasto simple, cuotas, compartido, reintegro, recurrencia, ingreso, transferencia — cada uno con su set | Sí | Parcial (faltan recurrencia, "Peso en el mes" y composición del pago de resumen) | `transactions` — "El usuario puede ver el detalle de una transacción" |
| TX-81 | transactions | `TxDetailGroup` / `TxDetailRow` | Cards con eyebrow caps uppercase; filas con ícono 32×32, label caps y value semibold | Sí | Parcial | `transactions` — "Los metadatos del detalle se agrupan en DetailGroups…" |
| TX-82 | transactions | Cuotas hermanas con numeración circular | Círculo 28 px coloreado por estado + chip "Pendiente"/"Pagada"; cada fila navega a su cuota | Sí | Sí | `transactions` — "Las cuotas hermanas se renderean con numeración circular…" |
| TX-83 | transactions | Back solo-ícono | `ArrowLeft` 20 px en botón 36×36 con `aria-label="Volver"`, sin texto | Sí | Sí | `transactions` — "El back del detalle se renderea como ícono solo, sin label de texto" |
| TX-84 | transactions | Back resuelto por `?from=` | `account:<id>` → `/accounts/<id>`, `card:<id>` → `/cards/<id>`, default `/transactions` | Sí | Sí | `transactions` — idem |
| TX-85 | transactions | Acciones en la topbar | Desktop: "Editar" sólido navy + "Eliminar" icon button. Mobile: topbar sticky, secundarias en "···", "Editar" en barra inferior fija | Sí | Sí | `transactions` — "Las acciones del detalle viven en un kebab menu" (título desactualizado, ver E) |
| TX-86 | transactions | Pedagogía in-context del off-ledger | Copy corto bajo el hero: consumo no pagado, cuota ya pagada, pago de resumen, reintegro pendiente, reintegro cancelado | Sí | **No** | `transactions` — "El detalle ofrece pedagogía in-context sobre off-ledger y reintegros pendientes" |
| TX-87 | transactions | Regla "sin estados decorativos" | Solo se muestra estado cuando informa algo real: *Reintegrado*, *Completada*, *Acreditado* | Sí | Sí | `transactions` — "El usuario puede ver el detalle de una transacción" |
| TX-88 | transactions | Nunca se muestra número de tarjeta | Solo nombre + tipo del medio de pago (la app gestiona, no opera pagos) | Sí | Sí | `transactions` — idem |
| TX-89 | transactions | Permisos de edición/borrado en el detalle | `canManage` / `canEdit` / `canDelete`; un compartido pagado por el otro miembro es legible pero no editable | Sí | Sí | `transactions` — "La app nativa expone el detalle de movimiento…" |
| TX-90 | transactions | Sugerencia de categoría por historial | Chip no bloqueante con la categoría (y subcategoría) usada la última vez para esa descripción normalizada | Sí | Sí | `transactions` — "El sistema sugiere una categoría según el historial del usuario" |
| TX-91 | transactions | Aviso "la próxima te la sugiero" | Informativo, no accionable, mutuamente excluyente con el chip de sugerencia | Sí | Parcial | `transactions` — "El sistema anticipa que recordará la categoría para la próxima vez" |
| TX-92 | transactions | FAB de alta (mobile-web) | Cuadrado 64×64 verde, `bottom-10 right-10`, **solo** en viewport `<sm`, en `/transactions` y `/dashboard` | Sí | N/A | `transactions` — "El usuario tiene un acceso rápido flotante para registrar un movimiento" |
| TX-93 | transactions | FAB nativo | 80×80, `bg-emerald`, sobre el tab bar, navega a `/transactions/new` | N/A | Sí | `transactions` — "La app nativa expone un FAB para registrar un movimiento" |
| TX-94 | transactions | Padding inferior reservado para el FAB | `pb-24 sm:pb-0` en web; `pb-28` en el `ScrollView` nativo | Sí | Sí | `transactions` — idem |
| TX-95 | transactions | Estado de filtros en React state | La URL canónica de `/transactions` no acepta query params; F5 resetea todo al default | Sí | Sí | `transactions` — "El estado de filtros y navegación de /transactions vive en React state, no en URL" |
| TX-96 | transactions | Secciones que fetchean independientemente | Banner de sugerencia, pendientes, overview, reintegros, filtros y lista, cada uno con loading/error propio y "Reintentar" por sección | Sí | Sí | `transactions` — "Cada sección de /transactions fetchea independientemente…" |
| TX-97 | transactions | Header persistente con CTA gateado | "Registrar movimiento" disabled hasta que el `MovementDrawerProvider` esté listo; nunca envuelve un `<Link>` mientras está disabled | Sí | N/A | `transactions` — "El header de /transactions permanece visible durante carga y error del contenido" |
| TX-98 | transactions | Primitivos de ledger compartidos | `MovementFilters`, `MovementList`, `MovementRow`, `PendingReimbursementsBlock` con el mismo lenguaje visual en las 3 rutas que los consumen | Sí | Sí | `transactions` — "Los primitivos visuales de ledger comparten un lenguaje visual único…" |
| TX-99 | transactions | Grid responsive de `MovementRow` | Desktop 3 columnas; bajo 760 px se oculta el running balance y quedan 2 | Sí | N/A | `transactions` — idem |
| TX-100 | transactions | "En qué se fue" como carta de presentación | Donut ~200 px SVG puro (sin librería, sin animación) + ranking compacto de hasta 5 + fila "+ N categorías más" | Sí | **No** | `transactions` — "El componente de gastos por categoría usa la variante híbrida donut + ranking compacto…" |
| TX-101 | transactions | Nota off-ledger del footer del donut | "Sin contar consumos en tarjeta sin pagar"; sin link "Ver el detalle" mientras no exista destino real | Sí | No | `transactions` — idem |
| TX-102 | transactions | Filtro por subcategoría | Solo activo con categoría seleccionada; marker `__none__` para "Sin subcategoría"; se descarta si llega sin categoría | Sí | No | `transactions` — "El usuario puede filtrar movimientos por subcategoría dentro de una categoría" |
| TX-103 | transactions | Modo subcategoría del overview | Con exactamente **una** categoría activa y sin subcategoría, el donut pasa a desglosar subcategorías | Sí | No | `transactions` — "El componente «En qué se fue» muestra desglose por subcategoría…" |
| TX-104 | transactions | `buildSubcategorySlices` | Helper en `@grana/money-logic`: ordena por valor desc, porcentajes que suman 100, bucket `null` = "Sin subcategoría" | Sí | Sí (package) | `transactions` — "`buildSubcategorySlices` está disponible en `@grana/money-logic`" |
| TX-105 | transactions | Drill-down desde el slice | El href preserva `month`, `currency` y `category` y agrega `subcategory` | Sí | No | `transactions` — "El click en un slice de subcategoría aplica el filtro de subcategoría" |
| TX-106 | transactions | Feed nativo navegable por mes | `getGlobalMovementsPage` compartido; mes independiente del dashboard; filas navegables con `?from=` | N/A | Sí | `transactions` — "La tab Movimientos de mobile muestra el feed global navegable por mes" |

## A.8 · Reintegros (`transactions`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| REI-01 | transactions | Declarar reintegro al registrar un gasto | Bloque "Tiene reintegro": monto esperado, subtipo y si ya fue recibido; creación **atómica** con el gasto | Sí | Sí | `transactions` — "El usuario puede declarar un reintegro al registrar un gasto" |
| REI-02 | transactions | Subtipo "en resumen" solo en tarjeta | "A cuenta" es el default y está disponible para cualquier medio de pago | Sí | Sí | `transactions` — idem |
| REI-03 | transactions | Cuenta de acreditación pre-rellenada por institución | Usa una cuenta del mismo banco que la del gasto, si existe | Sí | Sí | `transactions` — idem |
| REI-04 | transactions | Helper de % / tope | `applyReimbursementPercent` calcula el monto esperado | Sí | Sí | `transactions` — "La app nativa expone la pantalla de alta de movimiento" |
| REI-05 | transactions | Reintegro sobre compra en cuotas | Se vincula a la **madre**; "en resumen" cae en el período de la **primera cuota**, sin selector | Sí | Sí | `transactions` — "El usuario puede declarar un reintegro…" |
| REI-06 | transactions | Reintegro de compra compartida hereda el split | Una única fila con el split del hogar, para que la deuda derivada lo netee | Sí | Sí | `transactions` — idem |
| REI-07 | transactions | Tipo propio `reimbursement` | **No** es `income` ni `adjustment`; vinculado por `linked_transaction_id`; no modifica el gasto origen | Sí | Sí | `transactions` — "El reintegro es un tipo de movimiento propio vinculado al gasto" |
| REI-08 | transactions | Categoría derivada del gasto | No almacena categoría propia; nunca cuenta como ingreso genérico | Sí | Sí | `transactions` — idem |
| REI-09 | transactions | N reintegros por gasto | Sin unicidad sobre `linked_transaction_id`; el vínculo valida dueño y que el target sea un `expense` | Sí | Sí | `transactions` — idem |
| REI-10 | transactions | Pendiente no impacta nada | `amount` es "estimado vigente"; no entra a saldo, running balance, resumen ni neto | Sí | Sí | `transactions` — "Un reintegro pendiente no impacta saldos y se muestra separado del historial" |
| REI-11 | transactions | Bloque "Reintegros a confirmar" | Arriba del listado, en el módulo global y en el detalle de la cuenta de acreditación; no se renderiza si está vacío | Sí | Sí | `transactions` — idem / "La app nativa muestra los reintegros pendientes accionables en el feed" |
| REI-12 | transactions | `estimated_amount` inmutable | Conserva lo que el usuario esperaba, para auditar la diferencia contra lo recibido | Sí | Sí | `transactions` — idem |
| REI-13 | transactions | Confirmar = reconciliar monto + fecha | Setea `received_at`, sobrescribe `amount` y `date`, no toca `estimated_amount`; sin selector de cuenta ni de período | Sí | Sí | `transactions` — "El usuario confirma un reintegro reconciliando monto, fecha y destino" |
| REI-14 | transactions | Período "en resumen" derivado de la fecha | Server-side vía `getOrCreatePeriodForDate`; rechaza si el período ya fue pagado | Sí | Sí | `transactions` — idem |
| REI-15 | transactions | Reintegro "a cuenta" recibido suma al saldo | Movimiento entrante en la cuenta de acreditación (que puede diferir de la del gasto) | Sí | Sí | `transactions` — "El reintegro «a cuenta» recibido impacta el saldo de la cuenta" |
| REI-16 | transactions | Reintegro "en resumen" recibido reduce el período | Resta del total a pagar; no toca el disponible hasta que se paga el resumen | Sí | Sí | `transactions` — "El reintegro «en resumen» recibido reduce el total del período de tarjeta" |
| REI-17 | transactions | Cancelar un reintegro que nunca llegó | Setea `cancelled_at`; recibido y cancelado son mutuamente excluyentes; no aparece en ningún historial | Sí | Sí | `transactions` — "El usuario puede cancelar un reintegro que nunca llegó" |
| REI-18 | transactions | Borrar el gasto elimina sus reintegros | `ON DELETE CASCADE` | Sí | Sí | `transactions` — "La edición y el borrado del gasto origen protegen el vínculo del reintegro" |
| REI-19 | transactions | El detalle del reintegro enlaza al gasto | Referencia clickeable + subtipo + estado + categoría derivada; muestra el esperado si difiere del recibido | Sí | Sí | `transactions` — "El detalle de un reintegro muestra el gasto vinculado" |
| REI-20 | transactions | Gestionar el reintegro al **editar** el gasto | Agregar / editar / quitar mientras esté **pendiente**; recibido o cancelado se muestra read-only | Sí | Sí | `transactions` — "El usuario puede agregar, editar o quitar un reintegro al editar un gasto" |
| REI-21 | transactions | Descompartir arrastra el split del reintegro | Al descompartir el gasto en la misma edición, el reintegro pierde el split heredado | Sí | Sí | `transactions` — idem |
| REI-22 | transactions | Categoría de sistema "Reintegros / Cashback" retirada | `is_active=false`; no se ofrece en cargas nuevas, el historial queda intacto | Sí | Sí | `transactions` — "La categoría de sistema «Reintegros / Cashback» se retira" |

## A.9 · Recurrencias (`transactions`, `shared-recurrences`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| REC-01 | transactions | Crear regla recurrente desde cero | Sin movimiento semilla: `created_from_transaction_id = NULL`, `last_generated_date = NULL`; no crea transacción ni instancia | Sí (modal) | Sí (`/transactions/recurring/new`) | `transactions` — "El usuario puede crear una regla recurrente directamente, sin movimiento de origen" |
| REC-02 | transactions | Tipos admitidos | `income`, `expense`, `transfer`. **Ajustes y compras en cuotas no admiten recurrencia** | Sí | Sí | `transactions` — idem / "Las recurrencias iniciales excluyen ajustes y compras en cuotas" |
| REC-03 | transactions | Validaciones de la regla | Categoría en income/expense; destino ≠ origen y sin categoría en transfer; monto > 0; moneda activa de la cuenta; `end_date ≥ start_date` | Sí | Sí | `transactions` — idem |
| REC-04 | transactions | Regla en tarjeta USD sin FX al crearse | El tipo de cambio se pide al confirmar cada instancia | Sí | Sí | `transactions` — idem |
| REC-05 | transactions | Crear recurrencia al registrar un movimiento | Toggle "Repetir"; la regla es una entidad separada del movimiento | Sí | Sí | `transactions` — "El usuario puede crear una regla recurrente al registrar un movimiento" |
| REC-06 | transactions | Semilla condicionada por la fecha | `date <= hoy_AR` → crea el movimiento real y lo enlaza. `date > hoy_AR` → **no** crea nada: solo la regla con `start_date` = esa fecha | Sí | Sí | `transactions` — idem |
| REC-07 | transactions | Frecuencia intervalo + unidad | `interval_count` + `interval_unit` (`day/week/month/year`); presets `weekly/biweekly/monthly/annual` + `custom` | Sí | Sí | `transactions` — idem |
| REC-08 | transactions | Condición de fin opcional | `end_date` y/o `max_occurrences`, pueden coexistir; corta por la primera que se cumpla | Sí | Sí | `transactions` — "La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin" |
| REC-09 | transactions | Regla del cursor en la generación | `last_generated_date` NULL → primera instancia **exactamente** en `start_date`; no NULL → aplica el intervalo sobre el cursor | Sí | Sí | `transactions` — idem |
| REC-10 | transactions | Clamping de fin de mes | 31-ene + 1 mes ⇒ 28/29-feb | Sí | Sí | `transactions` — idem |
| REC-11 | transactions | Sin instancias retroactivas | Un `start_date` pasado genera **una** instancia pendiente fechada en `start_date`, no una por período vencido | Sí | Sí | `transactions` — idem |
| REC-12 | transactions | Instancia pendiente ≠ transacción real | Entidad separada; no impacta saldos, resúmenes ni `period_payments`; `transactions.status` queda reservado para tarjeta | Sí | Sí | `transactions` — "Las instancias recurrentes pendientes no son transacciones reales" |
| REC-13 | transactions | Una sola instancia pendiente por regla | La siguiente se genera recién al confirmar u omitir la actual | Sí | Sí | `transactions` — "El sistema genera instancias recurrentes de forma secuencial" |
| REC-14 | transactions | Confirmar instancia | Crea la transacción real con el mismo contrato que un alta manual; vincula por `confirmed_transaction_id` | Sí | Sí | `transactions` — "El usuario puede confirmar una instancia recurrente" |
| REC-15 | transactions | Confirmar en período pagado falla | Error explicativo; la instancia queda pendiente para editar la fecha u omitir | Sí | Sí | `transactions` — idem |
| REC-16 | transactions | Omitir instancia | Resuelve sin crear transacción; queda visible como "Omitida" en el historial de la regla | Sí | Sí | `transactions` — "El usuario puede omitir una instancia recurrente" |
| REC-17 | transactions | Editar la instancia antes de confirmar | Fecha/descripción/categoría son puntuales; **cambiar el monto actualiza también la regla** | Sí | **No** (mobile confirma con el snapshot) | `transactions` — "El usuario puede editar una instancia antes de confirmarla" |
| REC-18 | transactions | Bloque de pendientes separado del historial | Arriba del listado, con confirmar / editar / omitir | Sí | Parcial (confirmar/omitir) | `transactions` — "El modulo Movimientos muestra pendientes recurrentes separados del historial" |
| REC-19 | transactions | Hub `/transactions/recurring` | Lista reglas con tipo, monto, cuenta, frecuencia, próxima fecha e indicador de instancia pendiente | Sí | Sí (tabs Activas/Pausadas/Finalizadas) | `transactions` — "El usuario puede gestionar, pausar y eliminar reglas recurrentes" |
| REC-20 | transactions | Pausar / reactivar / eliminar reglas | Pausada no genera instancias; eliminar es soft-delete y conserva las transacciones confirmadas | Sí | Sí | `transactions` — idem |
| REC-21 | transactions | Detalle read-only + edición en drawer | Monto protagonista + metadatos; acciones como icon-buttons directos en el header (no dropdown) | Sí | Sí | `transactions` — "El detalle de una regla recurrente usa vista read-only + edición en drawer" |
| REC-22 | transactions | Field set mutable acotado | Solo monto, frecuencia, fecha de fin y descripción; cuenta, categoría y tipo se fijan al alta | Sí | Sí (mobile además sin `custom`) | `transactions` — idem / "La app nativa edita los campos mutables de una regla recurrente" |
| REC-23 | transactions | Historial de instancias de la regla | Lista `pending`/`confirmed`/`skipped` con fecha, monto y estado; las omitidas no se borran | Sí | Sí | `transactions` — "El detalle de una regla recurrente muestra el historial de sus instancias" |
| REC-24 | transactions | Sugerencia de recurrencia por patrón | Banner con aceptar / editar antes de crear / descartar; el descarte se persiste por fingerprint | Sí | Sí | `transactions` — "El sistema puede sugerir recurrencias por patrones repetidos" |
| REC-25 | transactions | Materialización perezosa de instancias vencidas | Fire-and-forget al enfocar el hub, idempotente, sin bloquear el read | Sí | Sí | `transactions` — "La app nativa expone el hub de recurrencias `/transactions/recurring`" |
| REC-26 | transactions | Toggle "Repetir" comunica su propósito | Nota siempre visible + hint **con color** al activar; el hint no se persiste en `user_guidance_events` | Sí | Parcial | `transactions` — "El toggle de recurrencia comunica su propósito" |
| REC-27 | transactions | Grafo de recurrencias isomórfico | Reads, generador, detección y mutations en `@grana/recurrences` sobre `GranaSupabaseClient` | Sí | Sí | `transactions` — "El grafo de recurrencias es isomórfico en `@grana/recurrences`" |
| REC-28 | transactions | Proyección "Próximos 7 días" / "Más adelante este mes" | Cards informativas del hub que proyectan ocurrencias futuras por moneda, sin escribir en DB | Sí | No | **Sin requirement** — lo agrega el change activo `fix-recurrence-projection-and-orphans` (ver E) |
| REC-29 | shared-recurrences | Regla de gasto compartida con el hogar | `household_id` + `default_split` (suman 100); **estructural al alta**, no editable después | Sí | Sí | `shared-recurrences` — "Una regla de recurrencia de gasto puede ser compartida con un hogar" |
| REC-30 | shared-recurrences | Herencia del split desde el movimiento semilla | Copia `household_id` y arma el `default_split` desde las filas `shared_expense_split` del gasto | Sí | Sí | `shared-recurrences` — "Una recurrencia creada desde un movimiento compartido hereda su split" |
| REC-31 | shared-recurrences | La instancia hereda hogar y split como snapshot | `split` propio en la instancia (distinto del template), para habilitar override por instancia a futuro | Sí | Sí | `shared-recurrences` — "La instancia generada hereda el hogar y el split de la regla" |
| REC-32 | shared-recurrences | Instancia compartida pendiente = base caja | No genera deuda ni impacta el gasto hasta confirmarse | Sí | Sí | `shared-recurrences` — "La instancia pendiente compartida no genera deuda ni impacta el gasto" |
| REC-33 | shared-recurrences | Confirmar crea un gasto compartido | Reutiliza el alta con `shared = { household_id, splits }`; la deuda se deriva como con cualquier gasto compartido manual | Sí | Sí | `shared-recurrences` — "Confirmar una instancia compartida crea un gasto compartido" |
| REC-34 | shared-recurrences | Sello "Compartido" en el hub | Las instancias con `household_id` se marcan antes de confirmar; la confirmación vive **solo** en el hub | Sí | Sí | `shared-recurrences` — "El hub de recurrencias señala las instancias compartidas" |
| REC-35 | shared | Salir del hogar bloqueado por recurrencia compartida activa | Guard server-side junto al de deuda viva y liquidaciones pendientes | Sí | Sí | `shared` — "El usuario puede salir del hogar solo si no hay deuda viva" |

## A.10 · Categorías (`categories`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| CAT-01 | categories | Catálogo de sistema | 18 categorías padre (13 expense + 5 income) y 71 subcategorías, `user_id = NULL`, visibles para todos | Sí | Sí | `categories` — "Catálogo de categorías del sistema" |
| CAT-02 | categories | Catálogo enfocado en Argentina | Marcas locales (Netflix, PedidosYa, Rappi, Uber/Cabify) y rubros AR (Monotributo, Expensas, Prepaga, SUBE, VTV, Patente, Aguinaldo, Compra dólar/MEP) | Sí | Sí | `categories` — idem |
| CAT-03 | categories | Enriquecimiento aditivo del catálogo | Migraciones incrementales con `INSERT … ON CONFLICT DO NOTHING`; nunca se edita el seed ni un `canonical_name` | N/A | N/A | `categories` — idem |
| CAT-04 | categories | Categorías de sistema inmutables | Ningún usuario puede editarlas, archivarlas ni eliminarlas (bloqueado por RLS) | Sí | Sí | `categories` — idem |
| CAT-05 | categories | `canonical_name` inmutable y único | Slug derivado del nombre inicial; único por `user_id`; cambiar el `name` no lo altera | Sí | Sí | `categories` — "canonical_name inmutable en categorías" |
| CAT-06 | categories | Crear categoría propia | Nombre 1–60, tipo `expense`/`income`/`both`, ícono y color opcionales | Sí (drawer) | Sí (pantalla pusheada) | `categories` — "El usuario puede crear categorías propias" |
| CAT-07 | categories | Editar categoría propia | `name`, `icon`, `color`; el tipo no se edita | Sí (drawer) | Sí (pantalla pusheada) | `categories` — "El usuario puede editar sus categorías propias" |
| CAT-08 | categories | Picker de ícono (grilla de emojis) | Popover con grilla curada + opción "Sin ícono"; se persiste como string emoji | Sí | Sí | `categories` — "La selección de ícono y color de una categoría es por picker (web)" |
| CAT-09 | categories | Picker de color (paleta + custom) | Swatches `#RRGGBB` + selector nativo + "Sin color" | Sí | Sí | `categories` — idem |
| CAT-10 | categories | Archivar categoría propia | Soft delete `is_active=false`; el historial conserva el nombre | Sí | Sí | `categories` — "El usuario puede archivar sus categorías propias" |
| CAT-11 | categories | El ocultamiento alcanza los dos niveles | Ninguna subcategoría inactiva se ofrece, esté su padre activo o no; se filtra **en el read**, no en cada consumer | Sí | Sí | `categories` — idem |
| CAT-12 | categories | Desaparición inmediata (sin esperar cache) | Archivar/eliminar saca el ítem del selector en la sesión en curso, sin recargar la app | Sí | Sí | `categories` — idem |
| CAT-13 | categories | Eliminar categoría solo si no está en uso | "En uso" = referenciada por `transactions`, `recurrences` o `recurrence_instances`, directa o vía subcategorías hijas | Sí | Sí | `categories` — idem |
| CAT-14 | categories | Guard doble: aplicación + FK `ON DELETE RESTRICT` | El cliente pre-consulta para dar un mensaje accionable; la DB es la última barrera para todo cliente | Sí | Sí | `categories` — idem |
| CAT-15 | categories | Crear subcategoría | Bajo cualquier categoría activa (propia o de sistema); `user_id = auth.uid()`; sin anidamiento | Sí (drawer) | Sí (pantalla pusheada) | `categories` — "El usuario puede crear subcategorías" |
| CAT-16 | categories | `canonical_name` único por categoría | UNIQUE `(category_id, canonical_name)`; colisión → Postgres `23505` traducido a i18n | Sí | Sí | `categories` — idem |
| CAT-17 | categories | Editar/archivar subcategoría propia | La gestión depende del dueño de **esa** subcategoría, no de la categoría padre | Sí (solo archivar/eliminar) | Sí (solo archivar/eliminar) | `categories` — "El usuario puede editar y archivar sus subcategorías" |
| CAT-18 | categories | Subcategoría propia bajo categoría de sistema | Es gestionable; las de sistema se muestran read-only en la misma lista | Sí | Sí | `categories` — idem |
| CAT-19 | categories | Nombres de sistema traducibles | `canonical_name` como clave i18n (`categories.*` / `subcategories.*`); las propias usan el `name` de DB como fallback | Sí | Sí | `categories` — "Nombres de categorías del sistema son traducibles" |
| CAT-20 | categories | Pantalla de gestión en Configuración | Lista agrupada, sistema sin acciones, propias con acciones, acceso a subcategorías para todas | Sí | Sí | `categories` — "Visualización de categorías en Configuración" |
| CAT-21 | categories | Alta/edición en drawer (web) | Disparado desde el listado/fila, sin cambiar de URL; el estado del drawer no vive en la URL | Sí | No (divergencia deliberada) | `categories` — idem / "Creación de subcategoría en drawer desde Configuración (web)" |
| CAT-22 | categories | Páginas dedicadas como fallback no-JS | `/settings/categories/new`, `/[id]/edit`, `/[id]/subcategories/new` renderizan el mismo form en `variant="page"` | Sí | N/A | `categories` — idem |
| CAT-23 | categories | Alta/edición como pantalla pusheada (mobile) | `FormScreen` con `PageHeader` navy + back-link; back de Android/gesto iOS popean sin guardar | N/A | Sí | `categories` — "Crear categoría propia en mobile" / "Edición de categoría propia en mobile" |

## A.11 · Dashboard / Inicio (`dashboard`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| DASH-01 | dashboard | Landing universal `/dashboard` | Único destino tras login, signup confirmado con onboarding hecho, y fin del onboarding | Sí | Sí | `dashboard` — "La pantalla dashboard es la landing universal post-login y post-onboarding" |
| DASH-02 | dashboard | Layout multi-columna en desktop | `lg+`: fila 1 (Para gastar + Dónde está), fila 2 (Balance del mes + Comprometido), luego full-width Compartido → Gastaste este mes → ¿En qué gasté? | Sí | N/A (mobile apila) | `dashboard` — "El dashboard usa un layout multi-columna en desktop (web)" |
| DASH-03 | dashboard | Saludo con nombre + fecha financiera | `Hola, {name}.` con fallback `Hola.`; fecha derivada de `getTodayAR()`, nunca `new Date()` | Sí | Sí | `dashboard` — "El header del dashboard saluda al usuario y muestra la fecha de hoy" |
| DASH-04 | dashboard | Header desde el primer paint | Header + providers montados desde `layout.tsx` (Variant C); `page.tsx` sync; controles disabled mientras carga el perfil | Sí | Sí | `dashboard` — idem / "La pantalla `(app)/dashboard` mobile renderiza…" |
| DASH-05 | dashboard | Navegador mensual compartido | `‹ Mes Año ›` en context client-side; hasta 12 meses atrás; flecha derecha disabled en el mes actual; no toca la URL ni persiste | Sí (header) | Sí (dentro del header navy) | `dashboard` — "El selector de mes del dashboard gobierna las secciones mensuales" |
| DASH-06 | dashboard | El selector no mueve el ancla de hoy | No afecta Hero, "Dónde está", "vas {neto} este mes" ni "Comprometido" | Sí | Sí | `dashboard` — idem |
| DASH-07 | dashboard | CTA "Nuevo movimiento" (desktop-web) | Abre el drawer sin navegar; **no se renderiza** en viewport `<sm` (ahí manda el FAB) | Sí | N/A | `dashboard` — "El header del dashboard ofrece un acceso primario para registrar un movimiento (web)" |
| DASH-08 | dashboard | Dashboard read-only | Ningún formulario ni mutación; todo click es navegación al módulo correspondiente | Sí | Sí | `dashboard` — "La pantalla dashboard es read-only" |
| DASH-09 | dashboard | Hero "Para gastar · hoy" | Card navy con ARS grande + chip USD; suma solo cuentas activas `cash`/`bank`; respeta off-ledger | Sí | Sí | `dashboard` — "El Hero muestra el disponible total bimoneda" |
| DASH-10 | dashboard | El Hero muestra `u$s 0,00` aunque no haya USD | Bimoneda por defecto: no se oculta la línea | Sí | Sí | `dashboard` — idem |
| DASH-11 | dashboard | Card "Dónde está" | Callout de concentración (% de la cuenta dominante) + barra proporcional por cuenta + grilla compacta de 2 columnas + celda "En dólares" | Sí | Sí | `dashboard` — "La card «Dónde está» desglosa las cuentas del usuario" |
| DASH-12 | dashboard | Rótulo por institución con fallback | Muestra `institutionName`; si no existe, el `name` del usuario (p. ej. efectivo) | Sí | Sí | `dashboard` — idem |
| DASH-13 | dashboard | `computeConcentration` compartida | Porcentaje dominante y anchos derivados de los datos; nunca hardcodeados | Sí | Sí | `dashboard` — idem |
| DASH-14 | dashboard | Truncado a 6 cuentas + "Ver todas" | El resto se ve en el módulo Cuentas | Sí | Sí | `dashboard` — idem |
| DASH-15 | dashboard | Una sola llamada alimenta la fila superior | Web: un container async con `getDashboardHero`. Mobile: `useDashboardHero()` dedupeado por queryKey | Sí | Sí | `dashboard` — idem |
| DASH-16 | dashboard | Eye toggle de privacidad | Enmascara todos los importes con `••••••`; client-side, no persiste; se resetea al salir/volver | Sí | Sí | `dashboard` — "El eye toggle enmascara todos los importes del dashboard" |
| DASH-17 | dashboard | El eye-mask no toca porcentajes | Labels, fechas, categorías y porcentajes siguen visibles | Sí | Sí | `dashboard` — idem |
| DASH-18 | dashboard | "Balance del mes" — neto + barras proporcionales | Eyebrow BALANCE, neto ARS grande con signo y color, filas con dot + label + monto + barra escalada contra `maxFlow` | Sí | Sí | `dashboard` — "La sección «Balance del mes» muestra el neto del mes con barras de ingresos y gastos" |
| DASH-19 | dashboard | Corte temporal de la sección | Ventana `[1° del mes, min(fin de mes, hoy_AR)]`; un mes futuro da serie vacía; un mes pasado se lee entero | Sí | Sí | `dashboard` — idem |
| DASH-20 | dashboard | Reconciliación `finalBalance` ↔ Disponible | Mismos signos que `calculateTransactionSums`, mismo universo de cuentas y mismo corte de día | Sí | Sí | `dashboard` — idem |
| DASH-21 | dashboard | Baldes por tipo de movimiento | Ingresos, Gastos, Ajustes (signado), Pago de tarjeta, Reintegros (plegados en Ingresos), Liquidaciones (signado), Cambio de moneda (signado por moneda), Transferencias (residuo sin fila) | Sí | Sí | `dashboard` — idem |
| DASH-22 | dashboard | Filas condicionales | Ingresos y Gastos siempre; Ajustes, Pago de tarjeta, Liquidaciones y Cambio de moneda solo si el mes las tiene | Sí | Sí | `dashboard` — idem |
| DASH-23 | dashboard | Aviso educativo bajo "Ajustes" | Voz Grana, atenuado, desde `dashboard.month.adjustment_note` | Sí | Sí | `dashboard` — idem |
| DASH-24 | dashboard | Chip "SIN REGISTRAR" en Ajustes | Ámbar/warning, uppercase, puramente presentacional | Sí | Sí | `dashboard` — "La fila «Ajustes» de «Balance del mes» marca el monto como sin registrar" |
| DASH-25 | dashboard | "vas {neto} este mes" anclado al mes en curso | Vive en el header de la card, no sigue al selector de mes | Sí | Sí | `dashboard` — "La sección «Balance del mes»…" |
| DASH-26 | dashboard | Strip USD al pie del balance | Chip USD + neto USD con signo + "Ingresos US$X · Gastos US$Y"; siempre visible (ceros si no hay actividad) | Sí | Sí | `dashboard` — idem |
| DASH-27 | dashboard | Sin gráfico de línea acumulada | `MonthBalanceChart` **no existe** en ninguna app; la serie diaria sigue en el package | Sí | Sí | `dashboard` — idem |
| DASH-28 | dashboard | "¿En qué gasté este mes?" | Dona SVG por categoría (`topN: 5` + "Otros") + leyenda con monto y porcentaje + toggle ARS/USD sin refetch | Sí | Sí | `dashboard` — "La sección «En qué se fue» muestra el desglose de gastos por categoría…" |
| DASH-29 | dashboard | Color de categoría desde DB | `slice.color` con fallback posicional a la paleta `cat-*`; sin hex inline | Sí | Sí | `dashboard` — idem |
| DASH-30 | dashboard | Barra proporcional por fila de la leyenda | Ancho = `monto / monto_máximo`, con el color de la categoría | Sí | Sí | `dashboard` — "La leyenda de «¿En qué gasté?» muestra una barra proporcional por categoría" |
| DASH-31 | dashboard | Créditos por categoría fuera de la dona | Netos negativos ("te devolvieron") en tono verde, sin barra y sin entrar al total de la dona | Sí | Sí | `dashboard` — "La sección «En qué se fue» muestra los créditos por categoría fuera de la dona" |
| DASH-32 | dashboard | Card "Comprometido" | Total a pagar = tarjeta a pagar + recurrencias pendientes de confirmar; **estática "desde hoy"**, no responde al selector de mes | Sí | Sí | `dashboard` — "La card «Comprometido» muestra los resúmenes de tarjeta y los gastos fijos del mes próximo" |
| DASH-33 | dashboard | Sección "Resúmenes de tarjeta" del Comprometido | "A pagar" + "En curso" sobre resúmenes ya empezados (`start_date <= hoy`); **excluye** los futuros | Sí | Sí | `dashboard` — idem |
| DASH-34 | dashboard | Sección "Recurrencias · pendientes de confirmar" | Instancias `status='pending'`; **no** proyecta "fijos del próximo mes" | Sí | Sí | `dashboard` — idem |
| DASH-35 | dashboard | Aviso "incluye $X vencido" | Solo cuando parte del monto a pagar corresponde a resúmenes con `due_date < hoy` | Sí | Sí | `dashboard` — idem |
| DASH-36 | dashboard | Contexto "Ya entra" + cierre neto | Ingreso recurrente proyectado del mes próximo como contexto; **no** suma al total a pagar; `transfer` no se cuenta | Sí | Sí | `dashboard` — idem |
| DASH-37 | dashboard | Etiqueta con fallback categoría/subcategoría | Descripción → subcategoría → categoría (nunca un guión si hay categoría) | Sí | Sí | `dashboard` — idem |
| DASH-38 | dashboard | Listado de movimientos priorizando Recurrencias | Se detallan los 3-4 de mayor monto de **una** sección; los subtotales de ambas siempre visibles | Sí | Sí | `dashboard` — idem |
| DASH-39 | dashboard | Sección "Gastaste este mes" | Barra de dos segmentos: "De tu caja" vs "Financiado en tarjeta" (`financiado = devengado − caja`); solo si hubo consumo de tarjeta | Sí | Sí | `dashboard` — "El dashboard muestra cuánto del gasto del mes se financió en tarjeta" |
| DASH-40 | dashboard | Tira "Compartido" | Neto del Hogar por moneda en una dirección; solo con actividad compartida; navega a `/shared` | Sí | **No** | `dashboard` — "El dashboard muestra el neto del Hogar cuando hay actividad compartida (web)" |
| DASH-41 | dashboard | Rótulo de la pregunta por sección | "¿Cuánto tengo?" / "¿Cómo se movió mi plata este mes?" / "¿En qué gasté este mes?" (título) / "Lo que ya sabemos del próximo mes" | Sí | Sí | `dashboard` — "Cada sección del dashboard rotula la pregunta que ayuda a responder" |
| DASH-42 | dashboard | Tolerancia a datos parciales | Cada sección con `<Suspense>` propio (web) o query TanStack propia (mobile), estado vacío neutral y error compacto con reintento | Sí | Sí | `dashboard` — "El dashboard tolera datos parciales sin romperse" |
| DASH-43 | dashboard | Skeletons shape-matched | `HeroSkeleton`, `MonthBalanceSkeleton`, `SpendingSkeleton`, `CommittedSkeleton`, `AccountsCardSkeleton`; nunca spinner ni "Cargando…" | Sí | Sí | `dashboard` — "Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched" |
| DASH-44 | dashboard | `min-height` estable sin layout shift | El hueco del skeleton iguala el del contenido y el del error compacto | Sí | Sí | `dashboard` — idem |
| DASH-45 | dashboard | Accesibilidad de los skeletons | `aria-busy` / `accessibilityState.busy` + label localizado por sección; los bloques internos son decorativos | Sí | Sí | `dashboard` — idem |
| DASH-46 | dashboard | `SkeletonBlock` respeta reduce-motion | En mobile, con "Reduce Motion" activo el bloque queda en opacidad estática ~0.7 | N/A | Sí | `dashboard` — idem |
| DASH-47 | dashboard | Queries del dashboard en package compartido | `@grana/dashboard` client-injected, RN-compatible, sin `react`/`next`/DOM/Node | Sí | Sí | `dashboard` — "Las queries y agregaciones del dashboard viven en un package compartido" |
| DASH-48 | dashboard | Naming espejo web↔mobile | Mismos nombres PascalCase y props públicas; sin JSX compartido | Sí | Sí | `dashboard` — "Los componentes del dashboard mobile siguen la convención de naming espejo del web" |
| DASH-49 | dashboard | Header navy + status bar light (mobile) | Navy de marca desde el mirror de tokens, respetando el safe-area top | N/A | Sí | `dashboard` — "El dashboard nativo pinta el header y la status bar con el navy de marca" |
| DASH-50 | dashboard | Pull-to-refresh ligado al gesto | El `RefreshControl` no se enciende por fetches internos de sección (p. ej. navegar de mes) | N/A | Sí | `dashboard` — "La pantalla `(app)/dashboard` mobile renderiza las secciones…" |

## A.12 · "En qué se fue" / gasto por categoría (`spending-by-category`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| SPEND-01 | spending-by-category | Desglose encabeza el módulo Movimientos | El listado sigue disponible debajo; un único selector de mes en toda la pantalla | Sí | No | `spending-by-category` — "El módulo Movimientos abre con un desglose de gastos por categoría del mes" |
| SPEND-02 | spending-by-category | Peso = neto por moneda | Gastos de la categoría − reintegros recibidos de esa categoría; ARS y USD nunca se suman | Sí | Sí (dashboard) | `spending-by-category` — "El desglose pesa por el neto de cada categoría, por moneda" |
| SPEND-03 | spending-by-category | Base devengado | Cuentan gastos cash/débito, consumos de tarjeta y **cada cuota** en el mes de su fecha | Sí | Sí | `spending-by-category` — idem |
| SPEND-04 | spending-by-category | Corte temporal de caja, no universal | Un gasto on-ledger con `date > hoy_AR` no cuenta; las filas de tarjeta **no** se cortan por día (cuentan desde el 1°) | Sí | Sí | `spending-by-category` — idem |
| SPEND-05 | spending-by-category | Semántica de fecha de las cuotas | Una compra de 12 cuotas aporta 1/12 por mes; la madre off-ledger **nunca** cuenta | Sí | Sí | `spending-by-category` — idem |
| SPEND-06 | spending-by-category | El pago de resumen no es gasto | Cancela deuda; nunca aparece en "En qué se fue" (sí puede aparecer en Balance del mes, lente CAJA) | Sí | Sí | `spending-by-category` — idem |
| SPEND-07 | spending-by-category | Netos negativos como créditos | No se descartan ni se capean a cero; se muestran fuera de la dona | Sí | Sí | `spending-by-category` — idem |
| SPEND-08 | spending-by-category | Donut + ranking + bucket "Otros" | Ordenado de mayor a menor con monto y porcentaje | Sí | Sí | `spending-by-category` — "El desglose se presenta como donut más ranking" |
| SPEND-09 | spending-by-category | Drill: lista que **reconcilia** con el donut | Misma lente CONSUMO; la suma de las filas iguala el peso de la categoría | Sí | **No** (mobile usa la lente CAJA) | `spending-by-category` — "Tocar una categoría abre sus movimientos" |
| SPEND-10 | spending-by-category | Reglas de composición de la lista drilleada | Cuotas por su cuota del mes (`n/total`), compartidos por la parte propia, reintegro como fila separada que resta, pago de resumen nunca | Sí | No | `spending-by-category` — idem |
| SPEND-11 | spending-by-category | Cada fila apunta a una transacción real | Abrir el detalle muestra la verdad cruda (total + parte) sin contradecir la fila | Sí | No | `spending-by-category` — idem |
| SPEND-12 | spending-by-category | Superponer otro filtro sale del drill | Con cuenta/tipo/monto/búsqueda vuelve a la lente CAJA y ya no se promete reconciliación | Sí | N/A | `spending-by-category` — idem |
| SPEND-13 | spending-by-category | Seleccionar subcategoría no revierte el donut | El donut permanece en modo subcategoría; tocar la seleccionada la deselecciona | Sí | No | `spending-by-category` — idem |
| SPEND-14 | spending-by-category | Volver a todas las categorías deja el estado limpio | El drill de egresos **no** fija filtro de moneda | Sí | N/A | `spending-by-category` — idem |
| SPEND-15 | spending-by-category | Navegación por mes del desglose | Mes actual por defecto según la zona financiera | Sí | Sí | `spending-by-category` — "El desglose navega por mes" |
| SPEND-16 | spending-by-category | Los compartidos cuentan solo la parte propia | `shared_expense_split.amount_assigned` del usuario, **sin importar quién cargó el gasto**; sin split propio → no aparece | Sí | Sí | `spending-by-category` — "El desglose cuenta la parte del miembro en los movimientos compartidos" |
| SPEND-17 | spending-by-category | Simetría en los reintegros compartidos | El reintegro netea solo la parte propia, para no doble-contar | Sí | Sí | `spending-by-category` — idem |
| SPEND-18 | spending-by-category | Lente compartida en `@grana/money-logic` | `categoryOwnPortion` y `countsAsCategorySpend` usadas por el donut y por la lista, con test de invariante | Sí | Sí | `spending-by-category` — nota de paridad |

## A.13 · Compartido / Hogar (`shared`)

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| SHR-01 | shared | Crear hogar compartido | `household` + `household_member` (junction, un miembro por fila); split default 50·50; nombre ≤50 | Sí | Sí | `shared` — "El usuario puede crear un hogar compartido" |
| SHR-02 | shared | Un usuario, un solo hogar activo | Enforced en la base como invariante de membresía | Sí | Sí | `shared` — "Un usuario pertenece a lo sumo a un hogar activo" |
| SHR-03 | shared | Invitar con código | Formato legible (`GRANA-XXXX`, sin caracteres ambiguos), vencimiento a 48 h, solo si hay cupo | Sí | Sí | `shared` — "El usuario puede invitar a otra persona con un código" |
| SHR-04 | shared | Unirse con código vía operación privilegiada | `SECURITY DEFINER` acotada al código: agrega miembro + marca la invitación usada + reconfigura split, atómicamente | Sí | Sí | `shared` — "El usuario puede unirse a un hogar con un código" |
| SHR-05 | shared | No se puede entrar por escritura directa | El self-insert solo está permitido para el creador como primer miembro de su propio hogar | Sí | Sí | `shared` — idem |
| SHR-06 | shared | Marcar un gasto como compartido | Toggle en el form (solo con hogar de 2); persiste `is_shared`, `household_id` y filas `shared_expense_split` | Sí | Sí | `shared` — "El usuario puede marcar un gasto como compartido con un split por porcentaje" |
| SHR-07 | shared | Split por porcentaje 0–100 | Suman exactamente 100; **0 es válido** (el gasto es 100 % del otro) | Sí | Sí | `shared` — idem |
| SHR-08 | shared | Toggle dedicado "es 100% de {nombre}" | Fija `{pagador:0, otro:100}` y oculta el campo libre; disponible en alta y en edición | Sí | Sí | `shared` — idem |
| SHR-09 | shared | El split **por defecto del hogar** sigue acotado a 1..99 | El 0/100 es una decisión por-gasto, no la norma del hogar | Sí | Sí | `shared` — idem |
| SHR-10 | shared | Reparto sin perder centavos | `Money.split` con reparto de residuo; la suma iguala exactamente el monto | Sí | Sí | `shared` — "El reparto de un split no pierde ni inventa centavos" |
| SHR-11 | shared | Gasto compartido en cuotas | Los splits van en cada **cuota hija**; la madre no tiene splits propios | Sí | Sí | `shared` — "Un gasto compartido de tarjeta en cuotas reparte el split en las cuotas hijas" |
| SHR-12 | shared | Deuda derivada por moneda, nunca persistida | Función pura de splits − liquidaciones; se recalcula en cada lectura; ARS y USD separados | Sí | Sí | `shared` — "La deuda neta del hogar se deriva por moneda y nunca se persiste" |
| SHR-13 | shared | Solo splits de transacciones compartidas | Un split legacy sobre una tx no compartida no contamina la deuda | Sí | Sí | `shared` — idem |
| SHR-14 | shared | Deudas menores al centavo → "están al día" | Se descartan por moneda | Sí | Sí | `shared` — idem |
| SHR-15 | shared | Las cuotas futuras no impactan la deuda hoy | Cada cuota impacta en el mes de su vencimiento | Sí | Sí | `shared` — "Las cuotas futuras no impactan la deuda hasta su vencimiento" |
| SHR-16 | shared | Reintegro compartido reduce la deuda | Hereda el split del gasto; solo el **recibido** afecta; ambos subtipos reducen por igual | Sí | Sí | `shared` — "El reintegro de un gasto compartido se reparte y reduce la deuda" |
| SHR-17 | shared | Home del hogar por mes | Navegador de mes que gobierna **solo** la actividad; deuda y proyección quedan fijas en "hoy" | Sí | Sí | `shared` — "El usuario puede ver el dashboard del hogar" |
| SHR-18 | shared | Hero "Gasto del hogar · neto" | Neto (`gastaron − reintegros`) protagonista, bruto y reintegros al costado, base **devengado**, bimoneda | Sí | Sí | `shared` — idem |
| SHR-19 | shared | "En qué gastaron" con drill inline | Desglose por categoría; tocar una categoría despliega sus movimientos sin navegar | Sí | Sí | `shared` — idem |
| SHR-20 | shared | Franja de deuda fija en "hoy" | Fuera del hero; lenguaje de relación entre personas; accesos a Saldar y a Ver el detalle | Sí | Sí | `shared` — idem |
| SHR-21 | shared | Tile "Lo que se viene" | Proyección derivada con `asOf` corrido por mes, independiente del navegador | Sí | Sí | `shared` — idem |
| SHR-22 | shared | "Últimos movimientos" como log de gastos | **Total** del movimiento como protagonista + "Tu parte: {monto}" como detalle; invariante a quién pagó | Sí | Sí | `shared` — idem |
| SHR-23 | shared | Un movimiento 100 % propio no repite la cifra | Si `ownShare == amount`, se oculta la línea "Tu parte" | Sí | Sí | `shared` — idem |
| SHR-24 | shared | Saldar deuda desde un drawer | Montos rápidos, cuenta de origen con saldo e identidad visual, fecha editable, anotación pedagógica, aviso de saldo negativo | Sí | Sí (pantalla `settle`) | `shared` — "El usuario puede saldar deuda registrando una liquidación" |
| SHR-25 | shared | Liquidación atómica con pata del pagador | Movimiento `settlement` (impacta saldo, **no** cuenta como gasto) + fila `settlement` pendiente, sin patas huérfanas | Sí | Sí | `shared` — idem |
| SHR-26 | shared | Sobrepagar invierte el saldo | Permitido y explicitado en el preview y en el estado "enviado", en vez de un `$0` silencioso | Sí | Sí | `shared` — idem |
| SHR-27 | shared | El receptor asigna la cuenta | Operación privilegiada atómica: valida caller, crea el movimiento entrante y marca la liquidación completada. Sin paso de aceptar/rechazar | Sí | Sí | `shared` — "El receptor asigna la cuenta donde recibió la liquidación" |
| SHR-28 | shared | `settlement` sin escritura directa del cliente | Todas las transiciones pasan por operaciones privilegiadas; no hay policy de UPDATE | Sí | Sí | `shared` — idem |
| SHR-29 | shared | Corrección libre mientras está pendiente | El pagador puede eliminar su propia liquidación; la fila cascadea y su saldo se restaura | Sí | Sí | `shared` — idem |
| SHR-30 | shared | Revertir una completada es **contraasiento** | La original queda `reversed` (no se borra) y se registra el asiento opuesto; ambas líneas quedan en el extracto | Sí | Sí | `shared` — "La reversión de una liquidación es un contraasiento, no un borrado" |
| SHR-31 | shared | Nombre del hogar readonly + drawer de edición | `Editar` neutro abre el drawer; `Guardar` es el único elemento verde | Sí | Sí | `shared` — "El nombre del hogar se presenta readonly y se edita en un drawer enfocado (web)" |
| SHR-32 | shared | Split por defecto readonly + drawer | Resumen de ambos integrantes; en edición el primero es editable y el segundo es `100 − primero` | Sí | Sí | `shared` — "El usuario puede configurar el split por defecto del hogar" |
| SHR-33 | shared | Salir del hogar con guards | Bloquea con deuda viva, liquidaciones pendientes o recurrencias compartidas activas; requiere confirmación por `Dialog` | Sí | Sí | `shared` — "El usuario puede salir del hogar solo si no hay deuda viva" |
| SHR-34 | shared | Monedas del hogar = ARS y USD | Sin tabla de configuración por hogar; sin conversión automática | Sí | Sí | `shared` — "Las monedas del hogar son ARS y USD por defecto" |
| SHR-35 | shared | RLS del módulo | Acceso acotado al propio hogar; las invitaciones solo son legibles por miembros; lectura acotada de cuentas del otro para liquidar | Sí | Sí | `shared` — "Un miembro puede leer los datos compartidos de su hogar" |
| SHR-36 | shared | El dueño de un split es miembro del hogar | Invariante en la base | Sí | Sí | `shared` — "El dueño de un split de gasto compartido es miembro del hogar" |
| SHR-37 | shared | Cuenta corriente ("Las cuentas entre ustedes") | Saldo por moneda + desglose colapsable + extracto con saldo corriente + divisor "Hoy" + "Lo que se viene" | Sí | Sí | `shared` — "El usuario puede ver la cuenta corriente del hogar" |
| SHR-38 | shared | El saldo final del extracto iguala la deuda derivada | Reconciliación exigida con `householdDebtAt` | Sí | Sí | `shared` — idem |
| SHR-39 | shared | Lenguaje llano sin jerga contable | "ver el detalle", "le debés a {name}", "pago" en vez de "liquidación"; se conserva "reintegro" | Sí | Sí | `shared` — "Las superficies visibles de Compartido usan lenguaje llano, sin jerga contable" |
| SHR-40 | shared | Invariante simétrico `is_shared` ↔ splits | Compartida con splits ⇒ suman su `amount`; no compartida ⇒ **ningún** split. Dos guardas diferidas complementarias | Sí | Sí | `shared` — "Los splits de un gasto compartido respetan un invariante simétrico con is_shared" |
| SHR-41 | shared | Guarda temporal `GRN01` | No se puede borrar **ni descompartir** un movimiento cubierto por una liquidación posterior en la misma moneda | Sí | Sí | `shared` — "No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior" |
| SHR-42 | shared | Descompartir es una RPC atómica | Deriva server-side el conjunto (raíz + cuotas + reintegros) desde **un solo id**; `SECURITY INVOKER` con validación de ownership explícita | Sí | Sí | `shared` — "Descompartir un gasto es una operación atómica sin splits huérfanos" |
| SHR-43 | shared | Home híbrido RSC + estado de cliente | Mes en context (no en `searchParams`); chrome visible y deshabilitado hasta estar listo; secciones independientes | Sí | Sí | `shared` — "El home de Compartido navega el mes y carga las secciones sin recargar la página" |
| SHR-44 | shared | Scope por mes vs "hoy" | Solo "Gasto del hogar" y "Últimos movimientos" reobtienen al cambiar de mes | Sí | Sí | `shared` — idem |
| SHR-45 | shared | Tab Hogar con tres estados | Sin hogar (setup inline) / esperando miembro (invitación) / hogar activo (dashboard con FAB) | N/A | Sí | `shared` — "El tab Hogar renderiza el módulo Compartido en la app nativa" |
| SHR-46 | shared | Subpantallas chromeless pusheadas | `settle`, `settings` y `cuenta-corriente` ocultan el tab bar y muestran `PageHeader` con back desde el primer paint | N/A | Sí | `shared` — "Las subpantallas de Compartido se pushean chromeless desde el tab Hogar" |

## A.14 · Configuración, guía e i18n

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| SET-01 | settings | Toggle "Mostrar centavos" | Controla decimales en **todos** los montos; default `false`; no altera cálculos | Sí (cookie 1 año) | Sí (`expo-secure-store`) | `settings` — "El usuario MUST poder activar o desactivar la visualización de centavos" |
| SET-02 | settings | La preferencia de centavos no se sincroniza entre plataformas | Cookie web y SecureStore mobile son independientes (divergencia documentada) | Sí | Sí | `settings` — "…en mobile (mobile)" |
| SET-03 | settings | Selector de idioma en `/settings` | Sección "Idioma" con fila descriptiva + control segmentado; etiquetas como **endónimos** ("Español", "English"), no localizadas | Sí | Sí | `settings` — "El usuario PUEDE cambiar el idioma de la app desde `/settings`" |
| SET-04 | settings | Footer global eliminado | Ningún `<footer>` del shell raíz; el `LanguageSwitcher` vive **solo** en `/settings` | Sí | N/A | `settings` — idem |
| SET-05 | settings | Acceso a gestión de categorías | Fila navegable a `/settings/categories` | Sí | Sí | `settings` — "El usuario MUST poder administrar sus categorías personalizadas desde configuración" |
| SET-06 | settings | Paridad de composición web↔mobile | Mismo título y mismas tres secciones en el mismo orden (Visualización, Idioma, Categorías) | Sí | Sí | `settings` — "El usuario MUST poder acceder a la pantalla de configuración en mobile" |
| SET-07 | settings | `PageHeader` custom en todo el stack de settings | Nunca el native stack header; las anidadas pasan `backLink`; cada pantalla usa `SafeAreaView edges={['top']}` | N/A | Sí | `settings` — idem |
| GUI-01 | guidance | Persistencia del ciclo de vida de las guías | `user_guidance_events` con `seen_at` / `dismissed_at` / `completed_at`, único por `(user_id, guidance_id)`, con RLS | Sí | No | `guidance` — "Sistema de persistencia de hints con granularidad clara" |
| GUI-02 | guidance | Hook `useGuidance(guidanceId)` | Devuelve `{ status, mark, isVisible }`; `isVisible = false` si fue dismissed o completed | Sí | No | `guidance` — "Hook `useGuidance(guidanceId)` para consulta y marcaje" |
| GUI-03 | guidance | Tour guiado del primer movimiento | Spotlight que arranca solo para usuarios sin movimientos, pasos Monto → Cuenta → Categoría → Descripción → Guardar | Sí | No | `guidance` — "Tour guiado del primer movimiento" |
| GUI-04 | guidance | Omitir / finalizar el tour | "Omitir guía" marca `dismissed_at`; finalizar marca `completed_at`; no vuelve a aparecer | Sí | No | `guidance` — idem |
| GUI-05 | guidance | El tour no aplica a tabs sin esos campos | Transferencia, Ajuste y Cambio quedan fuera | Sí | No | `guidance` — idem |
| GUI-06 | guidance | Primitivo `CoachmarkTour` reutilizable | Sin dependencias externas; mide el target, dibuja el recorte iluminado y se re-mide ante scroll/resize | Sí | No | `guidance` — "Primitivo CoachmarkTour reutilizable" |
| GUI-07 | guidance | Componente `InlineGuide` | Hint de una línea bajo un campo, dismissible con X | Sí (spec) / **sin call-sites** | No | `guidance` — "Componente InlineGuide para hints debajo de campos" (ver E) |
| GUI-08 | guidance | Componente `GuideCard` | Card educativa con CTA principal (marca `completed`) y "No ahora" (marca `dismissed`) | Sí (spec) / **sin call-sites** | No | `guidance` — "Componente GuideCard para sugerencias contextuales" (ver E) |
| GUI-09 | guidance | Mensaje post-save de impacto | Opcional (`MAY`) — solo si se engancha sin refactor mayor | No | No | `guidance` — "Post-save «impacto» para primer movimiento (OPCIONAL en Change 1)" |
| I18N-01 | i18n | Catálogos compartidos `@grana/i18n-messages` | `es.json` / `en.json` con paridad de claves enforced por `type Messages = typeof es` | Sí | Sí | `i18n` — "Mensajes localizados…" / "Cobertura i18n completa en rutas autenticadas web" |
| I18N-02 | i18n | Locale por cookie, no por URL | `NEXT_LOCALE`; sin segmento `[locale]`; bootstrapeada por el middleware; fallback a `es` | Sí | N/A | `i18n` — "La resolución de locale es vía cookie, no por URL" |
| I18N-03 | i18n | `LocaleProvider` mobile | `useLocale` / `setLocale` / `useT`; persiste en `expo-secure-store`; el cambio afecta **toda** la app | N/A | Sí | `i18n` — "Soporte multi-idioma en mobile vía LocaleProvider" |
| I18N-04 | i18n | Cobertura total de rutas autenticadas | Ningún string visible hardcodeado en `(app)/**` ni en los componentes compartidos que consume | Sí | Sí | `i18n` — "Cobertura i18n completa en rutas autenticadas web" |
| I18N-05 | i18n | Errores de Postgres traducidos | `translatePostgresError(code, dominio)` con fallback `<dominio>.errors.generic`; nunca `error.message` crudo | Sí | Sí (mapeo equivalente en mobile) | `i18n` — "Errores de server actions web devueltos como mensajes localizados" |
| I18N-06 | i18n | `RecurrenceMapError` traducido | Namespace `recurrences.mapper_errors.<code>` | Sí | Sí | `i18n` — idem |

## A.15 · Sistema de UI y plataforma

| ID | Módulo | Feature | Qué hace | Web | Mobile | Spec de origen |
|---|---|---|---|---|---|---|
| UI-01 | overlay-primitives | `Drawer` | Panel lateral sobre scrim, controlado, cierra por scrim y `Esc`, atrapa el foco y lo devuelve al trigger | Sí | Sí | `overlay-primitives` — "Drawer lateral con scrim y cierre estándar" |
| UI-02 | overlay-primitives | `Popover` | Anclado con flip, cierra por click afuera, `Esc` y scroll del contenedor; `max-height` con scroll interno | Sí | Sí (puede ser sheet) | `overlay-primitives` — "Popover anclado con cierre por afuera, scroll y Esc" |
| UI-03 | overlay-primitives | `Segmented` | Selección única con opciones deshabilitables individualmente | Sí | Sí | `overlay-primitives` — "Segmented control de selección única…" |
| UI-04 | overlay-primitives | `Switch` | On/off controlado con `role=switch` + `aria-checked`; respeta `disabled` | Sí | Sí | `overlay-primitives` — "Switch on/off controlado" |
| UI-05 | overlay-primitives | `Dialog` de confirmación | Centrado en `≥sm`, sheet inferior en `<sm`; sub-componentes Header/Body/Footer; CTA destructive por `Button`, no por variante del primitivo | Sí | Sí | `overlay-primitives` — "Dialog modal de confirmación con scrim, foco y errores tipados" |
| UI-06 | overlay-primitives | `Dialog` con CTA en loading sin cerrarse | El caller decide cuándo cerrar según el resultado del action; el error tipado se renderiza en el body | Sí | Sí | `overlay-primitives` — idem |
| UI-07 | overlay-primitives | `DropdownMenu` | Anclado con flip, `role="menu"`, roving focus con flechas, `Enter`/`Space` invoca, `Esc` cierra; un solo nivel | Sí | Sí | `overlay-primitives` — "DropdownMenu anclado a un trigger con items navegables por teclado" |
| UI-08 | money-input-calculator | Evaluación de expresiones aritméticas | `evaluateMoneyExpression` en `@grana/validation` con `decimal.js`, sin `eval`; `+ − × ÷`, paréntesis, unario, decimales es-AR; redondeo a 2 | Sí | Sí (package) | `money-input-calculator` — "Arithmetic expression evaluation" |
| UI-09 | money-input-calculator | Entrada de expresión inline en campos de monto | Mientras hay operador no emite valor canónico; resuelve en Enter o blur; expresión inválida se conserva para corregir | Sí | **No** | `money-input-calculator` — "Inline expression entry in money fields" |
| UI-10 | money-input-calculator | Teclado calculadora (popover) | Keypad con `+ − × ÷`, paréntesis/clear, display de expresión y `=`; opt-in por campo; portaleado al drawer para poder scrollear | Sí | **No** | `money-input-calculator` — "Calculator keypad popover on primary fields" |
| UI-11 | web-date-picker | `DatePicker` de un click | Abre directo el calendario de mes completo, sin paso intermedio | Sí | N/A | `web-date-picker` — "Selección de fecha que abre el mes completo" |
| UI-12 | web-date-picker | Atajo "Hoy" en zona financiera | Usa `getTodayAR()`, nunca el reloj del navegador | Sí | N/A | `web-date-picker` — "Atajo «Hoy» en zona financiera" |
| UI-13 | web-date-picker | Contrato ISO sin desfase de zona | Recibe y emite `YYYY-MM-DD`; round-trip sin corrimiento de día | Sí | N/A | `web-date-picker` — "Contrato de valor en ISO sin desfase de zona" |
| UI-14 | web-date-picker | Restricciones `min`/`max` | Deshabilita los días fuera de rango (p. ej. inicio de una recurrencia) | Sí | N/A | `web-date-picker` — "Restricciones de rango min/max" |
| UI-15 | web-date-picker | Cobertura total de campos de fecha | Ningún `<input type="date">` nativo queda en formularios web | Sí | N/A | `web-date-picker` — "Cobertura total de campos de fecha en la web" |
| UI-16 | route-loading-and-errors | Variant C (chrome en `layout.tsx` + `loading.tsx`) | Patrón por defecto para rutas nuevas; el header nunca se tapa con un spinner full-screen | Sí | Sí (equivalente) | `route-loading-and-errors` |
| UI-17 | route-loading-and-errors | `SectionFallback` / `RouteError` / `not-found` por segmento | Aislamiento de errores por sección con reintento localizado | Sí | Sí | `route-loading-and-errors` |
| UI-18 | web-responsive-layout | Piso de soporte 320 px | Contrato de presentación mobile-first que preserva el render de desktop | Sí | N/A | `web-responsive-layout` |
| UI-19 | page-header | `PageHeader` unificado | Título + subtítulo + `backLink` + slot de acciones; mismo lenguaje en web y mobile | Sí | Sí | `page-header` |
| UI-20 | mobile-app-shell | Tabs fijas + stacks pusheados | Inicio / Movimientos / Hogar / Menú; el resto se pushea desde Menú o desde una tab | N/A | Sí | `mobile-app-shell` |
| UI-21 | mobile-app-shell | Modo chromeless | Rutas que ocultan el tab bar (alta de movimiento, detalle de tarjeta, subpantallas de Hogar) | N/A | Sí | `mobile-app-shell` / `shared` |
| UI-22 | mobile-app-shell | Expo Go **no** es target de ejecución | La app depende de módulos nativos fuera del binario de Expo Go; se usa dev build | N/A | Sí | `mobile-app-shell` |
| UI-23 | web-app-shell | Sidebar + top-bar mobile + menú-drawer | Chrome persistente de `(app)`, peer del slot `{children}`; sin CTA de alta de movimiento | Sí | N/A | `web-app-shell` |
| UI-24 | ui-foundations | Tokens en `@grana/ui-tokens` con mirror nativo | `theme.css` + codegen a `tokens.cjs`; prohibido el hex inline en componentes | Sí | Sí | `ui-foundations` |
| UI-25 | ui-contracts | Contratos de props compartidos | `DrawerProps`, `PopoverProps`, `SegmentedProps`, `SwitchProps`, `ShowCentsToggleProps`, `LanguageSwitcherProps` | Sí | Sí | `overlay-primitives` / `settings` |
| UI-26 | web-data-access | Definición normativa única de "cuenta propia" | `type IN ('cash','bank') AND is_active = true` derivada de una sola fuente, no replicada por query | Sí | Sí | `web-data-access` / `dashboard` |
| UI-27 | web-data-access | Paginación server-side | No se paginan chunks descartando filas en el cliente | Sí | Sí | `web-data-access` |

---

# B. Reglas de negocio e invariantes

## B.1 · Invariantes con código

| Código | Qué garantiza | Dónde se enforza | Spec de origen |
|---|---|---|---|
| **I-CRED-1** | **Off-ledger de tarjetas.** Toda cuenta `type='credit'` tiene `initial_balance = 0` en todas sus monedas, y las transacciones `type='expense'` con `account.type='credit'` se excluyen del cálculo de saldo de **cualquier** cuenta, **en cualquier `status`** (`pending` y `paid` por igual). El único efecto sobre el disponible es indirecto: el `expense` de pago de resumen en una cuenta cash/bank. | Constraint `chk_credit_initial_balance`; helper centralizado del motor de saldos; tests unitarios y de integración | `cards` — "Las tarjetas no descuentan disponible hasta el pago del resumen" (**fuente normativa**; `accounts` y `transactions` la referencian sin redefinirla) |
| **I-CRED-6** | **Toda transacción de tarjeta tiene período.** Un `expense` con `is_parent=false` y `account.type='credit'` tiene `card_period_id NOT NULL` apuntando a un `card_periods` existente y `status ∈ {pending, paid}`. | Constraint NOT NULL condicional (trigger o CHECK con subquery) + validación en `registerCardPurchase` / `registerInstallments` | `cards` — "Toda transacción en tarjeta tiene un período asignado" |
| **I-CRED-7** | **Patrón madre/hija con la madre off-ledger.** Una compra en N≥2 cuotas genera una madre (`is_parent=true`, `account_id=NULL`, `status=NULL`, `card_period_id=NULL`) y N hijas (`parent_id`, `account_id=<tarjeta>`, `status='pending'`, `installment_n`, `installments_total`). La madre no impacta saldos ni totales de período. Las hijas transitan `pending → paid` **exclusivamente** por el flujo de pago de resumen. | Exclusión de `is_parent=true` en toda query de saldo; trigger / RLS / convención + revisión para el `UPDATE` manual de `status` | `cards` — "Las cuotas N>1 usan el patrón madre/hija con la madre off-ledger" |
| **I-CRED-9** | **Cuotas solo en ARS.** Una compra en N≥2 cuotas tiene `currency_code='ARS'`. | Validación en `registerInstallments` + constraint `chk_installments_ars_only` | `cards` — "Las cuotas N>1 solo aplican a transacciones en ARS" |
| **I-CRED-11** | **`fx_rate_to_ars` acotado.** Está populado (>0) **si y solo si** `account.type='credit'` AND `currency_code != 'ARS'` AND `type='expense'` AND `is_parent=false`. Modelo actualizado: el consumo USD en tarjeta **acepta NULL** (la conversión ocurre al pagar); el consumo ARS lo rechaza; los gastos no-credit lo aceptan cuando es >0 (pago de resumen); todo tipo no-expense lo rechaza. | Constraint `CHECK` con subquery sobre `accounts.type` (o trigger equivalente) + validación en las actions | `transactions` — "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS"; matizado por `cards` — "La cotización de la deuda USD se captura al pagar el resumen" |
| **I-CRED-12** | **Siempre ≥1 período abierto por delante de hoy.** Para toda cuenta `type='credit'` con `is_active=true` existe al menos un `card_periods` con estado derivado `open`. El mantenimiento es **lazy**: se genera al vuelo cuando una operación lo necesita, con `is_estimated=true`. Una tarjeta archivada queda exenta. | Generación lazy en el write path; UNIQUE `(account_id, start_date)` resuelve la race condition (el perdedor lee la fila del ganador y continúa) | `cards` — "El sistema mantiene siempre al menos un período abierto por delante de hoy" |
| **GRN01** | **Guarda temporal de Compartido.** No se puede borrar **ni descompartir** un movimiento compartido si existe una liquidación del mismo hogar, misma moneda y fecha ≥ la fecha de impacto del movimiento (`coalesce(due_date, date)`). | Triggers `BEFORE DELETE` y `BEFORE UPDATE` (acotado a `is_shared → false`) sobre `transactions`, por fila; lanzan `SQLSTATE GRN01` | `shared` — "No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior" |
| **GRN02** | **Orden cronológico inverso para deshacer un pago.** No se puede deshacer el pago de un resumen si existe un resumen posterior de la misma tarjeta ya pagado. | RPC `revert_card_period_payment` (mig. 0050) lanza `SQLSTATE GRN02` | `cards` — "Deshacer un pago exige orden cronológico inverso" |
| *(sin código)* | **Invariante simétrico `is_shared` ↔ splits.** Una transacción compartida **que porta splits** los tiene sumando exactamente su `amount`; una transacción **no** compartida no conserva **ningún** split. Evaluado por `transaction_id` y **diferido a fin de transacción**. La madre de cuotas compartida queda exenta del chequeo de suma (no porta splits propios). | Dos guardas complementarias: chequeo al mutar `shared_expense_split` (valida el estado final, sin early-return) + chequeo diferido sobre la transición `is_shared → false` | `shared` — "Los splits de un gasto compartido respetan un invariante simétrico con is_shared" |
| *(sin código)* | **Un usuario pertenece a lo sumo a un hogar activo.** | Invariante en la base sobre el alta de membresía (creador y unión privilegiada) | `shared` — "Un usuario pertenece a lo sumo a un hogar activo" |
| *(sin código)* | **El dueño de un split es miembro del hogar.** No se puede asignar una parte a un usuario ajeno al `household_id`. | Constraint/trigger en `shared_expense_split` | `shared` — "El dueño de un split de gasto compartido es miembro del hogar" |
| *(sin código)* | **Toda fecha confirmada fue ingresada cuando el banco ya la había anunciado.** P1 en el alta, P(n+1) al pagar P(n). `start_date` nunca se pide ni se estima. | Diseño del flujo de alta y de pago | `cards` — "El pago de un resumen confirma las fechas del período en curso…" |

## B.2 · Reglas "el sistema SHALL rechazar / bloquear / exigir"

### Cuentas y monedas
- **Rechaza** cuenta `cash` con `institution_id` no nulo (`chk_cash_no_institution`).
- **Rechaza** cuenta `bank` sin institución (`chk_bank_has_institution`), en validación y en DB.
- **Rechaza** `credit_limit` / `network_id` / `other_network_name` en cuentas no-`credit` (`chk_credit_columns_only_for_credit`).
- **Rechaza** moneda distinta de ARS/USD (`chk_account_currencies_supported`) y duplicados de `(account_id, currency_code)`.
- **Rechaza** desactivar una moneda con saldo derivado ≠ 0, o la última moneda activa.
- **Rechaza** cambiar `type` o el conjunto de monedas desde la edición (`updateAccountSchema` en modo `strict`).
- **Rechaza** eliminar una cuenta con al menos una transacción (propia o como destino de transferencia); la DB además bloquea por `ON DELETE RESTRICT` sobre `transfer_destination_account_id`.
- **Bloquea** archivar una tarjeta con algún período no-paid con transacciones imputadas → error tipado `pending_debt`.

### Tarjetas y períodos
- **Rechaza** `card_periods` con fechas no cronológicas (`chk_period_dates`) o `start_date` duplicado por cuenta (UNIQUE).
- **Rechaza** editar las fechas de un período `paid`.
- **Rechaza** la cascada de borde si el próximo período está pagado, o si `new_end_date >= next.end_date`.
- **Rechaza** registrar un consumo con fecha **anterior** al `start_date` del período más viejo (nombra la fecha de inicio del historial) y **no** crea períodos hacia atrás.
- **Rechaza** registrar un consumo con fecha dentro de un período `paid` → error tipado `period_already_paid`.
- **Rechaza** pagar un período cuyo estado derivado sea `open` o `paid` → `invalid_period_state`.
- **Exige** cotización (>0) al pagar un resumen con `pendingAmountUSD > 0`; sin ella no crea el gasto ni marca el período pagado.
- **Exige** que `next_end_date` sea posterior al cierre de P(n) y `next_due_date` posterior a `next_end_date`.
- **Rechaza** cambiar `network_id` / `other_network_name` post-creación (schema); **rechaza** ambos llenos o ambos vacíos en una tarjeta (`chk_network_xor`).
- **Rechaza** asignar `stamp_tax_rate` a una cuenta que no es `credit`.
- **Bloquea** deshacer un pago si hay un resumen posterior pagado (`GRN02`).
- **Rollback total** si cualquier paso de `payCardPeriod` o de la reversión falla — sin estados intermedios observables.

### Movimientos
- **Rechaza** monto ≤ 0 en ingreso/gasto/transferencia; monto = 0 en ajuste.
- **Rechaza** moneda no habilitada en la cuenta (y en **ambas** cuentas para transferencia).
- **Exige** categoría en ingreso y gasto; **rechaza** subcategoría que no pertenece a la categoría elegida.
- **Rechaza** transferencia con origen = destino, y "moneda destino" distinta de la origen (no hay conversión automática).
- **Rechaza** exchange con `currency_code == destination_currency`; **no ofrece** cuentas `credit` como origen ni destino.
- **Rechaza** compra en cuotas en moneda ≠ ARS (copy: "Las cuotas solo están disponibles en pesos").
- **Rechaza** cambiar `type`, `account_id`, `currency_code`, `is_parent` o `parent_id` post-creación (excepción única: la **cuenta** de un pago de resumen sí es editable).
- **Rechaza** cambiar monto o fecha de una fila con `parent_id` no nulo (cuota hija).
- **Rechaza** cambiar el monto de una madre de cuotas si **alguna** cuota está `paid` (categoría y descripción siguen editables).
- **Rechaza** cambiar monto o fecha de un consumo de tarjeta `paid`.
- **Rechaza** eliminar una compra en cuotas si alguna cuota está `paid`, y eliminar una cuota individual.
- **Bloquea** eliminar desde el detalle: cuota hija, consumo ya pagado, pata de liquidación del hogar y **pago de resumen** (se deshace desde el período).
- **Exige** que `linked_transaction_id` de un reintegro apunte a un `expense` **del mismo usuario**.
- **Rechaza** confirmar un reintegro "en resumen" contra un período ya pagado.
- **Rechaza** cancelar un reintegro ya recibido (recibido y cancelado son mutuamente excluyentes).
- **Rechaza** `movement_type = adjustment` (y compras en cuotas) como regla recurrente.
- **Rechaza** `end_date` anterior a `start_date` en una recurrencia.
- **Rechaza** confirmar una instancia recurrente de tarjeta cuya fecha cae en un período pagado.
- **Avisa sin bloquear** cuando la operación deja el disponible de **esa cuenta** y **esa moneda** por debajo de 0.

### Compartido
- **Rechaza** crear un segundo hogar si el usuario ya es miembro de uno activo.
- **Rechaza** nombre de hogar vacío o >50 caracteres.
- **Rechaza** invitar o unirse si el hogar ya tiene dos miembros.
- **Rechaza** un código vencido (>48 h) o ya usado, con error distinguible.
- **Rechaza** el self-insert directo en `household_member` fuera del creador de su propio hogar.
- **Rechaza** porcentajes que no suman exactamente 100, o fuera de `0..100`; el split **por defecto del hogar** además queda acotado a `1..99`.
- **Rechaza** UPDATE directo del cliente sobre `settlement` (no existe policy).
- **Rechaza** que un no-receptor confirme una liquidación.
- **Bloquea** salir del hogar con deuda viva, liquidaciones pendientes o recurrencias compartidas activas.
- **Rechaza** descompartir un movimiento ajeno con error explícito de ownership (no un "éxito" de cero filas).

### Categorías
- **Rechaza** (RLS) editar, archivar o eliminar categorías/subcategorías de sistema (`user_id IS NULL`).
- **Rechaza** eliminar una categoría/subcategoría **en uso** (guard de aplicación + FK `ON DELETE RESTRICT` como última barrera).
- **Rechaza** duplicar `canonical_name` por usuario, y `(category_id, canonical_name)` en subcategorías (`23505`).
- **Rechaza** nombre <1 o >60 caracteres.

### Auth y perfil
- **Rechaza** OTP que no sea exactamente 8 dígitos numéricos (antes de llamar a Supabase).
- **Rechaza** password <8 caracteres o sin letra + número, y confirmación que no coincide.
- **Rechaza** navegar fuera de la pantalla de verify ante `invalid_otp` / `otp_expired`.
- **No navega** a verify cuando `resetPasswordForEmail` devuelve `over_email_send_rate_limit` (sería engañoso: no se envió mail).
- **Rechaza** (RLS) leer o actualizar el profile de otro usuario; no hay policy de insert ni de delete.

### Transversales
- **Prohíbe** sumar o convertir ARS y USD en un mismo número, en toda superficie.
- **Prohíbe** aritmética binaria de JS sobre montos dentro del motor contable (solo `Money` / helpers decimales).
- **Prohíbe** `new Date()` directo en código financiero (siempre `getTodayAR()`).
- **Prohíbe** que un catálogo de categorías entregue ítems inactivos ("un read que los entrega es incorrecto; un consumer que los tapa esconde el defecto").
- **Prohíbe** devolver `error.message` crudo de Postgres como `formError`.
- **Prohíbe** hex inline en componentes (todo por tokens de `@grana/ui-tokens`).
- **Prohíbe** compartir JSX entre `apps/web` y `apps/mobile` (la paridad es de estructura y contrato, no de código de UI).

---

# C. Features removidas, revertidas o descartadas

> Recorrido completo de `openspec/changes/archive/` por `## REMOVED Requirements`, changes `remove-*` / `revert-*`,
> y specs que documentan algo "evaluado y descartado".

## C.1 · Funcionalidad retirada del producto

| Qué era | Cuándo | Motivo documentado |
|---|---|---|
| **Modos de usuario `novato` / `experto`** (`profiles.mode`) | 2026-05-27 · `remove-user-modes` | *"No esconden ningún diferencial de Grana"*: cuotas, bimoneda y contexto de inflación estaban disponibles para todos. La única diferencia real era que el novato no creaba cuentas, resoluble con un hint de primer uso. El alta de tarjeta novato a 1 fecha **calculaba mal los estimados**. Y pedirle al usuario que se autoclasifique es fricción y anti-patrón: *"la gente no sabe si es «novato» o «experto»"*, y la etiqueta choca con el pilar "pedagogía sin condescendencia". Conclusión: **una sola app para todos**. Se eliminó la columna, `createNovatoCreditCard`, `CreateNovatoCreditCardForm`, `createNovatoCreditCardSchema` y las claves i18n asociadas. |
| **Ocultar la creación de cuentas en modo novato** | Introducida 2026-05-26 (`hide-account-creation-novato`), **revertida** 2026-05-27 | Cae junto con los modos. *"Al desaparecer el modo novato, la creación de cuentas está disponible para todos… La profundidad la elige el usuario creando o no más cuentas"*. |
| **Pantalla de perfil del onboarding (modo + banco)** | 2026-05-27 · `remove-user-modes` | *"Al no haber modos, no hay pantalla de perfil que capture modo ni banco."* La `Billetera` default se provisiona al signup; las cuentas adicionales se crean después desde el módulo `accounts`. |
| **Creación atómica de cuenta bancaria en el onboarding** | 2026-05-27 · `remove-user-modes` | Se elimina con la pantalla de perfil. |
| **Onboarding novato que auto-creaba "Mi plata" + "Mi tarjeta"** | 2026-05-22 · `add-onboarding-post-signup` | Reemplazado por el wizard actual. *"El nuevo wizard NO crea tarjeta en onboarding… La cuenta `Billetera` ya la crea el trigger — no se necesita una segunda cuenta cash hardcodeada."* |
| **`reverseCardPayment` (v1)** — revertir un pago de resumen | 2026-05-21 · `remove-reverse-card-payment` | *"Decisión de UX vigente — los pagos de resumen son irreversibles."* El action y el `ReversePaymentDialog` existían en el código pero **ningún caller los importaba**, y el copy del form decía lo contrario. Migración propuesta en su momento: corregir con un `adjustment`. **⚠️ Esta decisión fue revertida el 2026-07-27** (ver C.2). |
| **Sección "Lo que viene" del dashboard** (compromisos y recurrencias a 14 días) | 2026-05-26 (web, `redesign-dashboard-home`) y 2026-06-03 (nativo, `dashboard-mobile-parity`) | *"La sección deja de existir en el producto."* Los compromisos siguen visibles en sus módulos: resúmenes en `/cards`, recurrencias en Movimientos → Recurrentes. `getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight` y los tipos `Upcoming*` fueron retirados de `@grana/dashboard` porque *"el package NO SHALL exportar código sin consumidores"*. |
| **`WelcomeFirstMoveCard`** (card de bienvenida del dashboard) | 2026-06-03 · `dashboard-mobile-parity` | Eliminada por el rediseño en ambas plataformas. |
| **Sección Tarjetas en el dashboard** (`CreditCardCarousel`) | 2026-05-26 · `dashboard-desktop-layout-and-cards-relocation` | *"Evitando duplicar la superficie y aligerando el dashboard a tres secciones."* El resumen de tarjetas vive únicamente en `/cards` (web) y se navega desde el `AppMenu` (nativo). El componente y `getCreditCards` siguen existiendo para el módulo `cards`. |
| **`CategoryTeaser`** (teaser de proporciones de 3 categorías) | 2026-05-26 / 2026-06-03 | *"Dejó de existir en ambas plataformas"*, reemplazado por la sección "En qué se fue" completa con dona y montos. |
| **`MonthBalanceChart`** (gráfico de línea acumulada del mes) | rediseño v2 | *"El componente no existe en ninguna de las dos apps"*. La serie diaria sigue disponible en el package para vistas futuras. |
| **Botón "+ Otro" / "Guardar y cargar otro"** del alta de movimiento | commit `c0580e36`, spec sincronizada 2026-06-05 (`sync-transactions-spec-drift`) | Se borró el botón, el ref+effect de re-focus, el handler y `onSubmitAndAddAnother` del hook compartido, más las claves i18n. *"La requirement quedó huérfana en la spec sin código que la respalde."* Migración: *"Ninguna. El producto no tenía usuarios al momento del refactor."* |
| **Hints `InlineGuide` del primer movimiento** (3 campos) | 2026-06-17 · `first-movement-tour` | *"El feedback de QA indicó que los hints de texto gris no se ven ni guían. Se reemplazan por el tour guiado."* |
| **Callback `/auth/callback` y links en los emails** | 2026-05-20 · `auth-otp-flow` | Los templates dejan de incluir links y pasan a mostrar solo el código OTP. La cookie `recovery_in_progress` desaparece: la única señal autoritativa es el claim `amr` del JWT. |
| **Pedido de fechas de P(n+2) al pagar un resumen** | 2026-06-11 · `capture-card-dates-at-statement` | *"Contradice el propio «Contexto del banco»: las fechas de un ciclo se anuncian recién cuando cierra el ciclo anterior."* El flujo obligaba a *"cargar cada fecha adivinada un resumen antes de ser anunciada, persistiéndola como real"*. Los períodos con fechas adivinadas **no se migran**: convergen al confirmarse en el próximo pago. |
| **`Footer` global de `apps/web/app/layout.tsx`** | change de settings (idioma) | El `LanguageSwitcher` se movió a `/settings`. *"NINGÚN otro componente SHALL renderizar el `LanguageSwitcher` fuera de `/settings`."* ⚠️ El spec de `i18n` todavía exige lo contrario (ver E). |
| **Bottom-sheet de alta de categoría en mobile** | 2026-08-02 · `mobile-keyboard-avoidance` | A ancho de teléfono el `Drawer` *"ocupa el 100% del ancho, deja de leerse como panel y pasa a ser una pantalla completa — pero sin las affordances de navegación de una"* (sin gesto de back iOS, sin back físico Android, cierre colgado de un único botón X). *"Con ese botón sin responder el usuario quedaba encerrado en el formulario, reportado en dispositivo."* Reemplazado por pantalla pusheada. |
| **Expo Go como target de ejecución** | 2026-08-05 · `mobile-native-dep-rebuild-docs` | *"La razón es estructural, no circunstancial: Expo Go es un binario fijo con un set cerrado de módulos nativos, y la app depende de módulos que no están en ese set."* No se revisa cuando cambie la lista de dependencias. |
| **Categoría de sistema "Reintegros / Cashback"** | change de reintegros | Se retira con `is_active = false` (no se elimina, para preservar el historial), porque *"el reintegro es un tipo de movimiento propio que hereda la categoría del gasto"*. |

## C.2 · Decisiones revertidas (el producto cambió de opinión)

| Decisión original | Reversión | Motivo de la reversión |
|---|---|---|
| **"Los pagos de resumen son irreversibles"** (2026-05-21) — errores se corrigen con un ajuste de saldo | **2026-07-27 · `revert-card-statement-payment`**: se implementa *deshacer el pago de un resumen* | *"Hoy un pago de resumen mal cargado es irreversible, y la app promete lo contrario."* El diálogo de "Eliminar" afirmaba que las cuotas volverían a pendientes, pero `deleteTransaction` fallaba contra la FK `RESTRICT` de `period_payments`. Y aunque el delete pasara, *"sería peor: los consumos quedarían en `paid` para siempre, el sello quedaría huérfano dentro de un resumen impago, y el resumen volvería a figurar como pagado sin pago."* Se acota: la reversión toca **la plata**, no **el calendario**. |
| **Card "Comprometido" = "lo del próximo mes"** | 2026-06-22 · `redesign-comprometido-card` | Bug de cálculo en producción: *"la card sumaba la deuda `pending` de TODOS los resúmenes impagos, incluidos los que vencen meses adelante (cuotas 2..N, períodos estimados). Inflaba el número (~2,7× en datos reales)."* Pasa a responder *"¿qué tengo que pagar y todavía no pagué?"* y a excluir los resúmenes futuros. |
| **No-goal de `/cards`: "NO agrega búsqueda, filtros ni ordenamiento"** | `redesign-cards-compact-view` | Se **deroga** en lo que respecta a filtros/orden/agrupado/colapso. *"Un input de búsqueda de texto libre SIGUE fuera de alcance."* |
| **No-goal de `/cards`: "NO introduce datos ni queries nuevas"** | idem | **Derogado**: se habilitan `institution.name`, `inUse` y las cifras "En curso" / monto por fila de próximos cierres. |
| **No-goal de `/cards`: "NO rediseñar el hero ni agregar KPIs nuevos"** | idem | **Derogado acotadamente** para la cifra "En curso" y la lista ampliada de próximos cierres. |
| **`recurrences.created_from_transaction_id` con `ON DELETE SET NULL`** | change activo `fix-recurrence-projection-and-orphans` | Borrar el movimiento semilla dejaba *"la regla viva, sin vínculo, indistinguible de una regla creada directamente"*. Pasa a `ON DELETE RESTRICT` con flujo de borrado en dos pasos. Marcado **BREAKING (schema)**. |

## C.3 · Evaluado y descartado (nunca se implementó)

| Qué se evaluó | Veredicto | Cita |
|---|---|---|
| Elegir `icon_type` (`bank` vs `wallet`) al crear una institución custom | Descartado; se fija siempre `'bank'` | *"la distinción `bank`/`wallet` fue evaluada y descartada como **ruido cognitivo** sin valor de producto; si en el futuro se necesita control fino del ícono, se expone como picker dedicado"* — `accounts` |
| Persistir un "modo de usuario" desde la bifurcación del onboarding | Descartado | *"La elección SHALL ser puramente de ruteo: NO SHALL persistir un «modo de usuario» ni reconfigurar la UI del resto de la app (eso queda fuera de alcance)."* — `onboarding` |
| Label de texto junto al back del detalle de movimiento | Descartado | *"el label de texto («← Visa Galicia», «← Movimientos») consume real estate sin agregar info crítica — el back del browser cumple el mismo rol semántico, y el ícono solo es el patrón estándar de banking/finance apps (v2, Mobills, Splid)"* — `transactions` |
| Kebab menu para las acciones del detalle de movimiento | Descartado en desktop; sobrevive solo como "···" para secundarias en mobile | `transactions` — el body del requirement lo reemplaza por acciones en la topbar |
| Deep-link de `/transactions` con filtros pre-aplicados | Fuera de alcance de la iteración | *"La ruta NO SHALL ser deep-linkeable con un filtro pre-aplicado en esta iteración."* — `transactions` |
| Badge de estado de liquidación por persona en el detalle de un gasto compartido | Descartado | *"**sin** badge «Te debe»/«Saldado» (el modelo no guarda el estado de liquidación por transacción)"* — `transactions` |
| Link "Ver el detalle →" en el footer del donut | Condicionado | *"NO SHALL renderizar un link «Ver el detalle →» salvo que exista un destino real al cual drill-downear"* — `transactions` |
| Persistencia del estado de colapso de grupos de banco entre sesiones | Fuera de v1 | `cards` — no-goals |
| "Uso de límite real" con cuotas futuras de todos los períodos | Fuera de v1 | `cards` — no-goals |
| Rail lateral de bancos en `/cards` | Fuera de v1 | `cards` — no-goals |
| Acciones nuevas por fila en `/cards` y `/accounts` (kebab extra, share, duplicar, exportar) | Prohibido por no-goal | *"el único gesto sobre la fila sigue siendo navegar a `/cards/[id]`"* — `cards`; *"no aparecen items nuevos como «Compartir», «Duplicar», «Exportar»"* — `accounts` |
| Totales globales por moneda en `/accounts` | Prohibido por no-goal | *"no existe ningún elemento visual que sume balances ARS de varias cuentas"* — `accounts` |
| Búsqueda / filtros / ordenamiento en `/accounts` | Prohibido por no-goal | *"El orden permanece el que devuelve la query (`created_at` ascendente)"* — `accounts` |
| Hero / overview / resumen por encima de las secciones de `/accounts` | Prohibido por no-goal | `accounts` |
| Avatar de cuenta dentro de los pickers de los formularios de transacción | Fuera de alcance (requiere dropdown custom) | *"el control actual es un `<select>` nativo y requiere un dropdown custom — change posterior"* — `accounts` |
| Editar subcategoría | No existe en ninguna plataforma y no se agrega | *"No existe hoy una ruta de editar subcategoría en web/mobile, por lo que no se propone un drawer nuevo"* — `docs/design/settings-category-drawers/` |
| Distribuir el pago de resumen entre las categorías de los consumos que cubrió | **Trabajo diferido** con TODO en el código | *"la query actual también excluye los pagos de resumen del breakdown, por lo cual el card spending hoy **no aparece** ni cuando devenga ni cuando se paga; el TODO en `getMonthCategoryBreakdown` documenta el walk pendiente"* — `transactions` |
| CTA de registrar en el encabezado pelado de `/transactions` (desktop-web) | **Gap conocido y aceptado** | *"restaurar un CTA en este encabezado pelado para desktop-web es follow-up explícito fuera de alcance de esta spec"* — `transactions` |
| Warning de saldo negativo al confirmar una instancia recurrente (mobile) | Diferido | *"nicety read-only que requiere el read de saldos por cuenta; su ausencia no bloquea el confirmar"* — `transactions` |
| Edición inline de monto/fecha/descripción al confirmar una instancia (mobile) | Diferido | *"En esta slice, confirmar SHALL usar el **snapshot** de la instancia"* — `transactions` |
| Tiles de contexto del detalle nativo ("Peso en el mes", recurrencia, composición del pago) | Fuera de alcance | *"la pantalla SHALL omitirlos sin romper para esos kinds"* — `transactions` |
| Filtros y breakdown por categoría en el feed nativo de Movimientos | Fuera de alcance declarado | *"La **barra de filtros** y el **breakdown por categoría** del feed web siguen explícitamente fuera de este alcance."* — `transactions` |
| Income compartido y compras de tarjeta recurrentes compartidas | Fuera de alcance | *"Income y compras de tarjeta recurrentes quedan fuera de alcance."* — `shared-recurrences` |
| Override del split por instancia recurrente | Modelado pero sin UI | *"El modelo de datos de la instancia SHALL soportar un `split` propio… aunque la UI para editarlo queda fuera de esta fase."* — `shared-recurrences` |
| Sub-menus en `DropdownMenu` | Descartado en el primitivo | *"El menu NO SHALL soportar sub-menus en este primitivo (un solo nivel). Si emerge necesidad, se evalúa en un change separado."* — `overlay-primitives` |
| Variantes "alert" / "info" / "destructive" en `Dialog` | Descartado | *"El Dialog NO SHALL imponer variantes… la semántica destructive se expresa vía `<Button variant="destructive">`, lo cual mantiene el primitivo agnóstico de uso."* — `overlay-primitives` |
| Componente `<Skeleton/>` wrapper en web | Descartado | *"NO SHALL introducirse un componente `<Skeleton/>` wrapper"* (web usa `div` con `animate-pulse` inline) — `dashboard` |
| Token único de string CSS para el gradient del hero | Descartado | *"no existe ningún token de la forma `--gradient-hero-navy: radial-gradient(...)`"*; se usan tres tokens separados para que el mirror nativo pueda consumirlos sin parsear CSS — `transactions` |
| Buscador dentro de los pickers de cuenta/categoría (mobile) | Descartado por paridad | *"El picker NO SHALL incluir buscador (paridad con web)."* — `transactions` |
| Filas de "Transferencias" en Balance del mes | Descartado deliberadamente | *"vale exactamente cero cuando las dos patas son propias — el caso normal —, así que una fila «Transferencias» mostraría siempre `$0` y ensuciaría la lectura"* — `dashboard` |
| Mensaje post-save de impacto del primer movimiento | `MAY`, condicionado | *"Si ensucia la arquitectura, MUST quedar fuera de Change 1."* — `guidance` |

---

# D. Decisiones de diseño explícitas

> Solo entradas donde un spec (o un handoff versionado) **justifica** por qué algo es así. Cita textual + fuente.

## D.1 · Modelo contable y lentes

| # | Decisión | Cita textual | Fuente |
|---|---|---|---|
| D-01 | Las tres lentes del dashboard difieren **a propósito** | *"Son lentes distintas a propósito: «En qué se fue» es **devengado** e incluye el consumo de tarjeta, mientras «Gastos» de Balance del mes es **caja** y solo cuenta lo que salió de una cuenta propia. La diferencia entre ambos es, justamente, el consumo de tarjeta del mes que aún no se pagó."* | `dashboard` — "La sección «Balance del mes»…" |
| D-02 | Cada card rotula su pregunta para hacer visible la diferencia de lentes | *"Para que quede claro que el dashboard mezcla **lentes distintas a propósito** (CAJA vs CONSUMO vs COMPROMISO) — y que dos números que miran cosas distintas no tienen por qué coincidir — cada sección SHALL comunicar la pregunta que ayuda a responder."* | `dashboard` — "Cada sección del dashboard rotula la pregunta que ayuda a responder" |
| D-03 | El título "¿En qué gasté este mes?" reemplaza a "En qué se fue" | *"El nombre evita el malentendido de «se fue»: hay plata que se gastó (tarjeta) pero todavía no salió de la caja."* | `dashboard` — idem |
| D-04 | "Cuenta propia" es un criterio único, derivado de una sola definición | *"El criterio NO SHALL replicarse a mano en cada query — SHALL derivarse de una única definición normativa compartida, de modo que Hero, «Dónde está», listado/detalle de cuentas y «Balance del mes» no puedan divergir por olvido."* | `dashboard` — "La sección «Balance del mes»…" |
| D-05 | Las transferencias se evalúan pata por pata, no se descartan de plano | *"El sistema NO SHALL descartar las transferencias de plano asumiendo que ambas patas son propias: esa suposición es la que hace divergir la serie del mes del Disponible."* | `dashboard` — idem |
| D-06 | El corte temporal es de caja, no universal | *"para la lente devengado la unidad de acumulación es el **mes**, no el día, así que la cuota o el consumo fechados más adelante en el mes en curso SHALL contar desde el día 1 — ya están incurridos, y esconderlos hasta que llegue su día haría que la dona arrancara vacía cada mes y se llenara sin que exista gasto nuevo."* | `spending-by-category` — "El desglose pesa por el neto de cada categoría, por moneda" |
| D-07 | Un día futuro no se emite como día de la serie | *"un día que todavía no llegó NO SHALL emitirse como día de la serie, porque una línea plana en un día futuro se lee como «no gasté» en vez de «todavía no pasó»."* | `dashboard` — "La sección «Balance del mes»…" |
| D-08 | Los netos negativos por categoría no se capean | *"El sistema NO SHALL descartar ni capear a cero esos netos negativos: SHALL mostrarlos como **créditos** («te devolvieron»), separados del peso de gasto y **fuera de la dona** (una dona no puede representar una porción negativa)."* | `spending-by-category` — idem |
| D-09 | La reconciliación del drill solo se promete en el drill puro | *"Si el usuario superpone **otro** filtro… ya no está en el drill puro… La reconciliación con el donut solo se promete en el estado de drill puro."* | `spending-by-category` — "Tocar una categoría abre sus movimientos" |
| D-10 | La cotización USD se captura al pagar, no al consumir | *"la conversión real ocurre recién al pagar el resumen, con la cotización del día de pago. El campo `fx_rate_to_ars` del consumo queda como dato opcional/histórico, sin uso contable en el alta."* | `cards` — "La cotización de la deuda USD se captura al pagar el resumen…" |
| D-11 | La cotización faltante **no** es motivo de revisión | *"un consumo USD en tarjeta sin cotización es el estado normal."* | `transactions` — "El módulo global de movimientos destaca movimientos que requieren revisión" |
| D-12 | El monto es editable pero la cotización es obligatoria | *"El monto final sigue siendo editable por el usuario (puede redondear o pagar parcial); la cotización es obligatoria, el monto no se fuerza."* | `cards` — idem |
| D-13 | Un ajuste es corrección de stock, no flujo | *"Un ajuste de saldo es una corrección del stock, no un flujo: NO SHALL sumarse a «Ingresos» ni a «Gastos»."* | `dashboard` — "La sección «Balance del mes»…" |
| D-14 | El reintegro no es ingreso genérico | *"El reintegro NO SHALL contarse como ingreso genérico en ningún total de «lo que entró»."* | `transactions` — "El reintegro es un tipo de movimiento propio vinculado al gasto" |
| D-15 | El pendiente es expectativa, no hecho | *"Los reintegros pendientes NO SHALL aparecer en el historial cronológico: SHALL listarse en un bloque «Reintegros a confirmar» arriba del listado… separando la expectativa del hecho."* | `transactions` — "Un reintegro pendiente no impacta saldos…" |
| D-16 | El sello se calcula sobre una base que lo excluye | *"la base usada es el total del resumen previo a la inserción del sello, de modo que el sello no se incluya en su propia base."* | `cards` — "El impuesto de sellos se registra como movimiento dentro del resumen pagado" |
| D-17 | La alícuota de sellos es oculta: se pregunta el **monto**, no el porcentaje | *"muestra un selector de montos en pesos… **y no se menciona ningún porcentaje al usuario**"* + *"el dato se pide solo esta vez y en los próximos resúmenes se sugerirá solo"* | `cards` — "El pago de un resumen incorpora el impuesto de sellos" |
| D-18 | Deshacer un pago toca la plata, no el calendario | *"La reversión NO SHALL deshacer los efectos del pago sobre el **calendario** de la tarjeta… Esas fechas son hechos del resumen real y no dependen de que el pago se haya cargado correctamente."* | `cards` — "El usuario puede deshacer el pago de un resumen" |
| D-19 | La alícuota aprendida sobrevive a la reversión | *"al volver a pagar el resumen el monto de sello viene pre-cargado, sin volver a preguntar como si fuera la primera vez."* | `cards` — idem |
| D-20 | El sello ambiguo se conserva en vez de borrarse | *"Si encuentra más de uno, NO SHALL borrar ninguno y SHALL completar la reversión informando que el movimiento de sello quedó en el resumen para revisión manual."* | `cards` — "El pago de un resumen registra el vínculo…" |
| D-21 | Cada fecha se pide en el único momento en que el banco ya la anunció | *"toda fecha de cierre/vencimiento confirmada (`is_estimated=false`) fue ingresada por el usuario en un momento en que el banco ya la había anunciado: P1 en el alta, P(n+1) al pagar P(n). `start_date` nunca se pide ni se estima."* | `cards` — "El pago de un resumen confirma las fechas del período en curso…" |
| D-22 | Un consumo previo al historial pertenece a un ciclo que Grana no trackea | *"El sistema NO SHALL crear períodos hacia atrás… Un consumo previo al historial pertenece a un ciclo que Grana no trackea (el registro empieza en el alta)."* | `cards` — "La asignación de una transacción a un período se persiste como FK" |
| D-23 | La madre de cuotas existe para no inventar movimientos futuros | *"las hijas SHALL NOT aparecer en el listado global por defecto para evitar movimientos futuros que el usuario no registró en esa fecha."* | `cards` — "Las cuotas N>1 usan el patrón madre/hija…" |
| D-24 | Editar una cuota aislada descuadraría la familia | *"editar una cuota hija en forma aislada descuadraría la familia (las N cuotas + la madre dejarían de sumar el total)."* | `transactions` — "Una cuota individual es inmutable…" |
| D-25 | El total del movimiento compartido es invariante a quién pagó | *"La fila NO SHALL mostrar rótulos de perspectiva de deuda que cambien de significado según el pagador («parte de {nombre}»): el detalle secundario es siempre la parte propia."* | `shared` — "El usuario puede ver el dashboard del hogar" |
| D-26 | El split 0/100 es una decisión por-gasto, no la norma del hogar | *"El split **por defecto del hogar** NO forma parte de esta relajación: su editor SHALL seguir acotado a `1..99`."* | `shared` — "El usuario puede marcar un gasto como compartido…" |
| D-27 | Revertir una liquidación es contraasiento, no borrado | *"NO SHALL borrarse físicamente ninguna fila."* El extracto conserva la original tachada como "Revertida" y el "Contraasiento". | `shared` — "La reversión de una liquidación es un contraasiento, no un borrado" |
| D-28 | Descompartir no puede reescribir un saldo ya liquidado | *"en el extracto esa liquidación quedó calculada sobre un saldo que incluía ese movimiento: borrarlo o descompartirlo reescribiría en silencio un saldo ya liquidado."* | `shared` — "No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior" |
| D-29 | Descompartir deriva el conjunto server-side, no desde el cliente | *"NO SHALL aceptar una lista arbitraria de ids provista por el cliente"* y valida ownership explícitamente porque *"un intento ajeno resultaría de otro modo en un UPDATE de cero filas y un «éxito» silencioso."* | `shared` — "Descompartir un gasto es una operación atómica sin splits huérfanos" |
| D-30 | Sobrepagar se explicita en vez de mostrar `$0` | *"el drawer SHALL explicitar esa inversión tanto en el preview como en el estado de «enviado»… en lugar de mostrar un `$0` silencioso."* | `shared` — "El usuario puede saldar deuda registrando una liquidación" |

## D.2 · Producto, UX y voz

| # | Decisión | Cita textual | Fuente |
|---|---|---|---|
| D-31 | La pedagogía in-context del off-ledger es un diferenciador propio | *"ninguna de las apps relevadas (YNAB, Mobills, Mint, Spendee, Copilot Money, Monarch Money) modela explícitamente el off-ledger ni el estado «esperado vs hecho» de los reintegros. Es un diferenciador propio de grana, que encaja con el tono editorial («sugiere y enseña, no condena»)… La fricción común en otras apps («¿por qué este consumo de tarjeta no bajó mi saldo?») se preempts directamente desde el detalle."* | `transactions` — "El detalle ofrece pedagogía in-context…" |
| D-32 | Solo se muestra estado cuando informa algo real | *"No existe estado «confirmado»: el detalle SHALL mostrar un estado **solo cuando informa algo real** — *Reintegrado*, *Completada*, *Acreditado*."* | `transactions` — "El usuario puede ver el detalle de una transacción" |
| D-33 | La app gestiona, no opera pagos | *"App de gestión, **NO** opera pagos: NUNCA mostrar número de tarjeta; solo **nombre + tipo** del medio de pago."* | `transactions` — idem |
| D-34 | El campo de texto libre se rotula "Descripción", no "Nota" | *"El campo de texto libre se rotula **«Descripción»** (no «Nota»)."* | `transactions` — idem |
| D-35 | Las acciones del listado viven pegadas al listado, no en el header | *"las acciones del listado (buscar, ver recurrencias, filtrar) viven en una **micro-toolbar pegada al listado**, donde tienen contexto inmediato con la lista sobre la que operan."* | `transactions` — "El encabezado de Movimientos es minimalista y pelado" |
| D-36 | El listado no duplica el panorama mensual | *"El resumen del período… es responsabilidad del **dashboard**, no del listado, para no duplicar el panorama mensual."* | `transactions` — "El listado de movimientos no muestra totales agregados" |
| D-37 | Navegar de mes no es filtrar | *"navegar de mes es navegación temporal, no un filtro de contenido"* — por eso el running balance sobrevive a la navegación por mes pero no a los filtros de contenido. | `transactions` — "El listado de una cuenta muestra el saldo corriente por fila" |
| D-38 | Un mes vacío no se confunde con un filtro sin resultados | *"La **navegación por mes** NO cuenta como filtro de contenido para esta clasificación (es una ventana temporal, no un filtro)."* | `transactions` — "El listado global distingue el motivo de un resultado vacío" |
| D-39 | El neto del mes se sacó del header por QA | *"el neto del mes en curso («vas {neto} este mes») NO vive en el header sino en el header de la card «Balance del mes» (**decisión de QA del rediseño**: junto a la fecha competía con el saludo)."* | `dashboard` — "El header del dashboard saluda al usuario…" |
| D-40 | El onboarding no permite saltar pasos | *"arrancar con datos vacíos rompe el dashboard (no hay disponible que mostrar, no hay cuenta nombrada, etc.). Forzar el paso por cada pantalla garantiza un estado inicial coherente."* | `onboarding` — "El wizard NO permite saltar pasos intermedios" |
| D-41 | El cierre del onboarding empuja a dar el primer paso | *"NO hay escape: el usuario SHALL elegir A o B (**decisión de producto** — el cierre del onboarding empuja a dar el primer paso)."* | `onboarding` — "La pantalla done…" |
| D-42 | Bimoneda por defecto es opt-out, no opt-in | *"La decisión de NO ver USD SHALL ser un opt-out posterior desde el módulo `settings`, no un opt-in en el onboarding."* | `onboarding` — "Bimoneda por defecto…" |
| D-43 | El toggle de USD será solo presentación | *"ese toggle SHALL afectar solo la presentación visual… y NO SHALL alterar las filas de `account_currencies` ni el ledger interno."* | `onboarding` — idem |
| D-44 | Compartido se nombra en castellano llano | *"«cuenta corriente» se conserva solo como nombre de dominio interno y de ruta"*; el acceso se rotula por la acción ("Ver el detalle"), la deuda como relación entre personas, y *"un mismo concepto, una sola palabra en toda la superficie"*. Se conserva **"reintegro"** *"(es preciso y conocido por la base de usuarios)"*. | `shared` — "Las superficies visibles de Compartido usan lenguaje llano, sin jerga contable" |
| D-45 | La deuda sale del hero navegable | La deuda vive en *"una **franja/tile propia fija en «hoy»** (no en el hero navegable)"* y los últimos movimientos se presentan *"como **log de gastos** (no como estado de deuda; la deuda ya vive, sin ambigüedad, en la franja de deuda)"*. | `shared` — "El usuario puede ver el dashboard del hogar" |
| D-46 | El endónimo del idioma no se localiza | *"Las etiquetas de cada locale SHALL ser los **endónimos** («Español», «English»)… Los endónimos no se localizan: ambos catálogos SHALL contener los mismos valores."* | `settings` — "El usuario PUEDE cambiar el idioma de la app desde `/settings`" |
| D-47 | El tour reemplazó a los hints porque los hints no se veían | *"El feedback de QA indicó que los hints de texto gris no se ven ni guían. Se reemplazan por el tour guiado."* | archivo `2026-06-17-first-movement-tour` |
| D-48 | El hint de recurrencia no se persiste como guía | *"El hint SHALL ser ayuda contextual permanente mientras el toggle está activo… y NO SHALL persistirse en `user_guidance_events` ni marcarse como visto."* | `transactions` — "El toggle de recurrencia comunica su propósito" |
| D-49 | El pago del sello es un cargo aparte que sale de la misma cuenta | *"Total a debitar = Monto a pagar (del resumen) + Impuesto de sellos"*, y *"el **aviso de saldo negativo** se calcula con el **total a debitar**… En la captura actual el negativo se calcula solo con el monto (ignora sellos): lo tratamos como una imprecisión a corregir."* | `docs/design/cards-pay-period/README.md` |
| D-50 | Aviso, no bloqueo, como regla transversal | *"el saldo negativo se advierte (`Alert warning`), nunca se impide. **Regla transversal de Grana para toda salida de plata.**"* | `docs/design/cards-pay-period/README.md` + `transactions` |

## D.3 · Arquitectura y proceso

| # | Decisión | Cita textual | Fuente |
|---|---|---|---|
| D-51 | El flujo de reset de password corre 100 % client-side a propósito | *"cuando un server action muta cookies o llama a `signOut`, Next.js invalida y re-renderiza automáticamente la ruta — si esa ruta verificara la sesión server-side, el re-render encontraría que ya no hay sesión y mostraría «enlace inválido» antes de que el éxito pueda renderizarse, desmontando el form en el medio. Hacer todo desde el browser elide ese race entirely."* | `auth` — "Setear password nuevo durante recovery" |
| D-52 | El repo es la fuente de verdad de los templates de email | *"Si el dashboard y el repo divergen, el contenido del repo gana — la resolución es sobrescribir el dashboard, nunca al revés."* | `auth` — "Los templates de email viven versionados en el repo" |
| D-53 | Web y mobile son implementaciones nativas en paralelo | *"JSX SHALL NO compartirse entre `apps/web` y `apps/mobile`; la lógica pura… MAY compartirse a nivel de helpers."* La paridad se mantiene *"en estructura y jerarquía visual"*. | `cards` / `accounts` |
| D-54 | Los paquetes no traducen texto | *"El paquete NO SHALL traducir texto: cada consumer resuelve el mensaje con su helper de i18n."* | `cards` — "Las mutaciones de tarjeta viven en `@grana/cards`…" |
| D-55 | Los packages no exportan código sin consumidores | *"el package NO SHALL exportar código sin consumidores (recuperable de git si una vista futura los retoma)."* | `dashboard` — "Las queries y agregaciones del dashboard viven en un package compartido" |
| D-56 | Un no-goal solo se deroga con un change nuevo | *"Cualquier propuesta que viole un no-goal vigente SHALL abrir un change OpenSpec nuevo y modificar este requirement antes de implementarse."* | `cards` / `accounts` |
| D-57 | Los handoffs de diseño son normativos en jerarquía, no en píxeles | *"referencia **normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock."* | `cards` / `accounts` |
| D-58 | El gradient del hero se tokeniza en partes, no como string | *"La forma «partes» (tres tokens separados) SHALL ser la canónica, para que el mirror de mobile vía codegen pueda exponer cada parte como una constante TypeScript y que el componente nativo equivalente consuma los stops sin parsear strings CSS."* | `transactions` — "El hero card de /accounts/[id] usa una superficie navy…" |
| D-59 | Un indicador con un token inexistente **viola** el requirement aunque esté en el árbol | *"Una clase de color que el sistema de estilos no resuelve deja el indicador transparente y viola este requirement, aunque el elemento esté en el árbol."* | `cards` — "El listado de tarjetas…" |
| D-60 | El contrato `Mutators` es un drift detector | *"cualquier consumer cuyo objeto `Mutators` no tenga esa propiedad falla en tiempo de compilación, no en runtime."* | `transactions` — "La lógica del formulario vive en `@grana/movement-form`…" |
| D-61 | Un read que entrega ítems inactivos es incorrecto | *"un catálogo que entrega ítems inactivos es un read incorrecto, y un consumer que los tapa esconde el defecto en vez de arreglarlo."* | `categories` — "El usuario puede archivar sus categorías propias" |
| D-62 | La desaparición del catálogo es inmediata, no eventual | *"Un catálogo cacheado que sigue ofreciendo una categoría ya eliminada de la base es un incumplimiento de este requirement, no una demora aceptable."* | `categories` — idem |
| D-63 | El guard vive en la base, no en cada cliente | *"La base rechaza borrar un movimiento que sembró una regla viva, para todos los clientes (web, mobile, SQL manual), no solo para el frontend que se acuerde… Es el costo deliberado de que la garantía viva en la base y no en cada cliente."* | change activo `fix-recurrence-projection-and-orphans` |
| D-64 | Variant C es el default para rutas nuevas | *"Para rutas nuevas SHOULD adoptarse Variant C salvo que exista una razón concreta documentada para no usar `<ruta>/layout.tsx`."* | `route-loading-and-errors` |
| D-65 | El `not-found` recibe strings ya traducidas | *"el set de strings depende del módulo… y delegar la traducción al caller mantiene al primitivo agnóstico del scope de i18n."* | `route-loading-and-errors` |
| D-66 | El `PageHeader` custom desplaza al native stack header en mobile | *"Razón: consistencia visual cross-platform y unificación del lenguaje de headers; las pantallas web equivalentes usan el mismo `PageHeader` con `backLink`."* | `settings` |
| D-67 | Deduplicación ≠ deprecación | Los requirements retirados por `dedupe-relocated-invariants` se marcan *"Deduplicación, no deprecación… La regla sigue vigente **sin ninguna pérdida de alcance**"*, y sobrevive *"la versión **verificable**"*. | archivo `2026-08-03-dedupe-relocated-invariants` |
| D-68 | Reubicación ≠ deprecación | *"Los diecisiete requirements de esta sección se **reubican**, no se deprecan… El texto del requirement, sus scenarios y sus modales normativos viajan verbatim."* | archivo `2026-08-02-split-project-conventions` |

---

# E. Huecos

## E.1 · Contradicciones entre specs (y contra el código)

| # | Contradicción | Estado real en el código | Recomendación |
|---|---|---|---|
| **E-01** | **`Efectivo` vs `Billetera`.** `accounts/spec.md` — "Cuenta **Efectivo** por defecto en el signup" y sus 3 scenarios afirman `name='Efectivo'`. `onboarding/spec.md` y `auth/spec.md` hablan de la **`Billetera`** (*"La `Billetera` default es una opción seleccionable"*). | **`Billetera`.** `supabase/migrations/0007_accounts.sql` creaba `'Efectivo'`; **`0012_profiles_onboarding_and_default_account.sql` reemplazó la función del trigger para que los nuevos usuarios reciban `'Billetera'`**, hizo backfill (`UPDATE … set name='Billetera' where name='Efectivo'`) y dejó una verificación que aborta si queda alguna cuenta `Efectivo`. Ninguna migración posterior lo revierte. | Actualizar `accounts/spec.md` (título del requirement + los 3 scenarios) a `Billetera`. Es drift documental puro, no un bug. |
| **E-02** | **`Footer` con `LanguageSwitcher`.** `i18n/spec.md` — "Language switcher en el footer en toda ruta": *"El sistema SHALL renderizar un componente `<Footer />` en toda ruta"*. `settings/spec.md` — *"El `Footer` global de `apps/web/app/layout.tsx` SHALL ser eliminado del repositorio. NINGÚN otro componente SHALL renderizar el `LanguageSwitcher` fuera de `/settings`."* | **Gana `settings`.** No existe ningún archivo `footer` en `apps/web`; `LanguageSwitcher` solo aparece en `app/(app)/settings/_components/`. | Retirar el requirement del footer de `i18n/spec.md` (con `## REMOVED` y su Reason) o reescribirlo apuntando a `/settings`. |
| **E-03** | **Composición del dashboard.** El requirement "La pantalla dashboard es la landing universal" enumera *"la misma composición de secciones en **orden fijo**: (1) Hero + Dónde está, (2) Balance del mes, (3) En qué se fue"*. El requirement de layout enumera 7 bloques: *"Para gastar → Dónde está → Balance del mes → **Comprometido** → **Compartido** → **Gastaste este mes** → ¿En qué gasté?"*. | Gana el segundo: `CommittedSection`, `SpentThisMonthSection` y la tira Compartido existen. | Actualizar el requirement de landing para que enumere las secciones reales (y marque cuáles son condicionales). |
| **E-04** | **Título vs cuerpo del requirement de acciones del detalle.** El título dice *"Las acciones del detalle viven en un kebab menu"*; el cuerpo dice *"SHALL exponer las acciones del detalle en la **topbar**, no en un kebab"* y el scenario exige *"no se renderea ningún menú kebab `⋯`"*. | Gana el cuerpo. | Renombrar el requirement ("Las acciones del detalle viven en la topbar"). |
| **E-05** | **Filtros en React state vs en la URL** (dentro de `transactions/spec.md`). "El módulo global permite búsqueda y filtros" y "El estado de filtros… vive en React state, no en URL" afirman que *"La URL canónica de `/transactions` SHALL ser `/transactions` sin query params"*. Pero los requirements de subcategoría dicen *"SHALL serializarse al URL como `?subcategory=<uuid>`"*, *"la búsqueda se aplica con debounce de 300ms **a la URL**"* y describen `parseMovementFilters` / `buildMovementLimitHref` sobre query params. | Gana React state (la migración a client shell es posterior). | Reescribir los tres requirements de subcategoría en términos de estado interno, o marcarlos `REMOVED`+`ADDED`. |
| **E-06** | **Título "wallet" vs cuerpo "vista compacta"** en `cards`. El título dice *"El listado de tarjetas se muestra como **wallet** con hero de pago mensual"*; el cuerpo exige *"una **vista compacta agrupada por banco** (NO como wallet de cards grandes)"*. | Gana el cuerpo (el componente se sigue llamando `Wallet` por decisión explícita). | Renombrar el requirement; aclarar que `Wallet` es el nombre del componente, no del patrón visual. |
| **E-07** | **CTA "Agregar tarjeta" en mobile.** El requirement de loading de `/cards` dice que el CTA es *"disabled placeholder mientras la ruta `/cards/new` mobile no exista"*. El requirement del listado dice que *"en mobile navega a la ruta `/cards/new` nativa"* y que *"NO SHALL renderizarse como placeholder permanentemente disabled"*. | `apps/mobile/app/(app)/cards/new.tsx` **existe** y `CardsHeader.tsx` hace `router.push('/(app)/cards/new')`. | Limpiar el texto stale del requirement de loading. |
| **E-08** | **Dos requirements de tarjetas viven dentro de `auth/spec.md`**: "La UI muestra una marca visual cuando las fechas de un período son estimadas" y "El selector de «cuenta de pago» en el flujo de pago de resumen lista las cuentas cash y bank con ARS". | Son reglas de `cards`, no de `auth`. Además la primera duplica (con distinto alcance: 📅 en 5 superficies) el requirement de `cards` "Los períodos estimados se señalizan en el detalle y la edición de la tarjeta", que **prohíbe** señalizar en el hero de `/cards` y en el dashboard. | Reubicar ambos a `cards/spec.md` y deduplicar el de fechas estimadas (contradicción de alcance real). |
| **E-09** | **Ruta del wizard de onboarding.** El spec de `onboarding` y el de `auth` mencionan `/onboarding/perfil` y `/onboarding/saldo-actual` en varios scenarios. | Las rutas reales son `/onboarding/welcome`, `/onboarding/initial-balance` y `/onboarding/done` (`rename-spanish-routes-to-english`, 2026-05-25). `/onboarding/perfil` ya no existe (`remove-user-modes`). | Actualizar los scenarios; la referencia a `perfil` es residuo de los modos. |
| **E-10** | **Referencia cruzada rota.** `dashboard/spec.md` remite a *"el requirement «El selector de mes del header gobierna las secciones mensuales (web)»"*; el requirement real se titula *"El selector de mes del dashboard gobierna las secciones mensuales"* (sin `(web)` y con "dashboard"). | — | Corregir el nombre citado. |

## E.2 · Features en el spec sin implementación encontrada

| # | Feature especificada | Estado en el código |
|---|---|---|
| **E-11** | `guidance` — "Componente `InlineGuide` para hints debajo de campos" | `apps/web/components/ui/inline-guide.tsx` **existe pero no tiene ningún call-site**. El change `first-movement-tour` retiró el requirement que lo consumía ("Primer movimiento web con InlineGuides") pero **dejó vivo el requirement del componente**. Componente huérfano. |
| **E-12** | `guidance` — "Componente `GuideCard` para sugerencias contextuales" (ejemplo canónico: `accounts.discovery`, *"¿Dónde está tu plata?"*) | `apps/web/components/ui/guide-card.tsx` **existe sin call-sites**. La guía `accounts.discovery` nunca se renderiza. El hint de cuentas que sí existe es `AccountsHint` (dismissible por `localStorage`), que **no** usa `user_guidance_events`. |
| **E-13** | `guidance` — "Post-save «impacto» para primer movimiento" | `MAY` explícito, condicionado a no ensuciar la arquitectura. No implementado. |
| **E-14** | `transactions` — "El módulo global destaca movimientos que requieren revisión" (duplicado, monto inusual, datos incompletos, ajuste frecuente) | Redactado con `MAY`. En el código solo se materializa el caso "sin categoría" (chip "Revisar"); no encontré detección de duplicados ni de monto inusual. |
| **E-15** | `transactions` — distribución del pago de resumen entre categorías | Explícitamente **diferido**, con TODO en `getMonthCategoryBreakdown`. El consumo de tarjeta pagado no aparece en el desglose ni al devengar ni al pagar. |
| **E-16** | `guidance` — persistencia y hooks de guías en mobile | La capa entera (`user_guidance_events`, `useGuidance`, tour) es **web-only**. Mobile no tiene equivalente. |
| **E-17** | `money-input-calculator` — entrada de expresión inline y keypad | `evaluateMoneyExpression` vive en `@grana/validation` (compartido), pero `apps/mobile/components/ui/MoneyAmountInput.tsx` **no lo importa** y no existe `MoneyCalculatorPopover` nativo. Feature web-only de facto. |
| **E-18** | `spending-by-category` — lista drilleada que reconcilia con el donut, en mobile | `getMonthCategoryLines` sigue en `apps/web/lib/transactions/queries.ts`. La lente (`categoryOwnPortion`, `countsAsCategorySpend`) ya está compartida en `@grana/money-logic`; falta hoistear la query a `@grana/transactions`. El propio spec lo documenta como **MOBILE PENDIENTE (tech lead)**. |
| **E-19** | `shared` — pantalla de **setup** como ruta pusheada en mobile | El requirement de subpantallas enumera *"setup, saldar, configuración y cuenta corriente"* como rutas pusheadas, pero no existe `app/(app)/home/setup.tsx`: el setup se renderiza **inline** en el tab Hogar (como pide el otro requirement). Contradicción menor de alcance. |
| **E-20** | `cards` — preview ámbar de cascada en el sheet de fechas (mobile) | El spec nativo exige el bloqueo cuando el próximo está pagado, pero no especifica el preview ámbar. Paridad parcial no declarada. |

## E.3 · Rutas / componentes sin spec que los cubra

| # | Superficie | Observación |
|---|---|---|
| **E-21** | **Cards "Próximos 7 días" / "Más adelante este mes"** del hub de recurrencias (`apps/web/app/(app)/transactions/recurring/_components/upcoming-recurrences.tsx`) | **Ningún requirement las cubre.** El change activo `fix-recurrence-projection-and-orphans` lo dice explícitamente: *"Las cards… quedan **especificadas por primera vez** — hoy no hay ningún requirement que las cubra."* Además tienen un bug conocido: la proyección ignora `last_generated_date` y dibuja ocurrencias ya materializadas. |
| **E-22** | `apps/web/app/(app)/transactions/recurring/_components/recurring-tabs.tsx` | El agrupado por estado (Activas / Pausadas / Finalizadas) está especificado **solo para mobile** ("La app nativa expone el hub de recurrencias"). El equivalente web no tiene requirement propio. |
| **E-23** | `apps/web/app/(app)/transactions/recurring/_components/recurrence-generation-trigger.tsx` | La materialización perezosa de instancias vencidas está especificada **solo para mobile** ("al enfocar la pantalla… fire-and-forget"). El disparador web existe sin requirement. |
| **E-24** | `apps/web/app/(app)/transactions/recurring/_components/create-recurrence-modal.tsx` | El spec dice *"El sistema SHALL ofrecer un punto de entrada para este flujo desde la pantalla de recurrencias"* sin normar la superficie. Web usa un **modal**; mobile usa una ruta (`/transactions/recurring/new`) que sí está especificada. La divergencia de superficie no está documentada como deliberada (a diferencia del caso de categorías, que sí la justifica). |
| **E-25** | `apps/mobile/app/(app)/menu.tsx` (`AppMenu`) | Cubierto de forma tangencial por `mobile-app-shell` y por menciones sueltas ("se navega desde el `AppMenu` → `/cards`"), pero sin un requirement que enumere sus ítems. |
| **E-26** | `apps/web/app/(app)/accounts/[id]/edit/` y `apps/web/app/(app)/cards/[id]/edit/` como páginas | Especificadas como *"fallback no-JS / deep-link"* de pasada; no hay scenarios que fijen su comportamiento de éxito/error como página. |
| **E-27** | `apps/mobile/app/(app)/accounts/[id]/currency.tsx` | Cubierta por "Crear, editar y gestionar monedas de una cuenta en mobile", pero sin scenarios propios de la pantalla de monedas más allá de los guards. |

## E.4 · Deuda declarada en los propios specs

| # | Deuda | Fuente |
|---|---|---|
| **E-28** | CTA de registrar ausente en el encabezado pelado de `/transactions` en desktop-web | *"restaurar un CTA… es follow-up explícito fuera de alcance de esta spec"* — `transactions` |
| **E-29** | Representar `NUMERIC` como `string`/`Money` en los tipos generados de Supabase | *"pendiente consciente"* — `schema-base` |
| **E-30** | Paridad mobile del rediseño visual de `/accounts` | *"SHALL implementarse como una vista nativa RN equivalente en un change futuro"* — `accounts` |
| **E-31** | Hero de dos cifras de `/cards` en mobile | *"MAY quedar como follow-up, manteniendo la paridad estructural cuando se haga"* — `cards` |
| **E-32** | 10 reglas recurrentes huérfanas y 1 `frequency` desincronizado en datos reales | change activo `fix-recurrence-projection-and-orphans` — *"el change las hace visibles, no las borra"* |

---

# F. Copy y voz de marca

> Copy **canonizado en specs** (no el catálogo i18n completo). Cuando el spec fija una clave en vez del texto, se indica la clave.

## F.1 · Onboarding — canon español (`onboarding/spec.md`, "Copy de referencia")

**Welcome**
- Saludo (si hay `full_name`): **"Ey, {first_name}! 👋"**
- Promesa: **"Vamos a ordenar tu plata sin convertir esto en una planilla eterna."**
- Subtext: **"Empezamos con lo que tenés hoy. Sin juicio, sin drama."**
- CTA: **"Empezar"**

**Saldo inicial** — pregunta literal: **"¿Cuánta plata tenés hoy?"**
- Encabezado: **"Esto no es un ingreso ni un gasto. Es tu punto de partida."**
- Subtext: **"Si no sabés el número exacto, poné una aproximación. La vida real rara vez cierra perfecto."**
- CTA: **"Continuar"** (único; sin "Saltar", "Omitir" ni equivalente)
- Restricción de copy: *"La UI NO SHALL mencionar la palabra «Billetera» ni el concepto «cuenta»."*

**Done**
- Éxito: **"Listo. Tu Grana ya tiene punto de partida."**
- Guiño: **"Ahora sí: que los gastos misteriosos den la cara."**
- Encabezado del fork: **"Tu Grana, tu decisión"** / **"¿Cómo querés llevar tu plata?"**
- Card A: **"Una billetera y listo"** · *"Llevá todo junto, sin complicarte. Anotás lo que entra y sale, y siempre sabés cuánto tenés. Tu billetera ya está creada."* · etiqueta **"Lo más simple"**
- Card B: **"Mis cuentas, al detalle"** · *"Cargá tus cuentas reales —banco, efectivo, lo que uses— y seguí el saldo de cada una. Para los que quieren tener todo cuadrado."* · etiqueta **"Más control"**
- Confirmación A: **"¡Genial! Arranquemos por tu primer movimiento."**
- Confirmación B: **"¡Te gusta el detalle! Vamos a crear tu primera cuenta."**
- Botón de confirmación: **"Vamos 🚀"** · volver: **"Volver"**
- CTA mobile: **"Ir al dashboard"**

## F.2 · Guías y educación (`guidance`, `transactions`, `dashboard`)

- Tour del primer movimiento — hint de Tipo: **"Gasto resta, ingreso suma. Simple, pero poderoso."**
- Acciones del tour: **"Siguiente"** · **"Omitir guía"**
- Orden de pasos: Monto → Cuenta → Categoría → Descripción → Guardar
- `GuideCard` canónica (`accounts.discovery`, **sin call-sites**): título **"¿Dónde está tu plata?"** · descripción *"Si además de CUÁNTA plata tenés, querés saber DÓNDE está…"* · CTA **"+ Crear cuenta"** · secundario **"No ahora"**
- Post-save (opcional, no implementado): **"Listo. Este movimiento cambió tu disponible y va a aparecer en tu resumen del mes."**
- Toggle "Hacer recurrente" — nota: **"Para lo que pagás seguido: alquiler, suscripciones, el sueldo."**
- Toggle "Hacer recurrente" — hint al activar: **"Cuando toca, Grana te lo deja listo y vos lo registrás con un toque. Nunca se carga solo sin tu OK."**
- Aviso educativo de Ajustes: clave `dashboard.month.adjustment_note` — *"los ajustes son grana que se movió sin registrar y la meta es hacerlos desaparecer registrando esos movimientos"*
- Chip de Ajustes: clave `dashboard.month.adjustment_unregistered` — **"SIN REGISTRAR"**

## F.3 · Pedagogía in-context del detalle (`transactions.detail.context.*`)

- Consumo/cuota de tarjeta no pagada: **"Este consumo no afecta tu disponible hasta que pagues el resumen del {período}."**
- Cuota hija ya pagada: **"Esta cuota ya está incluida en el resumen del {período} que pagaste."**
- Pago de resumen: **"Con este pago, las cuotas del período {período} quedaron en estado pagado."**
- Reintegro pendiente: **"Esperás que te lo devuelvan. Cuando llegue, marcalo como recibido y se va a sumar a tu disponible."**
- Reintegro cancelado: **"Marcaste este reintegro como cancelado. Si finalmente lo recibís, podés reabrirlo."**
- Regla: *"NO SHALL ser un formulario, banner accionable, ni alerta intrusiva — es texto explicativo."*
- Nota de cuota hija: **"Esta es una cuota. El monto se edita desde la compra original"** + link **"Ir a la compra original"**
- Callout de transferencia: aclara que **"no cuenta como gasto ni ingreso"**

## F.4 · Estados vacíos

| Superficie | Copy |
|---|---|
| `/transactions`, primera vez | **"Acá va a aparecer cada peso que se mueva"** + acción para registrar el primer movimiento |
| `/transactions`, mes vacío con historial | **"No registraste nada en {mes} todavía"** (sin tono de bienvenida) |
| `/transactions`, búsqueda sin resultados | Mensaje de "no se encontraron coincidencias" + acción **limpiar la búsqueda** |
| `/transactions`, filtros sin resultados | Mensaje de "ningún movimiento cumple los filtros" + acción **limpiar los filtros** |
| `/accounts` | **"Todavía no tenés cuentas"** + CTA secundario **"+ Crear cuenta"** |
| Detalle de cuenta sin movimientos | Mensaje vacío + CTA para agregar la primera transacción |
| Detalle de tarjeta, tarjeta nueva | **"Tu tarjeta está lista"** + CTA **"Registrar primer consumo"** |
| Período sin consumos | **"Sin movimientos"** |
| Pestaña de cuotas sin compras activas | **"Sin compras en cuotas"** |
| Historial de una regla sin instancias | Estado vacío en lugar de lista |
| Comprometido sin deuda ni recurrencias | Estado vacío neutral (la card **no** desaparece del layout) |
| "En qué gasté" sin gastos en la moneda activa | Estado vacío neutral (la card **no** desaparece del layout) |
| Deuda del hogar en cero | **"están al día"** |

## F.5 · Errores y bloqueos (texto fijado por spec)

| Contexto | Copy |
|---|---|
| Desactivar moneda con saldo | **"No podés desactivar una moneda con saldo distinto de cero."** |
| Última moneda activa | **"Debe quedar al menos una moneda activa."** |
| Cascada con próximo período pagado | **"El próximo resumen ya está pagado. No se puede modificar el borde entre ambos resúmenes."** |
| Cascada que colapsaría el próximo | **"La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen."** |
| Preview bloqueante en el sheet de fechas | **"No podés mover esta fecha: el próximo resumen ya está pagado"** (+ Guardar deshabilitado) |
| Archivar tarjeta con deuda | Dialog **"No se puede deshabilitar todavía"** (claves `cards.deactivate_block.*`, error tipado `pending_debt`) |
| Cuotas en moneda ≠ ARS | **"Las cuotas solo están disponibles en pesos"** |
| Eliminar compra con cuota pagada | **"No se puede eliminar — al menos una cuota ya fue pagada"** |
| Eliminar una cuota suelta | **"Para eliminar esta compra, eliminá la operación completa desde el detalle de la compra"** |
| Eliminar un pago de resumen | Se rechaza informando que *"debe deshacerse desde el detalle del período de la tarjeta"*; el diálogo **NO** afirma que las cuotas volverán a pendientes |
| Reset de password inválido | **"este link es inválido o expiró"** + link a forgot-password |
| Confirmación de cuenta | **"tu cuenta fue confirmada, iniciá sesión"** (mensaje one-shot) |
| Login con email sin confirmar | `auth.errors.email_not_confirmed_with_resend` + botón `auth.login.resend_confirmation_code` |
| Email ya registrado | `auth.errors.user_already_exists` |
| Credenciales inválidas | Mensaje genérico único (`auth.errors.invalid_credentials`), nunca en la URL |
| Error Postgres no mapeado | `<dominio>.errors.generic` (nunca el mensaje crudo) |
| Duplicado de cuenta / categoría | `accounts.errors.duplicate` (`23505`) |

## F.6 · Rótulos y microcopy del producto

**Dashboard**
- Eyebrow del hero: **"PARA GASTAR · HOY"** · caption: **"Lo que tenés disponible hoy, en pesos y dólares."**
- Preguntas por sección: **"¿Cuánto tengo?"** · **"¿Cómo se movió mi plata este mes?"** · **"¿En qué gasté este mes?"** (es el título) · **"Lo que ya sabemos del próximo mes"**
- Saludo: **"Hola, {name}."** (`dashboard.welcome`) / fallback **"Hola."** (`dashboard.welcome_anon`)
- Ancla del mes en curso: **"vas {neto} este mes"**
- Comprometido: subtítulo **"Plata que ya está comprometida"** · aviso **"incluye $X vencido"** · contexto **"Ya entra"**
- Gastaste este mes: **"De tu caja"** / **"Financiado en tarjeta"** + aclaración de que lo financiado **"se paga en los próximos resúmenes"**
- Compartido: **"Te deben $X"** / **"Debés $X"**
- Créditos por categoría: **"te devolvieron"**

**Tarjetas**
- Hero: **"A pagar (ahora)"** + **"En curso"** con caption **"se sigue sumando hasta el cierre"** · **"Próximos cierres"**
- Cero en el hero: **`$ 0`** (nunca un texto de empty-state)
- Detalle: eyebrow **"RESUMEN A PAGAR"** · **"RESUMEN EN CURSO"** + badge **"Sumando consumos"** · mini fila **"PRÓXIMO · cierra X · ya comprometido en cuotas"**
- Panel de ciclo: **"CIERRA"** · **"en N días"** · **"Día X de N"**
- Límite sin cargar: **"Cargá el límite para ver cuánto te queda disponible."** + botón **"Cargar límite"**
- Límite cargado: **"Límite usado $X de $Y"** + **"Disponible $Z"**
- Countdown: **"N días para el vencimiento"** / **"vencido hace N días"**
- Estado por período: **"Pagado DD-mm · N movimientos"** · **"Pagado el 15-may desde Banco Galicia"**
- Pestañas: **"Movimientos del período"** · **"Cuotas en curso · N"**
- Pantalla de resúmenes: `<h1>` exactamente **"Resúmenes"** (prohibido "Historial de resúmenes")
- Sellos: chip **"No me cobraron sellos"**; aviso de que *"el dato se pide solo esta vez y en los próximos resúmenes se sugerirá solo"*; **prohibido mencionar el porcentaje**
- Pago: aviso de irreversibilidad y, tras `revert-card-statement-payment`, la acción **"Deshacer pago"** cuyo diálogo aclara *"que las fechas confirmadas del ciclo en curso se mantienen"*
- Fechas estimadas: marca discreta tipo **"cierra ~DD/MM"** o sufijo **"estimado"**

**Cuentas**
- Secciones: **"EFECTIVO · 2"** / **"Bancarias"** / **"Archivadas (N)"**
- Badge: **"Archivada"** (`accounts.badges.archived`, `bg-warning-soft text-warning`)
- Menú: **"Editar"** · **"Archivar"** · **"Eliminar"** · **"Reactivar"**
- Confirmaciones: `confirmations.archive_body` · `confirmations.delete_body_no_transactions`
- Institución custom: ítem **"+ Agregar nueva institución…"**, promocionado como **"+ Agregar «{query}» como nueva"**
- Fila sintética: **"Saldo inicial"**

**Movimientos**
- Tipos del selector: **Gasto · Ingreso · Transferencia · Ajuste · Cambio de moneda**
- Tabs mobile: **Gasto · Ingreso · Transferencia · Ajuste · Cambio**
- Ajuste: dirección **Suma / Resta**, preview **"Saldo quedará"**, descripción re-etiquetada como **"Motivo del ajuste"** (`drawer.adjust_reason`)
- Cambio: card **"Monto recibido"** (`labels.exchange_received`) + hint `exchange.no_other_currency_hint`
- Chips de contexto del hero: `fecha · medio de pago · categoría · subcategoría`
- Línea de contexto: **"Gasto · pago único en efectivo"** · **"Ingreso de ACME S.A."** · **"Movimiento entre tus cuentas"**
- Eyebrow de transferencia: **"Transferencia interna"**
- Chips de fila: **"Recurrente"** · **"Revisar"** · **"Cuota X de Y"** / **"3/6"** · **"pendiente"**
- Grupos de fecha: **"Hoy"** · **"Ayer"**
- Eyebrows de `TxDetailGroup`: **"DETALLES"** · **"TARJETA"** · **"CUOTAS"** · **"REINTEGROS"**
- Tiles: **"Pagado con"** · **"Detalle"** · **"Descripción"** · **"Peso en el mes"** · **"En cuotas"** · **"Resultado neto"** · **"Te toca pagar"** · **"Dividido entre"** · **"Acreditado en"** · **"Movimiento"**
- Reintegros: bloque **"Reintegros a confirmar"** · checkbox **"Ya me lo acreditaron"** · toggle **"Tiene reintegro"** · etiqueta **"esperado"** bajo el monto
- Donut: eyebrow **"GASTADO"** · caption **"en 8 categorías"** · fila **"+ N categorías más · {monto}"** · footer **"Sin contar consumos en tarjeta sin pagar"**
- Título del breakdown drilleado: **"En qué se fue dentro de {categoría}"** (`transactions.breakdown.title_with_category`)
- Slice sin subcategoría: `transactions.breakdown.no_subcategory_slice`
- CTAs: **"Registrar movimiento"** · **"Nuevo movimiento"** · **"+ Agregar transacción"** · **"Guardar cambios"** · label accesible del FAB `transactions.actions.register_movement` · CTA de cuotas `actions.register_installments`

**Compartido**
- Home: hero **"Gasto del hogar · neto"** · **"En qué gastaron"** · **"Lo que se viene"** · **"Últimos movimientos"**
- Fila: **"Tu parte: {monto}"** (se oculta si `ownShare == amount`) · subtítulo **"Pagaste"** / **"Pagó {nombre}"**
- Deuda: **"le debés a {name}"** · **"{name} te debe"** · **"están al día"**
- Acceso: **"Ver el detalle"** (prohibido "Cuenta corriente" de cara al usuario)
- Cuenta corriente: título **"Las cuentas entre ustedes"** · subtítulo **"quién pagó qué y cómo queda el saldo; nada se borra"** · desglose **"Cómo llegamos a este saldo"** · divisor **"Hoy"** · tramo **"Lo que se viene"**
- Extracto: columna **"qué cambia"** en castellano natural · líneas **"Revertida"** y **"Contraasiento"**
- Vocabulario obligatorio: **"pago"** (nunca "liquidación"), **"anulación"** (nunca "contraasiento" de cara al usuario), **"monto"** (nunca "importe"), **"desglose"** (nunca "ecuación"); se conserva **"reintegro"**
- Toggle de gasto: **"Compartir gasto"** · toggle extremo **"Lo pagué yo, pero es 100% de {nombre}"**
- Anotación pedagógica al saldar: *"la parte de {otro} se registra como deuda a tu favor"*
- Salir del hogar: **"Salir del hogar"** con confirmación por `Dialog` y CTA `destructive`

**Configuración**
- Secciones: **"Visualización"** · **"Idioma"** · **"Categorías"**
- Preferencia: **"Mostrar centavos"**
- Fila de idioma: `settings.language.row_label` + `settings.language.description`; opciones **"Español"** / **"English"** (`settings.language.es` / `.en`)
- Acceso a categorías: **"Administrar categorías"**
- Categorías: **"Agregar"** · **"Editar"** · **"Ver subcategorías"** · **"Archivar"** · **"Eliminar"** · **"Sin ícono"** · **"Sin color"** · **"Sin subcategoría"** · **"Toda la categoría"**

## F.7 · Reglas de voz que el spec fija explícitamente

1. **Bimoneda inviolable** — ARS protagonista, USD subordinado y etiquetado; nunca se suman ni se convierten en un mismo número.
2. **Aviso, no bloqueo** — el saldo negativo se advierte, nunca se impide. Regla transversal para toda salida de plata.
3. **"Sugiere y enseña, no condena"** — tono editorial cálido; la copy de ajustes apunta a que desaparezcan, sin culpabilizar.
4. **Pedagogía sin condescendencia** — el motivo por el que se eliminaron las etiquetas `novato`/`experto`.
5. **Lenguaje llano en Compartido** — sin jerga contable de cara al usuario; un concepto, una palabra en toda la superficie.
6. **Nada de estados decorativos** — un estado solo se muestra cuando informa algo real.
7. **La app gestiona, no opera pagos** — nunca se muestra un número de tarjeta.
8. **Cada cifra responde "¿de dónde sale?"** — precisión contable + microcopy que lo explica.
9. **Todo texto visible sale del catálogo i18n** — sin strings hardcodeados en rutas autenticadas.
10. **Los montos usan formato es-AR** — miles con `.`, decimales con `,`, `tabular-nums`; USD siempre etiquetado (`US$ 120,00`).
