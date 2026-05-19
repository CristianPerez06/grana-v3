# Grana Mobile

App nativa de Grana V3, construida con [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction/) + [NativeWind](https://www.nativewind.dev). Comparte código cross-platform con `apps/web` vía los paquetes `@grana/*`.

## Requisitos

- pnpm instalado y `pnpm install` corrido al menos una vez desde la raíz del repo (ver [README raíz](../../README.md)).
- Para correr en dispositivo físico o simulador: app [Expo Go](https://expo.dev/client) en el teléfono, o el simulador de iOS / emulador de Android instalado localmente.

## Scripts

Desde `apps/mobile/` con `pnpm <script>`, o desde la raíz con `pnpm --filter mobile <script>`.

### Dev y QA

| Script        | Qué hace                                                  |
| ------------- | --------------------------------------------------------- |
| `dev`         | Levanta Metro y abre el dev server (Expo Go o dev client) |
| `ios`         | Atajo: `expo start --ios` (abre el simulador de iOS)      |
| `android`     | Atajo: `expo start --android` (abre el emulador Android)  |
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

## Convenciones específicas de este workspace

- **`node-linker=hoisted` en el `.npmrc` raíz del repo**: layout plano (npm-style) en todo el monorepo. Imprescindible para builds de EAS / React Native; ver [`EAS_SETUP.md`](./EAS_SETUP.md) para el detalle. Inocuo para `apps/web` (Next.js usa su propio resolver).
- **`eas-cli` como dev dep**, no global: versión pineada en el lockfile, reproducible en CI. Ver [`EAS_SETUP.md`](./EAS_SETUP.md) para el detalle.
