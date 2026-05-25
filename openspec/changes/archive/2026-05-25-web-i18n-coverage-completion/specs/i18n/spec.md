## ADDED Requirements

### Requirement: Cobertura i18n completa en rutas autenticadas web

Toda ruta bajo `apps/web/app/(app)/**` SHALL renderizar texto exclusivamente vía `next-intl` (`getTranslations` en Server Components, `useTranslations` en Client Components). Ningún string visible al usuario en estas rutas SHALL estar hardcoded en código JSX o en `string` literales de TypeScript que se rendereen al DOM.

Quedan explícitamente cubiertas, sin que esta lista sea taxativa: `accounts/**` (lista, alta, detalle y todos sus componentes), `cards/**` (lista, alta, detalle y todos sus componentes), `transactions/**` (lista, alta, detalle y todos sus componentes). El `<Footer />` y el `<Header />` ya están cubiertos por el requirement de language switcher existente.

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

#### Scenario: Una clave i18n usada en un componente debe existir en ambos catálogos

- **WHEN** un desarrollador agrega `t('cards.detail.limit_summary.over_limit_warning')` en un componente nuevo
- **AND** la clave existe solo en `es.json`
- **THEN** el build de TS (`pnpm --filter web build`) falla porque el type `Messages = typeof es` no contiene la clave en una rama que el código fuerza

### Requirement: Errores de server actions web devueltos como mensajes localizados

Todo `'use server'` action bajo `apps/web/app/_actions/` que pueda devolver un error originado en la base de datos (códigos Postgres) SHALL mapear ese error a un mensaje localizado en el locale activo antes de retornar. El campo `formError` del `ActionResult` SHALL contener texto ya traducido, listo para renderizar verbatim por el cliente. El sistema SHALL NOT devolver `error.message` raw de Postgres (`"duplicate key value violates unique constraint..."`, `"new row for relation ... violates check constraint..."`, etc.) como `formError`.

El mapeo SHALL implementarse vía un helper compartido análogo a `translatePostgresError` ya en uso en `apps/web/app/_actions/categories.ts`. El helper SHALL aceptar un código Postgres (o `undefined`) y un discriminador semántico de dominio (`'account' | 'card' | 'transaction' | 'recurrence' | 'category' | 'subcategory' | ...`), y devolver un string traducido. Códigos no mapeados SHALL caer a un mensaje genérico del dominio (clave `<dominio>.errors.generic`).

Quedan cubiertas como mínimo: `apps/web/app/_actions/accounts.ts`, `apps/web/app/_actions/credit-cards.ts`, `apps/web/app/_actions/recurrences.ts`, `apps/web/app/_actions/transactions.ts`, además del archivo `categories.ts` que ya cumple el patrón.

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

#### Scenario: El helper de traducción de errores se reutiliza, no se duplica

- **WHEN** se inspecciona `apps/web/app/_actions/`
- **THEN** existe un único helper (módulo compartido, p. ej. `apps/web/app/_actions/_lib/translate-error.ts`) que centraliza el mapeo Postgres → i18n
- **AND** los archivos de server actions (`accounts.ts`, `credit-cards.ts`, `recurrences.ts`, `transactions.ts`, `categories.ts`) importan ese helper en lugar de redefinir su propia versión inline
