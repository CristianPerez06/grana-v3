## Context

Las 6 rutas del grupo `(auth)` comparten hoy el shell `CurvedNavyContainer`, que renderiza un header navy con borde curvo (`CurvedNavyHeader`, con el logo, título y subtítulo en blanco sobre navy) seguido de un `<main>` centrado de `max-w-[430px]`. `CurvedNavyContainer` es el único consumidor de `CurvedNavyHeader`, y ambos solo se usan en `(auth)`.

El spec de `auth` ya describe el shell como "card centrada sobre un fondo limpio", lenguaje del que el header navy se aleja. La marca Grana fue renovada (componente `GranaLogo` por paths vectoriales) y la dirección de diseño "minimal centered card" fue explorada y aprobada en Paper.

Restricciones relevantes:
- Es un reskin: server actions, validación (`@grana/validation`), claves i18n y los componentes de UI compartidos (`Input`, `FormField`, `PasswordField`, `Button`, `SubmitButton`) NO cambian.
- El `Button` primario ya es esmeralda (`bg-emerald hover:bg-emerald-deep`) y `SubmitButton` lo usa por defecto: el CTA del diseño ya está cubierto por el sistema.
- `GranaLogo` vive en la rama `feature/grana-logo` (aún no en `main`); por eso este branch se apila sobre ella.

## Goals / Non-Goals

**Goals:**
- Reemplazar el shell de `(auth)` por una tarjeta centrada minimalista, manteniendo intacto todo el comportamiento.
- Un único punto de cambio (`AuthShell`) que reskinea las 6 rutas a la vez.
- Responsive: cardless a todo el ancho bajo `sm`, tarjeta con hairline + sombra en `sm+`.
- Dejar el árbol sin código muerto (borrar `CurvedNavyContainer` y `CurvedNavyHeader`).

**Non-Goals:**
- Paridad del shell de auth en la app mobile (Expo) — follow-up aparte.
- Cambiar formularios, campos, validación, i18n, server actions o el sistema de inputs/botones.
- Agregar footer legal (Términos/Privacidad/Ayuda): era un recurso para llenar el canvas desktop en Paper; sin páginas destino ni claves i18n, no se incluye en código por ahora.
- Pantallas OTP/reset rediseñadas internamente: solo cambia el shell que las envuelve.

## Decisions

### 1. `AuthShell` como componente de shell por página (no en `layout.tsx`)

`AuthShell` reemplaza a `CurvedNavyContainer` con la **misma forma de props** (`title`, `subtitle?`, `children`, `contentClassName?`), de modo que cada `page.tsx` lo monta pasando su propio título/subtítulo. Se descarta mover el chrome a `app/(auth)/layout.tsx` porque el título/subtítulo son por-página y App Router no permite pasar datos de page → layout sin acoplar. `layout.tsx` sigue delimitando el grupo. La paridad de props minimiza el diff en las páginas (cambian solo el import y el nombre del componente; signup/forgot dejan de pasar `showBack`/`backHref`/`backLabel`).

Alternativa considerada: chrome en `layout.tsx` + header por página → más archivos tocados y estilos partidos entre layout y página. Rechazada.

### 2. Responsive cardless-en-mobile con prefijos Tailwind

La tarjeta usa clases base sin borde/sombra y agrega `sm:border sm:border-border sm:shadow-...` y padding mayor en `sm+`. Bajo `sm` el contenido queda a todo el ancho fundido con `bg-page`. Esto reproduce con un solo componente la intención de Paper ("cardless en mobile, tarjeta en desktop") sin dos árboles.

### 3. Reutilizar el sistema de inputs/botones tal cual

No se introducen tamaños/radios a medida (el mock de Paper usaba 48px/12px; el sistema usa `h-11`/`radius-md`). Mantener el `Input`/`Button` del sistema garantiza consistencia con el resto de la app y reduce el cambio a presentación del shell. `AUTH_INPUT_CLASS` se mantiene salvo que el contraste sobre tarjeta blanca pida un ajuste mínimo de borde/anillo de foco (decisión durante implementación, sin tocar el componente base).

### 4. Logo dentro de la tarjeta con colores de marca por defecto

`GranaLogo` se usa con sus colores por defecto (wordmark navy, badge esmeralda, glifo blanco), correctos sobre tarjeta blanca — a diferencia del header navy actual, que lo invertía (`fg="#FFFFFF" glyph="#0B1A2B"`).

### 5. Borrar `CurvedNavyContainer` y `CurvedNavyHeader`

Tras migrar las 6 páginas quedan sin uso. Se borran en el mismo change para no dejar código muerto (verificado: no hay otros consumidores).

## Risks / Trade-offs

- **Regresión visual en alguna de las 6 rutas (las OTP/reset son menos obvias)** → Mitigación: revisar las 6 rutas (`/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/forgot-password/verify`, `/reset-password`) tras el swap; `reset-password` además tiene estados de card de éxito/error que deben verse bien dentro del nuevo shell.
- **`AUTH_INPUT_CLASS` afinado para la era navy** (`focus:border-navy`, `border-slate-300`) puede verse subóptimo sobre tarjeta blanca → Mitigación: ajuste mínimo de clases si hace falta, sin tocar `Input`.
- **Branch apilado sobre `feature/grana-logo`** (dependencia de `GranaLogo`) → Mitigación: al aterrizar, el usuario mergea primero el branch del logo a `main`; luego se rebasa este branch con `git rebase --onto main feature/grana-logo feature/auth-minimal-redesign` para replayar solo el commit del rediseño.
- ~~**Design-refs de Paper aún no versionados** (cuota agotada)~~ → Resuelto el 2026-05-31: PNG+SVG de los 6 artboards (Desktop 1440 + Web Mobile 390) y un JSX de referencia para Signup desktop quedaron en `design-refs/` (no autoritativos — ver `design-refs/README.md`).

## Migration Plan

1. Crear `AuthShell`; migrar las 6 páginas; borrar los componentes navy.
2. `pnpm lint` + `pnpm build` + revisión visual de las 6 rutas.
3. Archivar el change (integrar el delta al master spec de `auth`) como último commit del branch, antes del merge.
4. Rollback: revertir el commit del rediseño restaura `CurvedNavyContainer` (sin cambios de datos).
