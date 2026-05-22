## Context

El shell de navegación de Grana V3 hoy vive en dos lugares con problemas paralelos:

- **Web** (`apps/web/app/(app)/_components/`): un `Header` con grid de 3 columnas que aloja la navegación primaria (Cuentas/Tarjetas/Movimientos) y un `Sidebar` colapsable que solo expone Settings + logout. El estado de colapso vive en un `SidebarContext` propio. El `layout.tsx` raíz monta `<Header />` arriba y un flex row con `<Sidebar /> + <main />`. No hay utilidades responsive (`sm:`/`md:`/`lg:`), por lo que la app no es usable bajo 768px. Los textos del header están hardcodeados en español.
- **Mobile** (`apps/mobile/components/layout/TabBar.tsx`): un tab bar custom (no `Tabs` default de Expo Router) que interpreta cuatro rutas — `dashboard`, `movimientos`, `tarjetas`, `menu` — donde `menu` no navega sino que dispara `onMenuPress()` para abrir el `AppMenu` (bottom sheet modal). Los colores activo/inactivo están hardcodeados (`#0B1A2B` / `#8A94A3`), aunque el resto del archivo ya usa clases utilitarias derivadas de `@grana/ui-tokens` (`bg-card`, `border-border-soft`, `text-text-soft`).

La paleta de marca existe completa en `packages/ui-tokens/src/theme.css` (navy, emerald, plum, terracotta, slate; surfaces; semantic; cat-1…cat-5; modo oscuro). Hoy la nav no la usa.

Esta change consolida ambas redesigns en una sola entrega coordinada porque la decisión de paleta (emerald como acento activo) y la "lectura" del sistema de navegación se aplican simétricamente en ambas plataformas.

## Goals / Non-Goals

**Goals:**

- Web: eliminar `Header`, reescribir `Sidebar` como island flotante (logo arriba, nav primaria al medio, settings/logout al pie), aplicar paleta de marca (emerald activo, navy logo, hover sutil), e introducir comportamiento mobile-first (drawer + topbar bajo `md`).
- Mobile: diferenciar visualmente el 4to slot del tab bar como botón de menú (no como pestaña), aplicar paleta de marca al tab bar leyendo desde `@grana/ui-tokens`, mejorar la presentación general del tab bar y la sheet `AppMenu`.
- Mantener la simetría de contrato entre plataformas: mismos nombres conceptuales (Dashboard, Movimientos, Tarjetas), mismo color de acento activo (emerald), misma jerarquía visual (nav primaria vs acción de menú).

**Non-Goals:**

- No cambiar el conjunto de destinos accesibles desde la nav. Los items son los actuales (Dashboard, Cuentas, Tarjetas, Movimientos, Settings, Logout en web; Dashboard, Movimientos, Tarjetas + menú con Mis tarjetas / Hogar / Ahorros / Configuración / Salir en mobile). La reorganización de items pertenece a otra change.
- No tocar la paleta de `@grana/ui-tokens`. Los tokens existen; esta change solo cambia su uso.
- No introducir features de personalización (temas custom, reordenar items, marcar favoritos).
- No modificar `apps/web/middleware.ts` ni las redirecciones de auth.
- No tocar el `mobile-app-shell` en lo que respecta a arranque/resolución de paquetes/typecheck (cubierto por requirements existentes).
- No agregar libraries nuevas (drawer libraries, animation libraries, etc.). El drawer mobile se hace con `<dialog>` o estado + Tailwind.

## Decisions

### D1. Web: sidebar-only en lugar de header + sidebar

**Decisión:** Eliminar el `Header` por completo. Toda la navegación va al `Sidebar`.

**Por qué:** La distribución actual está invertida — la nav primaria (Cuentas/Tarjetas/Movimientos) vive en el header mientras el sidebar solo tiene utilidades secundarias. Para un dashboard con ~5 destinos primarios, el patrón canónico (Linear, Notion, Stripe Dashboard) es sidebar-only con logo arriba, nav al medio, perfil/settings al pie. Reduce dos componentes a uno, libera espacio vertical para contenido, y elimina la ambigüedad sobre dónde encontrar qué.

**Alternativa considerada:** mantener un header delgado con breadcrumbs/page title + sidebar para nav. Descartada: agrega complejidad sin un beneficio claro a este tamaño de app; los breadcrumbs pueden vivir dentro de cada pantalla si los necesitamos en el futuro.

### D2. Web: island sidebar (flotante, todas las esquinas redondeadas)

**Decisión:** El sidebar se renderiza con margen externo (`m-3` ≈ 12px en todos los lados), `rounded-2xl` o `rounded-3xl`, `shadow-sm`/`shadow-md`, y se separa del contenido principal (`<main />`) con `gap` en lugar de borde compartido.

