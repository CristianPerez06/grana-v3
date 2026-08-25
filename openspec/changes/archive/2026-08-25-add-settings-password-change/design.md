## Context

El mecanismo de cambio de contraseña ya existe y está speceado: el requirement "Setear password nuevo durante recovery" de la capability `auth` describe una pantalla con dos campos de password que llama a `supabase.auth.updateUser({ password })` y después a `supabase.auth.signOut()`, 100% client-side, en web y en mobile. Lo que este change agrega es el mismo mecanismo **entrado desde adentro de la sesión**, y las tres diferencias que eso impone:

| | Recovery (existe) | Cambio in-app (este change) |
| --- | --- | --- |
| Quién prueba identidad | El OTP de 8 dígitos del email | La contraseña actual, tipeada |
| Sesión al terminar | Se destruye (`signOut()` global) y el usuario vuelve a `/login` | Se **conserva**; se revocan las demás |
| Pantalla final | Card de éxito con link a `/login` (paso obligatorio) | Card de éxito con vuelta a `/settings` (no hay paso obligatorio) |
| Gate de entrada | Claim `amr=otp` en el JWT | Ninguno: estar autenticado alcanza |

Piezas reusables verificadas en el repo:

- `@grana/validation` — `passwordRules` (≥8, ≥1 letra, ≥1 número), `resetSchema`, `translateFieldError` / `translateValidationMessage`.
- `PasswordField` en las dos plataformas, con contrato compartido en `@grana/ui-contracts`.
- `mapSupabaseError` en las dos plataformas, ya con `invalid_credentials`, `same_password`, `weak_password` y `over_request_rate_limit` mapeados.
- `SettingsSection` (contrato compartido), `PageHeader` con `backLink`, y `FormScreen` en mobile.
- `@grana/supabase` exporta un `createClient(url, key, options)` pelado — no sólo el browser client de `@supabase/ssr` —, que es justo lo que hace falta para el cliente de verificación.

No hay toast en ninguna de las dos apps: `sonner` no está en `apps/web/package.json` y no hay ningún componente `toast` en el repo. Esa ausencia condiciona la decisión 5.

## Goals / Non-Goals

**Goals:**

- Que un usuario autenticado pueda cambiar su contraseña sin desloguearse ni pasar por el email.
- Que el cambio revoque las sesiones de los demás dispositivos, y que el usuario se entere de si eso pasó o no.
- Que quien no conozca la contraseña actual no pueda cambiarla, aunque tenga la sesión abierta delante.
- Que la verificación no ponga en riesgo la sesión sobre la que el usuario está parado.
- Que la sección nueva se vea y se comporte igual en web y en mobile, y que crezca sin re-arquitecturar.

**Non-Goals:**

- Reauthentication por email con nonce (decisión 3).
- Un hub `/settings/security` (decisión 1).
- Un sistema de toasts (decisión 5).
- Tocar el `scope` de los `signOut()` que ya existen, o el drift de i18n del stack `(auth)` de mobile (ver `proposal.md` → Non-Goals).

## Decisions

**1. Sección en la raíz de `/settings`, no una ruta hub.** La fila "Cambiar contraseña" linkea directo a `/settings/password`; no hay `/settings/security` en el medio. El motivo es que **ya existe el precedente exacto**: la sección "Categorías" es un `SettingsSection` con una única fila que linkea a `/settings/categories`. Copiar esa forma da consistencia gratis en las dos plataformas, con componentes que ya están escritos. Un hub con un solo ítem sería una pantalla cuyo contenido es un link, a costa de un tap y un nivel de back-stack.

El crecimiento está previsto y no obliga a decidir ahora: las funciones futuras (cambiar email, sesiones activas, borrar cuenta) entran como **filas nuevas de la misma sección**, y recién cuando la raíz de `/settings` quede cargada se promueve la sección a `/settings/security` — un movimiento de ruta más un `href`. Diseñar el hub hoy sería adivinar: `profiles` tiene los campos (`email`, `full_name`, `financial_timezone`) pero no hay ningún plan comprometido sobre ellos.

**2. La contraseña actual se pide, y se verifica con `signInWithPassword`.** Supabase **no** exige la contraseña actual en `updateUser({ password })`: con la sesión abierta alcanza. Sin el campo, cualquiera que agarre un dispositivo desbloqueado con Grana abierta puede cambiar la contraseña y —con la revocación de la decisión 4— dejar afuera al dueño. El campo es la diferencia entre "cambiar la contraseña" y "apropiarse de la cuenta".

Supabase no expone un "verificar contraseña" aparte, así que la verificación es un `signInWithPassword(email, currentPassword)` cuyo resultado se usa como predicado. El `email` sale de la sesión (`getUser()`), no de un input.

