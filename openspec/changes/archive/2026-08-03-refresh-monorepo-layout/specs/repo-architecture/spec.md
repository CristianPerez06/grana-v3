## MODIFIED Requirements

### Requirement: El repo está organizado como monorepo pnpm con apps/ y packages/

El repo SHALL estar organizado como un monorepo manejado por pnpm workspaces, con la siguiente layout:

- `apps/` SHALL contener una carpeta por aplicación desplegable. Hoy son `apps/web/` (Next.js) y `apps/mobile/` (Expo). Apps futuras SHALL agregarse bajo `apps/` siguiendo el mismo patrón. Cada `apps/<name>/` SHALL tener su propio `package.json`, su propio toolchain (Next config, Expo config, etc.), y SHALL ser autónomo a nivel build.
- `packages/` SHALL contener una carpeta por paquete compartido entre apps. Cada `packages/<name>/` SHALL tener su propio `package.json` con `name: "@grana/<name>"` y SHALL exportar vía `main`/`exports`. Los paquetes se agrupan hoy en tres familias, **descritas como orientación y no como inventario**:
  - **Dominio / feature** — un paquete por área de producto, con sus queries, cálculos y tipos (por ejemplo `@grana/accounts`, `@grana/cards`, `@grana/transactions`).
  - **Cross-cutting** — infraestructura que atraviesa features (por ejemplo `@grana/supabase`, `@grana/validation`, `@grana/money-logic`).
  - **Design system** — contratos y tokens compartidos entre plataformas (`@grana/ui-contracts`, `@grana/ui-tokens`; las reglas de composición viven en `ui-foundations`).

  La lista autoritativa de paquetes SHALL ser el contenido de `packages/` más los globs de `pnpm-workspace.yaml`, NO una enumeración en esta spec. Este requirement NO SHALL mantener un índice de paquetes: agregar uno nuevo no requiere editarlo.
- La raíz del repo SHALL contener: `package.json` (scripts orquestadores + dev tooling compartido), `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json` (base de TypeScript compartida por apps y paquetes), `openspec/`, `supabase/` (backend, no es app), `AGENTS.md`, `CLAUDE.md` (puntero a `AGENTS.md`), y los archivos meta (`.gitignore`, `.env.example`, README, etc.).
- Código de producto SHALL NOT vivir en la raíz. Todo `app/`, `components/`, `lib/` y similares SHALL vivir dentro de un `apps/<name>/` o `packages/<name>/`.

La regla de qué va en `apps/` vs `packages/`:

- Va en `apps/<name>/` el código específico de una plataforma o deployment (rutas Next, pantallas Expo, middleware, server actions, components).
- Va en `packages/<name>/` el código que es reutilizable entre apps **y** no tiene dependencias de plataforma. Si un módulo se usa solo en una app, vive en esa app.

#### Scenario: Una feature nueva de web se agrega bajo apps/web

- **WHEN** un colaborador implementa una ruta o componente nuevo solo para la app web
- **THEN** el archivo se crea bajo `apps/web/app/` o `apps/web/components/`
- **AND** no se crea en la raíz ni en `packages/`

#### Scenario: Lógica compartida nueva se agrega como paquete

- **WHEN** un colaborador identifica lógica que va a usarse en web y mobile (p. ej. un nuevo grupo de schemas de validación para una entidad)
- **THEN** se agrega al paquete compartido que corresponda (p. ej. `packages/validation/src/<entity>.ts`)
- **AND** se importa desde ambas apps vía el nombre del paquete (p. ej. `import { ... } from '@grana/validation'`)

#### Scenario: Un paquete nuevo no obliga a editar esta spec

- **WHEN** un colaborador crea `packages/<nuevo>/` con su `package.json` (`name: "@grana/<nuevo>"`) y sus exports
- **THEN** el paquete queda cubierto por este requirement sin necesidad de agregarlo a ningún listado de esta spec
- **AND** la lista autoritativa de paquetes sigue siendo `packages/` más los globs de `pnpm-workspace.yaml`

#### Scenario: Lógica que se usaba solo en web pero ahora también se necesita en mobile

- **WHEN** un colaborador descubre que un módulo que vivía en `apps/web/lib/` ahora también lo necesita mobile
- **THEN** el módulo se promueve a un paquete bajo `packages/` con un `package.json` propio
- **AND** ambas apps lo consumen vía el nombre del paquete
- **AND** se evita duplicar el código copiándolo a `apps/mobile/lib/`

#### Scenario: Un colaborador intenta agregar código de producto en la raíz

- **WHEN** un colaborador crea un archivo de código de producto directamente en la raíz del repo (p. ej. en una nueva carpeta `lib/` o `components/` raíz)
- **THEN** el archivo viola la convención
- **AND** debe moverse a la app o paquete apropiado
