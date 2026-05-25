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

El helper `t()` global existente en `apps/mobile/lib/i18n.ts` SHALL mantenerse exportado para uso fuera de componentes (helpers puros, mappers de error, código que corre antes de un mount), con un fallback documentado al catálogo `es`. Todo componente que renderea texto traducible SHALL usar `useT()` — incluyendo: pantallas root del shell (`dashboard`, `accounts`, `tarjetas`, `movimientos`), pantallas de auth y onboarding (`welcome`, `perfil`, `saldo-actual`, `done`, `RouteError`), componentes de navegación (`TabBar`, `AppMenu`), todas las secciones del dashboard (`HeroSection`, `UpcomingFortnightSection`, `MonthBalanceSection`, `CardsSection`, `WelcomeFirstMoveCard`, `DashboardHeader`, `EyeMaskToggle`), y todas las pantallas/components nuevos de `/settings` y categorías. El switcher de idioma SHALL afectar toda la app — no solo el subárbol de `/settings`.

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