**3. Verificación con contraseña actual, no reauthentication por email.** Supabase ofrece un camino más fuerte: activar "Secure password change" en el dashboard, que obliga a `reauthenticate()` → OTP por email → `updateUser({ password, nonce })`. Se descarta por dos razones. La primera es de alcance: usa el template "Reauthentication", que el requirement de templates versionados de `auth` deja explícitamente afuera *"mientras la app no los use"* — adoptarlo lo mete adentro de la regla y obliga a versionarlo, mirrorearlo en el dashboard y mantenerlo. La segunda es de UX: agrega un viaje al email y una pantalla de OTP a una operación que el usuario inició estando adentro de la app, para una app de finanzas personales de dos usuarios. El campo de contraseña actual cubre el modelo de amenaza real (dispositivo ajeno/desatendido) a un costo de un input.

**4. `signOut({ scope: 'others' })`, y por qué el `scope` no es un detalle.** Verificado contra las typings de `@supabase/auth-js` (SDK `2.105.4`, instalado): el default de `signOut()` es `'global'` — desloguea de **todos** los dispositivos, el actual incluido. Acá hace falta `'others'`, que tiene tres propiedades relevantes:

- Conserva la sesión actual y revoca los refresh tokens de todas las demás.
- **No emite el evento `SIGNED_OUT`** (la doc del SDK lo dice explícitamente para el scope `others`). Esto es lo que hace viable "cambiar la contraseña sin salir": el listener de `onAuthStateChange` en `apps/mobile/app/_layout.tsx:44` redirige a `(auth)/login` al recibir `SIGNED_OUT`. Con `'global'` o con `signOut()` pelado, el usuario terminaría deslogueado del dispositivo donde acaba de cambiar la contraseña.
- **No invalida los access tokens ya emitidos.** También de la doc del SDK: revocar el refresh token no mata el JWT en curso, que sigue siendo válido hasta expirar (default de Supabase: 1h). El copy tiene que decir la verdad — "se cierra la sesión en tus otros dispositivos" — sin prometer instantaneidad. Bajar el TTL del JWT en el dashboard arreglaría la ventana, pero es un trade-off global de la app por un caso de borde; no se hace acá.

**5. Card de éxito en el lugar del formulario, con dos estados.** Tres alternativas, y por qué gana ésta:

- *Toast y quedarse*: no hay sistema de toasts en ninguna de las dos apps. Introducir uno cross-platform (primitivo + contrato en `@grana/ui-contracts` + spec) sería un change previo entero, para mostrar una línea de texto.
- *Volver atrás en silencio*: es el patrón del repo para formularios anidados (`CreateCategoryForm` hace `router.back()` en mobile y `router.push('/settings/categories')` en web). **No transfiere.** Funciona para crear una categoría porque el resultado es visible en el destino: aterrizás en la lista y ahí está. Un cambio de contraseña no deja rastro visible en ningún lado — el usuario haría una operación irreversible y de seguridad, y recibiría silencio. Y no habría dónde poner el aviso del estado parcial.
- *Card de éxito*: reusa el patrón que el requirement de recovery ya specea (`auth.reset.success_title` + `success_body`, form desmontado), y absorbe los dos desenlaces cambiando una línea de body. Cero primitivos nuevos.

La diferencia deliberada con recovery: el CTA es "Volver a ajustes", no "Ir al login", porque la sesión sigue viva y no hay ningún paso obligatorio pendiente. Que el form se desmonte también evita re-enviar con una "contraseña actual" que ya dejó de serlo.

**6. Orden de operaciones, y el cliente descartable.** La secuencia es verificar → actualizar → revocar, y el primer paso corre sobre un cliente aparte:

```
1. tmp = createClient(url, anonKey, {         2. supabase.auth.updateUser({ password })
     auth: { persistSession: false,              ← cliente vivo de la app
             autoRefreshToken: false,
             detectSessionInUrl: false } })   3. supabase.auth.signOut({ scope: 'others' })
   tmp.signInWithPassword(email, current)        ← revoca las demás + la huérfana de (1)
```

El motivo del cliente descartable: `signInWithPassword` **crea una sesión nueva del lado del servidor** cada vez que tiene éxito. Hacerlo sobre el cliente vivo reemplazaría la sesión en curso en medio del flujo — en web eso significa reescribir las cookies de auth que el middleware lee en el request siguiente, y en mobile reescribir SecureStore — dejando al usuario en una sesión recién rotada si el paso 2 falla. Con `persistSession: false` la verificación no toca ni cookies ni SecureStore: es un predicado puro y todo camino de error deja la sesión exactamente como estaba.

En web el cliente descartable **no** se crea con `createBrowserClient` de `@supabase/ssr` (escribe cookies por diseño) sino con el `createClient` pelado que exporta `@grana/supabase`, que es el mismo que ya usa mobile.

