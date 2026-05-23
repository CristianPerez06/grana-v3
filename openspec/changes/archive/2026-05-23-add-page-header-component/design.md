## Context

El repo ya tiene un precedente claro de "componente de UI cross-platform con contract compartido": `route-loading-and-errors` define `Spinner` y `RouteError` con tipos en `@grana/ui-contracts` y dos implementaciones idiomáticas. Este change replica ese molde para el header de página, que hoy vive como `<h1 className="...">` copiado en cada page.tsx de web y aún no existe como tal en mobile.

Estado actual al momento de proponer este change:

- **Web**: 20 archivos en `apps/web/app/(app)/**/page.tsx` declaran un `<h1 className="text-2xl font-semibold tracking-tight">` directo. La limpieza inmediatamente previa a este change unificó el estilo (antes había `font-bold` y `text-xl` en algunas) y separó el back link a su propia fila en `accounts/new`, `accounts/[id]/edit` y `cards/[id]/periods/[periodId]`. La inconsistencia se eliminó pero el patrón sigue sin estar encapsulado.
- **Mobile**: 3 archivos (`movimientos.tsx`, `accounts.tsx`, `tarjetas.tsx`) son placeholders que centran un `Text` en pantalla, no tienen header. `dashboard.tsx` usa `DashboardHeader` dedicado (paralelo al web).
- **Excepciones existentes**: páginas de detalle de entidad (`/dashboard`, `/accounts/[id]`, `/cards/[id]`, `/transactions/[txId]`, `/accounts/[id]/transactions/[txId]`) no usan `<h1>` — usan headers compuestos (`DashboardHeader`, `AccountDetailHeader`, `CardHero`, `TransactionDetailHeader`). El wizard de onboarding usa `text-3xl font-bold tracking-tight`, su propio contexto visual.

Restricciones del repo aplicables (CLAUDE.md):
- "JSX is not shared between web and React Native" → dos implementaciones, mismo contract.
- "Naming convention: interaction callbacks are named `onPress` (RN-friendly)" → si surgiera un callback, se llama `onPress`.
- Packages bajo `packages/` no tienen build step; editar `ui-contracts/src/index.ts` propaga inmediatamente.
- Code en inglés, doc en español, OpenSpec keywords en inglés.

## Goals / Non-Goals

**Goals:**

- Encapsular el estilo canónico de header de página en un componente reutilizable por plataforma.
- Compartir el contract de props (`PageHeaderProps`) en `@grana/ui-contracts` para que un drift en web rompa los tipos en mobile y viceversa.
- Eliminar los ~20 `<h1>` ad-hoc en web reemplazándolos por `<PageHeader>`.
- Establecer la primitiva en mobile **antes** de que aparezcan las primeras pantallas reales no-dashboard, para evitar la misma deuda que tuvo web.
- Dejar un anti-regresión declarativo en el spec: una page nueva que use `<h1>` directo (web) o un título top-level ad-hoc (mobile) viola el spec.

**Non-Goals:**

- **No** reescribir los headers compuestos de detalle de entidad (`DashboardHeader`, `AccountDetailHeader`, `CardHero`, `TransactionDetailHeader`). Esos resuelven un problema distinto (mostrar entidad + métricas + acciones específicas) y siguen siendo dueños de su layout.
- **No** unificar con el `<h1>` del wizard de onboarding (`text-3xl font-bold tracking-tight`). El wizard tiene su propio layout group y contexto visual; meterlo en la misma primitiva forzaría una abstracción que dobla en complejidad por ahorrar una línea.
- **No** introducir un sistema de tipografía completo (`Heading`/`Title`/`Body` etc.). Este change resuelve un caso concreto y repetitivo; un type system de tipografía se decide cuando aparezca un segundo o tercer caso.
- **(Revisado durante implementación)** Inicialmente este change no incluía `description`. Al refactorizar las list pages quedó claro que 4 call sites reales lo necesitan (`/transactions`, `/transactions/recurring`, `/settings/categories`, `/settings/categories/[id]/subcategories`) y que renderizarlo afuera del PageHeader pierde cohesión visual (el `gap-6` del wrapper de page separa subtítulo del título). Se agregó `description?: string` al contract; ver Decisión 7.
- **No** introducir Storybook para mobile (no existe hoy). La historia visual va sólo en web.

