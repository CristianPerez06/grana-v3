## Context

grana-v3 hoy es un repo de una sola app Next.js, pre-producción, con auth flow + dashboard placeholder construido. Hay un `pnpm-workspace.yaml` en la raíz pero solo carga `allowBuilds` — los workspaces propiamente dichos no están configurados.

El próximo paso del producto es construir una app móvil con paridad de features usando React Native + Expo. Antes de poder empezar esa construcción hay que decidir y ejecutar la estructura de repo que va a sostener web + mobile. La exploración previa concluyó que **monorepo** es el camino (ver proposal para el razonamiento: sharing real de validation/i18n/types, colaborador no técnico que opera vía Claude Code + OpenSpec, momento óptimo porque el repo está pre-prod y es pequeño).

Este change limita el scope a la **reestructuración estructural + extracción de paquetes compartidos**. El scaffold de la app mobile (Expo + Expo Router + NativeWind + metro config) queda explícitamente para un change futuro separado. Las decisiones técnicas sobre el stack mobile ya están tomadas a nivel exploración (Expo Router, NativeWind, tokens como TS) pero NO se documentan acá — vuelven en el design doc del change de scaffold mobile, donde corresponden.

## Goals / Non-Goals

**Goals:**

- Reestructurar el repo a `apps/web` + `packages/*` sin perder funcionalidad de `apps/web`.
- Extraer el código compartible (validation, i18n messages, supabase client factory, ui-tokens) a paquetes con `name: "@grana/<x>"` listos para ser consumidos por una segunda app cuando aparezca.
- Que `apps/web/` siga construyendo, lintando, levantando en dev y mostrando Storybook después de la mudanza completa.
- Preservar el deploy en Vercel cambiando solo la "Root Directory" del proyecto.
- Dejar la convención de monorepo documentada en `project-conventions` para que el próximo change (scaffold mobile) tenga un suelo claro sobre el cual operar.

**Non-Goals:**

- Crear `apps/mobile/` o cualquier código mobile. Esto incluye: no `pnpm create expo`, no `metro.config.js`, no NativeWind config, no pantalla placeholder, no verificación en simuladores. Todo eso es change separado.
- Cablear EAS Build.
- Generar los tipos de DB de Supabase. `packages/supabase/` deja el slot listo.
- Introducir Turborepo o ninguna otra capa de orquestación/caching. Plain pnpm workspaces alcanza.
- Modificar `supabase/migrations/*` o templates de email.
- Agregar features nuevas a web.

## Decisions

### Decisión 1: pnpm workspaces sin Turborepo

**Qué**: usar pnpm workspaces como única herramienta de orquestación. No introducir Turborepo, Nx, ni Lerna.

**Por qué**:
- pnpm ya es el package manager del repo.
- Para 1 app y ~4 paquetes con un solo dev, Turborepo agrega complejidad sin payoff: el caching distribuido y la paralelización de tareas brillan cuando hay decenas de paquetes o CI lento.
- `pnpm --filter <app>` cubre la necesidad real (correr scripts en una app específica).
- Si en el futuro CI o build times duelen, Turborepo se puede agregar encima de pnpm workspaces sin romper nada.

**Alternativas consideradas**:
- **Turborepo**: descartado por overhead prematuro.
- **Nx**: aún más overhead que Turborepo; orientado a equipos grandes con muchos paquetes.
- **Lerna**: legacy, sin razones para elegirlo en 2026.

### Decisión 2: Layout de paquetes compartidos — cuatro paquetes estrechos

**Qué**: cuatro paquetes con responsabilidades estrechas:

- `@grana/validation`: schemas Yup. Plataforma-agnóstico (Yup corre en cualquier JS runtime).
- `@grana/i18n-messages`: solo los JSON. El runtime queda en cada app (next-intl en web; la app mobile elegirá su runtime cuando exista — fuera de scope acá).
- `@grana/supabase`: factory del cliente Supabase + slot para tipos de DB generados (`Database`). El factory acepta un storage adapter para que web pase su cookies-adapter (`@supabase/ssr`) y una futura segunda app pase otro adapter.
- `@grana/ui-tokens`: tokens de diseño como objetos TS (colores, espaciado, tipografía, config de dark mode).

**Por qué paquetes estrechos en lugar de un mega `@grana/shared`**:
- Cada paquete tiene su propio `package.json` y dependencias declaradas. Si `validation` no necesita supabase, no lo trae transitivamente.
- Permite versionar y publicar (o cambiar la estrategia) por paquete sin tocar los otros.
- Más claro mentalmente y para el LLM: "esta lógica vive en `@grana/validation`".

