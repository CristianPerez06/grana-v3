## ADDED Requirements

### Requirement: La app provee un componente RouteNotFound reutilizable

La app web SHALL exponer un componente `RouteNotFound` reutilizable en `apps/web/components/ui/route-not-found.tsx`. El componente SHALL aceptar las strings ya traducidas y un destino de navegación, y SHALL mostrar al usuario:

1. Un título corto en el idioma activo del usuario (ej. en español: "No encontramos esa página" o, en variantes por módulo, "No encontramos esa tarjeta").
2. Una descripción breve en el idioma activo (ej. "Puede haber sido eliminada o no existir").
3. Un botón de acción primaria (variant `primary` del `Button` interno) etiquetado con `backLabel` que navega a `backHref` mediante el `<Link>` de Next.

El componente NO SHALL exponer un callback de reintento — la semántica es navegación a un punto de partida conocido, no recuperación. El componente SHALL alinear su disposición visual con `<RouteError>` (contenedor centrado, `min-h-[50vh]`, padding `px-6 py-12`, tipografía `text-lg font-semibold text-text` para el título) para mantener coherencia entre estados terminales de ruta. El componente NO SHALL usar `role="alert"` (no es un error); MAY omitir role o usar `role="status"`.

El tipo `RouteNotFoundProps` SHALL vivir en `packages/ui-contracts/`:

```ts
type RouteNotFoundProps = {
  title: string
  description: string
  backHref: string
  backLabel: string
  className?: string  // solo significativo en web
}
```

Las props se pasan ya traducidas — el componente NO SHALL invocar `useTranslations` internamente. La razón es que el set de strings depende del módulo (cada `not-found.tsx` consume su propio namespace) y delegar la traducción al caller mantiene al primitivo agnóstico del scope de i18n.

#### Scenario: RouteNotFound web renderiza título, descripción y link funcional

- **WHEN** un `not-found.tsx` renderiza `<RouteNotFound title="Card not found" description="It may have been deleted or never existed." backHref="/cards" backLabel="Back to cards" />`
- **THEN** la pantalla muestra el título "Card not found"
- **AND** muestra la descripción "It may have been deleted or never existed."
- **AND** muestra un botón "Back to cards" que apunta a `/cards`
- **AND** hacer click sobre el botón navega a `/cards`

#### Scenario: RouteNotFound no anuncia como alerta

- **WHEN** un screen reader recorre el árbol accesible de una pantalla con `<RouteNotFound />`
- **THEN** el componente NO se anuncia con `role="alert"` (reservado a errores)

### Requirement: Toda ruta dinámica de id en (app) tiene un not-found.tsx ancestro que preserva chrome

Toda ruta dentro de `apps/web/app/(app)/**` que llame a `notFound()` desde `next/navigation` SHALL estar cubierta por al menos un `not-found.tsx` ubicado en algún ancestro del árbol de segmentos, de modo que el fallback default chromeless de Next.js NUNCA se exhiba al usuario autenticado.

La cobertura SHALL cumplir:

1. EXISTE `apps/web/app/(app)/not-found.tsx` como **floor global**. Renderiza `<RouteNotFound>` con las strings genéricas del namespace `notFound.generic`, `backHref="/dashboard"`, `backLabel` desde `notFound.generic.back_label`. Por su posición en el árbol, queda envuelto por `(app)/layout.tsx` y por lo tanto preserva el `AppShell` (sidebar + main area).

2. CADA módulo cuyo árbol contiene rutas dinámicas de id con `notFound()` que se beneficien de un back-link más específico SHALL definir su propio `<modulo>/not-found.tsx`. En el alcance inicial, esto cubre:
   - `apps/web/app/(app)/cards/not-found.tsx` → `backHref="/cards"`, namespace `notFound.cards`
   - `apps/web/app/(app)/accounts/not-found.tsx` → `backHref="/accounts"`, namespace `notFound.accounts`
   - `apps/web/app/(app)/transactions/not-found.tsx` → `backHref="/transactions"`, namespace `notFound.transactions`
   - `apps/web/app/(app)/settings/categories/not-found.tsx` → `backHref="/settings/categories"`, namespace `notFound.categories`

