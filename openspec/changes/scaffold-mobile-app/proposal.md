## Why

`apps/mobile` está reservado en el monorepo pero no existe todavía. Este change crea el proyecto Expo mínimo para que el slot mobile sea real, el workspace de pnpm lo resuelva, y el próximo colaborador pueda construir sobre una base conocida en lugar de hacer setup desde cero.

## What Changes

- Crear `apps/mobile/` con Expo SDK + Expo Router, TypeScript strict y una pantalla raíz de placeholder
- Configurar Metro para resolver los paquetes `@grana/*` del workspace
- Conectar `apps/mobile/tsconfig.json` para que extienda `tsconfig.base.json` y los path aliases `@grana/*` estén disponibles (aunque sin uso todavía)
- Agregar config de ESLint consistente con el resto del monorepo
- Agregar script `dev:mobile` en el `package.json` raíz para que `pnpm dev:mobile` arranque el servidor de desarrollo de Expo

## Capabilities

### New Capabilities

- `mobile-app-shell`: La app Expo arranca, renderiza una pantalla de placeholder, pasa type-check y lint, y el seam con los paquetes del workspace está configurado para uso futuro.

### Modified Capabilities

*(ninguno — sin cambios de requerimientos existentes)*

## Impact

- Nuevo paquete en `apps/mobile/` — ya cubierto por el glob `apps/*` en `pnpm-workspace.yaml`
- El `package.json` raíz recibe el script `dev:mobile`
- Los paths de `tsconfig.base.json` ya son correctos; `apps/mobile/tsconfig.json` los hereda al extenderlo
- Sin cambios en `apps/web/`, `packages/*` ni ningún código compartido
- Dependencias nuevas solo en `apps/mobile/`: `expo`, `expo-router`, `react-native`, `react`, `typescript`, `eslint` y paquetes de tipos relacionados
