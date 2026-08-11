# i18n Specification

## Purpose

Define la estrategia de internacionalización de Grana: catálogos JSON compartidos en `@grana/i18n-messages`, motor `next-intl` en web con resolución de locale por cookie `NEXT_LOCALE` (sin segmento `[locale]` en la URL), language switcher visible en el footer en toda ruta, y un set mínimo de mensajes localizados para auth, validación, errores comunes, placeholders del dashboard y footer. Mobile consume los mismos catálogos vía un helper propio adaptado a React Native.
## Requirements
### Requirement: Soporte multi-idioma con next-intl

El sistema SHALL usar `next-intl` para internacionalización. El conjunto de locales soportados SHALL ser `['es', 'en']` con `es` como default. Los locales SHALL declararse una sola vez en `lib/i18n/config.ts` y consumirse desde `lib/i18n/request.ts` (el entry point `getRequestConfig`).

#### Scenario: El locale por default es español

- **WHEN** un usuario sin cookie `NEXT_LOCALE` carga cualquier ruta
- **THEN** la página renderiza con los mensajes de `es`

#### Scenario: Agregar un nuevo locale es centralizado

- **WHEN** un desarrollador agrega `'pt'` al array de locales en `lib/i18n/config.ts` y agrega `lib/i18n/messages/pt.json`
- **THEN** el sistema puede renderizar en portugués sin tocar `request.ts`, el middleware, el switcher ni ninguna page

### Requirement: La resolución de locale es vía cookie, no por URL

El sistema SHALL determinar el locale activo leyendo la cookie `NEXT_LOCALE`. El sistema SHALL NOT usar un segmento `[locale]` en la URL. Si la cookie está ausente o tiene un valor no soportado, el sistema SHALL caer al locale por default.

#### Scenario: La cookie selecciona el locale

- **WHEN** un request llega con la cookie `NEXT_LOCALE=en`
- **THEN** la página renderizada usa los mensajes en inglés

#### Scenario: Un valor de cookie no soportado cae al default

- **WHEN** un request llega con la cookie `NEXT_LOCALE=fr` (no está en el set soportado)
- **THEN** la página renderizada usa el locale por default (`es`)

#### Scenario: La cookie es bootstrapeada por el middleware

- **WHEN** un request sin cookie `NEXT_LOCALE` llega al middleware
- **THEN** el middleware setea `NEXT_LOCALE` con el locale por default en la response

### Requirement: Language switcher en el footer en toda ruta

El sistema SHALL renderizar un componente `<Footer />` en toda ruta (tanto los grupos `(auth)` y `(app)` como las rutas públicas) que contenga un `<LanguageSwitcher />`. Activar un idioma SHALL actualizar la cookie `NEXT_LOCALE` vía un server action y re-renderizar el layout.

#### Scenario: Switcher visible en login

- **WHEN** un usuario anónimo está en `/login`
- **THEN** el footer con el language switcher es visible al pie del viewport

#### Scenario: Switcher visible en el dashboard

- **WHEN** un usuario autenticado está en `/dashboard`
- **THEN** el footer con el language switcher es visible al pie del viewport

#### Scenario: Cambiar el locale persiste entre navegaciones

- **WHEN** un usuario clickea "EN" en el language switcher y luego navega a una ruta distinta
- **THEN** la nueva página renderiza con los mensajes en inglés
- **AND** la cookie `NEXT_LOCALE=en` está presente en el próximo request

### Requirement: Mensajes localizados para auth, validación, errores, dashboard placeholder y footer

Los catálogos en `lib/i18n/messages/es.json` y `lib/i18n/messages/en.json` SHALL contener claves como mínimo para: cada string visible de las páginas de auth (signup, login, forgot-password, reset-password, mensajes del callback), el placeholder del dashboard, el header (label de logout), el footer, cada mensaje de validación de Yup y cada entrada del mapeo de códigos de error de Supabase.