**Por qué:** Distingue visualmente al sidebar como un objeto/panel propio en lugar de una "pared". El estilo es coherente con el resto de la UI de Grana V3 (`card` ya usa esquinas redondeadas y sombra). El logo arriba refuerza la identidad y duplica como link "ir a Dashboard".

**Alternativa considerada:** edge-attached, solo esquinas derechas redondeadas. Descartada por el usuario en la fase de propuesta (preferencia explícita por island con cuatro esquinas).

**Trade-off:** El island ocupa unos pocos píxeles extra; el contenido vive en un viewport efectivamente más chico. Aceptable para anchos `md+` donde sobra horizontal real estate.

### D3. Web: responsive breakpoint y drawer

**Decisión:** Bajo `md` (768px en Tailwind por default) el sidebar desaparece y se reemplaza por:

1. Una topbar delgada (~56px) con logo (`/dashboard`) + botón hamburger a la izquierda y, opcionalmente, espacio reservado para acciones contextuales a la derecha.
2. Un drawer lateral izquierdo que se abre desde el hamburger con el mismo contenido del sidebar desktop (logo, nav, settings, logout). Se cierra con tap fuera, ESC, o botón X interno.

**Implementación:** un único componente `AppShell` que recibe el estado de breakpoint vía clases responsive (`hidden md:flex` para sidebar desktop, `flex md:hidden` para topbar mobile). El drawer es un `<dialog>` nativo con `open` controlado por React state — sin librerías. Se anima con clases utilitarias (`transition-transform`, `translate-x-*`).

**Por qué `<dialog>`:** API nativa de modal, accesibilidad correcta gratis (focus trap, ESC, ARIA), sin dependencias.

**Alternativa considerada:** Radix `Dialog`. Descartada para esta change: agrega una dependencia para un caso simple; `<dialog>` cubre las necesidades. Si en el futuro aparece un segundo caso de uso, se puede reconsiderar.

### D4. Web: estado activo con `usePathname`

**Decisión:** El sidebar es Client Component (ya lo es por el state). Usa `next/navigation`'s `usePathname` para determinar el item activo. El item activo recibe: `border-l-[3px] border-positive` (emerald), `text-positive`, `bg-positive/8` (o un token específico si lo introducimos más adelante).

**Por qué:** simple, sin server-state, sin necesidad de pasar el path actual desde el layout.

### D5. Web: paleta — emerald activo, navy logo, terracotta logout

**Decisión:** Mapeo concreto de tokens:

| Elemento | Token |
|---|---|
| Sidebar surface | `bg-card` |
| Sidebar border | `border-border-soft` |
| Logo (texto/icono) | `text-navy` |
| Item inactivo (texto + ícono) | `text-text` (hover: `text-text` + `bg-page`) |
| Item activo | `text-positive`, `border-l-positive`, `bg-positive/8` |
| Settings (sin estado activo) | igual a item inactivo |
| Logout | `text-error` (igual al actual) |
| Hover destructivo | `bg-error/8` |

**Por qué:** emerald = positive = el color con el que el usuario asocia "movimiento" y "estado correcto" en la app. Navy para el logo refuerza la marca sin competir con el accent.

### D6. Mobile: 4to slot como botón circular

**Decisión:** En `TabBar.tsx`, mantener el slot `menu` en la misma row del tab bar pero con un treatment visual distinto:

- Renderizado como `<Pressable>` circular (~52px) con `bg-positive` (emerald), ícono `MoreHorizontal` blanco, sin label.
- Las otras tres pestañas (Dashboard / Movimientos / Tarjetas) mantienen su layout actual (ícono + label vertical).
- El botón circular se eleva un poco (margin-top negativo) o se centra verticalmente alineado con los íconos de las pestañas, según se vea mejor en device — esta decisión final queda para implementación con review visual.

**Por qué:** Resuelve la confusión visual ("menu se ve como una pestaña más") sin sacar el menú de su ubicación esperada (esquina inferior derecha es ergonómica para pulgar). Mantiene el contrato de Expo Router (`menu` sigue siendo una "ruta" que el TabBar intercepta).

**Alternativa considerada:** FAB flotante encima del tab bar. Descartada: agrega un overlay con z-index propio y rompe la simetría de la row.

**Alternativa considerada:** mover el menú al header / top-right. Descartada: mobile no tiene header en este shell; agregarlo solo para el botón es desproporcionado.

### D7. Mobile: paleta y surface del tab bar

**Decisión:**

