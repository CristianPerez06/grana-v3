## Why

> **Estado:** EXPLORATION. Esta proposal documenta la dirección, no la decisión. No tiene `tasks.md` ejecutables ni spec delta hasta que el módulo se priorice y se complete su exploración.

Hoy las acciones "Agregar categoría" (`/settings/categories`) y "Agregar subcategoría" (`/settings/categories/[id]/subcategories`) **navegan** a una página dedicada (`/new`) que monta un formulario en una page completa. En cambio, los módulos vecinos (`accounts`, `cards`) ya migraron a un patrón **drawer**: el botón abre un drawer modal que monta el form sin cambiar de URL, con la page `/new` quedando solo como fallback no-JS.

La inconsistencia es perceptible para el usuario:

- En `accounts` y `cards`, "+ Crear cuenta" / "+ Agregar tarjeta" abren un drawer que se cierra y deja al usuario en el listado.
- En `categories`, "+ Agregar" navega a una página separada con un form; tras crear, el usuario vuelve por código (`router.push(…)`) al listado.

La migración a drawer cerraría el gap de paridad UX, alinearía categories con el patrón ya validado en accounts/cards, y eliminaría el round-trip de navegación para la operación más frecuente del módulo (crear una categoría/subcategoría).

Este change queda **parked** hasta que se priorice. El change predecesor `align-settings-headers` ya alinea el chrome (Variant C, header en layout, Button primitivo en las actions) — esta exploración se monta sobre ese trabajo y NO debe arrancar antes de que `align-settings-headers` esté en `main`.

## What Changes (alcance preliminar — sujeto a exploración)

A confirmar durante la exploración. Sketch inicial:

- **MODIFICAR** `apps/web/app/(app)/settings/categories/_components/categories-header.tsx`: reemplazar el `<Button asChild><Link href="…/new">` por un `<CreateCategoryButton />` que abre un drawer (siguiendo el patrón de `CreateAccountButton` en `apps/web/app/(app)/accounts/_components/create-account-button.tsx`).
- **AGREGAR** `apps/web/app/(app)/settings/categories/_components/create-category-button.tsx`: trigger + drawer, monta `<CreateCategoryForm variant="drawer" />`.
- **MODIFICAR** `apps/web/app/(app)/settings/categories/new/_components/create-category-form.tsx`: aceptar `variant: 'page' | 'drawer'` con `onClose` / `onSuccess` callbacks, igual que `CreateAccountForm`.
- **ANÁLOGO** para la acción de subcategorías: `CreateSubcategoryButton` que abre drawer + `CreateSubcategoryForm` con variants.
- **MANTENER** las pages `/settings/categories/new` y `/settings/categories/[id]/subcategories/new` como fallback no-JS (no se borran).
- Posiblemente **AGREGAR** un primitivo o pattern compartido si la lógica trigger+drawer aparece por tercera vez (umbral del feedback `feedback_reusable_components`: ≥2 rutas con duplicación real ya alcanzado entre accounts/cards/categories).

## Capabilities (sketch)

A definirse durante la exploración. Probablemente:

- `categories`: agregar un requirement / scenario que documente el patrón drawer-first para creación, con la page `/new` como fallback no-JS.
- Posiblemente actualizar `overlay-primitives` o crear un nuevo capability para el trigger+drawer compartido si se extrae.

## Open Questions

A resolver antes de pasar a `tasks.md` ejecutable:

1. **¿Mismo drawer para edit?** En accounts el drawer también edita (no solo crea). ¿Categorías mantiene `/[id]/edit` como page o también lo lleva a drawer?
2. **¿Subcategorías comparten el mismo trigger pattern que categorías, o cada uno tiene su botón propio?** Hay una pequeña diferencia: el de subcategorías necesita el `categoryId` del path.
3. **¿Se extrae un pattern compartido `<EntityCreateButton triggerLabel={…} form={…} />` o se duplica el código siguiendo la regla de no abstraer antes de tiempo?**
4. **¿El form `CreateCategoryForm` cambia su shape de submit handler** (de `redirect()` server action a `onSuccess` callback), o el drawer hace su propio submit y la page sigue con redirect?
5. **¿Qué pasa con la navegación post-crear** en mobile-web (`< sm`)? En accounts el drawer cubre full-screen en mobile.

## Impact (preliminar)

**Código:** estimado en 4–6 archivos modificados/creados bajo `apps/web/app/(app)/settings/categories/`, más posiblemente uno o dos en `_components` compartidos.

**APIs / queries:** ninguno nuevo. Reutiliza los server actions existentes de creación.

**i18n:** posibles claves nuevas para el título del drawer (similar a `accounts.actions.create` que ya existe).

**Dependencia bloqueante:** `align-settings-headers` debe estar mergeado a `main` antes de arrancar esta exploración. Esa proposal entrega `categories-header.tsx` con la action ya en `<Button asChild>`, que es el punto de partida del refactor.

**Out of scope (incluso después de exploración):**
- Mobile (`apps/mobile`): el módulo de configuración en mobile aún no implementa la sección de categorías. Cuando lo haga, será en su propio change.
- Migrar otras pages de form (transactions/edit, recurring/edit, etc.) — fuera de este alcance.
