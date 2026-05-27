## 1. AuthShell

- [x] 1.1 Crear `apps/web/components/layout/auth-shell.tsx`: `bg-page` a pantalla completa, tarjeta blanca centrada vertical/horizontalmente (`max-w-[420px]`, `rounded-[var(--radius-4xl)]`), con `GranaLogo` centrado (colores por defecto: wordmark navy, badge esmeralda), título (`text-2xl font-bold tracking-tight`), subtítulo opcional (`text-sm text-text-muted`) y `children` debajo
- [x] 1.2 Props con la misma forma que `CurvedNavyContainer`: `title: string`, `subtitle?: string`, `children: ReactNode`, `contentClassName?: string` (named export `AuthShell`)
- [x] 1.3 Responsive: tarjeta sin borde/sombra y full-width bajo `sm`; `sm:border sm:border-border` + sombra suave + padding mayor en `sm+`

## 2. Migrar las 6 rutas del grupo (auth)

- [x] 2.1 `app/(auth)/login/page.tsx`: usar `AuthShell` en vez de `CurvedNavyContainer` (mantener `title`/`subtitle` y los links inferiores `forgot` / `no_account`)
- [x] 2.2 `app/(auth)/signup/page.tsx`: usar `AuthShell`; quitar `showBack`/`backHref`/`backLabel`; conservar el link inferior `have_account` y los 4 campos del form
- [x] 2.3 `app/(auth)/forgot-password/page.tsx`: usar `AuthShell`; quitar props de back; conservar link `back_to_login`
- [x] 2.4 `app/(auth)/signup/verify/page.tsx`: usar `AuthShell` (verificar que la pantalla OTP se vea bien dentro de la tarjeta)
- [x] 2.5 `app/(auth)/forgot-password/verify/page.tsx`: usar `AuthShell` (verificar OTP)
- [x] 2.6 `app/(auth)/reset-password/page.tsx`: usar `AuthShell`; verificar los estados de card de éxito y de "link inválido/expirado" dentro del nuevo shell

## 3. Limpieza y estilos

- [x] 3.1 Borrar `apps/web/components/layout/curved-navy-container.tsx` y `apps/web/components/layout/curved-navy-header.tsx` (verificar que no queden imports)
- [x] 3.2 Revisar `apps/web/lib/auth-class-names.ts`: revisado — `border-slate-300` + anillo de foco navy se ven bien sobre la tarjeta blanca (inputs definidos, foco on-brand); sin cambios

## 4. Verificación

- [x] 4.1 `pnpm lint` (0 errores; warnings preexistentes ajenos) y `pnpm build` (las 6 rutas compilan, sin errores de tipos) pasan en web
- [x] 4.2 Smoke test runtime de las 6 rutas (`/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/forgot-password/verify`, `/reset-password`): HTTP 200, render del `GranaLogo` + tarjeta `AuthShell`, header navy ausente. Revisión pixel-level en desktop/mobile pendiente de ojo humano en `localhost:3000` (no hay tooling de screenshot aquí)
- [x] 4.3 Confirmado: ningún archivo fuente referencia `CurvedNavyContainer` / `CurvedNavyHeader` (solo quedaban en `.next/` cache, regenerado)

## 5. Cierre OpenSpec

- [ ] 5.1 Archivar el change: mover a `openspec/changes/archive/YYYY-MM-DD-auth-minimal-redesign/`, integrar el delta al master spec `openspec/specs/auth/spec.md`, y `pnpm openspec:check` en verde (último commit del branch, antes del merge)
- [ ] 5.2 (Cuando se reponga Paper) versionar los design-refs en `design-refs/` y pedir a Paper que cree los artboards mobile faltantes (signup / forgot)
