## Why

Hoy en mobile, las pantallas de `(app)` muestran el `PageHeader` sobre fondo blanco y dejan el status bar (zona del notch / reloj / wifi / batería) como una banda neutra del color de fondo. Visualmente la zona superior se siente "abierta" — no hay una identidad de marca que la separe del contenido — y la altura total del bloque superior varía entre pantallas según el `PageHeader` tenga back link o no, lo que produce un salto visual al navegar.

Esta propuesta pinta status bar + header con el color de marca `--navy` (estructural primario), unifica la altura del bloque superior en todas las pantallas, y hace que el componente de header sea autosuficiente respecto del top safe-area inset (deja de depender de que cada pantalla envuelva con `SafeAreaView edges={['top']}`).

## What Changes

- El componente mobile `PageHeader` (`apps/mobile/components/ui/PageHeader.tsx`) se vuelve self-wrapping en el top safe-area inset: renderiza internamente `<SafeAreaView edges={['top']} className="bg-navy">`. Título pasa a blanco (`text-white`), descripción y back link a `text-navy-muted`.
- `DashboardHeader` (`apps/mobile/components/dashboard/DashboardHeader.tsx`) recibe el mismo tratamiento navy + safe-area top + título blanco, para que el dashboard mantenga paridad visual con las demás pantallas de `(app)`.
- `EyeMaskToggle` cambia el color del icono a blanco para legibilidad sobre fondo navy.
- `(app)/_layout.tsx` agrega `<StatusBar style="light" />` (de `expo-status-bar`) para que reloj / wifi / batería se rendericen en claro sobre el fondo navy.
- Las 9 pantallas de `(app)` (`dashboard`, `transactions`, `accounts`, `cards`, `settings/index`, `settings/categories/index`, `settings/categories/new`, `settings/categories/[id]/edit`, `settings/categories/[id]/subcategories/index`, `settings/categories/[id]/subcategories/new`) dejan de envolverse en `SafeAreaView edges={['top']}` a nivel pantalla y sacan el header de adentro del `ScrollView`, para que la banda navy llegue de borde a borde y para que el header tenga el top safe-area inset bajo su propia responsabilidad.
- **Nueva regla de altura constante**: tanto `PageHeader` como `DashboardHeader` reservan siempre el slot de la fila del back link. Si `backLink` está ausente, renderizan un `<View className="h-5" />` (altura equivalente al `text-sm leading-5` que ocupa la fila del back link real). Esto garantiza que la altura total del bloque superior (status bar + barra de header) sea idéntica en cada pantalla, independientemente de si tiene back link.
- No hay cambios en `apps/web`. La API pública `PageHeaderProps` en `@grana/ui-contracts` no cambia — sólo cambia la presentación interna en mobile.

## Capabilities

### New Capabilities

Ninguna. Este cambio modifica capacidades existentes; no introduce capacidades nuevas.

### Modified Capabilities

- `page-header`: la sección mobile cambia su descripción visual y su responsabilidad sobre el top safe-area inset. Se agrega un requirement nuevo sobre altura constante del bloque superior en mobile.
- `mobile-app-shell`: se modifica el requirement "La app mobile respeta el safe-area top en todas las pantallas root" (el top inset de `(app)` pasa a ser responsabilidad del componente de header, no de cada pantalla) y se agrega un requirement sobre `StatusBar style="light"` en `(app)` para coherencia con el header navy.

## Impact

- **Código modificado en mobile**:
  - `apps/mobile/components/ui/PageHeader.tsx`
  - `apps/mobile/components/dashboard/DashboardHeader.tsx`
  - `apps/mobile/components/dashboard/EyeMaskToggle.tsx`
  - `apps/mobile/app/(app)/_layout.tsx`
  - 9 pantallas bajo `apps/mobile/app/(app)/**`
- **APIs externas**: ninguna. El contract `PageHeaderProps` (`packages/ui-contracts`) y los componentes web no cambian.
- **Dependencias**: usa `expo-status-bar` ya presente en `apps/mobile/package.json`.
- **Tokens / design system**: usa `--navy` y `--navy-muted` ya definidos en `@grana/ui-tokens`. No introduce literales hex hardcodeados.
- **Accesibilidad**: el contraste blanco / `--navy` (#FFFFFF / #0B1A2B) es muy alto (cumple WCAG AAA para texto). `accessibilityRole="header"` del título se preserva.
- **Riesgos**: ninguno significativo. La regla de altura constante introduce ~20px de espacio reservado en pantallas sin back link (status bar + barra de header siguen siendo compactos, ~64–72px totales en iOS).