#### Scenario: Ambos catálogos cubren las mismas claves

- **WHEN** un desarrollador corre el chequeo de paridad de catálogos i18n del proyecto (o diffea manualmente los JSON)
- **THEN** toda clave presente en `es.json` también está en `en.json` y viceversa

#### Scenario: Mensajes de validación localizados

- **WHEN** el locale activo es `en` y un usuario envía `/signup` con un email faltante
- **THEN** el formulario muestra un mensaje de validación en inglés (desde la llamada a `yup.setLocale` alimentada por el catálogo)

#### Scenario: Un error de Supabase se renderiza en el locale activo

- **WHEN** el locale activo es `es` y `loginAction` recibe el código de Supabase `invalid_credentials`
- **THEN** el formulario muestra el mensaje en español guardado bajo `auth.errors.invalid_credentials`

### Requirement: Soporte multi-idioma en mobile vía LocaleProvider (mobile)

`apps/mobile` SHALL soportar los mismos locales que web (`es`, `en`) consumiendo los mismos catálogos JSON de `@grana/i18n-messages`. El default SHALL ser `es`.

La selección activa SHALL persistirse en `expo-secure-store` bajo la clave `locale` (valores `'es'` | `'en'`). Si la clave está ausente o tiene un valor no soportado, la app SHALL caer al locale por default (`es`).

La distribución del locale activo a componentes SHALL implementarse con un `LocaleProvider` ubicado cerca del root layout (`apps/mobile/app/_layout.tsx`), que expone:

- `useLocale(): Locale` — locale activo.
- `setLocale(next: Locale): Promise<void>` — escribe SecureStore y actualiza el state del provider, disparando re-render reactivo.
- `useT(): (key: string, params?) => string` — hook que devuelve la función `t` ligada al catálogo del locale activo.

El helper `t()` global existente en `apps/mobile/lib/i18n.ts` SHALL mantenerse exportado para uso fuera de componentes (helpers puros, mappers de error, código que corre antes de un mount), con un fallback documentado al catálogo `es`. Todo componente que renderea texto traducible SHALL usar `useT()` — incluyendo: pantallas root del shell (`dashboard`, `accounts`, `tarjetas`, `movimientos`), pantallas de auth y onboarding (`welcome`, `initial-balance`, `done`, `RouteError`), componentes de navegación (`TabBar`, `AppMenu`), todas las secciones del dashboard (`HeroSection`, `UpcomingFortnightSection`, `MonthBalanceSection`, `CardsSection`, `WelcomeFirstMoveCard`, `DashboardHeader`, `EyeMaskToggle`), y todas las pantallas/components nuevos de `/settings` y categorías. El switcher de idioma SHALL afectar toda la app — no solo el subárbol de `/settings`.

#### Scenario: El locale por default es español en mobile

- **WHEN** un usuario instala la app sin haber tocado la preferencia
- **THEN** el `LocaleProvider` resuelve `locale = 'es'`
- **AND** las pantallas que usan `useT()` renderean con strings en español

#### Scenario: setLocale persiste y re-renderea inmediatamente

- **WHEN** un componente consumidor llama `setLocale('en')`
- **THEN** SecureStore guarda `locale=en`
- **AND** el provider actualiza su state interno
- **AND** todos los consumers de `useT()` re-renderean con strings en inglés sin recargar la app

#### Scenario: Un valor no soportado en SecureStore cae al default

- **WHEN** la SecureStore tiene `locale=fr` (no soportado)
- **THEN** el `LocaleProvider` cae a `es` y NO crashea
- **AND** la app arranca con strings en español

#### Scenario: El switcher afecta toda la app, no solo /settings

- **WHEN** un usuario activo en cualquier ruta cambia el locale a `en` desde `/settings`
- **THEN** al navegar al dashboard, tab bar, AppMenu, accounts, tarjetas, movimientos o cualquier subcomponente del dashboard, los strings aparecen en inglés
- **AND** los labels de navegación ("Home", "Movements") y los headers de sección del dashboard ("To spend", "What's coming") también responden al cambio

