## Context

Después de `mobile-settings-parity` (archived 2026-05-25), el switcher de idioma web es funcional end-to-end: la cookie `NEXT_LOCALE` resuelve el locale, el `<Footer />` está montado en `(app)` y `(auth)`, y `apps/web/app/(app)/settings/**` está 100% traducido vía `next-intl`.

El gap actual: el resto de rutas autenticadas (`/accounts`, `/cards`, `/transactions`) tiene strings hardcoded en español. Inventario aproximado (medido durante la fase de exploración):

- `accounts/**`: ~9 archivos, ~15-20 strings hardcoded. No importa `next-intl` en ningún archivo.
- `cards/**`: ~32 archivos, ~25-35 strings hardcoded. No existe namespace `cards` en los catálogos. **Namespace nuevo requerido.**
- `transactions/**`: a auditar (cantidad menor; namespace `transactions.*` ya existe parcialmente).
- Server actions (`apps/web/app/_actions/`): `accounts.ts` (~11 líneas), `credit-cards.ts` (~34 líneas), `recurrences.ts` (~30+ líneas), `transactions.ts` (~12 líneas) devuelven `formError: error.message` raw de Postgres. Total ~100+ líneas a refactorizar.

Estado de los catálogos `packages/i18n-messages/src/{es,en}.json`:
- Namespaces existentes: `error`, `auth`, `validation`, `dashboard`, `settings`, `common`, `nav`, `onboarding`, `categories`, `accounts`, `transactions`, `subcategories`.
- `accounts.*` y `transactions.*` tienen cobertura parcial — claves existen para algunos labels pero no para todo el árbol UI.
- `cards.*` **no existe**: hay que crearlo desde cero.

El patrón canónico de error handling localizado ya está implementado en `apps/web/app/_actions/categories.ts` (función `translatePostgresError`). Es la referencia.

## Goals / Non-Goals

**Goals:**

- Toda ruta bajo `apps/web/app/(app)/**` responde al cambio de locale: si el usuario cambia a `en`, no queda ningún string visible en español (salvo, obviamente, datos ingresados por el usuario y nombres propios).
- Server actions de web devuelven `formError` con texto ya localizado al locale activo. No más mensajes de Postgres raw en la UI.
- Paridad de claves entre `es.json` y `en.json` enforced por el type `Messages = typeof es` (sigue siendo la misma estrategia que hoy).
- Un mismo helper de traducción de errores Postgres (estructurado como `translatePostgresError`) se reusa entre server actions en lugar de duplicarse.

**Non-Goals:**

- **No** se cambia el motor de i18n. Se mantiene `next-intl`, cookie-based locale resolution, `<Footer />` con switcher.
- **No** se renombra la ruta `/transactions` a `/movimientos`. El slug visible "Movimientos" se traduce vía clave i18n; la URL queda como está (otro change, si llega).
- **No** se traducen strings de mobile. Esta change es web-only. Las claves nuevas quedan accesibles desde mobile vía `useT()` sin trabajo adicional.
- **No** se agregan idiomas nuevos (sigue siendo `es` + `en`).
- **No** se introduce ICU plurals/select complejos si las cadenas actuales no los requieren. Se mantiene el estilo simple `{param}` ya en uso.
- **No** se traduce el contenido de los catálogos de subcategorías ni nombres de categorías de sistema (eso vive en `subcategories.*` / `categories.*` y ya tiene su propia política).
- **No** se traducen mensajes de log/audit/console. Solo lo que llega al usuario.

## Decisions

### D1 — Helper `translatePostgresError` compartido entre server actions

**Decisión:** extraer un helper genérico `translatePostgresError(code, kind)` a un módulo compartido, p. ej. `apps/web/app/_actions/_lib/translate-error.ts`, en lugar de duplicar la función en cada archivo de server actions.

**Alternativa considerada:** dejar una copia inline en cada `_actions/*.ts` (como hoy en `categories.ts`). Rechazado: ya hay 4+ server actions a tocar; una copia en cada uno produce drift inevitable, y cada nuevo error code obliga a editar N archivos.

**Forma:** el helper recibe el código Postgres y un `kind` discriminator (`'account' | 'card' | 'transaction' | 'recurrence' | 'category' | 'subcategory' | ...`) y devuelve un string ya traducido. Internamente hace `getTranslations('<kind>.errors')` y resuelve la clave por código. Códigos no mapeados caen a `<kind>.errors.generic`.

