# Grana Mobile

App nativa de Grana V3, construida con [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction/) + [NativeWind](https://www.nativewind.dev). Comparte código cross-platform con `apps/web` vía los paquetes `@grana/*`.

## Requisitos

- pnpm instalado y `pnpm install` corrido al menos una vez desde la raíz del repo (ver [README raíz](../../README.md)).
- Simulador de iOS o emulador de Android instalado localmente (o un dispositivo físico conectado).
- Un **dev build** de la app instalado en ese simulador/dispositivo (`pnpm ios` / `pnpm android`).

> ## ⚠️ Expo Go no se usa en este proyecto
>
> **Nunca. No es "todavía no" ni "depende del caso": Grana se corre siempre con un development build propio.**
>
> Expo Go es un binario fijo que Expo publica con un set cerrado de módulos nativos. Grana usa módulos que no están en ese set (`react-native-keyboard-controller`, entre otros) y va a seguir sumando otros, así que Expo Go no puede ejecutar esta app — no hay configuración que lo arregle.
>
> Si alguien te dice "abrilo con Expo Go", está desactualizado. El flujo correcto es `pnpm ios` / `pnpm android` una vez, y después `pnpm dev` para el día a día. Ver [Dependencias nativas](#dependencias-nativas).

## Scripts

Desde `apps/mobile/` con `pnpm <script>`, o desde la raíz con `pnpm --filter mobile <script>`.

### Dev y QA

| Script        | Qué hace                                                  |
| ------------- | --------------------------------------------------------- |
| `dev`         | `expo start --dev-client` — solo Metro, contra un dev build ya instalado (nunca Expo Go) |
| `ios`         | **`expo run:ios`** — compila el nativo (corre `pod install` + autolinking), lo instala y levanta Metro |
| `android`     | **`expo run:android`** — compila el nativo (autolinking), lo instala y levanta Metro |
| `web`         | Levanta la versión web (debug; la app productiva es Next) |
| `lint`        | ESLint sobre todo el código de la app                     |
| `typecheck`   | `tsc --noEmit` para chequear tipos sin emitir             |

### Builds nativos (EAS)

| Script               | Qué hace                                                            |
| -------------------- | ------------------------------------------------------------------- |
| `build:android`      | EAS cloud build, Android (APK firmado, consume créditos)            |
| `build:android:local`| Mismo pero corre el pipeline localmente (sin créditos, sin cola)    |
| `build:ios`          | EAS cloud build, iOS (simulator `.app` mientras no haya Apple Dev)  |
| `build:ios:local`    | Mismo pero localmente                                               |
| `build:list`         | Lista los últimos 5 builds del proyecto en EAS                      |

> Cada script expande a `eas build --profile production --platform <p> [--local]`. El perfil `production` está definido en `eas.json` (ver [`EAS_SETUP.md`](./EAS_SETUP.md) Fase 3).

Desde la raíz del repo, los mismos comandos están atajados con prefijo `eas:`: `pnpm eas:android`, `pnpm eas:ios:local`, `pnpm eas:list`, etc.

## Builds y distribución

Los builds nativos (iOS / Android) se hacen vía **EAS** (Expo Application Services). La configuración completa — instalación del CLI, identidad de la app, perfiles de build, env vars, credenciales y primer build interno — está documentada en [`EAS_SETUP.md`](./EAS_SETUP.md).

## Dependencias nativas

Instalar el paquete **no alcanza**: `pnpm install` trae el JS, pero el código nativo entra a la app recién cuando se **recompila el binario** (ahí corre el autolinking). Metro recargando JS nunca arregla esto.

**Después de agregar, actualizar o borrar una dependencia con código nativo:**

```bash
pnpm ios        # o: pnpm android
```

No `pnpm dev` — ese solo levanta Metro contra el build que ya tenés instalado.

Esto aplica también cuando **traés cambios de otra persona** (`git pull`) que agregaron una dependencia nativa. Un rebuild y listo; no es un defecto.

### Síntomas y qué significan

| Error | Causa | Fix |
| --- | --- | --- |
| `The package 'X' doesn't seem to be linked` | El binario instalado se compiló antes de que existiera la dependencia | `pnpm ios` / `pnpm android` |
| `Failed to get the SHA-1 for: <path en node_modules>` | El file map de Metro quedó apuntando a un `node_modules` que se borró/reinstaló | `pnpm dev --clear`, o borrar `$TMPDIR/metro-cache` y `$TMPDIR/metro-file-map-*` |
| `Unable to resolve module X` | Falta el paquete, o `metro.config.js` no está viendo la raíz del workspace | `pnpm install`; verificar `watchFolders` en [`metro.config.js`](./metro.config.js) |

> **Ojo con el layout de `node_modules`.** El repo usa `nodeLinker: hoisted` (definido en [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)), así que las dependencias viven en el **`node_modules` de la raíz del repo**, NO en `apps/mobile/node_modules/`. Que `ls apps/mobile/node_modules/<paquete>` no encuentre nada es lo esperado y **no** significa que falte instalar: buscá en la raíz. `metro.config.js` ya resuelve ambas rutas.

## Convenciones específicas de este workspace

- **`nodeLinker: hoisted` en [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)**: layout plano (npm-style) en todo el monorepo. Imprescindible para builds de EAS / React Native; ver [`EAS_SETUP.md`](./EAS_SETUP.md) para el detalle. Inocuo para `apps/web` (Next.js usa su propio resolver). El `.npmrc` raíz ya no define settings — pnpm 11 los lee de `pnpm-workspace.yaml`.
- **`eas-cli` como dev dep**, no global: versión pineada en el lockfile, reproducible en CI. Ver [`EAS_SETUP.md`](./EAS_SETUP.md) para el detalle.
