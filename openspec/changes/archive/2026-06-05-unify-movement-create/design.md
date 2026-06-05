## Context

`apps/web` mantiene dos superficies para crear un movimiento — un drawer scoped a `/transactions` y la ruta `/transactions/new` — montadas por separado. El drawer ya es el camino preferido por todos los entry points (FAB, header CTA, empty state); la ruta queda como fallback cuando `useMovementDrawer()` está temporalmente `null`. La consecuencia: dos shells del mismo formulario pueden coexistir en simultáneo, los success paths divergen, y tres rutas (dashboard, account detail, card detail) hardcodean links a `/transactions/new` porque el provider del drawer está scoped a un único layout. El producto no tiene usuarios reales, así que la ruta puede eliminarse en vez de degradarse — preservarla como fallback re-introduciría la divergencia que motiva el change.

Componentes involucrados (sin reimplementación):

- `apps/web/app/(app)/_components/app-shell.tsx` — chrome (sidebar + topbar + main); destino del nuevo mount del loader.
- `apps/web/app/(app)/transactions/_components/movement-drawer-loader.tsx` — carga `accounts/categories/household` vía TanStack y monta `MovementDrawerProvider`; renderiza `children` aún cuando las queries están pending (el provider simplemente no existe en ese estado).
- `apps/web/app/(app)/transactions/_components/movement-drawer.tsx` — provider + opener (`openCreate(preselectAccountId?)`).
- `apps/web/app/(app)/transactions/new/_components/movement-form.tsx` — el `MovementForm` compartido; lógica del hook viene de `@grana/movement-form`.
- `apps/web/lib/transactions/movement-drawer-context.ts` — `useMovementDrawer()`.

## Goals / Non-Goals

**Goals:**

- Una sola superficie de alta de movimiento, disponible desde cualquier ruta `(app)`.
- Eliminar la URL `/transactions/new` y todo el plumbing exclusivo de la ruta (`resolveReturnHref`, `createReturnHref`, variant `page` del form).
- Mantener las URLs canónicas de detalle (`/transactions/[txId]`) y edición (`/transactions/[txId]/edit`) intactas, incluyendo su lectura de `?from=`.
- Preservar la lógica del formulario en `@grana/movement-form` y los orquestadores en `@grana/transactions-mutations` sin cambios.

**Non-Goals:**

- No tocar la edición de movimientos ni la ruta `/transactions/[txId]/edit`.
- No tocar el alta de movimiento en la app nativa (mobile). El FAB nativo y su requirement sobre `/transactions/new` quedan tal cual (el destino mobile sigue siendo una pantalla futura sin implementar).
- No refactorizar la UX interna del drawer (Save spinner, comportamiento de Close durante una mutación in-flight). Levantado durante la exploración pero ortogonal a este change estructural.
- No promover el loader por encima de `AppShell` para habilitar triggers desde sidebar/topbar. No hay CTAs en chrome hoy; agregar uno es follow-up explícito.
- No agregar fallbacks de `<Link>` para cuando el provider esté `null` durante la primera hidratación. La ruta `/transactions/new` desaparece — no hay destino.

## Decisions

### Decisión 1: drawer-only en vez de drawer + ruta fallback

**Elegimos** eliminar `/transactions/new` por completo.

**Alternativa considerada:** mantener `/transactions/new` como fallback no-JS / deep-link. **Rechazada** porque preserva exactamente la divergencia (dos shells, dos success paths) que motiva el change. Sin usuarios reales no hay deep-links, bookmarks ni clientes sin JS que proteger. Mantenerla como hedge teórico paga el costo estructural completo (provider + ruta + variant `page` del form + plumbing `from=`) por una garantía inutilizada.

**Alternativa considerada:** page-only — borrar el drawer. **Rechazada** porque tira a la basura la UX rápida ya construida; la data layer (`MovementDrawerLoader`) está estructuralmente lista para hostear el drawer app-wide. Mobile resolverá su propio caso (full-screen route) — no es restricción para esta decisión web.

### Decisión 2: mount del loader inside AppShell, alrededor de `{children}`

**Elegimos** mover `<MovementDrawerLoader>` a `apps/web/app/(app)/_components/app-shell.tsx`, envolviendo solo el slot `{children}` que ya envuelve el contenido de cada página. El loader queda dentro de `AppQueryProvider` (su parent en `(app)/layout.tsx`).

