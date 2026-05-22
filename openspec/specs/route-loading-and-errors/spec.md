# route-loading-and-errors Specification

## Purpose

Define los estados de carga y error a nivel de ruta para `apps/web` y `apps/mobile`. Cubre los componentes primitivos compartidos (`Spinner`, `RouteError`) — sus variantes de tamaño, su API común vía `@grana/ui-contracts` y sus reglas de contenido (mensaje genérico, retry, ocultar detalles en producción) — y la regla de presencia por ruta en cada plataforma. Web usa `loading.tsx` y `error.tsx` de Next App Router por layout group; mobile usa los componentes inline contra los estados `isPending`/`error` de los hooks de TanStack Query.

## Requirements

### Requirement: La app provee un componente Spinner con tres variantes de tamaño

Cada app (web y mobile) SHALL exponer un componente `Spinner` reutilizable en su librería local de componentes UI. El componente SHALL aceptar exactamente tres tamaños: `sm`, `md`, `lg`. Los tres tamaños SHALL renderizarse como una animación de carga indeterminada (rotación continua), sin un valor de progreso.

Las propiedades públicas del componente SHALL coincidir entre plataformas. El tipo `SpinnerProps` SHALL vivir en `packages/ui-contracts/` y SHALL ser importado tanto desde `apps/web` como desde `apps/mobile`:

```ts
type SpinnerProps = {
  size: 'sm' | 'md' | 'lg'
  className?: string  // solo significativo en web; mobile lo acepta para paridad de API
}
```

Los colores del spinner SHALL leerse de tokens existentes en `@grana/ui-tokens` (paleta de marca). NO SHALL haber literales de color hex hardcodeados en el componente.

El uso esperado por tamaño:

- `sm`: dentro de botones u otros controles compactos (reservado para futuro; debe existir desde el primer día para no requerir un cambio adicional).
- `md`: indicadores secundarios dentro de páginas (ej. una sección que recarga sin bloquear la navegación).
- `lg`: indicador principal de carga de ruta (usado por el wrapper de `loading.tsx` en web y por el `RouteError`/loading screens en mobile).

#### Scenario: Spinner web renderiza las tres variantes

- **WHEN** un desarrollador renderiza `<Spinner size="sm" />`, `<Spinner size="md" />` y `<Spinner size="lg" />` en `apps/web`
- **THEN** los tres se montan sin error
- **AND** los tres tienen diámetros visualmente distintos (orden creciente sm < md < lg)
- **AND** los tres usan colores derivados de tokens de `@grana/ui-tokens`

#### Scenario: Spinner mobile renderiza las tres variantes

- **WHEN** un desarrollador renderiza `<Spinner size="sm" />`, `<Spinner size="md" />` y `<Spinner size="lg" />` en `apps/mobile`
- **THEN** los tres se montan sin error en un dispositivo iOS o Android
- **AND** los diámetros guardan la misma relación de orden que en web
- **AND** ningún color está hardcodeado en el componente

#### Scenario: SpinnerProps es la misma tipo en ambas plataformas

- **WHEN** se modifica `SpinnerProps` en `packages/ui-contracts/`
- **THEN** TypeScript reporta error en `apps/web` y en `apps/mobile` simultáneamente si la nueva firma rompe el uso existente

### Requirement: La app provee un componente RouteError reutilizable

Cada app (web y mobile) SHALL exponer un componente `RouteError` reutilizable en su librería local de componentes UI. El componente SHALL aceptar un error y un callback de reintento, y SHALL mostrar al usuario:

1. Un mensaje genérico de error en el idioma activo del usuario (ej. en español: "Algo salió mal").
2. Un botón "Reintentar" que invoca el callback `onRetry` provisto por el caller.

El componente NO SHALL mapear el contenido del `error` a copy específica en esta iteración (es mejora futura). En modo desarrollo, el componente MAY mostrar adicionalmente el `error.message` o el `error.digest` para ayudar al debug; en producción ese detalle SHALL estar oculto.

El tipo `RouteErrorProps` SHALL vivir en `packages/ui-contracts/` y SHALL ser idéntico entre plataformas:

```ts
type RouteErrorProps = {
  error: Error & { digest?: string }
  onRetry: () => void
  className?: string  // solo significativo en web
}
```

El callback se nombra `onRetry` (no `onPress` ni `onClick`) porque tiene semántica de dominio explícita — no es un wrapper genérico de interacción.

#### Scenario: RouteError web renderiza mensaje y botón funcional

- **WHEN** un usuario aterriza en un `error.tsx` que renderiza `<RouteError error={err} onRetry={reset} />`
- **THEN** la pantalla muestra el mensaje genérico en el idioma activo del usuario
- **AND** muestra un botón etiquetado "Reintentar"
- **AND** presionar el botón invoca `reset()` (el callback provisto)

#### Scenario: RouteError mobile renderiza mensaje y botón funcional

