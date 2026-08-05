# Proposal: mobile-native-dep-rebuild-docs

## Why

Agregar una dependencia nativa a `apps/mobile` obliga a recompilar el binario, y eso no está escrito en ningún lado. Cada vez que alguien trae un cambio con una dependencia nativa nueva, la app explota con `The package 'X' doesn't seem to be linked` y hay que re-derivar el diagnóstico desde cero.

Ya pasó al menos dos veces con `react-native-keyboard-controller` (agregado en `mobile-keyboard-avoidance`, 2-ago-2026).

Peor: el README **apunta en la dirección contraria**. Dice que se corre con Expo Go (imposible desde que hay módulos nativos), y describe `pnpm ios` / `pnpm android` como "atajo: `expo start --ios`, abre el simulador" cuando en realidad son `expo run:ios` / `expo run:android`, es decir **el build nativo completo**. El comando que resuelve el problema está documentado como una comodidad para abrir el emulador, así que nadie que busque "cómo arreglo el error de linking" lo encuentra.

Un segundo desvío recurrente, del mismo episodio: como el repo usa `nodeLinker: hoisted`, las dependencias viven en el `node_modules` de la raíz y NO en `apps/mobile/node_modules/`. Verificar la ruta del workspace y no encontrar nada se lee como "falta instalar" y lleva a un `rm -rf node_modules` innecesario — que a su vez deja el file map de Metro apuntando a inodos borrados y produce `Failed to get the SHA-1 for: …`. Tres errores distintos encadenados a partir de una convención no escrita.

## What Changes

- **`apps/mobile/README.md`**:
  - Requisitos: Expo Go deja de figurar como opción; se explicita que hace falta un **dev build** propio.
  - Tabla de scripts: `dev`, `ios` y `android` pasan a describir lo que realmente hacen (`expo start --dev-client`, `expo run:ios`, `expo run:android`).
  - Nueva sección **"Dependencias nativas"**: la regla (instalar ≠ linkear), qué comando corre, que también aplica al traer cambios de otra persona, y una tabla de síntoma → causa → fix para los tres errores del episodio (`doesn't seem to be linked`, `Failed to get the SHA-1`, `Unable to resolve module`).
  - Aviso sobre el layout `hoisted`: buscar en el `node_modules` de la raíz, no en el del workspace; que falte ahí es lo esperado y no amerita reinstalar.
  - Corrección de una referencia obsoleta: `node-linker=hoisted` ya no vive en el `.npmrc` raíz sino en `pnpm-workspace.yaml` (el propio `.npmrc` lo aclara).
- **Requirement nuevo** en `mobile-app-shell` que vuelve normativa la regla del rebuild, para que no dependa de que el README no se vuelva a desactualizar.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `mobile-app-shell`: nuevo requirement "Una dependencia nativa nueva exige recompilar el binario" — la regla, el comando, y el layout `hoisted` como parte del contrato de resolución de módulos.

## Impact

- `apps/mobile/README.md` (documentación; sin cambios de código ni de comportamiento).
- `openspec/specs/mobile-app-shell/spec.md` vía el delta de este change.
- Sin impacto en runtime, build, tests ni CI.