Detalle feliz: el paso 1 deja una sesión huérfana del lado del servidor (creada por la verificación, nunca persistida en ningún cliente). El paso 3, al ser `'others'`, la revoca junto con las de los demás dispositivos. La secuencia se limpia sola.

**7. El estado parcial se reporta, no se traga.** Si el paso 2 tiene éxito y el 3 falla, la contraseña **quedó cambiada** y los otros dispositivos **siguen adentro**. Es el único estado intermedio posible y se resuelve mostrando la card de éxito con el body alternativo: éxito del cambio (irreversible, hay que reportarlo como hecho) más el aviso de que la revocación no ocurrió. Ni reintentar en silencio ni afirmar el éxito completo: tragarse ese error convertiría la promesa de seguridad del copy en una mentira exactamente en el caso donde importa.

**8. `invalid_credentials` va a nivel de campo.** El error de contraseña actual incorrecta se renderiza sobre el campo "Contraseña actual"; el `Alert` / `FormError` del formulario queda para los errores que no son de un campo (`same_password`, `weak_password`, `over_request_rate_limit`, genérico). Todos los códigos ya están en `mapSupabaseError`; lo que cambia es **dónde** se pinta, no el mapeo. `same_password` podría discutirse como error de campo sobre "Nueva contraseña", pero viene de `updateUser` (paso 2) y no de la validación local, así que se trata como los demás errores de servidor.

**9. `changePasswordSchema` vive en `@grana/validation`.** Es `resetSchema` más `currentPassword: yup.string().label('current_password').required()`, con `passwordRules` compartido intacto para los otros dos campos. Va al package y no a cada app porque es la convención del repo (el requirement de schemas unificados de `auth`) y porque las dos plataformas lo consumen igual: web vía `yupResolver`, mobile vía `schema.validate({ abortEarly: false })`.

**10. La pantalla mobile se monta sobre `FormScreen`.** `FormScreen` compone `PageHeader` + `KeyboardAwareScrollView` y documenta que la pantalla **no** declara `SafeAreaView edges={['top']}` propio porque el header se hace cargo del inset superior. Con tres campos de password y el teclado en pantalla, el manejo de teclado que trae el shell no es opcional.

Eso choca con la letra de la capability `settings`, que dice que *cada* pantalla del stack (root o anidada) envuelve su contenido en `SafeAreaView edges={['top']}`. **El drift ya existe hoy**: `/settings/categories/new` usa `FormScreen` sin `SafeAreaView` desde que el shell existe. Este change acota la cláusula a las pantallas que componen el árbol a mano y deja explícito que las montadas sobre `FormScreen` delegan el inset en `PageHeader` — reconciliación de una línea, sin cambio de código, en vez de sumar una pantalla nueva que contradiga el spec.

## Risks / Trade-offs

- **Reintentos con la contraseña actual equivocada chocan contra el rate limit de Supabase Auth** → cada intento fallido es un `signInWithPassword` real, así que tres tanteos pueden devolver `over_request_rate_limit` en lugar de "contraseña incorrecta". El código ya está mapeado y se renderiza a nivel formulario; el scenario está escrito para que el comportamiento sea el esperado y no una sorpresa de soporte.
- **Los otros dispositivos siguen operativos hasta que expire su access token** (hasta 1h) → limitación del modelo de tokens de Supabase, no del código. Se mitiga con copy honesto (decisión 4). Quien necesite corte inmediato tiene que bajar el TTL del JWT a nivel proyecto.
- **Estado parcial: contraseña cambiada, sesiones no revocadas** → decisión 7, con scenario propio y body alternativo en la card.
- **Usar `createBrowserClient` por descuido para el cliente de verificación en web** → escribiría cookies de auth y rompería la propiedad que justifica el paso 1. La tarea nombra el import correcto y la verificación lo chequea explícitamente.
- **Olvidar el `scope` en el `signOut` final** → el default `'global'` desloguearía al usuario del dispositivo donde está, con el agravante de que en mobile el redirect a `(auth)/login` lo dispara el listener del root layout y parecería un bug de navegación, no de scope. Es el error más fácil de cometer del change; hay scenario dedicado.
- **Los errores de validación de Yup en mobile salen en español aunque el locale sea `en`** → limitación preexistente y transversal (`apps/mobile/lib/yup-locale.ts` fija los literales a nivel de módulo), no introducida acá. El copy propio del change sí queda localizado en los dos idiomas; las tres cadenas base (`required`, `min`, `email`) no, hasta que se haga el change dedicado. La verificación en `en` lo chequea con ese alcance explícito para no dar por bueno un falso positivo ni bloquear este change por deuda ajena.
- **Verificación manual**: el repo no tiene tests de UI nativa, y el flujo cruza dos dispositivos (hay que comprobar que la sesión del otro efectivamente cae). La red de seguridad es el checklist de la sección 7 de `tasks.md` más `lint`/`typecheck` para el resto.