3. El `not-found.tsx` por módulo SHALL ser un Server Component que invoca `getTranslations('notFound')` y pasa las strings del sub-namespace correspondiente al `<RouteNotFound>`.

4. NUEVAS rutas dinámicas de id en `(app)` con llamadas a `notFound()` SHALL caer bajo el floor global por defecto. Si el módulo dueño de la ruta no tiene aún un `not-found.tsx` propio y su back-link a un índice de módulo aporta valor sobre `/dashboard`, ese módulo SHALL agregar su `not-found.tsx`.

La cobertura aplica con independencia de la Variant (A/B/C) que la ruta use para loading/error. El boundary de not-found es ortogonal a esos variants.

#### Scenario: Acceder a /cards/<id-inexistente> conserva el chrome del módulo

- **GIVEN** un usuario autenticado
- **WHEN** navega a `/cards/<id-que-no-existe>`
- **THEN** la respuesta renderiza `<AppShell>` (sidebar visible)
- **AND** renderiza el chrome de `cards/layout.tsx` (header del módulo Cards)
- **AND** dentro del slot principal muestra el contenido localizado de `notFound.cards`
- **AND** ofrece un botón "Volver a tarjetas" que navega a `/cards`
- **AND** NO muestra el texto literal "404 | This page could not be found"

#### Scenario: Acceder a /cards/<carpeta-no-existente>/<algo> dentro del subárbol de cards conserva chrome del módulo

- **GIVEN** un usuario autenticado
- **WHEN** navega a una URL dentro del subárbol de un módulo cubierto (ej. `/cards/<id>/wild/segment`) cuyo segmento extra no matchea ningún archivo
- **THEN** Next.js renderiza el `not-found.tsx` más cercano dentro del subárbol (`(app)/cards/not-found.tsx`)
- **AND** la respuesta preserva `<AppShell>` + el header del módulo Cards
- **AND** ofrece el back-link del módulo (`/cards`)

**Nota:** URLs que NO entran a ningún route group de `(app)` (ej. `/blahblah` en la raíz) caen al fallback default de Next.js — quedan fuera del alcance de este change. Cubrirlas requeriría `app/not-found.tsx` a nivel raíz, que no puede preservar AppShell por no tener establecido el contexto de auth/providers, y se trata como un change separado si surge la necesidad.

#### Scenario: Acceder a /accounts/<id-inexistente> usa el back-link de cuentas

- **GIVEN** un usuario autenticado
- **WHEN** navega a `/accounts/<id-que-no-existe>`
- **THEN** el botón de acción primaria del estado not-found apunta a `/accounts`, no a `/dashboard`

### Requirement: Las strings de not-found viven bajo el namespace notFound de @grana/i18n-messages

El paquete `@grana/i18n-messages` SHALL exponer un namespace `notFound` con la siguiente forma:

```jsonc
"notFound": {
  "generic":      { "title": "…", "description": "…", "back_label": "…" },
  "cards":        { "title": "…", "description": "…", "back_label": "…" },
  "accounts":     { "title": "…", "description": "…", "back_label": "…" },
  "transactions": { "title": "…", "description": "…", "back_label": "…" },
  "categories":   { "title": "…", "description": "…", "back_label": "…" }
}
```

Cada sub-namespace SHALL contener las tres claves (`title`, `description`, `back_label`). El español es la fuente canónica del proyecto; el inglés SHALL existir como traducción paralela completa (ninguna clave faltante entre locales).

#### Scenario: Las claves notFound están completas en ambos locales

- **WHEN** se carga `packages/i18n-messages/src/es.json` y `packages/i18n-messages/src/en.json`
- **THEN** ambos archivos contienen el namespace `notFound`
- **AND** los sub-namespaces `generic`, `cards`, `accounts`, `transactions`, `categories` están presentes en ambos
- **AND** cada sub-namespace tiene las claves `title`, `description`, `back_label`