- Eliminar los literales `#0B1A2B` / `#8A94A3` del TabBar y reemplazarlos por tokens leídos como JS values desde un módulo central. Como `@grana/ui-tokens` ships CSS (por la elección Tailwind v4) y mobile necesita valores JS, se introduce un mirror mínimo en el propio `apps/mobile/lib/colors.ts` con los tokens que usa la nav (navy, positive, text-soft, text, card, border-soft). Cuando aparezca el codegen TS mirror del token system completo (ver memoria `project_ui_tokens_tailwind_v4`), este archivo se reemplaza por el import.
- Active state: `text-positive` (emerald) tanto en ícono como en label. Pill superior de 3px sobre el ícono activo, ancho ~24px, color positive.
- Inactive: `text-text-soft` (igual al actual semánticamente, pero leído del token).
- Surface: `bg-card`, borde superior `border-border-soft` (ya está), padding vertical aumentado de `pt-[10px]` a algo como `pt-[14px]`, esquinas superiores `rounded-t-xl` (12px).

**Por qué:** Cumple la regla "componentes cross-platform: mismos nombres, distintas implementaciones" — el contrato visual (emerald activo) se respeta; la implementación es nativa de cada stack.

### D8. Mobile: AppMenu ajustes menores

**Decisión:** Reemplazar el literal navy del texto y el `text-error` por sus equivalentes vía tokens (algunos ya están bien); agregar un acento emerald sutil en el ícono del item al presionarlo (ej. `active:bg-positive/8`). No re-arquitecturar la sheet — se mantiene como `Modal` con presentación bottom-sheet.

**Por qué:** Coherencia visual con el resto de la nav sin abrir un alcance extra.

### D9. i18n de labels de nav

**Decisión:** Los labels que migran del header al sidebar en web (Cuentas, Tarjetas, Movimientos, Dashboard) y los labels del tab bar mobile (Inicio/Dashboard, Movimientos, Tarjetas) leen de `@grana/i18n-messages` bajo una key namespace `nav.*`. Si la key no existe, se agrega en español primero (locale por default).

**Por qué:** Tener strings hardcodeadas en un componente core compromete la futura migración a multi-locale y rompe la simetría con otros componentes ya internacionalizados.

## Risks / Trade-offs

- **[Cambio visual fuerte para usuarios actuales]** → la nav cambia de un día para otro. Mitigación: el patrón sidebar-only es estándar; la curva es de minutos. No hay onboarding necesario.
- **[`<dialog>` y server-side rendering]** → `<dialog open>` controlado por React state se hidrata. No abre por defecto. Riesgo bajo en Next App Router porque el drawer vive en un Client Component.
- **[Mirror manual de colors en mobile]** → introduce duplicación entre `theme.css` y `apps/mobile/lib/colors.ts`. Aceptable porque (a) son ~6 valores, (b) ya existe la nota en memoria de generar el TS mirror con codegen en el futuro, y (c) este change no debería ser bloqueado por el codegen.
- **[Pre-existing hardcoded literals en `text-navy`]** → el TabBar actual ya usa una clase `text-navy` definida en algún lado (probablemente Tailwind extended o NativeWind config). Verificar durante implementación que la clase exista o reemplazar por la token correcta.
- **[Estado activo en sidebar via `usePathname`]** → si en el futuro hay rutas dinámicas profundas, hay que decidir reglas de matching (prefix vs exacto). Para esta change se usa prefix-match con priority al match más largo. Documentado en el spec.
- **[Conflicto con futuras changes que toquen el shell]** → la pre-change check requiere verificar `openspec/changes/`. Si aparece una change que también toque `mobile-app-shell` o que agregue una capability `web-app-shell` paralela, esta change debe coordinarse con ella.

## Migration Plan

No hay datos a migrar. La implementación es puramente de UI. Pasos en orden:

1. Implementar el nuevo sidebar (Client Component único `AppShell`) en una rama; mantener `Header.tsx` en paralelo temporalmente para revisión visual lado a lado si es útil.
2. Eliminar `Header.tsx` y actualizar `layout.tsx`.
3. Implementar el topbar mobile + drawer; verificar bajo `md` y sobre `md` (Chrome DevTools responsive, real device si está disponible).
4. Migrar literales hardcodeados de `TabBar.tsx` al mirror de tokens y actualizar el treatment visual del slot `menu`.
5. Pequeños ajustes en `AppMenu.tsx`.
6. Verificar i18n: agregar keys `nav.*` faltantes.
7. Smoke test manual: login → dashboard, navegar entre items, abrir drawer mobile, abrir menú mobile.

**Rollback:** revertir el commit antes del merge a main. La change es atómica.

## Open Questions

- ¿La pill activa del tab bar mobile va arriba del ícono o como subrayado debajo del label? Decisión final tras prototipo visual.
- Para el item Settings en el sidebar web: ¿separado visualmente del resto (con un divider arriba) o intercalado al final de la nav primaria? Default propuesto: divider + ítem al pie junto con logout, separados de la nav primaria.
- ¿El botón circular del menú mobile lleva un sutil shadow para diferenciarlo más, o un treatment plano? Sugerencia inicial: plano, sin shadow, para no romper la planaridad de la tab bar.