**Trade-off conocido — paquetes con un solo consumer hoy**: hasta que aparezca la app mobile, los cuatro paquetes solo los consume `apps/web/`. La extracción se hace ahora igual porque (a) el cambio de paths es ahora barato y queda fuera del próximo change, (b) fuerza a separar lo cross-platform de lo Next-specific desde el principio, (c) el siguiente change (scaffold mobile) puede asumir que los paquetes ya están listos.

**Alternativas consideradas**:
- **Un solo `@grana/shared`**: simple al inicio, doloroso a la larga (dependencias acopladas, bundle bloat en cada app).
- **Diferir la extracción hasta que mobile aparezca**: rechazado en la deliberación con el usuario (opción A1) en favor de extraer ahora (opción A2). Razón: el cambio de paths se hace una sola vez, y dejarlo para el change de scaffold mobile mezcla dos preocupaciones (estructura del monorepo + setup de mobile) en un mismo PR.

### Decisión 3: Tokens en `packages/ui-tokens` como TS, no como tailwind.config compartido

**Qué**: `packages/ui-tokens/src/index.ts` exporta los tokens como objetos TS. `apps/web/tailwind.config` importa esos objetos y los splat dentro de `theme.extend`. NO se comparte un `tailwind.config.js` directamente.

**Por qué**:
- Los tokens son data; los configs de Tailwind son **estructura** y pueden divergir por app (p. ej. `content:` paths).
- Mantener tokens como TS deja la flexibilidad de que la futura app mobile use otra versión de Tailwind si NativeWind v4 no soporta limpio Tailwind v4 al momento de scaffold (decisión que se toma en el change de scaffold mobile, no acá).
- Es la forma menos opinada de compartir: cualquier sistema que pueda importar TS puede consumir los tokens.

**Alternativas consideradas**:
- **Compartir `tailwind.config.base.js` y extenderlo en cada app**: amarra a versiones compatibles de Tailwind entre apps. Descartado por riesgo cross-version.

### Decisión 4: Vercel "Root Directory" → `apps/web`, sin tocar nada más

**Qué**: el único cambio en Vercel es setear "Root Directory" del proyecto a `apps/web`. No se reconfiguran env vars, ni se cambia el build command (Vercel detecta `pnpm-workspace.yaml` y corre `pnpm install` desde la raíz del repo).

**Por qué**:
- Vercel ya soporta pnpm workspaces nativamente desde hace ~2 años. Detecta el workspace, instala desde root, builda desde el directorio configurado.
- Cambiar más cosas (build command custom, install command custom) sería sobre-ingeniería.

**Acción manual requerida**: el cambio de Root Directory tiene que hacerse en el dashboard de Vercel antes del push de la migración para evitar un build rojo. Documentado en CLAUDE.md / README.

### Decisión 5: Migración por mudanza, no por reescritura

**Qué**: el código de web se **mueve** físicamente de la raíz a `apps/web/` con `git mv`. No se reescribe ni se refactoriza durante la mudanza. Los imports internos `@/...` se preservan apuntando a `apps/web/` vía el `tsconfig.json` de la app.

**Por qué**:
- Minimiza el riesgo de la migración: si algo se rompe, el diff de git muestra exactamente qué archivos cambiaron de path (todos) y nada más.
- Los imports `@/...` siguen funcionando porque el `paths` del `tsconfig` se ajusta a `apps/web/*`.
- Los imports a paquetes compartidos sí cambian: lo que era `@/lib/validation/auth` pasa a ser `@grana/validation`. Esto es un find-and-replace acotado a los lugares que importaban `lib/validation/` (y análogo para los otros tres paquetes).

**Alternativas consideradas**:
- **Reescribir/refactorizar durante la migración**: tentador pero peligroso. Mezcla dos cambios en un PR (mudanza + refactor) y hace imposible bisectar si algo falla.

### Decisión 6: Orden de extracción — primero mudar todo, después extraer paquetes

**Qué**: la secuencia es (1) mover toda la raíz a `apps/web/` con la lib intacta, (2) verificar que web sigue funcionando, (3) recién entonces extraer paquete por paquete, verificando build/lint después de cada extracción.

**Por qué**:
- Si la mudanza rompe algo, lo aísla del trabajo de extracción.
- Cada extracción es un step verificable independientemente — si la extracción de `@grana/supabase` rompe login, sabemos exactamente cuándo se rompió.
- Los commits intermedios (squasheados al final) sirven como puntos de bisect.

### Decisión 7: TS paths a fuente directa, sin build step por paquete

**Qué**: los paquetes bajo `packages/<name>/` no tienen build step (no `tsc -b`, no `tsup`, no `dist/`). El `package.json` de cada paquete apunta `main`/`exports` directamente a `src/index.ts`. Un `tsconfig.base.json` raíz (o el de `apps/web/`) tiene `paths` para que `@grana/<name>` resuelva a `packages/<name>/src/index.ts`.

