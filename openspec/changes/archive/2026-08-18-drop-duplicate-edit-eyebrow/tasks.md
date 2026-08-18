## 1. Web

- [x] 1.1 En `movement-form.tsx`, cambiar `showEyebrow` a `!isEdit && !isMobile`: sin eyebrow en edición, en cualquier viewport; el alta de escritorio lo conserva.

## 2. Nativa

- [x] 2.1 Verificar que la pantalla de edición ya monta el `PageHeader` con título solo. No editar.

## 3. Verificación

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [x] 3.2 **Edición web** (drawer, ancho y angosto): el encabezado dice solo "Editar movimiento".
- [ ] 3.3 **Alta web escritorio**: conserva su eyebrow "NUEVO" — *verificado*. **Alta web angosto**: sigue sin eyebrow — pendiente.
- [ ] 3.4 **Nativa**: sin cambios en el encabezado de edición.

> La verificación manual pendiente en la **app nativa** está consolidada en el issue #38 (`QA App Mobile — formulario de edición de movimiento`), asignado y con checklist propio.

## 4. Cierre

- [x] 4.1 Archivar y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 4.2 Correr `pnpm openspec:check`.
