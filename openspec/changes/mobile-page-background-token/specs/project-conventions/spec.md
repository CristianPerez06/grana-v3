## ADDED Requirements

### Requirement: `@grana/ui-tokens` sirve sus custom properties a ambas plataformas

`@grana/ui-tokens` expone dos familias de color. Los **tokens estructurales** (`page`, `card`, `navy`, `border-soft`, `text`, `text-muted`, `text-soft`, `positive`, `terracotta`, la paleta `cat-*`, la paleta `account-*`, …) tienen valores literales. Los **aliases** de estilo shadcn (`background`, `foreground`, `primary`, `secondary`, `muted`, `muted-foreground`, `input`, `ring`, `destructive`, `success`, `info`, `surface-*`, y sus `*-foreground`) tienen como valor un string `var(--…)` que apunta a un token estructural.

Los aliases SHALL resolver en **ambas** plataformas. Para eso, el bloque `:root` de custom properties declarado en `packages/ui-tokens/src/theme.css` SHALL estar disponible también para `apps/mobile`: el codegen del package (`scripts/codegen.mjs`) SHALL emitir, junto al `tokens.cjs` que ya genera, un CSS con ese mismo `:root`, y `apps/mobile/global.css` SHALL importarlo. NativeWind resuelve `var()` en runtime contra las variables declaradas en `:root`.

Sin ese `:root`, cualquier clase cuyo token sea un alias compila a `var(--…)`, la variable no existe en React Native y la superficie o el texto **no toman color** — un fallo silencioso que NO detectan `pnpm typecheck` ni `pnpm lint`.

`apps/mobile` MAY usar indistintamente aliases y tokens estructurales una vez declarado el `:root`. NO SHALL asumirse que el nombre de la clase revela a qué token apunta: el utility prefix se concatena con la key del color, así que `text-muted` es el prefijo `text-` sobre el alias `muted` (un color de **borde**), mientras que el token estructural `text-muted` se escribe `text-text-muted`. Ante la duda, la resolución SHALL verificarse compilando la config de Tailwind, no leyendo el nombre.

#### Scenario: Un alias resuelve en mobile

- **WHEN** un componente de `apps/mobile` aplica una clase cuyo token es un alias (por ejemplo `bg-background` o `bg-muted`)
- **THEN** la superficie renderiza con el color del token estructural al que apunta el alias
- **AND** no queda sin color ni deja ver el window background nativo

#### Scenario: El codegen emite el CSS de variables para mobile

- **WHEN** un colaborador corre el codegen de `@grana/ui-tokens` tras editar `theme.css`
- **THEN** se regeneran tanto `tokens.cjs` como el CSS con el bloque `:root`
- **AND** ambos quedan derivados de la misma fuente, sin listas de colores mantenidas a mano

#### Scenario: El nombre de la clase no revela el token

- **WHEN** un colaborador necesita el color de texto secundario en `apps/mobile`
- **THEN** sabe que `text-muted` apunta al alias `muted` (`var(--border-soft)`, un color de borde) y que el token de texto es `text-text-muted`
- **AND** elige la clase compilando la config o consultando `tokens.cjs`, no por el nombre