```
AppQueryProvider (existente)
└── PreferencesProvider (existente)
    └── AppShell
        ├── Sidebar              ◀── peer; no acceso al drawer
        ├── TopBarMobile         ◀── peer; no acceso al drawer
        ├── Drawer (menú mobile) ◀── peer; no acceso al drawer
        └── <main>
            └── MovementDrawerLoader   ◀── nuevo mount point
                └── {children}
```

**Alternativa considerada:** envolver `<AppShell>` entero desde `(app)/layout.tsx` para que sidebar/topbar también puedan abrir el drawer. **Rechazada** porque ningún elemento de la chrome dispara `openCreate()` hoy ni está planeado a corto plazo. Si esa necesidad aparece, el cambio es trivial (mover el wrapper un nivel arriba) y se trata como follow-up.

**Alternativa considerada:** montar el loader solo en un subconjunto de rutas (`/transactions`, `/dashboard`, `/accounts`, `/cards` — las que tienen CTA de alta hoy). **Rechazada** porque re-introduce la fragmentación que estamos resolviendo: cualquier ruta nueva que quiera el CTA tendría que re-listarse en el set. App-wide es la simplificación correcta.

### Decisión 3: scope acotado del cleanup de `?from=`

**Elegimos** eliminar **solo el lado de creación** del parámetro `?from=`:

- Borrar `resolveReturnHref` y la prop `createReturnHref` del `MovementForm`.
- Borrar los 3 generadores `?from=account:<id>` / `?from=card:<id>` que hoy apuntan a `/transactions/new` (dashboard header, account detail CTA, card header actions).

**Mantenemos** intacto:

- El reader de `?from=` en `apps/web/app/(app)/transactions/[txId]/page.tsx:25-43` y `[txId]/edit/page.tsx`.
- Los 2 generadores `?from=...` que apuntan al detalle (account list-row, card list-row) — sirven para que el back-nav del detalle resuelva al origen list.

**Alternativa considerada:** borrar `?from=` por completo y reemplazar el back-nav del detalle/edición por `router.back()` o el header `Referer`. **Rechazada** porque amplía el scope a un sistema de navegación entero, sin beneficio inmediato; el draft del usuario explícitamente lista `[txId]/edit` como out-of-scope.

**Alternativa considerada:** dejar los generadores del lado de creación intactos pero con valor inocuo (el drawer no los lee). **Rechazada** porque queda dead code que invita a re-introducir la ruta como "fallback amistoso" más adelante.

### Decisión 4: success path → close + `router.refresh()`

**Elegimos** que `onSuccess` del form cierre el drawer y dispare `router.refresh()` en la ruta actual. El usuario queda en `/accounts/abc` (o donde haya estado) y el listado embedded refleja el nuevo movimiento.

**Alternativa considerada:** redirigir al detalle del movimiento recién creado. **Rechazada** porque rompe el contexto que el usuario tenía (estaba en account detail viendo sus movimientos); el listado actualizado es la confirmación implícita esperada.

**Alternativa considerada:** mostrar un toast de "Movimiento creado" además del refresh. **Diferida.** Es ortogonal a la decisión estructural; cabe en la conversación sobre el Save UX del drawer (Goal explícito out-of-scope).

### Decisión 5: visual de cold-load para los CTAs

**Elegimos** componer todos los CTAs sobre el `Button` compartido (`@/components/ui/button`) y dejar que su estado `disabled` nativo se encargue del visual cold-load — sin envolver `<Link>`, sin spinner, sin opacity hardcodeada en cada call-site. `RegisterMovementButton` se refactoriza para usar `<Button variant="primary" size="md">` y `QuickAddFab` pasa a usar `<Button variant="primary" size="fab">` (se agrega la size `fab` al `Button` para hospedar el FAB de 64×64 px). Esto cierra el bug reportado de "el header CTA no muestra `cursor: pointer`" (que venía de un `<button>` crudo sin la base del design system).

**Alternativa considerada:** spinner adentro del botón. **Rechazada** porque rompe la consistencia con el patrón existente y promete una operación in-flight cuando lo que está pasando es solo data loading.

**Alternativa considerada:** ocultar el botón hasta que el drawer esté listo. **Rechazada** porque genera layout shift en cold-load (~200-500ms) y un usuario que esperaba ver el CTA se desorienta.

