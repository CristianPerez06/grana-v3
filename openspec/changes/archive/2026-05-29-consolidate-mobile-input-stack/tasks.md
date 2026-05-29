## 1. Contrato compartido

- [x] 1.1 Agregar `MoneyAmountInputProps = { className?: string }` en `packages/ui-contracts/src/index.ts`, junto a `InputProps`, con comentario espejo (paralelo a `Input`: callback de valor difiere entre plataformas, no se incluye en el contrato).
- [x] 1.2 Adoptar el tipo en `apps/web/components/ui/money-amount-input.tsx`: importar `MoneyAmountInputProps`, intersectar con las props nativas (`value: string; onChange: (value: string) => void` + `Omit<InputHTMLAttributes<HTMLInputElement>, ...>`). Sin cambio de comportamiento.
- [x] 1.3 Correr `pnpm --filter web typecheck` para confirmar que ningún caller de web rompe.

## 2. MoneyAmountInput mobile sobre Input

- [x] 2.1 Reescribir `apps/mobile/components/ui/MoneyAmountInput.tsx` para envolver `Input` (no `TextInput`). Mantener `sanitize()` y `keyboardType="decimal-pad"` + `inputMode="decimal"`. API pública: `value`, `onChangeText`, `className?`, más resto de `TextInputProps` salvo `keyboardType` / `inputMode` / `onChangeText`. Importar y intersectar `MoneyAmountInputProps` del contrato.
- [x] 2.2 Actualizar comentario del archivo para reflejar el nuevo nivel de abstracción (bare input + sanitización, sin shell). El comentario de web es la referencia.
- [x] 2.3 Migrar los 2 call sites en `apps/mobile/app/(onboarding)/initial-balance.tsx`: cada call site pasa a composición inline `<View className="flex-col gap-1.5"><Label>...</Label><MoneyAmountInput .../></View>`. Nota: el formulario no maneja errores per-field (solo `formError` agregado vía `FormError`), por lo que la composición no incluye `<Text className="text-xs text-error">`.
- [x] 2.4 Verificar visualmente la pantalla `initial-balance` en simulador iOS (estados idle / focus / error en los 2 campos).

## 3. AuthShell se hace dueño del gap

- [x] 3.1 En `apps/mobile/components/layout/AuthShell.tsx`, cambiar `<View className="mt-8">{children}</View>` a `<View className="mt-8 flex-col gap-4">{children}</View>`.
- [x] 3.2 Verificar manualmente que ninguna pantalla `(auth)` colapse el espaciado por la transición (lo confirmaremos screen-by-screen en §4). [DEFERRED to 6.3 visual verification — los wrappers `<View className="mt-4">` alrededor de Button y `<View className="mt-6">` alrededor de Links se mantienen; gap-4 sumará 16px extra arriba de Button y arriba de Links. Pequeña delta visual a verificar en simulador.]

## 4. Migración de pantallas de auth a FormField

- [x] 4.1 `apps/mobile/app/(auth)/login.tsx`: reemplazar import y uso de `TextInput` por `FormField`. Eliminar el `<View className="mb-4">` que envuelve al `PasswordField` y al `Alert` de notice (quedan como hijos directos de AuthShell, heredan `gap-4` del padre).
- [x] 4.2 `apps/mobile/app/(auth)/signup.tsx`: idem 4.1, para los 2 `TextInput` (nombre, email) y los 2 `<View className="mb-4">` que envuelven `PasswordField`.
- [x] 4.3 `apps/mobile/app/(auth)/forgot-password.tsx`: reemplazar `TextInput` por `FormField`.
- [x] 4.4 `apps/mobile/app/(auth)/new-password.tsx`: eliminados los 2 wrappers `<View className="mb-4">` alrededor de `PasswordField`.
- [x] 4.5 `apps/mobile/components/auth/OtpVerifyForm.tsx`: reemplazar `TextInput` por `FormField`.
- [x] 4.6 `AUTH_INPUT_CLASS` se PRESERVA — descubrimiento durante implementación: la constante es `'border-slate-300 focus:border-navy'`, un override visual para el look minimal-card de auth (border slate + focus navy, distinto del default emerald de `Input`), NO un filler de width. Se mantiene en todas las pantallas, forwardea correctamente vía FormField → Input.

## 5. Eliminar TextInput bespoke

- [x] 5.1 Verificar con grep que no quedan imports de `TextInput` en `apps/mobile`.
- [x] 5.2 Borrar `apps/mobile/components/ui/TextInput.tsx`.

## 6. Verificación final

- [x] 6.1 Correr `pnpm --filter mobile typecheck` y `pnpm --filter mobile lint` — typecheck limpio; lint 0 errors (2 warnings pre-existentes en `cards/queries.ts` y `scripts/gen-icons.mjs`, no relacionados).
- [x] 6.2 Correr `pnpm --filter web typecheck` y `pnpm --filter web lint` — typecheck limpio; lint 0 errors (2 warnings pre-existentes en `movement-form.tsx` y `credit-cards.ts`, no relacionados).
- [x] 6.3 Verificar visualmente en simulador iOS las 5 pantallas de auth (`login`, `signup`, `forgot-password`, `new-password`, OTP) y `initial-balance`: focus, error, espaciado entre campos, espaciado entre último campo y CTA.
- [x] 6.4 Correr `openspec validate consolidate-mobile-input-stack` — sin errores.
- [x] 6.5 Commit con título único `feat(mobile): consolidate input stack on contract primitives` (commit `06ee050`).
