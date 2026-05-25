## ADDED Requirements

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
