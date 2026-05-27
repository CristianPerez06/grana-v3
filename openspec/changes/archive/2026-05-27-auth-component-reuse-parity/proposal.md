## Why

La revisión de reutilización de componentes en las rutas/pantallas de `(auth)` (web + mobile) reveló dos cosas:

1. **Falta nombre y ubicación documentada para la capa "compuesta"** (componentes reutilizables entre rutas pero que no son primitivos genéricos de `ui/`). Esa ausencia llevó a que `OtpVerifyForm` viva en lugares distintos en cada plataforma: web en `app/(auth)/_components/otp-verify-form.tsx`, mobile en `components/OtpVerifyForm.tsx` (raíz, junto a componentes no relacionados). Una sesión LLM fresca que espera simetría no lo encuentra.
2. **Gaps de paridad reales en mobile.** Los campos de contraseña usan `TextInput` crudo con `secureTextEntry` en vez del primitivo `PasswordField` — mobile pierde el toggle ver/ocultar que web sí ofrece. El aviso de éxito del login se arma a mano (`View` + clases) en vez de usar el primitivo `Alert`. Y el fallback "Falta tu email" está duplicado casi idéntico entre `recovery-verify` y `signup-verify`.

Web ya cumple la convención; el trabajo de paridad es solo mobile.

## What Changes

- **Convención (`project-conventions`):** se documenta la taxonomía de 3 capas de componentes UI (primitivos / compuestos / locales de ruta) y la ubicación canónica de cada capa por plataforma, incluida la asimetría de los compartidos de feature (web `app/(group)/_components/` vs mobile `components/<feature>/`, forzada por el router).
- **Paridad mobile — primitivos:** `login`, `signup` y `new-password` pasan a usar `PasswordField` en sus campos de contraseña; el aviso del login y el aviso de "código reenviado" del OTP pasan a usar el primitivo `Alert`.
- **Reubicación:** `OtpVerifyForm` mobile se mueve de `components/OtpVerifyForm.tsx` a `components/auth/OtpVerifyForm.tsx` (espejo del `_components/` web, idiomático para Expo Router).
- **Extracción:** se extrae `MissingEmailFallback` (`components/auth/`), reemplazando el bloque duplicado en `recovery-verify` y `signup-verify`.
- **`CLAUDE.md`:** se agrega la sección "Component layering (UI)" con la taxonomía y ubicaciones.
- **No cambian** comportamientos, server actions, validación, navegación, copy ni claves i18n. Web no cambia.

## Capabilities

### New Capabilities

<!-- Ninguna capability nueva. -->

### Modified Capabilities

- `project-conventions`: se AGREGA la requirement "Capas de componentes UI y ubicación de componentes compuestos".

## Impact

- **Código (solo `apps/mobile`):**
  - `app/(auth)/login.tsx`, `signup.tsx`, `new-password.tsx`: `PasswordField` + `Alert`.
  - Nuevo `components/auth/OtpVerifyForm.tsx` (movido desde `components/`), notice con `Alert`.
  - Nuevo `components/auth/MissingEmailFallback.tsx`; `recovery-verify.tsx` y `signup-verify.tsx` lo usan.
- **Docs:** `CLAUDE.md` (sección Component layering) + master spec `project-conventions` (al archivar).
- **Sin overlap de capability** con los changes activos `auth-minimal-redesign` y `auth-minimal-redesign-mobile`, que tocan `auth` (no `project-conventions`); pueden archivarse en cualquier orden.
- **Fuera de alcance / follow-up:** consolidar los dos stacks de input de mobile (`TextInput` bespoke con `mb-4` propio vs `FormField`/`Input` del contrato) en uno solo; verificación visual en simulador (no hay tooling de screenshot en este entorno).
