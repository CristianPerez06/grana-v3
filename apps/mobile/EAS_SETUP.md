# EAS Setup — Grana Mobile

Guía de configuración de [EAS](https://docs.expo.dev/eas/) (Expo Application Services) para buildear y distribuir la app mobile. Cubre desde la instalación del CLI hasta el primer build interno corriendo en dispositivo físico.

EAS es el pipeline oficial de Expo para builds nativos en la nube, gestión de credenciales y distribución interna.

---

## Decisiones fijadas

| Decisión | Valor | Por qué |
|----------|-------|---------|
| Bundle ID iOS / Android package | `ar.com.grana.app` | Refleja el mercado argentino (asume control del dominio `grana.com.ar`). El identificador no se puede cambiar una vez publicado en las stores. |
| Perfiles de build | Solo `production` por ahora | Equipo chico, un solo flujo. Iteración día-a-día corre con `expo start` contra `.env` local; EAS se usa solo cuando hace falta un build nativo. Se agregan más perfiles cuando lo justifique CI, testers externos, o store launch (ver Fase 3 para el detalle). |
| Distribución | `internal` (sideload APK en Android, simulator en iOS hasta tener Apple Dev) | Sin pasar por TestFlight / Play Store mientras estemos iterando. |
| Manejo de env vars | Un único environment `production` en EAS | Mientras haya un solo Supabase project, una sola env. Cuando se separe data (e.g., Supabase staging) se agregan más environments. |
| Plan de Expo | Free tier | Suficiente para uso solo. Upgrade solo si justificado. |

## Sobre las cuentas de Apple / Google

- **Apple Developer ($99/año) — requerido** para instalar builds en iPhones físicos vía EAS internal distribution. EAS usa _ad-hoc provisioning_, que igual exige membresía paga.
- **Google Play ($25 único) — NO requerido** para distribución interna. EAS genera un APK y un link de instalación; se sidecargar en cualquier Android sin tocar Play Console. Solo hace falta cuando querés publicar en la tienda.

Empezar con cuenta gratis de Expo + Apple Developer paga (si necesitás iOS hoy). Postergar Google Play hasta el momento de publicar.

---

## Fase 1 — Instalación del CLI y login

### 1.1 Por qué `eas-cli` vive como dev dependency en `apps/mobile/`

`eas-cli` está construido sobre [oclif](https://oclif.io), que carga sus submódulos de forma perezosa en runtime via `require()`. Eso asume un `node_modules` plano (estilo npm). El store de pnpm es symlinked: las dependencias transitivas no quedan accesibles desde el root del paquete, y oclif falla con `Cannot find module 'debug'`.

Para evitar ese problema, la raíz del repo declara `node-linker=hoisted` en su `.npmrc`. Eso fuerza un layout plano (estilo npm) en todo el monorepo, que además es el setup que [Expo oficialmente recomienda](https://docs.expo.dev/guides/monorepos/#pnpm) para monorepos pnpm + React Native — varias librerías RN (Reanimated, entre otras) corren scripts Node durante el Gradle/Xcode build que resuelven dependencias hermanas via `require.resolve()`, y el layout symlinked default de pnpm rompe esas resoluciones.

| Archivo | Contenido relevante | Razón |
|---------|---------------------|-------|
| `.npmrc` (raíz del repo) | `node-linker=hoisted` | Layout plano para todo el monorepo. Imprescindible para que builds de EAS funcionen. Inocuo para `apps/web` (Next.js no depende del layout, usa su propio resolver vía `transpilePackages`). |
| `apps/mobile/package.json` → `devDependencies` | `"eas-cli": "^18.13.0"` | Pinea la versión del CLI en el lockfile (reproducible en CI y entre máquinas). |

> **Aprendizaje del setup**: inicialmente intentamos scopear `node-linker=hoisted` a `apps/mobile/.npmrc` para no afectar al resto. No funcionó en EAS: el cloud builder corre `pnpm install` desde la raíz del repo, así que un setting workspace-level no aplica. Debe vivir en el `.npmrc` de la raíz.

> **No instalar `eas-cli` con `pnpm add -g`** — el store global de pnpm también es symlinked y falla con el mismo error. Tampoco usar `npm install -g eas-cli`: en este repo el package manager es pnpm exclusivamente.

### 1.2 Verificar que el binario está disponible

Después de `pnpm install` desde la raíz del repo:

```bash
pnpm --filter mobile exec eas --version
```

Tiene que imprimir algo como `eas-cli/18.13.0 darwin-arm64 node-vXX`.

> Si preferís comandos más cortos, podés agregar `"eas": "eas"` a los `scripts` de `apps/mobile/package.json` y usar `pnpm --filter mobile eas <cmd>` en lugar de `pnpm --filter mobile exec eas <cmd>`. Opcional.

### 1.3 Crear cuenta en Expo

[expo.dev](https://expo.dev) → Sign up. Free tier.

### 1.4 Login desde el CLI

```bash
pnpm --filter mobile exec eas login
```

Abre un flujo OAuth en el navegador. Una vez completado, verificar:

```bash
pnpm --filter mobile exec eas whoami
```

Tiene que imprimir tu username de Expo.

---

## Fase 2 — Identidad de la app y registro en EAS

Antes de buildear cualquier cosa hay que decirle a EAS quién es esta app: nombre visible, slug del proyecto, identificadores únicos para cada tienda y el `projectId` que ata el repo al proyecto en el dashboard de Expo.

### 2.1 Campos de identidad en `app.json`

Estos campos quedan versionados en `apps/mobile/app.json`. Cambiarlos después de la primera build sube la fricción (y rompe el linkeo con el proyecto en EAS), así que se setean ahora y se dejan estables.

| Campo | Valor | Para qué |
|-------|-------|----------|
| `expo.name` | `Grana` | Nombre visible debajo del ícono en el home screen del dispositivo. |
| `expo.slug` | `grana-mobile` | Identificador del proyecto en el dashboard de EAS (`@<owner>/grana-mobile`) y en URLs de builds. Cambiarlo después de `eas init` requiere recrear el proyecto. |
| `expo.ios.bundleIdentifier` | `ar.com.grana.app` | Identificador único de la app en iOS. Inmutable una vez publicado en la App Store. |
| `expo.android.package` | `ar.com.grana.app` | Equivalente Android. Inmutable una vez publicado en Play Store. |

> El bundle ID y el package name son **inmutables a nivel tienda**: Apple y Google los usan como clave primaria de la app. Si se publica con `ar.com.grana.app` y después se cambia, la app aparece como un producto distinto (con instalaciones a cero). Por eso se decide antes de cualquier build dirigido a stores.

### 2.2 Registrar el proyecto con `eas init`

Una vez que los campos de identidad están en `app.json`, correr:

```bash
pnpm --filter mobile exec eas init
```

El comando:

1. Pregunta qué cuenta de Expo debe ser owner del proyecto. Para uso solo, elegir la cuenta personal. (Si más adelante se migra a una org, el `projectId` se mantiene y el owner se reasigna; no hace falta volver a correr `eas init`.)
2. Pide confirmación para crear `@<owner>/grana-mobile` (toma el slug de `app.json`).
3. Al confirmar, crea el proyecto en EAS y **modifica `app.json`** agregando:
   - `expo.extra.eas.projectId` — UUID que liga el código al proyecto en EAS. Se commitea al repo; **no es un secreto** (aparece en URLs públicas de builds).
   - `expo.owner` — username de la cuenta dueña.
   - `expo.extra.router` — slot vacío que Expo Router usa internamente.

Output esperado (formato real, los valores cambian por proyecto):

```
✔ Which account should own this project? › <tu-usuario>
✔ Would you like to create a project for @<tu-usuario>/grana-mobile? … yes
✔ Created @<tu-usuario>/grana-mobile
✔ Project successfully linked (ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) (modified app.json)
```

### 2.3 Verificar y commitear

Confirmar que `app.json` quedó con los campos nuevos:

```bash
pnpm --filter mobile exec node -e "const c = require('./app.json'); console.log({ owner: c.expo.owner, projectId: c.expo.extra?.eas?.projectId })"
```

Tiene que imprimir un objeto con tu username de Expo y un UUID. Si alguno es `undefined`, repetir `eas init`.

El cambio en `app.json` va a un branch `feature/eas-bootstrap` (o similar — sigue las convenciones de branching del repo raíz) y se mergea con `--no-ff` siguiendo la convención del proyecto.

---

## Fase 3 — Configurar `eas.json`

`eas.json` define **cómo** EAS construye la app: qué tipo de artefacto produce, cómo lo distribuye, qué credenciales usa y cómo numera las builds.

### 3.1 Decisión: arrancar con un único perfil

El standard de EAS es tener tres perfiles (`development`, `preview`, `production`) para cubrir dev-client, dogfooding interno y store builds. Para un equipo chico con un solo Supabase project, eso es overhead sin payoff:

- Iteración día-a-día corre con `expo start` contra `apps/mobile/.env` local — no requiere build de EAS.
- Builds nativos vía EAS solo se necesitan cuando se agregan módulos nativos o cuando se quiere probar la app en hardware real.
- Tres perfiles con la misma env apuntando al mismo Supabase es config noise.

Arrancamos con un único perfil llamado `production`, configurado para distribución interna. Cuando aparezca una segunda audiencia (CI automatizado, testers externos, store launch) se agregan los perfiles que correspondan.

### 3.2 El archivo `apps/mobile/eas.json`

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "distribution": "internal",
      "autoIncrement": true,
      "environment": "production",
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    }
  }
}
```

### 3.3 Decisiones encodadas (y por qué)

| Campo | Valor | Razón |
|-------|-------|-------|
| `cli.appVersionSource` | `"remote"` | EAS es el dueño de `buildNumber` (iOS) y `versionCode` (Android). `app.json` solo guarda la `version` legible. Evita commits ruidosos cada vez que CI bumpea el número de build. |
| `production.distribution` | `"internal"` | Build instalable vía link/QR (sin pasar por TestFlight / Play). |
| `production.autoIncrement` | `true` | Bumpea `buildNumber` / `versionCode` automáticamente en cada build. Las stores rechazan builds con número repetido — autoIncrement es la forma simple de evitar el problema desde el día uno. |
| `production.environment` | `"production"` | **Importante**: EAS auto-mapea el environment de un build con una heurística que combina nombre de perfil y `distribution`. Con `distribution: "internal"`, el default es el environment `preview`, **no `production`** — incluso aunque el perfil se llame "production". Setear `environment` explícito acá fija el environment a leer las env vars. Comprobado: sin este campo, `eas config --profile production` resuelve `preview`. |
| `production.ios.simulator` | `true` | Builds para iOS Simulator, no iPhone físico. **No requiere Apple Developer**. Cuando el Apple Dev esté activo (Fase 5), cambiar a `false`. |
| `production.android.buildType` | `"apk"` | APK directo para sideload. Cuando se publique en Play Store, cambiar a `"app-bundle"`. |

> El perfil se llama `production` por convención (EAS reconoce ese nombre como ambiente natural del lifecycle), pero su shape actual lo hace más cerca de un "preview/internal" build tradicional. La forma se va a ajustar — agregando perfiles nuevos o flippeando estos campos — cuando aparezca el momento de publicar.

### 3.4 Validar que `eas.json` parsea y resuelve

Confirmar que el archivo es JSON válido y que EAS puede resolver el perfil:

```bash
pnpm --filter mobile exec node -e "console.log('profiles:', Object.keys(require('./eas.json').build))"
# → profiles: [ 'production' ]

pnpm --filter mobile exec eas config --profile production --platform ios
```

`eas config` imprime la config resuelta del perfil (combina `eas.json` + `app.json` + env). Si tira error, hay algo mal en el JSON. En el output va a aparecer:

```
Resolved "production" environment for the build.
No environment variables with visibility "Plain text" and "Sensitive" found for the "production" environment on EAS.
```

Eso es **esperado en esta fase**: el environment quedó fijado correctamente en `production` (gracias al campo explícito `environment`), pero todavía no creamos las variables. La Fase 4 las crea.

### 3.5 Lo que NO está en `eas.json` (todavía)

- **Sin bloque `submit`** — la subida a TestFlight / Play Store es Fase 8, deferida hasta tener las cuentas pagas activas y el flujo de Fase 6 (primer build) validado.
- **Sin perfiles `development` ni `preview`** — innecesarios hoy. Cuando se justifiquen (Fast Refresh contra dev client con módulos nativos, testers externos con builds release-mode separados de los nuestros, CI), se agregan extendiendo el perfil `production` con [`extends`](https://docs.expo.dev/eas/json/#extends).
- **Sin perfiles para device iOS** — mientras no haya Apple Developer activo, no tiene sentido tener un perfil que va a fallar al pedir provisioning profiles.

---

## Fase 4 — Crear env vars en el environment `production` de EAS

Con `eas.json` ya apuntando al environment `production`, hay que crear las variables que la app necesita en runtime. Sin esto, el build se ejecuta pero la app crashea al startup porque `process.env.EXPO_PUBLIC_SUPABASE_URL` resuelve a `undefined`.

### 4.1 Qué variables necesita la app

Hoy son dos, ambas Supabase, ambas con prefijo `EXPO_PUBLIC_` (ver `apps/mobile/lib/supabase.ts`):

| Variable | Para qué |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key — la security boundary real es RLS en la base, no esta key. |

> **Sobre el prefijo `EXPO_PUBLIC_`**: Expo inlinea estas variables en el bundle JS que se shipea al dispositivo. Cualquiera con la app puede extraerlas. Por eso `--visibility plaintext` es correcto en EAS — no hay nada que ocultar a nivel del CI/dashboard que no sea ya visible en el cliente. La seguridad real vive en Supabase: RLS (Row Level Security) sobre cada tabla, y rotación de la anon key si alguna vez se considera comprometida.

### 4.2 De dónde sacar los valores

Dos fuentes equivalentes:

- **`apps/mobile/.env` local** — si ya configuraste `expo start` para que conecte a Supabase, los valores ya están ahí.
- **Dashboard de Supabase** → Project Settings → API:
  - `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
  - `Publishable key` (la `anon` key pública) → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 4.3 Crear las variables con `eas env:create`

Desde la raíz del repo, sustituyendo los valores en línea (no los pasees por chats / logs):

```bash
pnpm --filter mobile exec eas env:create \
  --environment production \
  --name EXPO_PUBLIC_SUPABASE_URL \
  --value '<tu URL>' \
  --type string \
  --visibility plaintext \
  --scope project \
  --non-interactive

pnpm --filter mobile exec eas env:create \
  --environment production \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value '<tu anon key>' \
  --type string \
  --visibility plaintext \
  --scope project \
  --non-interactive
```

Flags relevantes:

| Flag | Valor | Por qué |
|------|-------|---------|
| `--environment` | `production` | Coincide con el `environment` declarado en `eas.json`. |
| `--type` | `string` | Las dos son strings simples (no archivos). |
| `--visibility` | `plaintext` | Visible en logs de build y en `env:list`. Suficiente para `EXPO_PUBLIC_*`, que igual termina en el bundle del cliente. |
| `--scope` | `project` | Variables atadas a este proyecto EAS, no compartidas con otros proyectos de la cuenta. |
| `--non-interactive` | (flag) | Falla rápido si falta un flag, en lugar de abrir prompts. Ideal para scripts y docs reproducibles. |

### 4.4 Verificar sin exponer los valores

`eas env:list` con `--format short` imprime solo nombres, tipos y visibility — sin los valores. Útil para checkear que están las que tienen que estar sin exponer secretos en logs o screenshots:

```bash
pnpm --filter mobile exec eas env:list --environment production --format short
```

Tiene que listar `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Para inspeccionar valores completos (cuando hace falta), `--format long` (default).

### 4.5 Cuándo (re)crear estas vars

- **Nueva máquina del equipo** — no hace falta tocar nada. EAS las resuelve en cloud, cualquier `eas build` desde cualquier máquina las picks up.
- **Cambia el Supabase project** — actualizar con `eas env:update` (mismo formato, sustituye el valor).
- **Rotación de la anon key** — idem `eas env:update`. Las builds anteriores ya distribuidas siguen usando la key vieja hasta que se rebuildeen.
- **Se agrega un environment nuevo** (e.g., `staging`, `preview`) — repetir el flow para el environment nuevo. EAS no copia env vars entre environments automáticamente.

---

## Fase 6 — Primer build interno

Con `eas.json` y las env vars en su lugar, ya se puede disparar el primer build. Cubrimos dos targets:

- **Android (APK firmado)** — distribución interna real: EAS auto-genera el keystore de release y devuelve un link de instalación que cualquier teléfono Android puede abrir y sideloadear.
- **iOS Simulator (`.app`)** — validación del pipeline iOS sin requerir Apple Developer. Útil mientras se espera el enrollment; cuando el Apple Dev esté activo, se cambia `ios.simulator: false` y se hace el primer build para iPhone físico (Fase 5).

### 6.1 Disparar el build

Hay scripts atajados en `package.json` (raíz y mobile). Desde la raíz del repo, usando los atajos con prefijo `eas:`:

```bash
# Build en la nube (consume créditos del free tier de EAS)
pnpm eas:android
pnpm eas:ios

# Mismos comandos en modo local (no consume créditos, sin cola)
pnpm eas:android:local
pnpm eas:ios:local

# Listar los últimos builds del proyecto en EAS
pnpm eas:list
```

Cada uno expande a `eas build --profile production --platform <p> [--local]`. Desde `apps/mobile/` los mismos scripts existen sin el prefijo `eas:` (`pnpm build:android`, `pnpm build:ios:local`, etc.).

La primera vez para cada plataforma:

1. **Prompt de keystore (solo Android)** — EAS pregunta si querés generar un Android Keystore nuevo. Responder **yes**. El keystore queda guardado en el dashboard de EAS y se reutiliza en todos los builds futuros. Importante porque Android rechaza updates de la app si el APK nuevo está firmado con un keystore distinto al instalado.
2. **Prompt de export compliance (solo iOS)** — EAS pregunta si la app solo usa encryption estándar/exento. Responder **yes** para Grana — solo HTTPS/TLS, Keychain, Supabase auth (todo exento de US export compliance). EAS persiste la respuesta en `app.json` (`ios.infoPlist.ITSAppUsesNonExemptEncryption: false`) y el prompt no vuelve a aparecer.
3. **Upload** — EAS empaqueta y sube el repo (~30-60 segundos).
4. **Cola y build** — el job entra a la cola del free tier y arranca cuando hay capacidad. Duración típica: **10-20 minutos** (los primeros builds son más lentos por cold cache).

El CLI bloquea esperando el build por default. Si querés liberar la terminal, Ctrl-C y reconectar después con `pnpm eas:list` para ver los últimos builds.

> **Builds locales para iteración (recomendado durante setup)**: agregando `--local` al mismo comando, EAS corre el pipeline en tu máquina en vez de en la nube. **No consume créditos del free tier**, arranca inmediatamente sin cola, e itera más rápido — ideal para debugging de issues de build/runtime como los de Fase 6.4. Requiere:
> - **iOS**: macOS con Xcode + CocoaPods (`brew install cocoapods`) + Fastlane (`brew install fastlane`). El `.app` queda en un `.tar.gz` local; se instala dragueando el `.app` al simulator corriendo, o con `eas build:run --platform ios --latest`.
> - **Android**: Java JDK 17 + Android SDK (forma fácil: instalar Android Studio una vez).
>
> Cuando usar cloud (no `--local`): builds para compartir con un tester por link, builds de record en el dashboard de EAS, validación pre-distribución final.

### 6.2 Instalar el APK

Cuando el build termina, en la salida del CLI (o en el dashboard) aparece:

- Un **link de instalación** (página con QR + descarga directa).
- El APK como artifact descargable directo.

Dos formas de poner el APK en el teléfono:

1. **QR**: abrir la página del build en el browser de la compu, escanear con la cámara del Android, tap al link de instalación, permitir "Install from unknown source" si aparece la pregunta, instalar.
2. **Descarga directa**: abrir la página del build desde el browser del propio teléfono, descargar el APK, tap para instalar.

### 6.3 Smoke test después de instalar

Build verde ≠ app funcional — un APK puede compilar y crashear al startup si las env vars no llegaron al bundle o si hay un crash native. Validar manualmente:

1. La app abre con el ícono y nombre **Grana**.
2. La primera screen renderiza sin red box ni crash native.
3. La pantalla de login alcanza Supabase — intentar loguear con credenciales incorrectas y confirmar que el error sea el de "credenciales inválidas", **no** un error de red. Un error de red implicaría que `EXPO_PUBLIC_SUPABASE_URL` o `_ANON_KEY` no entraron al bundle.

### 6.4 Gotchas que tropezamos y cómo se resolvieron

Documentadas acá para que la próxima persona no tenga que redescubrirlas. Las tres ya están corregidas en el repo, así que un build nuevo no las pega.

| Síntoma | Causa raíz | Fix |
|---------|------------|-----|
| Build fail en Gradle, `react-native-reanimated/android/build.gradle` line 53, "Process 'command 'node'' finished with non-zero exit value 1". | El `node-linker=hoisted` estaba en `apps/mobile/.npmrc` (workspace level), no en el `.npmrc` raíz. EAS Build corre `pnpm install` desde la raíz, así que el setting workspace-level no aplicaba, y RN libraries no podían resolver dependencias hermanas via `require.resolve()`. | Mover `node-linker=hoisted` al `.npmrc` raíz del repo. Ya está versionado. |
| Build fail en Metro, "Cannot find module `@grana/ui-tokens/tokens`" desde `apps/mobile/tailwind.config.js`. | `apps/mobile/tailwind.config.js` requiere `@grana/ui-tokens/tokens` pero `apps/mobile/package.json` nunca declaró la dependencia. El layout isolated viejo de pnpm permitía que Node's resolver caminara hacia arriba y encontrara workspace packages no declarados; el layout hoisted ya no lo permite (correctamente). | Declarar `"@grana/ui-tokens": "workspace:*"` en `devDependencies` de `apps/mobile/package.json`. Ya está hecho. |
| iOS simulator build instala pero la app crashea al startup. Crash report nativo señala una NSException re-lanzada desde `ObjCTurboModule::performVoidMethodInvocation` en `com.meta.react.turbomodulemanager.queue` (poco informativo). El log stream del simulator (ver 6.5) revela el verdadero error: `Unhandled JS Exception: TypeError: Cannot read property 'useRef' of null` dentro del stack `react-native-screens` / `react-navigation`. | Reanimated v4 movió su Babel plugin de `react-native-reanimated/plugin` (v3) a `react-native-worklets/plugin` (v4). El `babel.config.js` de mobile no tenía ninguno. Sin el plugin, Reanimated init rompe en runtime — silenciosamente en Android (animaciones degradadas, no crash), ruidosamente en iOS donde el stack que lo consume dereferencia `null`. Además `react-native-worklets` solo estaba como transitive en `.pnpm/`, no resoluble desde el contexto de Babel. | Agregar `'react-native-worklets/plugin'` como **último** plugin en `apps/mobile/babel.config.js` y declarar `"react-native-worklets"` como dep directa en `apps/mobile/package.json`. Ya está hecho. |

> Lección general: cualquier `require` o `import` que aparezca en código de `apps/mobile/` (incluyendo plugins de Babel) necesita una dep declarada explícitamente. El hoisted layout no es más estricto que npm en este sentido, pero comparado con el isolated layout viejo, sí expone más deps no declaradas.
>
> Lección iOS-específica: un crash report nativo en simulator suele tener forma de NSException via TurboModule queue, lo cual es _downstream_ del problema real. El crash report no muestra el error JS underlying — hay que ir al log stream del simulator para encontrarlo (ver 6.5).

### 6.5 Diagnosticar crashes nativos en iOS simulator

Cuando una iOS simulator build instala bien pero la app crashea al abrir, el crash report nativo (Console.app o el `.crash` que aparece en `~/Library/Logs/DiagnosticReports/`) muestra el stack nativo pero rara vez la causa real. Si la app crashea durante init de React Native — patrón típico: la queue terminada es `com.meta.react.turbomodulemanager.queue` y el stack pasa por `objc_exception_rethrow` → `std::__terminate` → `abort` — el error verdadero (NSException o JS Exception) está en los `NSLog` del proceso.

Para extraerlos, identificar el simulator booteado:

```bash
xcrun simctl list devices booted
```

Y después, antes de reproducir el crash, abrir un stream en vivo en otra terminal:

```bash
xcrun simctl spawn booted log stream --predicate 'process == "Grana"' --level=debug
```

Tap el ícono de Grana en el simulator. Cuando crashea, Ctrl-C el stream. Las últimas 20-30 líneas tienen el error real — buscar:

- `Unhandled JS Exception: ...` — error JS no atrapado (caso más común con bundling/plugins mal configurados).
- `*** Terminating app due to uncaught exception 'NSExceptionName', reason: '...'` — exception ObjC nativa con nombre y razón.
- Líneas con `Error` o `Fault` cerca del momento del crash.

Alternativamente, si el crash ya pasó, mirar el último minuto de logs en una sola query:

```bash
xcrun simctl spawn booted log show --predicate 'process == "Grana"' --info --debug --last 2m
```

> El crash report nativo y el log stream son **complementarios**: el crash report te dice _dónde_ (queue, stack, address), el log stream te dice _por qué_ (la excepción que originó la cadena).

---

_Trabajo pendiente (Fase 5, 8a-c, tech debt) tracked en [`PROXIMAS_FASES.md`](./PROXIMAS_FASES.md). Ese archivo se borra cuando todo lo de adentro está hecho._