### Decisión 6: ubicación del componente `MovementForm` tras eliminar el route folder

**Elegimos** reubicar `MovementForm` a `apps/web/lib/transactions/components/movement-form.tsx`, alineado con los otros primitivos compartidos de transactions (`register-movement-button.tsx`, `quick-add-fab.tsx`).

**Alternativa considerada:** moverlo a `apps/web/app/(app)/transactions/_components/movement-form.tsx`. **Rechazada** porque mezcla componentes compartidos no-de-ruta con folder convencional de Next; el `lib/` ya es el home semántico de "primitivos de transactions reusables fuera del shell".

## Risks / Trade-offs

| Riesgo | Mitigación |
| --- | --- |
| Las queries `accounts/categories/household` ahora se disparan en la primera nav a cualquier ruta `(app)` (incluido `/settings`, donde antes no se cargaban). | Payloads chicos; `QUERY_KEYS` deduplica con consumers que ya las usan (`TransactionsHeader`); cache de TanStack persiste entre navs. El extra request en cold-load de `/settings` se evalúa aceptable. |
| Si una de las 3 queries falla, el drawer no puede abrirse y los CTAs quedan disabled en todo el app. | La spec ya cubre este caso (`req: El header de /transactions permanece visible durante carga y error`); aplicamos el mismo modo degradado con feedback + retry, ahora a nivel app-shell. |
| Sidebar/TopBar pierden la posibilidad teórica de abrir el drawer sin promoción del loader. | Hoy no hay ningún CTA en chrome. Si se necesita, promover el loader un nivel es follow-up trivial. Documentado en proposal como "Open / deferred". |
| Tests/usages que importan `MovementForm` desde el path viejo (`app/(app)/transactions/new/_components/movement-form`) van a romper en compile-time. | Buscar todas las importaciones y actualizar al nuevo path como parte de la implementación; TypeScript falla loud. |
| El back-nav del detalle/edición depende del reader de `?from=`. Si por accidente borramos ese código, rompemos navegación que no estamos tocando. | Tests manuales en verification: abrir `/transactions/[txId]?from=account:abc`, click `←` → debería ir a `/accounts/abc`. Greps explícitos confirman que no se tocan los archivos del detalle/edit. |
| El requirement "El alta y edición de movimientos se presenta como drawer lateral en desktop" hoy dice que `/transactions/new` y `/transactions/[txId]/edit` siguen resolviendo el form. Modificarlo "rompe" ese contrato. | Documentado explícitamente como BREAKING en proposal. Sin usuarios → impacto cero práctico. La spec se rescribe para clarificar que ahora solo `/transactions/[txId]/edit` resuelve el form. |

## Migration Plan

Single commit, single deploy. No hay usuarios → no se necesita estrategia de roll-out por etapas.

Orden de implementación sugerido (lo detalla `tasks.md`):

1. Mover `MovementForm` al nuevo path y arreglar imports.
2. Promover `<MovementDrawerLoader>` al `AppShell`; eliminar el wrap actual en `transactions/layout.tsx`.
3. Reemplazar los 3 entry-points externos a drawer-opener (dashboard, account, card).
4. Eliminar el route folder `app/(app)/transactions/new/` y la prop `createReturnHref`.
5. Quitar la `variant="page"` del form.
6. Quitar `resolveReturnHref` y la prop `from` del path de creación.
7. Verificar todos los CTAs end-to-end con el skill `/run`.

**Rollback:** revert del PR. La ausencia de migraciones de schema o data hace el revert trivial.

## Open Questions

Ninguna pendiente — todas las open questions del draft del usuario quedaron resueltas durante la exploración:

- Loader placement: inside AppShell around `{children}` (Decisión 2).
- Cold-load CTA visual: reuse existing convention (Decisión 5).
- `variant="page"` pruning: delete (no es alcanzable tras borrar la ruta).
- `MovementForm` location: `apps/web/lib/transactions/components/movement-form.tsx` (Decisión 6).
- i18n keys del page header: ninguna a borrar (compartidas con el drawer).
- e2e/tests visitando `/transactions/new`: no existen.

El único item levantado y explícitamente diferido es el UX interno del drawer (spinner en Save, comportamiento de Close durante mutation in-flight) — se trata en un change posterior si el usuario lo prioriza.
