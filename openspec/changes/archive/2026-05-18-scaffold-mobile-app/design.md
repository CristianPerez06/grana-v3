## Context

El monorepo tiene `apps/web` (Next.js) funcionando y `apps/mobile` reservado pero ausente. Los paquetes bajo `packages/*` exponen su fuente directamente (sin build step); web los resuelve vía `transpilePackages` + `paths`. Metro tiene su propio resolver de módulos y no entiende los path aliases de TypeScript ni los symlinks de pnpm de manera nativa.

## Goals / Non-Goals

**Goals:**
- `apps/mobile` existe como un proyecto Expo + Expo Router funcional dentro del monorepo
- `pnpm --filter mobile dev` (o `pnpm dev:mobile` desde la raíz) arranca el servidor de Expo sin errores
- TypeScript strict pasa; ESLint pasa
- Metro está configurado para resolver paquetes `@grana/*` del workspace para que imports futuros funcionen sin rework

**Non-Goals:**
- NativeWind ni ningún setup de estilos
- Codegen de tokens de `@grana/ui-tokens`
- Conexión del cliente Supabase
- EAS ni configuración de builds
- Pantallas reales de producto (solo placeholder)
- Flujo de autenticación

## Decisions

### 1. Expo Router para navegación

Ya definido en exploración previa. El routing basado en archivos en `apps/mobile/app/` espeja el modelo mental de `apps/web/app/`. No se consideran alternativas.

### 2. Resolución de paquetes del workspace en Metro

Los `packages/*` no tienen build step. Metro no sigue nativamente los `paths` de TypeScript ni los symlinks del virtual store de pnpm.

**Decisión**: configurar `metro.config.js` con `watchFolders` apuntando a la raíz del repo (para que Metro observe cambios en `packages/*`) y `resolver.nodeModulesPaths` apuntando al `node_modules` raíz (para que Metro encuentre deps hoisted).

Si algún paquete falla al transpilar a través de Metro, el fix en ese momento es agregarle un build step solo a ese paquete — no un cambio a nivel de repo. Esto está documentado en CLAUDE.md y queda diferido hasta que un paquete realmente falle.

**Alternativa considerada**: `node-linker=hoisted` en `.npmrc` para aplanar todas las deps. Rechazada — afectaría todo el monorepo y podría romper web.

### 3. Configuración de TypeScript

`apps/mobile/tsconfig.json` extiende `tsconfig.base.json`. Los path aliases `@grana/*` declarados en `tsconfig.base.json` se heredan, así los imports futuros typecheckean sin config adicional. El setup de TS propio de Expo (`expo/tsconfig.base`) se fusiona vía el array `extends`.

### 4. ESLint

Usar `eslint-config-expo` (la config recomendada por Expo) como base. Sin reglas custom en la etapa de scaffold.

**Nota**: `eslint-config-expo` puede necesitar `public-hoist-pattern[]=*eslint*` en `.npmrc` si no está ya hoisted. Verificar y agregar si es necesario (la app web ya tiene `eslint-config-next` hoisted por este mecanismo).

### 5. Scripts raíz

Agregar `dev:mobile` al `package.json` raíz usando `pnpm --filter mobile dev`. El script `dev` existente sigue apuntando solo a web.

## Risks / Trade-offs

- **Metro + symlinks de pnpm** → Si Metro no puede seguir un symlink hacia `packages/`, los imports de `@grana/*` fallarán en runtime aunque TypeScript los resuelva. Mitigación: probar al menos un import de `@grana/*` (aunque sea solo de tipos) durante el scaffold para confirmar que el seam funciona antes de iniciar trabajo de auth.
- **Churn del Expo SDK** → Expo lanza frecuentemente y tiene requisitos de peer-deps que rompen. Mitigación: pinear al SDK estable actual (52 o 53) y dejar `expo upgrade` como tarea futura deliberada.
- **Peer deps de eslint-config-expo no hoisted** → Misma clase de problema que `eslint-config-next`. Mitigación: revisar `.npmrc` y extender `public-hoist-pattern` si es necesario.
