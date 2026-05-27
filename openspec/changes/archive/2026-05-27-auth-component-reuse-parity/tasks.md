## 1. Convención y docs

- [x] 1.1 Agregar la requirement "Capas de componentes UI y ubicación de componentes compuestos" en `specs/project-conventions/spec.md` (delta `## ADDED Requirements`) con escenarios
- [x] 1.2 Agregar la sección "Component layering (UI)" a `CLAUDE.md` (taxonomía de 3 capas + ubicaciones por plataforma + asimetría web/mobile)

## 2. Paridad mobile — primitivos

- [x] 2.1 `app/(auth)/login.tsx`: campo de contraseña → `PasswordField`; aviso de éxito → `Alert variant="success"`
- [x] 2.2 `app/(auth)/signup.tsx`: campos `password` y `confirmPassword` → `PasswordField`
- [x] 2.3 `app/(auth)/new-password.tsx`: campos `password` y `confirmPassword` → `PasswordField`
- [x] 2.4 Paridad del toggle: el `PasswordField` mobile usa el ícono ojo (`lucide-react-native` `Eye`/`EyeOff`) en vez de texto "Ver/Ocultar", como web; y se corrige el centrado vertical del botón ojo en web (`top-[34px]` → `top-7`, centrado real sobre el input)

## 3. Reubicación y extracción

- [x] 3.1 Mover `components/OtpVerifyForm.tsx` → `components/auth/OtpVerifyForm.tsx` (arreglar imports relativos); notice → `Alert variant="success"`
- [x] 3.2 Actualizar imports de `OtpVerifyForm` en `recovery-verify.tsx` y `signup-verify.tsx`
- [x] 3.3 Crear `components/auth/MissingEmailFallback.tsx` y usarlo en `recovery-verify.tsx` y `signup-verify.tsx`

## 4. Verificación

- [x] 4.1 `pnpm typecheck:mobile` (limpio) y `pnpm lint:mobile` (0 errores; 1 warning preexistente ajeno en `lib/cards/queries.ts`)
- [ ] 4.2 Revisión visual de las pantallas de auth en simulador (toggle de contraseña, `Alert`, fallback) — pendiente de ojo humano (sin tooling de screenshot en este entorno)

## 5. Cierre OpenSpec

- [x] 5.1 Archivar: movido a `openspec/changes/archive/2026-05-27-auth-component-reuse-parity/`, requirement "Capas de componentes UI y ubicación de componentes compuestos" integrada al master `openspec/specs/project-conventions/spec.md`, `pnpm openspec:check` en verde (último commit del branch, antes del merge)
