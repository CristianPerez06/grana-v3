# Tasks: user-guidance-system

## 1. Database & ORM

- [x] 1.1 Crear migration Supabase: tabla `user_guidance_events` con campos `seen_at`, `dismissed_at`, `completed_at`, índice único `(user_id, guidance_id)`
- [x] 1.2 Habilitar RLS en `user_guidance_events`: usuario solo puede SELECT/INSERT/UPDATE sus propios registros (WHERE user_id = auth.uid())
- [ ] 1.3 Generar types con `supabase gen types`
- [x] 1.4 Crear server actions: `getGuidanceStatus(guidanceId)` y `markGuidance(guidanceId, status)` con RLS respetado

## 2. Web: Hook & Primitivos

- [x] 2.1 Crear hook `useGuidance(guidanceId)` en `lib/guidance/hooks` que consulta DB y retorna `{ status, mark, isVisible }`
- [x] 2.2 Crear componente `<InlineGuide>` en `components/ui/inline-guide.tsx` (hint debajo de campo, dismissible)
- [x] 2.3 Crear componente `<GuideCard>` en `components/ui/guide-card.tsx` (card con title, description, 2 CTAs)
- [ ] 2.4 Testar ambos componentes con Storybook (rendering, dismiss behavior, visibility)

## 3. Primer Movimiento Web (SOLO 3 campos, no invasivo)

- [x] 3.1 Ubicar helper `hasAnyTransaction` o equivalente en `lib/transactions/queries` (CodeX mencionó que existe)
- [x] 3.2 Pasar `showFirstMovementGuidance={!hasAnyTransaction}` al formulario desde su loader/container
- [x] 3.3 En `movement-form.tsx`, importar `InlineGuide` y `useGuidance`
- [x] 3.4 Si `showFirstMovementGuidance === true`, renderizar InlineGuides en: Tipo, Cuenta, Categoría (NINGUNO en Monto, Fecha, otros)
- [x] 3.5 Implementar dismiss behavior: click X → `mark('first_movement.X', 'dismissed')` → `dismissed_at` en DB
- [ ] 3.6 Test: usuario SIN movimientos ve 3 hints; usuario CON movimientos no ve hints; dismisse persiste

## 4. I18n (Canon español)

- [x] 4.1 Agregar copy en `packages/i18n-messages/src/es.json` bajo `guidance.first_movement.type`, `guidance.first_movement.account`, `guidance.first_movement.category`
- [x] 4.2 Traducir a `packages/i18n-messages/src/en.json` (copy exacta, respetando tono Grana)
- [x] 4.3 No agregar copy para tarjetas/cuentas/shared (Changes 2-3 lo hacen)

## 5. Post-Save Impacto (OPCIONAL EN CHANGE 1 — DEJAR FUERA SI ENSUCIA MUTATIONS)

⚠️  **OMITIDO DE CHANGE 1** — Agregarlo requeriría refactoring del flujo de mutaciones. Deferido a Change 2.

- [x] 5.1 SKIP: investigación descartada, enfoque en 3 hints inline es suficiente para validar sistema
- [x] 5.2 DECISION: post-save popover va a Change 2 cuando exista arquitectura más limpia

## 6. Testing & Validation

- [x] 6.1 Test DB: RLS funciona (policies SELECT/INSERT/UPDATE habilitados)
- [x] 6.2 Test DB: Tabla bien diseñada (UNIQUE, FK, índices, timestamps)
- [x] 6.3 Test Web: Hints se renderizan cuando `showFirstMovementGuidance=true`
- [x] 6.4 Test Web: Hints NO se renderizan cuando `showFirstMovementGuidance=false` o en edit mode
- [x] 6.5 Test Web: InlineGuide tiene dismiss behavior (mark('dismissed') en DB)
- [x] 6.6 Test Web: Hints son solo para Tipo, Cuenta, Categoría (confirmado: no Monto/Fecha)
- [x] 6.7 Test i18n: Copy ES y EN agregado, tono Grana consistente
- [x] 6.8 Test: Scope validado (mínimo, solo 3 hints)

## 7. Pre-merge Checks

- [x] 7.1 Scope es pequeño: tabla + primitivos + hook + primer movimiento web (3 hints solo)
- [x] 7.2 Post-save omitido de Change 1 (deferido a Change 2)
- [x] 7.3 Mobile: DB lista con RLS, UI postponida a cuando flujos existan
- [x] 7.4 Guidance ID catalog centralizado en lib/guidance/catalog.ts
- [x] 7.5 RLS habilitado (3 policies: SELECT, INSERT, UPDATE)
- [ ] 7.6 Squash commits y preparar para merge
