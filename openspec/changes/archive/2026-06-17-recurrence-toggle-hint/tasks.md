# Tasks: recurrence-toggle-hint

## 1. i18n

- [x] 1.1 `es.json`: reescribir `transactions.drawer.repeat_note` (propósito) + agregar `transactions.drawer.repeat_hint`
- [x] 1.2 `en.json`: traducir ambos manteniendo el tono

## 2. UI

- [x] 2.1 En `movement-form.tsx`, dentro del bloque `isRecurrent`, renderizar el hint tintado (emerald) con ícono de lámpara, arriba del "¿Cada cuánto?"

## 3. Verificación

- [x] 3.1 Typecheck web pasa
- [x] 3.2 Runtime: activar el toggle muestra el hint con color; desactivar lo oculta — verificado por el usuario
- [x] 3.3 `openspec validate recurrence-toggle-hint --strict` pasa

## 4. Pre-merge

- [ ] 4.1 Archivar el change en la branch
- [ ] 4.2 Commit `feat(transactions): explicar el toggle de recurrencia con un hint contextual`
