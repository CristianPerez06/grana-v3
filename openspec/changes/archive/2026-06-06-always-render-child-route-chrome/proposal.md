## Why

La spec `route-loading-and-errors` define Variant C (chrome persistente en `layout.tsx` + skeletons solo en el cuerpo via `loading.tsx`) y declara explícitamente que la acción primaria del header SHALL estar disabled mientras la data no esté lista. Esa regla está aplicada en las section roots (`/dashboard`, `/transactions`, `/accounts`, `/cards`, `/shared`), pero **no en sus rutas hijas**. Resultado: cuando se navega a `/transactions/recurring`, `/transactions/[txId]`, `/accounts/[id]`, `/cards/[id]`, `/cards/[id]/periods/*`, el header desaparece y aparece un `PageHeaderSkeleton` (o, peor, el body skeleton de la section root padre porque la ruta hija no tiene su propio `loading.tsx`). El usuario reporta este problema recurrentemente con la frase "el header debería estar siempre desde first paint" — la regla existe pero las rutas hijas no la realizan.

## What Changes

- Cada ruta hija que hoy renderiza su `PageHeader` dentro de `page.tsx` y depende del fallback de `loading.tsx` SHALL adoptar Variant C: introducir `<ruta>/layout.tsx` que renderice el chrome persistente (back-link + slot de acciones) y dejar el `loading.tsx` con skeletons solo del cuerpo.
- Los slots de acciones (botones que abren drawers o navegan) SHALL renderizarse en su posición final desde el first paint, con `disabled={true}` mientras la data dependiente no haya resuelto.
- Los títulos dinámicos (nombre de cuenta, tarjeta, período, recurrencia) SHALL usar placeholder no-breaking-space (`' '`) mientras la data se resuelve, para preservar la altura sin reflow — mismo patrón ya en uso en `CategoriesHeader`.
- **BREAKING (interno)**: los `loading.tsx` de `/transactions/recurring` y `/transactions/[txId]` SHALL dejar de usar `PageHeaderSkeleton`. Se ajustan para skeletonear solo el cuerpo.
- Rutas concretas que SHALL ganar `layout.tsx` y `loading.tsx` propios:
  - `apps/web/app/(app)/transactions/recurring/`
  - `apps/web/app/(app)/transactions/[txId]/`
  - `apps/web/app/(app)/accounts/[id]/`
  - `apps/web/app/(app)/cards/[id]/`
  - `apps/web/app/(app)/cards/[id]/periods/`
  - `apps/web/app/(app)/cards/[id]/periods/[periodId]/`
  - (`/transactions/[txId]/edit`, `/cards/[id]/periods/[periodId]/pay` heredan del layout del segmento padre; pueden definir el suyo solo si necesitan chrome distinto)

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `route-loading-and-errors`: ampliar Variant C para cubrir explícitamente rutas hijas. Agregar requirement nuevo que prohíbe el uso de `PageHeaderSkeleton` para tapar el header durante el loading y mandata `layout.tsx` por ruta hija que hoy depende de un `loading.tsx` con header-skeleton. Incluye scenarios concretos para `/transactions/recurring`, `/transactions/[txId]`, `/accounts/[id]`, `/cards/[id]`, `/cards/[id]/periods`.

## Impact

- **Código afectado (web)**:
  - Nuevos `layout.tsx`: en cada uno de los 6 directorios listados arriba.
  - Reescritura de `loading.tsx`: `transactions/recurring/loading.tsx`, `transactions/[txId]/loading.tsx` quitan `PageHeaderSkeleton`. Crear `loading.tsx` para `/accounts/[id]`, `/cards/[id]`, `/cards/[id]/periods`, `/cards/[id]/periods/[periodId]` (hoy heredan del padre incorrectamente).
  - Ajuste de `page.tsx`: las pages dejan de declarar `<PageHeader>` para los casos en que el layout lo monta; el page renderiza solo cuerpo. Donde el header del page lleva info dinámica (título con nombre dinámico, descripción del recurso), el layout monta un placeholder vacío que el page no necesita reemplazar — el shape del título queda reservado y la info dinámica vive en sub-secciones del cuerpo (ej. `AccountDetailHeader`, `CardDetailHeader`, header interno de `GlobalTransactionDetail`, que ya son widgets compuestos en el cuerpo).
  - Componentes de skeleton existentes (`PageHeaderSkeleton`) NO se eliminan — se preservan para casos donde la página entera no tiene chrome estable (no hay actualmente, pero el componente queda para futuro).
- **Mobile**: sin cambios — mobile no usa el patrón loading.tsx server-side de Next.
- **APIs / DB / deps**: ninguno.
- **Riesgo**: títulos dinámicos (`AccountDetailHeader`, `CardDetailHeader`) hoy renderizan el avatar + nombre + status pill como **el** título visual de la página. Si el layout monta un PageHeader minimalista con back-link + placeholder, hay riesgo de que la página termine con dos elementos "header-like" apilados. Mitigación: para `/accounts/[id]` y `/cards/[id]` el layout monta SOLO el back-link (no un PageHeader con título), y el widget compuesto sigue siendo el único título visual del cuerpo. Esto está alineado con el patrón ya implementado por `unify-child-route-headers` (precedente: el back-link arriba del widget compuesto).
- **Dependencia con `unify-child-route-headers`**: este change asume que la regla "section header solo en section root" ya está vigente (las section layouts ya retornan null off-root). Por lo tanto este change SHOULD landearse después de `unify-child-route-headers`.