- **WHEN** una pantalla mobile renderiza `<RouteError error={err} onRetry={retry} />` ante un error de fetching
- **THEN** la pantalla muestra el mensaje genérico en el idioma activo del usuario
- **AND** muestra un botón "Reintentar"
- **AND** presionar el botón invoca `retry()` (típicamente `query.refetch()` cuando se usa con TanStack Query)

#### Scenario: El componente no expone error.message en producción

- **WHEN** la app corre en modo producción (`NODE_ENV=production`)
- **AND** `<RouteError>` recibe un `error` con `message` revelador (ej. "Connection refused to host db.internal:5432")
- **THEN** el DOM/UI NO contiene ese `message` visible al usuario

### Requirement: Toda ruta de apps/web bajo (app), (auth) y (onboarding-wizard) tiene loading.tsx y error.tsx (web)

`apps/web` SHALL incluir, para cada segmento de ruta bajo `app/(app)/`, `app/(auth)/` y `app/(onboarding-wizard)/`, un archivo `loading.tsx` y un archivo `error.tsx` colocalizados con el `page.tsx` correspondiente.

- `loading.tsx` SHALL renderizar un componente compartido (`RouteLoading`) que envuelve `<Spinner size="lg" />` y lo centra vertical y horizontalmente en el área de contenido principal.
- `error.tsx` SHALL ser un Client Component (Next lo exige) que recibe `{ error, reset }` y renderiza `<RouteError error={error} onRetry={reset} />`.

Cuando dos rutas adyacentes pueden compartir el mismo loading/error (por estar al mismo nivel jerárquico), un único par a nivel de layout group (`(app)/loading.tsx`, `(app)/error.tsx`) SHALL ser preferido en lugar de duplicar archivos por ruta hija. La regla operativa: agregar `loading.tsx` / `error.tsx` al **nivel más alto donde aplica el mismo fallback**; las rutas hijas pueden sobrescribir solo si necesitan un comportamiento distinto.

#### Scenario: Navegar a una ruta no congela la URL anterior

- **WHEN** un usuario hace click en un link a una ruta que tarda > 200ms en resolver el RSC payload
- **THEN** la URL en la barra cambia inmediatamente
- **AND** el área de contenido principal muestra el `RouteLoading` mientras la ruta resuelve
- **AND** el sidebar/topbar permanece visible y operable durante la carga

#### Scenario: Un error en una server query cae en error.tsx

- **WHEN** una página bajo `(app)/` lanza un error durante el fetch server-side (ej. Supabase devuelve 500)
- **THEN** el `error.tsx` del segmento (o del layout group más cercano) se monta
- **AND** el usuario ve `<RouteError>` con el botón "Reintentar"
- **AND** presionar "Reintentar" invoca `reset()` y reintenta el render de la ruta

#### Scenario: Las tres áreas de routing tienen cobertura

- **WHEN** un desarrollador inspecciona `apps/web/app/`
- **THEN** existe al menos un `loading.tsx` y un `error.tsx` accesibles desde cualquier ruta bajo `(app)/`
- **AND** existe al menos un `loading.tsx` y un `error.tsx` accesibles desde cualquier ruta bajo `(auth)/`
- **AND** existe al menos un `loading.tsx` y un `error.tsx` accesibles desde cualquier ruta bajo `(onboarding-wizard)/`

### Requirement: Toda pantalla autenticada de apps/mobile con fetching cliente entrega loading y error states (mobile)

`apps/mobile` SHALL renderizar un estado de loading y un estado de error consistentes en toda pantalla que dependa de un fetch cliente (típicamente vía `useQuery` de TanStack Query, ver `mobile-app-shell`). El loading SHALL usar `<Spinner size="lg" />`; el error SHALL usar `<RouteError>`.

Patrón canónico para pantallas mobile:

```tsx
const { data, isPending, error, refetch } = useQuery({ ... })

if (isPending) return <ScreenLoading />  // wrapper que centra <Spinner size="lg" />
if (error) return <RouteError error={error} onRetry={() => refetch()} />
return <ScreenContent data={data} />
```

Esta regla aplica a cualquier pantalla bajo `(app)/` que monte queries cliente. Pantallas placeholder (sin fetching) están exentas hasta su primera implementación real.

#### Scenario: Una pantalla mobile en carga muestra Spinner centrado

- **WHEN** un usuario abre una pantalla mobile cuyas queries cliente aún están en estado `pending`
- **THEN** la pantalla muestra `<Spinner size="lg" />` centrado vertical y horizontalmente
- **AND** no muestra el contenido principal vacío ni texto placeholder

#### Scenario: Una pantalla mobile con error muestra RouteError con retry funcional

- **WHEN** una query cliente en una pantalla mobile cae en error
- **THEN** la pantalla muestra `<RouteError>` con el mensaje genérico y el botón "Reintentar"
- **AND** presionar "Reintentar" llama a `refetch()` y la pantalla vuelve a entrar en estado de loading mientras la query reintenta
