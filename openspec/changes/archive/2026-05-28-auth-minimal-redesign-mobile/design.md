## Context

Las 6 pantallas de `apps/mobile/app/(auth)/` usan el `CurvedNavyContainer` mobile (KeyboardAvoidingView → ScrollView → CurvedNavyHeader navy con borde curvo + View de contenido `max-w-[430px]`). `CurvedNavyContainer`/`CurvedNavyHeader` mobile solo se usan en `(auth)`. El `GranaLogo` mobile (`apps/mobile/components/ui/GranaLogo.tsx`, react-native-svg, misma API que web: `width`/`fg`/`accent`/`glyph`) existe pero no se usa en ninguna pantalla.

NativeWind resuelve los colores desde `@grana/ui-tokens/tokens` (`tailwind.config.js`), por lo que las clases `bg-page`, `bg-card`, `border-border`, `text-text`, `text-text-muted` están disponibles con sus literales light. El `Button` primario mobile ya es `bg-emerald text-white`.

Espejo del change web `auth-minimal-redesign` (misma dirección "minimal centered card"), con implementación nativa propia según la política Web↔Mobile.

## Goals / Non-Goals

**Goals:**
- Shell de auth mobile = tarjeta centrada minimalista, con el logo Grana cableado por fin.
- Un único `AuthShell` que reskinea las 6 pantallas.
- Preservar el manejo de teclado (`KeyboardAvoidingView` + `ScrollView`).
- Sin código muerto (borrar el shell navy mobile).

**Non-Goals:**
- Tocar handlers, Supabase, validación, navegación o copy.
- Rediseñar internamente las pantallas OTP/new-password: solo cambia el shell.
- Modo oscuro (los tokens `dark` en RN son un tema preexistente aparte).

## Decisions

### 1. Cardless centrado (sin tarjeta) en mobile

La app corre a ancho de teléfono = "bajo `sm`" en la lógica responsive del web, donde el diseño es cardless. Por eso el `AuthShell` mobile NO dibuja borde/sombra de tarjeta: el contenido va centrado directamente sobre `bg-page`, con el logo, título y subtítulo centrados arriba y el form debajo. Evita además el dolor de las sombras en RN (elevation/shadow*).

Alternativa: replicar una "tarjeta" con borde/sombra → innecesario a ancho de teléfono y peor en RN. Rechazada.

### 2. Mantener KeyboardAvoidingView + ScrollView

El shell viejo ya envolvía el contenido en `KeyboardAvoidingView` (behavior por plataforma) + `ScrollView` (`keyboardShouldPersistTaps="handled"`). Se conserva en `AuthShell` para no regresionar el comportamiento del teclado en los forms. El centrado vertical se hace con `contentContainerClassName="flex-grow justify-center"` (centra cuando hay espacio, scrollea cuando el teclado lo reduce). Padding top/bottom desde `useSafeAreaInsets`.

### 3. Props mínimas: `title`, `subtitle?`, `children`

Se quitan `showBack`/`backHref`/`backLabel` (el header navy y su chevron desaparecen). Cada pantalla ya tiene sus links de navegación inline (`¿Ya tenés cuenta?`, `Volver a iniciar sesión`, botones de "volver a empezar"), así que no se pierde navegación.

### 4. Logo con colores por defecto

`<GranaLogo width={104} />` usa wordmark navy + badge esmeralda + glifo blanco (defaults), correctos sobre `bg-page`/contenido claro. Self-sizing (calcula su alto), no requiere fijar height.

### 5. Borrar el shell navy mobile

Tras migrar las 6 pantallas, `CurvedNavyContainer`/`CurvedNavyHeader` mobile quedan sin uso → se borran.

## Risks / Trade-offs

- **Regresión de teclado en forms** → Mitigación: se conserva el `KeyboardAvoidingView`+`ScrollView` del shell viejo; verificar login/signup/new-password con teclado abierto.
- **Pantallas OTP (signup-verify, recovery-verify) dentro del nuevo shell** → Mitigación: el `OtpVerifyForm` no cambia; revisar que entre bien en el layout centrado.
- **Branch sibling de la del web** (ambas tocan la requirement `auth`) → Mitigación: archivar web primero; el delta de este change trae la requirement completa final (web+mobile). Ver [[feedback_never_merge_to_main]] (merges los hace el usuario).
- **`tracking`/sombras en NativeWind** → Mitigación: se evita `tracking-*` y sombras; se usa `text-2xl font-bold` como el header mobile previo.

## Migration Plan

1. Crear `AuthShell` mobile; migrar las 6 pantallas; borrar el shell navy.
2. Typecheck (`tsc --noEmit`) + lint de mobile en verde.
3. Archivar (después del change web) integrando la requirement final al master spec de `auth`; `pnpm openspec:check` en verde.
4. Rollback: revertir el commit restaura el shell navy mobile (sin cambios de datos).
