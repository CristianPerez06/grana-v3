# Enforzar los gates de OpenSpec en CI

## Why

El gate que protege la spec depende hoy de que una persona se acuerde de correrlo. `project-conventions` dice que `pnpm openspec:check` "corre **localmente** sobre la branch y pasa con exit code 0", y nada verifica que eso haya pasado: `.github/workflows/ci.yml` tiene cuatro jobs (`quality`, `web-build`, `web-test`, `monorepo-health`) y ninguno menciona openspec.

El modo de falla no es teórico. Al archivar `split-project-conventions` la casilla de `openspec:check` quedó tildada sin que el comando se hubiera ejecutado nunca — el `pnpm` de esa shell resolvía a un shim de corepack roto. No lo detectó ni la herramienta local ni el PR: los siete checks del PR estaban en verde mientras el único gate de la spec no había corrido. La casilla se corrigió a mano después del merge, pero eso es exactamente la clase de error que un gate existe para hacer imposible.

El agravante es de principio: la V3 se sostiene sobre "el repo es la memoria del producto". El lint, el build, los tests y el lockfile están todos guardados por CI. La memoria —lo único que el proyecto declara como su activo central— es el único artefacto sin guardarraíl automático.

## What Changes

- **`.github/workflows/ci.yml` gana un job `specs`** que corre los dos gates de OpenSpec en cada PR a `main` y en cada push a `main`, con la misma forma que los jobs existentes. Ambos comandos son rápidos y no necesitan build.
- **El gate deja de ser una promesa local y pasa a ser una verificación de CI.** La corrida local se conserva, pero cambia de rol: es el loop de feedback rápido, no el punto de enforcement. La branch ya no puede mergear con la spec rota aunque nadie haya corrido nada.
- **Se nombra `openspec validate --specs --strict` como segundo gate.** Hoy la spec sólo nombra `pnpm openspec:check`, que detecta placeholders `TBD` pero no detecta deltas residuales, requirements sin `SHALL`/`MUST` ni specs maestros malformados. Los dos gates cubren fallas distintas y el requirement debe nombrar ambos.
- **Se agrega un scenario de rechazo por CI**, para que la regla describa qué pasa cuando el archive queda incompleto y no sólo qué debería hacer el colaborador.

No es **BREAKING**: no cambia la definición de qué es un archive correcto, sólo quién lo verifica. Una branch que hoy pasa el gate local sigue pasando.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `project-conventions`: cambia el requirement "El archive de una change ocurre en la branch antes del merge a main". La cláusula de gate y sus scenarios describen hoy un chequeo local previo al merge; pasan a describir un gate de CI con la corrida local como feedback rápido, y se nombra `openspec validate --specs --strict` junto a `pnpm openspec:check`.

## Impact

- **Código**: `.github/workflows/ci.yml` — un job nuevo. No se toca `apps/`, `packages/`, `supabase/migrations/` ni tests.
- **Datos**: ninguno. No hay migraciones.
- **Specs**: 1 capability tocada (`project-conventions`), 1 `MODIFIED`.
- **CI**: un job adicional por PR. Sin build ni acceso a red más allá de `pnpm install`, así que el costo en minutos de runner es marginal comparado con `web-build`.
- **Riesgo**: bajo. El peor caso es que el job encuentre specs maestros que ya estaban rotos antes de este change; eso sería un hallazgo legítimo, no una regresión, y se corrige en su propia change.
- **Solapamiento con changes activas**: ninguno. La única change activa es `cards-mobile-density`, que toca `cards`.
