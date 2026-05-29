## Why

Mobile tiene hoy dos stacks de input que coexisten en paralelo:

1. **Bespoke (`TextInput`)**: encapsula label + input + error + `mb-4` en un solo componente. NO está en `@grana/ui-contracts`, NO existe equivalente en web. Usado por las pantallas de `(auth)` y por la pantalla de onboarding `initial-balance`.
2. **Contract (`Input` + `Label` + `FormField`)**: bare input + label + field shell, todos con prop type compartido en `@grana/ui-contracts`. `PasswordField` se construye sobre `FormField`. Usado por los formularios de categorías.

La coexistencia produce un Frankenstein en auth: `signup` mezcla `TextInput` (que trae `mb-4` propio) con `PasswordField` (sin margen, basado en `FormField`), por lo que las pantallas envuelven manualmente `<View className="mb-4">` alrededor de cada `PasswordField` para falsificar el ritmo del bespoke. Visualmente consistente, estructuralmente roto.

Además, `TextInput` no figura en la lista de primitivos de la spec `project-conventions` (`Button, Card, Input, FormField, PasswordField, Alert, Spinner, Label`), y la regla "pantallas equivalentes SHALL usar el primitivo equivalente de su plataforma" no puede cumplirse porque web no tiene equivalente de `TextInput`. Es deuda heredada, no convención.

Esta consolidación es el follow-up explícitamente bookmarkeado en el archivo del change `2026-05-27-auth-component-reuse-parity` ("Fuera de alcance / follow-up: consolidar los dos stacks de input de mobile…en uno solo").

## What Changes

- **BREAKING (interno):** se elimina `apps/mobile/components/ui/TextInput.tsx`. Es un primitivo no contrato, solo consumido por código de la app — no tiene callers externos.
- **`apps/mobile/components/layout/AuthShell.tsx`:** el `<View>` que envuelve `children` pasa de `className="mt-8"` a `className="mt-8 flex-col gap-4"`. AuthShell se hace dueño del ritmo vertical de los campos.
- **Pantallas de auth** (`login.tsx`, `signup.tsx`, `forgot-password.tsx`, `new-password.tsx`) y **`components/auth/OtpVerifyForm.tsx`**: migran `TextInput` → `FormField`, eliminan los wrappers `<View className="mb-4">` alrededor de `PasswordField`, dejan el espaciado al `gap-4` del padre.
- **`apps/mobile/components/ui/MoneyAmountInput.tsx`:** se reescribe para envolver `Input` (bare), espejo del shape de `apps/web/components/ui/money-amount-input.tsx` (input crudo, sin label/error/margin propio). La sanitización de keystrokes + `keyboardType="decimal-pad"` se preserva sin cambios.
- **`apps/mobile/app/(onboarding)/initial-balance.tsx`:** las dos llamadas a `MoneyAmountInput` se componen ahora con `Label` + `MoneyAmountInput` + texto de error inline en un `<View className="flex-col gap-1.5">`, como hace web. Si emerge duplicación, se evalúa un `MoneyField` compuesto en un follow-up; este change NO lo crea ([[feedback_reusable_components]]).
- **`packages/ui-contracts/src/index.ts`:** se añade `MoneyAmountInputProps` minimal (`className?`) — paralelo a `InputProps`, sin incluir el callback de valor (que difiere entre plataformas: `onChange` web vs `onChangeText` mobile, mismo precedente que `Input`).
- **`openspec/specs/project-conventions/spec.md`:** la requirement "Capas de componentes UI y ubicación de componentes compuestos" amplía su lista canónica de primitivos para incluir `MoneyAmountInput`, y agrega un scenario que codifica "los primitivos de campo NO MAY incluir vertical margin propio; el ritmo vertical lo posee el contenedor padre".
- **Sin cambios** en: comportamiento de auth/onboarding, server actions, validación, navegación, copy, claves i18n, web. El parsing de dinero vía `parseMoneyInput` (decimal.js) NO cambia.

## Capabilities

### New Capabilities

<!-- Ninguna capability nueva. -->

### Modified Capabilities

- `project-conventions`: se MODIFICA la requirement "Capas de componentes UI y ubicación de componentes compuestos" para (a) agregar `MoneyAmountInput` a la lista canónica de primitivos y (b) codificar la regla de spacing ownership (primitivos de campo no bakean vertical margin; el padre gestiona el ritmo).

## Impact

- **Código (solo `apps/mobile` y `packages/ui-contracts`):**
  - Elimina: `apps/mobile/components/ui/TextInput.tsx`.
  - Modifica: `apps/mobile/components/layout/AuthShell.tsx` (1 línea), `apps/mobile/components/ui/MoneyAmountInput.tsx` (reescritura sobre `Input`), `apps/mobile/app/(auth)/{login,signup,forgot-password,new-password}.tsx`, `apps/mobile/components/auth/OtpVerifyForm.tsx`, `apps/mobile/app/(onboarding)/initial-balance.tsx`.
  - Agrega: `MoneyAmountInputProps` en `packages/ui-contracts/src/index.ts`; mismo tipo importado en la implementación mobile y en `apps/web/components/ui/money-amount-input.tsx` (web hoy define su tipo local).
- **Web:** una sola edición — `money-amount-input.tsx` adopta `MoneyAmountInputProps` del contrato. Sin cambio de comportamiento.
- **Spec:** edición delta sobre `project-conventions` (Requirement existente, no nueva).
- **Riesgo visual:** el cambio de `TextInput` (`h-11 rounded-lg border bg-card px-3 text-sm`) a `Input` (`h-11 w-full rounded-lg border bg-card px-3 text-sm`) — clases prácticamente idénticas; `Input` agrega `w-full` y maneja `focus:border-emerald` con `useState` en vez de Tailwind variant. Verificación visual en simulador mobile antes de archivar.
- **Diseño en Paper:** no se requieren design-refs nuevas — la apariencia objetivo es la actual ([[feedback_design_refs_workflow]] aplica a cambios visuales, este es refactor de composición).
- **Tests / type-check:** corre `pnpm --filter mobile typecheck`, `pnpm --filter web typecheck`, lint en ambos. La adopción del tipo compartido en web confirma que ambas plataformas usan la misma forma.
- **Fuera de alcance / follow-up:**
  - `MoneyField` (label+input+error compuesto) si emerge duplicación real al unificar otros formularios de dinero futuros.
  - Migración análoga del resto de formularios mobile (transacciones, recurrencias, cards, accounts) cuando aterricen — fuera del scope porque hoy no existen.