**Por qué**:
- Más simple para development: cambios en un paquete se ven inmediatamente en web sin recompilar.
- Next.js maneja TypeScript de dependencias workspace nativamente vía `transpilePackages` en `next.config.ts`.
- Si en el futuro hay un problema (p. ej. Metro de la futura app mobile no resuelve TS de paquetes externos), cambiar a build step es una migración local del paquete afectado.

**Alternativas consideradas**:
- **Build step por paquete con `dist/`**: más estándar para paquetes publicables, pero introduce un step manual (build antes de consumir) y romperia el hot reload.

## Risks / Trade-offs

- **[Vercel build rojo durante la ventana de re-wire]** → mitigación: hacer el cambio de "Root Directory" en Vercel **antes** del push de la migración. Si igual sale rojo, el rollback es trivial: revertir el commit en main. El estado pre-migración es 100% recuperable porque es una mudanza sin pérdida de información.

- **[Imports rotos que el typecheck no detecte]** → mitigación: ejecutar `pnpm --filter web build`, `pnpm --filter web lint`, y `pnpm --filter web exec storybook build` después de la mudanza y después de cada extracción de paquete como verificaciones independientes. El `build` valida producción; `lint` valida ESLint; Storybook valida los componentes en aislamiento.

- **[Storybook se rompe al moverse]** → mitigación: Storybook usa rutas relativas a `.storybook/` y al directorio donde corre; mudarlo dentro de `apps/web/` debería ser transparente. Verificar `pnpm --filter web storybook` después de la mudanza. Si hay problemas con paths, ajustar `main.ts` de Storybook.

- **[El paquete `@grana/supabase` introduce sobrescritura de los clientes actuales de web]** → mitigación: la mudanza de `lib/supabase/client.ts` y `server.ts` a `packages/supabase/` se hace en una tarea explícita, no implícita. Web pasa a importar desde `@grana/supabase`. Los archivos específicos de Next (`middleware.ts`, `errors.ts`) quedan en `apps/web/lib/supabase/` porque dependen de la API de Next y no son cross-platform.

- **[Paquetes con un solo consumer son churn parcial]** → trade-off aceptado: los cuatro paquetes solo los consume web hasta que aparezca mobile. El valor inmediato es estructural (separar lo cross-platform de lo Next-specific) y diferido (próximo change no tiene que extraer). Si el change de scaffold mobile no llega en plazo razonable, la extracción de `@grana/supabase` y `@grana/ui-tokens` puede sentirse prematura — el costo es bajo y no se revierte.

- **[Next.js `transpilePackages` necesario para que web consuma paquetes TS sin build]** → mitigación: agregar `transpilePackages: ['@grana/validation', '@grana/i18n-messages', '@grana/supabase', '@grana/ui-tokens']` en `next.config.ts` durante la extracción del primer paquete. Es una línea, documentada por Next.

- **[Trade-off: dos `node_modules` virtuales que pesan]** → con pnpm el costo es bajo (symlinks contra un store global). No es un riesgo, pero es una propiedad nueva del repo que vale la pena anotar.

## Migration Plan

La migración se ejecuta en una sola branch (`feature/migrate-to-monorepo`), con un solo commit al final (por la convención de merge a main de este repo: un commit por feature, fast-forward). Los pasos internos se enumeran en `tasks.md`. Resumen del orden de ejecución:

1. Setup raíz: ampliar `pnpm-workspace.yaml`, crear `package.json` raíz con scripts orquestadores y `tsconfig.base.json` con paths para `@grana/*`.
2. Crear `apps/web/` y mover todo el código actual ahí con `git mv`. Ajustar `tsconfig.json` y configs de Next/Tailwind/Storybook/ESLint a la nueva ubicación.
3. Verificar que `apps/web/` sigue funcionando: `build`, `lint`, `dev`, `storybook`.
4. Crear cada paquete bajo `packages/` (`validation`, `i18n-messages`, `supabase`, `ui-tokens`) extrayendo el código correspondiente de `apps/web/lib/`. Actualizar imports en `apps/web/` para consumir vía `@grana/*`. Verificar build/lint después de cada extracción.
5. Actualizar `CLAUDE.md` y `README.md` con el nuevo layout, comandos por app, y nota del cambio de Root Directory en Vercel.
6. Cambiar "Root Directory" en Vercel a `apps/web` (humano, antes del push).
7. Squash a un solo commit, fast-forward merge a main.

**Rollback**: si el deploy de Vercel falla post-merge, revertir el commit de merge en main (sigue siendo un solo commit, fácil de deshacer) y revertir el cambio de Root Directory en Vercel. El estado previo se recupera 1:1.

## Open Questions

- **Nombre del scope del paquete**: el proposal asume `@grana/<name>`. Si Cristian quiere otro scope (p. ej. `@grana-v3/`, su user de GitHub, o sin scope), se elige al ejecutar. Default propuesto: `@grana/`. **No es bloqueante.**
