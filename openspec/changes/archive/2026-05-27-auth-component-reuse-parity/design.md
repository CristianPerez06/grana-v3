## Contexto

Revisión de reutilización de componentes en las rutas/pantallas de `(auth)` (web + mobile). Dos hallazgos: (1) no existe nombre ni ubicación documentada para la capa de componentes "compuestos", lo que produjo divergencia de ubicación en `OtpVerifyForm`; (2) gaps de paridad en mobile (campos de contraseña sin `PasswordField`, avisos sin `Alert`, fallback duplicado).

## Decisión: taxonomía de 3 capas de componentes UI

| Capa | Qué es | Web | Mobile | Storybook | Contrato compartido |
|------|--------|-----|--------|-----------|---------------------|
| **1. Primitivos de UI** | Building blocks básicos (`Button`, `Card`, `Input`, `FormField`, `PasswordField`, `Alert`, `Spinner`, …) | `apps/web/components/ui/` | `apps/mobile/components/ui/` | Web: sí. Mobile: no (espeja por nombre) | Sí — props en `@grana/ui-contracts` |
| **2. Compuestos** | Reutilizables entre rutas, no genéricos para `ui/` | `components/layout/` (shells) · `app/(group)/_components/` (feature) | `components/layout/` (shells) · `components/<feature>/` (feature) | No | Solo `PageHeader` |
| **3. Locales de ruta/pantalla** | De un solo uso, colocados junto a la ruta | `login/login-form.tsx` | inline en la pantalla | No | No |

Regla de uso que se deriva: **pantallas equivalentes usan el primitivo equivalente** en cada plataforma. Un campo de contraseña usa `PasswordField` (con toggle ver/ocultar) en ambos lados — no un input crudo con `secureTextEntry`. Esto extiende la paridad-por-contratos ya existente (que garantiza la API) hacia la paridad de *uso* (que garantiza que el primitivo realmente se use).

## Por qué la ubicación de los compuestos de feature difiere entre plataformas

Next.js App Router **ignora los directorios con prefijo `_`**, así que web puede colocar componentes compartidos de una feature junto a sus rutas: `app/(auth)/_components/otp-verify-form.tsx`. Expo Router trata **todo `app/` como rutas** (no hay un escape `_` equivalente garantizado), por lo que mobile NO puede colocar componentes ahí sin arriesgar rutas fantasma. Por eso mobile usa `components/<feature>/` — patrón que ya emplea (`components/cards/`, `components/categories/`, `components/dashboard/`, `components/settings/`).

La asimetría es **del router, no una violación de la política Web↔Mobile**: esa política prohíbe compartir JSX y exige paridad de API por contratos; nunca exigió rutas de carpeta idénticas. Los shells de app/route-group (`AuthShell`, `TabBar`, `AppMenu`) sí coinciden (`components/layout/` en ambas) porque no chocan con el router.

## No-goals

- **Consolidar los dos stacks de input de mobile.** Hoy conviven `TextInput` (bespoke, con `mb-4` propio, usado por los forms de auth) y `FormField`/`Input` (los del contrato `@grana/ui-contracts`, sobre los que se construye `PasswordField`). Unificarlos es un refactor mayor con riesgo de regresión visual; se deja como follow-up. Por eso este change conserva `TextInput` para los campos de texto y solo lleva los de contraseña a `PasswordField` (envueltos para preservar el espaciado `mb-4`).
- **Tocar web.** Ya cumple la convención.
