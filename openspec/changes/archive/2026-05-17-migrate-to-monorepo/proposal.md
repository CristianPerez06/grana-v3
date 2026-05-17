## Why

grana-v3 está pre-producción y hoy es un repo de una sola app (Next.js). El próximo paso del producto es construir una app móvil con paridad de features usando React Native + Expo. Como existe oportunidad real de compartir validación, catálogos i18n, tipos de Supabase y tokens de diseño entre web y mobile, y como el colaborador no técnico opera vía Claude Code + OpenSpec (que se beneficia enormemente de tener un único repo con contexto unificado para cambios cross-platform), conviene migrar a un monorepo **ahora** — mientras el código es pequeño y la migración es trivial — en lugar de hacerlo más tarde cuando ya haya feature work en dos repos.

Este change limita el scope a la **reestructuración + extracción de paquetes compartidos**. El scaffold de la app mobile (Expo + Expo Router + NativeWind) y cualquier feature mobile quedan para changes futuros separados.

## What Changes

- Reestructurar el repo a **pnpm workspaces** con la siguiente forma:
  - `apps/web/` ← todo lo que hoy vive en la raíz (Next.js, componentes, middleware, lib/, .storybook/, etc.)
  - `packages/validation/` ← schemas Yup extraídos de `lib/validation/`
  - `packages/i18n-messages/` ← catálogos JSON extraídos de `lib/i18n/messages/`
  - `packages/supabase/` ← factory del cliente Supabase compartido + slot para tipos de DB generados; web lo consume reemplazando los actuales `lib/supabase/client.ts` / `server.ts`
  - `packages/ui-tokens/` ← tokens de diseño (colores, espaciado, tipografía) consumidos por el `tailwind.config` de web (y, en el futuro, por la app mobile cuando aparezca)
  - `apps/mobile/` queda reservado en la convención del repo pero **no se crea en este change** — lo crea el primer change de scaffold mobile.
- Expandir `pnpm-workspace.yaml` (ya existe, pero hoy solo lleva `allowBuilds`) para incluir `apps/*` y `packages/*`.
- Crear `package.json` raíz con scripts orquestadores (`pnpm --filter web dev`, etc.) y dev tooling compartido.
- Verificar que `apps/web/` sigue construyendo (`pnpm --filter web build`), corriendo (`pnpm --filter web dev`), y que Storybook sigue funcionando, después de la mudanza y después de cada extracción de paquete.
- Actualizar `CLAUDE.md` para describir el nuevo layout, dónde va cada tipo de código, y cómo correr la app web. Dejar nota explícita de que `apps/mobile/` y los detalles de tooling mobile se documentan en el change de scaffold mobile.
- Documentar (no automatizar) el cambio de **"Root Directory" → `apps/web`** en el proyecto de Vercel.
- **BREAKING** (interno, sin usuarios todavía): cambian todas las rutas relativas del repo. Importaciones internas que hoy son `@/lib/validation/...`, `@/lib/i18n/messages/...`, `@/lib/supabase/{client,server}` pasan a ser `@grana/validation`, `@grana/i18n-messages`, `@grana/supabase`. El resto de `@/...` sigue apuntando dentro de `apps/web/`.

## Capabilities

### New Capabilities

_None — esta migración es estructural, no introduce nueva funcionalidad de producto._

### Modified Capabilities

- `project-conventions`: agregar (a) layout de monorepo (qué va en `apps/*` vs `packages/*` vs raíz), (b) convención de specs cross-platform: una capability por comportamiento de negocio con scenarios tagueados `(web)` / `(mobile)` solo donde diverja, y capabilities propias (`web-*` / `mobile-*`) para preocupaciones genuinamente específicas de una plataforma. La convención (b) es forward-looking: queda registrada acá porque la layout del monorepo la habilita, aunque no haya specs cross-platform existentes hasta que aparezca la app mobile. Adicionalmente: actualizar la referencia de los catálogos i18n en la requirement de "código en inglés" a la nueva ruta `packages/i18n-messages/src/*.json`.

## Impact

- **Estructura del repo**: cambia toda la layout de directorios. Es la mudanza más invasiva que va a sufrir el repo en su vida útil, y conviene hacerla ahora que es barata.
- **Código movido (sin cambios de lógica)**:
  - Raíz → `apps/web/`: `app/`, `components/`, `middleware.ts`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.storybook/`, `public/`.
  - `lib/validation/` → `packages/validation/src/` (con `package.json` propio, `name: "@grana/validation"`).
  - `lib/i18n/messages/` → `packages/i18n-messages/src/` (solo los JSON; el runtime `next-intl` con `config.ts` + `request.ts` se queda en `apps/web/`).
  - `lib/supabase/client.ts` y `server.ts` → `packages/supabase/src/` con un factory que acepta el adapter de storage (cookies en web; preparado para SecureStore u otro en mobile más adelante). `middleware.ts` y `errors.ts` de Supabase quedan en `apps/web/` porque son específicos de Next.
  - Los tokens de diseño actualmente en el `tailwind.config` de web → `packages/ui-tokens/src/index.ts`, y el config de web los re-importa.
- **Código nuevo**:
  - `package.json` raíz con scripts orquestadores.
  - `package.json` de cada paquete (`@grana/validation`, `@grana/i18n-messages`, `@grana/supabase`, `@grana/ui-tokens`).
  - `apps/web/package.json` con todas las deps actuales de Next (movidas desde el `package.json` raíz que existía).
  - Opcional según decisión: `tsconfig.base.json` raíz con `paths` para resolver `@grana/*` a fuente directa (ver design.md, Decisión 7).
- **Dependencias**: sin paquetes externos nuevos. Solo se mueven dependencias existentes entre `package.json`s y se agregan dependencias internas de tipo `workspace:*` (p. ej. `@grana/validation: workspace:*` en `apps/web/package.json`).
- **Acciones manuales requeridas**: en Vercel, cambiar "Root Directory" del proyecto a `apps/web` antes de deployar el primer commit post-migración. Documentado en el README pero ejecutado por el humano.
- **Riesgos**:
  - **Vercel re-wire**: hay una ventana corta entre push y reconfigurar "Root Directory" donde el build de Vercel va a fallar. Mitigación: hacer el cambio de Vercel justo antes del push de la migración, o aceptar un build rojo único.
  - **Imports rotos que el typecheck no detecte**: mitigación en design.md (correr `build`, `lint`, `storybook` como verificaciones independientes después de la mudanza y de cada extracción).
  - **Storybook se rompe al moverse**: mitigación documentada en design.md.
- **Out of scope explícito** (changes futuros separados):
  - **Scaffold de `apps/mobile/`** (Expo + Expo Router + NativeWind + metro config + pantalla placeholder + verificación en simuladores). Es un change propio porque cierra un sub-objetivo independiente y porque su risk profile (Metro, NativeWind v4/v4, simuladores) merece su propio gate.
  - Construcción de auth flow en mobile.
  - Construcción de dashboard en mobile.
  - Cableado de EAS Build.
  - Generación de tipos de Supabase para `packages/supabase/` (slot queda preparado, generación es follow-up trivial).
  - Cualquier feature nuevo de web.