#### Scenario: El locale mobile es independiente del locale web

- **WHEN** un usuario tiene `NEXT_LOCALE=en` en su navegador y la SecureStore mobile sin valor
- **THEN** la app mobile arranca en `es` (su propio default)
- **AND** cambiar el locale en una plataforma no modifica la otra

### Requirement: Cobertura i18n completa en rutas autenticadas web

Toda ruta bajo `apps/web/app/(app)/**` SHALL renderizar texto exclusivamente vía `next-intl` (`getTranslations` en Server Components, `useTranslations` en Client Components). Ningún string visible al usuario en estas rutas SHALL estar hardcoded en código JSX o en `string` literales de TypeScript que se rendereen al DOM.

Quedan explícitamente cubiertas, sin que esta lista sea taxativa: `accounts/**` (lista, alta, detalle y todos sus componentes), `cards/**` (lista, alta, detalle y todos sus componentes), `transactions/**` (lista, alta, detalle y todos sus componentes). El `<Footer />` y el `<Header />` ya están cubiertos por el requirement de language switcher existente. Esta cobertura SHALL incluir además los componentes compartidos que viven fuera del árbol de rutas pero son consumidos por ellas — en particular `apps/web/lib/transactions/components/**` y `apps/web/lib/recurrences/components/**`.

Toda clave nueva referenciada por `useTranslations`/`getTranslations` SHALL existir tanto en `packages/i18n-messages/src/es.json` como en `packages/i18n-messages/src/en.json`. La paridad SHALL estar enforced en tiempo de compilación por el type `Messages = typeof es` ya exportado por `@grana/i18n-messages`.

Excepciones permitidas (no se consideran "strings hardcoded"):
- Contenido provisto por el usuario (nombres de cuenta, monto, fecha mostrada en formato locale-aware).
- Nombres propios y siglas (`Grana`, `ARS`, `USD`).
- Identificadores técnicos no visibles (clases CSS, atributos `data-*`, `id`).
- Mensajes de log/audit/console no expuestos al usuario.

#### Scenario: Cambiar a inglés traduce la página de cuentas

- **WHEN** un usuario autenticado tiene `NEXT_LOCALE=en` y navega a `/accounts`
- **THEN** la página renderiza el título, el botón de crear, el estado vacío, las secciones (efectivo, bancarias, archivadas) y cada componente de fila en inglés
- **AND** no aparece ningún string en español originado en código (los datos propios del usuario sí pueden estar en cualquier idioma, eso no es responsabilidad del switcher)

#### Scenario: Cambiar a inglés traduce la página de tarjetas

- **WHEN** un usuario autenticado tiene `NEXT_LOCALE=en` y navega a `/cards` o `/cards/<id>`
- **THEN** la página renderiza encabezados, labels, CTAs, copy del card hero, el resumen de límite, las fechas de cierre/vencimiento y los banners en inglés

#### Scenario: Cambiar a inglés traduce la página de movimientos

- **WHEN** un usuario autenticado tiene `NEXT_LOCALE=en` y navega a `/transactions`, `/transactions/new` o `/transactions/<id>`
- **THEN** la página renderiza encabezados, labels, filtros y CTAs en inglés
- **AND** los componentes compartidos consumidos por la ruta (`MovementFilters`, `GlobalMovementList`, `PendingRecurrencesBlock`, `RecurrenceSuggestionBanner`) también renderean en inglés

#### Scenario: Una clave i18n usada en un componente debe existir en ambos catálogos

- **WHEN** un desarrollador agrega `t('cards.detail.limit_summary.over_limit_warning')` en un componente nuevo
- **AND** la clave existe solo en `es.json`
- **THEN** el build de TS (`pnpm --filter web build`) falla porque el type `Messages = typeof es` no contiene la clave en una rama que el código fuerza

