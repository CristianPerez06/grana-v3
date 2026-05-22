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

