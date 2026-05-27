## 1. AuthShell (mobile / React Native)

- [x] 1.1 Crear `apps/mobile/components/layout/AuthShell.tsx`: `KeyboardAvoidingView` (`flex-1 bg-page`, behavior por plataforma) → `ScrollView` (`keyboardShouldPersistTaps="handled"`, `contentContainerClassName="flex-grow justify-center px-6"`, padding top/bottom desde `useSafeAreaInsets`) → wrapper `w-full max-w-[420px] mx-auto`
- [x] 1.2 Header centrado dentro del wrapper: `<GranaLogo width={104} />` + título (`text-2xl font-bold text-text text-center`) + subtítulo opcional (`text-sm leading-snug text-text-muted text-center`); contenido (`children`) debajo con separación
- [x] 1.3 Props `title: string`, `subtitle?: string`, `children: ReactNode` (named export `AuthShell`); sin `showBack`/`backHref`/`backLabel`

## 2. Migrar las 6 pantallas de (auth) mobile

- [x] 2.1 `app/(auth)/login.tsx`: usar `AuthShell` (1 uso, sin back)
- [x] 2.2 `app/(auth)/signup.tsx`: usar `AuthShell`; quitar `showBack`/`backHref` (conservar link inline "¿Ya tenés cuenta?")
- [x] 2.3 `app/(auth)/forgot-password.tsx`: usar `AuthShell`; quitar back (conservar "Volver a iniciar sesión")
- [x] 2.4 `app/(auth)/signup-verify.tsx`: usar `AuthShell` en los 2 usos (no-email + main); quitar back
- [x] 2.5 `app/(auth)/recovery-verify.tsx`: usar `AuthShell` en los 2 usos; quitar back
- [x] 2.6 `app/(auth)/new-password.tsx`: usar `AuthShell` en los 2 usos (sesión inválida + main); el branch `checking` (ActivityIndicator sobre `bg-page`) queda igual

## 3. Limpieza

- [x] 3.1 Borrar `apps/mobile/components/layout/CurvedNavyContainer.tsx` y `CurvedNavyHeader.tsx` (verificar que no queden imports)
- [x] 3.2 Confirmado vía typecheck + lint (0 errores): no quedan imports sin usar tras quitar las props de back (`useRouter` sigue usándose en los handlers)

## 4. Verificación

- [x] 4.1 Typecheck de mobile (`tsc --noEmit`) limpio y lint con 0 errores (1 warning preexistente ajeno en `lib/cards/queries.ts`)
- [x] 4.2 Confirmado: ningún archivo mobile referencia `CurvedNavyContainer` / `CurvedNavyHeader`
- [x] 4.3 Revisión visual de las 6 pantallas en simulador/dispositivo (logo presente, sin header navy, teclado no tapa el form) — pendiente de ojo humano (no hay simulador/screenshot tooling acá)

## 5. Cierre OpenSpec

- [ ] 5.1 Archivar DESPUÉS del change web `auth-minimal-redesign`: integrar la requirement final (web+mobile) al master `openspec/specs/auth/spec.md`, `pnpm openspec:check` en verde (último commit del branch, antes del merge)
