## 1. Espiga: confirmar que NativeWind resuelve `var()`

- [ ] 1.1 Declarar a mano un `:root { --page: #F6F7F9; }` al tope de `apps/mobile/global.css` y aplicar `bg-background` en una pantalla de prueba.
- [ ] 1.2 Verificar en el emulador si la superficie pinta gris. Si NO pinta, abandonar el enfoque de este change y ejecutar en su lugar la migración a tokens estructurales descartada en `design.md` (Decisión 1); el resto de las tareas de los grupos 2 y 3 queda sin efecto y el grupo 5 se reescribe.
- [ ] 1.3 Revertir la declaración manual antes de seguir.

## 2. Codegen de las variables

- [ ] 2.1 Extender `packages/ui-tokens/scripts/codegen.mjs` para emitir `src/tokens.css` con el bloque `:root` de `theme.css` (sólo custom properties: sin `@custom-variant`, sin `@theme`, sin `.dark`).
- [ ] 2.2 Exportar el archivo generado desde `packages/ui-tokens/package.json` (`exports`).
- [ ] 2.3 Verificar que correr el codegen dos veces produce el mismo output (idempotente) y que `tokens.cjs` sigue generándose igual que antes.

## 3. Consumo desde mobile

- [ ] 3.1 Importar el CSS generado desde `apps/mobile/global.css`, antes de las directivas `@tailwind`.
- [ ] 3.2 Verificar en el emulador que una clase alias (`bg-background`, `bg-muted`) pinta el color correcto.

## 4. Corregir los aliases mal elegidos

- [ ] 4.1 Revisar los ~230 usos de `text-muted` en `apps/mobile`: ahora resuelven a `var(--border-soft)` (#EEF1F4, un color de **borde**), casi ilegible como texto. Determinar si querían `text-text-muted` (#6B7683).
- [ ] 4.2 Corregir los que estén mal. Es un reemplazo mecánico, pero SHALL verificarse por pantalla que el resultado es el color de texto secundario esperado.
- [ ] 4.3 Repetir el chequeo para `text-primary` (resuelve a `var(--navy)`) y para cualquier otro alias en uso que apunte a un token de familia distinta a la del utility.

## 5. Fondo de la ventana (ya implementado)

- [x] 5.1 Pintar `bg-page` en el root de `apps/mobile/app/_layout.tsx`, dentro de `SafeAreaProvider`. — commit `5ff1c91`
- [x] 5.2 Reemplazar `bg-background` por `bg-page` en el root de las 13 pantallas mobile que lo usaban. — commit `5ff1c91`
- [ ] 5.3 Verificar en el emulador que las esquinas redondeadas del tab bar muestran el gris de página y no negro.

## 6. Cierre

- [ ] 6.1 Correr `pnpm typecheck` y `pnpm lint` en `apps/mobile` y en `packages/ui-tokens`.
- [ ] 6.2 Actualizar el comentario de cabecera de `apps/mobile/lib/colors.ts` si el codegen cambia lo que ese mirror manual tiene que cubrir.
- [ ] 6.3 Archivar el change y sincronizar los deltas en `openspec/specs/{project-conventions,mobile-app-shell,page-header}/spec.md`.