**Razón:** mantiene el call site corto (`return { ok: false, formError: await translatePostgresError(error.code, 'account') }`) y centraliza la lógica de mapeo.

### D2 — Namespace `cards.*` nuevo, no anidado bajo otro

**Decisión:** crear top-level namespace `cards.*` en los catálogos i18n.

**Alternativa considerada:** anidar bajo `accounts.cards.*` o bajo `dashboard.cards.*`. Rechazado: la capability `cards` es first-class en el dominio (off-ledger, períodos, instalments) y merece su propio namespace, alineado con la convención usada por `accounts`, `transactions`, `categories`.

### D3 — Sub-key convention dentro de cada namespace

**Decisión:** dentro de cada namespace usar sub-keys agrupadas por tipo de string:
- `title`, `description`, `subtitle` — encabezados de página/sección.
- `labels.*` — labels de form fields y campos de detalle.
- `actions.*` — texto de botones y CTAs.
- `empty.*` — copy de empty states.
- `errors.*` — mensajes de error que devuelven server actions o validaciones, indexados por código semántico (no por código Postgres).
- `confirmations.*` — copy de modales de confirmación.

Es la convención que ya está parcialmente usada por `settings.*` y `categories.*`; se generaliza.

### D4 — Server Components vs. Client Components

**Decisión:** seguir las reglas estándar de `next-intl`:
- Server Component (sin `'use client'`): `const t = await getTranslations('ns')`.
- Client Component (`'use client'`): `const t = useTranslations('ns')`.

Nunca pasar funciones `t` como prop entre Server → Client (rompe la serialización). Si un Client Component necesita strings, se importa `useTranslations` localmente.

**Razón:** este es el patrón ya en uso en `settings/**` y en `auth/**`. No introducir variantes.

### D5 — Claves "wide" antes que "tall"

**Decisión:** preferir claves descriptivas medianamente largas (`cards.detail.limit_summary.over_limit_warning`) en lugar de claves cortas opacas (`cards.olw`). Si el JSON pesa más, no importa — pesa lo mismo en bundle (es un import compartido) y es radicalmente más legible en review.

### D6 — Auditoría con grep, no AST

**Decisión:** la auditoría de strings hardcoded se hace con `grep`/búsqueda manual heurística (strings entre comillas con caracteres acentuados, palabras como "Cuenta", "Tarjeta", etc.), no con un parser AST.

**Razón:** el esfuerzo de un linter custom no se justifica para 3 rutas. El reviewer cierra el gap.

## Risks / Trade-offs

- **[Riesgo]** Drift de claves entre `es.json` y `en.json` al agregar muchas claves nuevas → **Mitigación:** el type `Messages = typeof es` exportado por `@grana/i18n-messages` ya hace fail al compilar TS si una clave usada por `useTranslations`/`getTranslations` no existe en el catálogo. Workflow: agregar primero a `es.json`, después a `en.json`, después usar en el componente.

- **[Riesgo]** Traducciones inglesas pobres por hacerlas a vuelo sin contexto → **Mitigación:** este change es estructural (asegurar coverage); refinar el inglés es un follow-up aceptable, pero el inglés actual de la app ya es razonable y el reviewer puede señalar gemas. El usuario es nativo del dominio (accountant) y revisa.

- **[Trade-off]** El helper `translatePostgresError` introduce un overhead pequeño (otro `await getTranslations`) por cada error en server action → aceptable, el path de error no es hot.

- **[Riesgo]** Strings que se construyen por concatenación (`"Eliminar " + nombre`) son fáciles de traducir incompletamente, dejando solo la parte estática traducida → **Mitigación:** usar interpolación `{name}` en la clave i18n, no concatenación, en todo string nuevo que se toque.

- **[Riesgo]** Hardcoded strings que vienen de la DB (p. ej. nombre de la categoría "Comida") no se traducen y el usuario puede pensar que el switcher está roto → **Aceptación consciente:** los datos del usuario nunca se traducen. Los nombres de categorías de sistema viven en `categories.*` con clave i18n y se renderizan vía `t()` por separado; eso queda fuera de scope acá.

- **[Trade-off]** No se introduce un lint rule que prohíba strings literales en JSX bajo `(app)/**` → costo de mantenimiento mayor al beneficio para esta etapa. El reviewer cierra el gap.
