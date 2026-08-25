# Propuesta visual — Seguridad y cambio de contraseña

## Contexto

Esta propuesta aplica `docs/design/route-ui-system.md` a la sección **Seguridad** nueva de `/settings` y a la ruta hija `/settings/password`. Extiende `docs/design/settings/` — la raíz de configuración ya tiene sistema propio y acá sólo se le agrega una cuarta sección, más una pantalla de formulario que ese sistema todavía no cubría.

**Los mocks no son autoritativos.** Son un handoff visual para acordar forma, densidad y estados antes de escribir el spec. La implementación traduce a tokens del design system (`bg-card`, `border-border`, `text-text-muted`, `text-error`, `text-warning`), nunca hex literales — los custom properties de `shared.css` existen sólo para que el HTML se vea sin build.

Change asociado: `openspec/changes/add-settings-password-change/`.

## Implementación inspeccionada

- `apps/web/app/(app)/settings/page.tsx`
- `apps/web/app/(app)/settings/layout.tsx` y `_components/settings-header.tsx`
- `apps/web/app/(app)/settings/_components/settings-section.tsx`
- `apps/web/app/(auth)/reset-password/page.tsx` (form de password + card de éxito ya existentes)
- `apps/web/components/ui/password-field.tsx`
- `apps/mobile/app/(app)/settings/index.tsx`
- `apps/mobile/app/(auth)/new-password.tsx`
- `apps/mobile/components/settings/SettingsSection.tsx`
- `apps/mobile/components/ui/PasswordField.tsx`
- `apps/mobile/components/layout/FormScreen.tsx`

## Archivos

| Archivo | Qué muestra |
| --- | --- |
| `web/settings-password.html` | Los tres momentos en web: sección Seguridad en la raíz, el formulario, la card de éxito |
| `mobile/settings-password.html` | Los mismos tres momentos en tres pantallas nativas, incluido el error de campo |
| `components/security-section.html` | La sección aislada, para comparar con la fila de Categorías |
| `components/change-password-form.html` | Los tres estados del formulario: limpio, error de campo, error de formulario |
| `components/success-card.html` | Los dos estados de la card: revocación exitosa y revocación fallida |

## Datos disponibles

- Nada asíncrono. La pantalla no lee del ledger ni de `profiles`: los tres campos son input del usuario y el `email` para verificar sale de la sesión.
- Estados de UI: `pending` del submit, error por campo (`currentPassword`, `password`, `confirmPassword`), error de formulario, y el resultado de la revocación de sesiones.
- Sin loading state y sin skeleton: no hay nada que esperar antes del primer paint.

## Dirección propuesta

- **La sección es una fila más, no una pantalla nueva.** Misma forma que Categorías: título uppercase, panel con borde, una fila con label + descripción y chevron. La descripción de la fila hace trabajo real — es donde el usuario se entera de que el cambio cierra las otras sesiones, antes de entrar.
- **El formulario reusa la superficie de auth.** Tres `PasswordField` apilados con el mismo ritmo que `/reset-password`, ancho contenido (`max-width` ~420px en web) para que no se estire a los 760px del layout de settings.
- **El error de la contraseña actual vive en el campo**, con el borde del input teñido. El bloque de error de formulario queda para lo que no es de un campo (`same_password`, `weak_password`, rate limit). Que se distingan visualmente es el punto: son problemas distintos y se arreglan distinto.
- **La card de éxito reemplaza al formulario en el lugar**, no navega. Mismo patrón que la card de éxito de recovery, con dos bodies posibles y un CTA de vuelta a ajustes en peso secundario — es una salida, no la acción principal de la pantalla.
- **El estado B de la card no se disfraza de error.** El check verde se queda: la contraseña sí se cambió. Lo que cambia es el body, en color de warning, contando lo que no pasó.