## Decisions

### Decisión 1: Un componente por plataforma con prop contract compartido

**Elección**: Replicar el patrón de `Spinner`/`RouteError` — `PageHeaderProps` en `@grana/ui-contracts`, `apps/web/components/ui/page-header.tsx` y `apps/mobile/components/ui/PageHeader.tsx` con la misma firma.

**Alternativas consideradas**:

1. *Solo exportar un string de Tailwind* (ej. `PAGE_TITLE_CLASS = 'text-2xl font-semibold tracking-tight'`) desde un package compartido. Rechazado: no encapsula el back link ni el slot de actions, y la regla "no h1 ad-hoc en pages" no se puede expresar como spec — sería sólo una convención no verificable.
2. *Un único componente isomórfico* usando una abstracción tipo `Slot`/`as`. Rechazado: el repo establece explícitamente "two native implementations, one shared API" y "JSX is not shared between web and React Native".
3. *Subir el componente al layout de cada grupo*. Rechazado: las pages tienen títulos distintos y back links contextuales — un layout no puede inferirlos sin que cada page le pase props, que es exactamente lo que el componente hace de manera directa.

### Decisión 2: `backLink?: { href: string; label: string }` como objeto, no dos props sueltas

**Elección**: Un objeto opcional con `href` y `label`. Cuando es `undefined`, no se renderiza la fila del back link.

**Por qué**: Hace explícito que `href` y `label` van juntos — no se puede pasar uno sin el otro. Si alguien quiere un back link, debe proveer ambos campos; TypeScript lo fuerza. Dos props sueltas (`backHref?: string; backLabel?: string`) admiten el estado inválido "tengo href pero no label" que habría que validar en runtime.

**Alternativa considerada**: `back?: { href: string; label: string } | { onPress: () => void; label: string }` para soportar back-via-callback. Rechazado por YAGNI — todas las rutas que hoy tienen back link son navegacionales con URL conocida (`/accounts`, `/cards/${id}`, etc.). Cuando aparezca un caso de back-via-callback se extiende el tipo entonces.

### Decisión 3: `actions?: ReactNode` como slot genérico, no array tipado

**Elección**: Un `ReactNode` que el caller compone como quiera (un botón, un dropdown, un grupo de botones, lo que sea).

**Por qué**: Sólo hay un call site identificado hoy que necesita actions (`cards/[id]/periods/[periodId]` con `<EditDatesSheet>`). Diseñar un tipo `Action[]` con `label`, `icon`, `onPress`, `variant` etc. para un único caso es overengineering. `ReactNode` mantiene la puerta abierta sin imponer estructura.

**Alternativa considerada**: `rightSlot?: ReactNode` (nombre más genérico). Rechazado: `actions` es semánticamente más claro y limita el uso a "cosas que el usuario puede ejecutar", no "cualquier cosa visual a la derecha del título" (eso último es el dominio de los headers compuestos de detalle, que no son PageHeader).

### Decisión 4: Web usa `next/link`, mobile usa `expo-router` `Link` — la conversión vive en cada implementación

**Elección**: Cada implementación importa el helper de Link de su propio framework. El contract sólo expone `href: string`; cómo se navega es decisión de cada plataforma.

**Por qué**: `next/link` y `expo-router` `Link` tienen APIs incompatibles y propiedades distintas (prefetching, replace, etc.). Abstraerlos detrás de un wrapper común es el comienzo de un router cross-platform — ese problema no es el de este change.

### Decisión 5: Anti-regresión en el spec, sin auto-fix

**Elección**: El spec declara explícitamente que las pages no deben usar `<h1>` ad-hoc (web) ni un título top-level ad-hoc (mobile), excepto en los casos listados (headers de detalle, wizard de onboarding). La verificación operativa es manual (grep en code review) hasta que aparezca un lint/test que lo automatice.

**Por qué**: Un test que falle ante un `<h1>` nuevo es deseable pero está fuera del scope de este change (requiere infraestructura de lint custom o un test de Storybook scanning). El spec deja registrada la regla; cualquier futuro change que viole la regla cae bajo violación de spec y se atrapa en review.