### Requirement: Errores de server actions web devueltos como mensajes localizados

Todo `'use server'` action bajo `apps/web/app/_actions/` que pueda devolver un error originado en la base de datos (códigos Postgres) SHALL mapear ese error a un mensaje localizado en el locale activo antes de retornar. El campo `formError` del `ActionResult` SHALL contener texto ya traducido, listo para renderizar verbatim por el cliente. El sistema SHALL NOT devolver `error.message` raw de Postgres (`"duplicate key value violates unique constraint..."`, `"new row for relation ... violates check constraint..."`, etc.) como `formError`.

El mapeo SHALL implementarse vía un helper compartido — `translatePostgresError` en `apps/web/app/_actions/_lib/translate-error.ts`. El helper SHALL aceptar un código Postgres (o `undefined`) y un discriminador semántico de dominio (`'account' | 'card' | 'transaction' | 'recurrence' | 'category' | 'subcategory'`), y devolver un string traducido. Códigos no mapeados SHALL caer a un mensaje genérico del dominio (clave `<dominio>.errors.generic`).

Quedan cubiertas como mínimo: `apps/web/app/_actions/accounts.ts`, `apps/web/app/_actions/credit-cards.ts`, `apps/web/app/_actions/recurrences.ts`, `apps/web/app/_actions/transactions.ts`, además del archivo `categories.ts` que ya cumple el patrón.

Errores de aplicación que NO provienen de Postgres pero que llegan al cliente (por ejemplo, `RecurrenceMapError` en `apps/web/lib/recurrences/mapper.ts`) SHALL traducirse en el server action que los captura vía su propio namespace i18n (`recurrences.mapper_errors.<code>`), no devolver `error.message` raw.

#### Scenario: Un error de duplicado en `createAccount` devuelve mensaje localizado

- **WHEN** un usuario con `NEXT_LOCALE=en` invoca `createAccount` con un nombre que ya existe
- **AND** Postgres devuelve código `23505` (unique violation)
- **THEN** el `ActionResult` retornado tiene `ok: false` y `formError` contiene el mensaje en inglés correspondiente a `accounts.errors.duplicate`
- **AND** `formError` no contiene `"duplicate key value violates unique constraint..."` raw

#### Scenario: Un error de validación de constraint en credit cards devuelve mensaje localizado

- **WHEN** un usuario con `NEXT_LOCALE=es` invoca un server action sobre una tarjeta de crédito que viola un CHECK constraint (por ejemplo `chk_installments_ars_only`)
- **THEN** el `ActionResult` retornado tiene `ok: false` y `formError` contiene un mensaje en español tomado de `cards.errors.*` (o equivalente semántico para el constraint), no el texto raw del CHECK violation

#### Scenario: Un error con código Postgres no mapeado cae a un mensaje genérico

- **WHEN** un server action recibe un error Postgres con un código no contemplado en el mapeo del dominio
- **THEN** el `formError` devuelto es el valor de `<dominio>.errors.generic` en el locale activo
- **AND** `formError` no contiene el código Postgres ni el mensaje raw

#### Scenario: Un `RecurrenceMapError` devuelve mensaje localizado

- **WHEN** un server action de recurrences captura un `RecurrenceMapError` con `code='missing_category'`
- **THEN** el `formError` devuelto es el valor de `recurrences.mapper_errors.missing_category` en el locale activo
- **AND** `formError` no contiene el mensaje en español hardcoded del constructor de la clase

#### Scenario: El helper de traducción de errores se reutiliza, no se duplica

- **WHEN** se inspecciona `apps/web/app/_actions/`
- **THEN** existe un único helper (módulo compartido `apps/web/app/_actions/_lib/translate-error.ts`) que centraliza el mapeo Postgres → i18n
- **AND** los archivos de server actions (`accounts.ts`, `credit-cards.ts`, `recurrences.ts`, `transactions.ts`, `categories.ts`) importan ese helper en lugar de redefinir su propia versión inline

