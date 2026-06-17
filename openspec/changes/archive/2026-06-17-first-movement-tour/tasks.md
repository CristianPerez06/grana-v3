# Tasks: first-movement-tour

## 1. Catálogo & i18n

- [x] 1.1 Agregar `FIRST_MOVEMENT_TOUR: 'first_movement.tour'` al catálogo `lib/guidance/catalog.ts`
- [x] 1.2 Agregar copy del tour en `es.json` bajo `guidance.first_movement_tour` (4 pasos + cierre + botones)
- [x] 1.3 Traducir el copy a `en.json` (mismo tono cercano)

## 2. Primitivo CoachmarkTour

- [x] 2.1 Crear `components/ui/coachmark-tour.tsx` con overlay por portal, spotlight (box-shadow) y globo posicionado
- [x] 2.2 Medir target vía `data-tour` dentro de un `containerRef`, con `scrollIntoView` por paso
- [x] 2.3 Re-medir ante `scroll` (capture) y `resize`
- [x] 2.4 Globo: título, descripción, progreso (dots + "Paso X de 4"), "Siguiente", "Omitir guía", y botón de cierre en el paso finale
- [x] 2.5 Navegación: Siguiente/Atrás, Esc = omitir
- [x] 2.6 `pointer-events: auto` en la raíz del portal (Radix modal pone none en el body)

## 3. Integración en el formulario

- [x] 3.1 Agregar anclas `data-tour` en: Monto (hero), Cuenta, Categoría, Descripción, Guardar (solo drawer / create)
- [x] 3.2 Quitar los 3 `InlineGuide` (`.type`, `.account`, `.category`) del form
- [x] 3.3 Montar `CoachmarkTour` con el `containerRef` del form cuando corresponda
- [x] 3.4 Gating de arranque: `showFirstMovementGuidance && isDrawer && !isEdit && tab ∈ {expense,income} && isVisible`
- [x] 3.5 onFinish → `mark('completed')`; onSkip/Esc → `mark('dismissed')`

## 4. Verificación

- [ ] 4.1 Usuario sin movimientos: el tour arranca solo y recorre los 5 pasos (Monto → Cuenta → Categoría → Descripción → Guardar)
- [ ] 4.2 Omitir / completar persiste y no reaparece
- [ ] 4.3 Usuario con movimientos: no aparece
- [ ] 4.4 Cambiar a Transferencia/Ajuste/Cambio cierra el tour
- [ ] 4.5 Sin errores `MISSING_MESSAGE`; spotlight bien posicionado al scrollear

## 5. Pre-merge

- [ ] 5.1 Archivar el change OpenSpec en la branch antes de mergear
- [ ] 5.2 Squash commit + push