### Decisión 7: `description?: string` agregado al contract (revisión durante implementación)

**Elección**: Agregar `description?: string` al contract, renderizado dentro del bloque del título con `gap-1` para que el `gap-6` del wrapper de page no se interponga.

**Por qué**: La proposal original excluyó subtítulo "hasta tener evidencia". La implementación trajo la evidencia inmediatamente: 4 de las 8 list pages usan un párrafo `text-sm text-muted-foreground` debajo del título como parte semántica del header. Renderizarlo afuera del PageHeader rompe la cohesión visual (queda separado por el gap del wrapper).

**Alternativa considerada**: Que cada page envuelva PageHeader + subtitle en un div local con gap propio. Rechazado: duplica el patrón 4 veces y abre la puerta a estilos divergentes (`text-sm` vs `text-xs`, `mt-1` vs `mt-2`, etc.) — el problema exacto que este change vino a resolver.

**Limitación**: solo un párrafo string, no `ReactNode`. Cuando aparezca un caso que necesite JSX rico en la descripción se reabre la decisión; hoy todos los call sites son texto plano.

### Decisión 6: Story de Storybook sólo en web; mobile no tiene Storybook

**Elección**: Crear `apps/web/components/ui/page-header.stories.tsx` con los casos (sólo título, título + back link, título + actions, los tres). En mobile no hay Storybook hoy y este change no lo introduce.

**Por qué**: Web tiene Storybook configurado (`apps/web/.storybook/`); la story permite revisar la primitiva visualmente sin levantar la app. Mobile lo va a necesitar eventualmente pero introducir Storybook RN es un change independiente.

## Risks / Trade-offs

- **[Riesgo]** Perder algún `<h1>` activo durante el refactor (queda un page con la primitiva nueva en algunos lugares y `<h1>` en otros) → **Mitigación**: el spec declara la regla; tasks.md incluye un paso final de `grep -rn "<h1" apps/web/app/(app)` que debe devolver vacío para todos los archivos no listados como excepción.
- **[Riesgo]** El componente se queda corto para algún caso real (ej. una page que necesite subtitle, breadcrumb largo, badge al lado del título) → **Mitigación**: el caller siempre puede dejar de usar `PageHeader` para ese caso particular y renderizar un header propio, agregándolo a la lista de excepciones del spec. La primitiva no obliga a su uso cuando no encaja.
- **[Riesgo]** `actions?: ReactNode` se usa como cajón de sastre para cosas que no son acciones (badges, fechas, etc.), erosionando la semántica → **Mitigación**: si pasa, se renombra o se restringe el tipo. El review de PRs es el punto natural de detección.
- **[Trade-off]** Acoplar el back link al PageHeader (en vez de dejarlo como componente aparte que cada page compone) significa que cambiar el estilo del back link cross-cutting requiere editar la primitiva — pero esto es exactamente lo que queremos: el back link de página es parte del header, no un componente independiente.

## Migration Plan

No hay migración runtime — es un refactor de UI sin estado persistido. El roll-out es:

1. Publicar `PageHeaderProps` en `@grana/ui-contracts`.
2. Implementar `PageHeader` en web y mobile.
3. Migrar las pages web una por una (o en grupos por subdirectorio) — cada migración es trivialmente reversible.
4. Migrar los 3 placeholders mobile.
5. Grep final + actualización del spec maestro al archivar.

**Rollback**: revertir el commit del refactor de cada page; el componente puede quedar publicado sin uso si fuera necesario.

## Open Questions

- ¿El back link debe vivir dentro del `<PageHeader>` siempre, o algunos casos lo prefieren afuera? **Resolución provisoria**: dentro siempre. Las pages que hoy tienen back link arriba del título (las de detalle) usan headers compuestos, no PageHeader, así que no entran en este change. Si surge un caso futuro de "PageHeader + algo entre el back link y el título" se agrega como excepción o se extiende el componente.
- ¿`actions` debe ser un slot o un array tipado en el futuro? **Resolución**: empezar con `ReactNode`. Si aparecen 3+ call sites con la misma estructura de acciones, considerar un tipo `Action[]`. Hoy no hay base empírica para diseñarlo.
