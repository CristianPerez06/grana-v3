# Proposal: first-movement-tour

## Why

El sistema de guidance actual (Change `user-guidance-system`) muestra 3 hints de
texto gris debajo de los campos del formulario de movimiento. En QA con un usuario
real, el feedback fue contundente: **"son muy malos, prácticamente no se ven"**. El
texto discreto no cumple el objetivo de educar al usuario nuevo: no sobresale, no
guía, no explica para qué sirve cada campo.

La referencia mental del usuario es el **tour de "reservas" de Mercado Pago**: un
recorrido tipo *spotlight* que atenúa la pantalla, ilumina un elemento por vez y
explica qué es y para qué sirve, con progreso y botón "Siguiente".

## What Changes

- **Reemplazar** los 3 `InlineGuide` pasivos del primer movimiento por un **tour
  guiado activo** (coachmark / spotlight) que recorre el formulario paso a paso.
- Nuevo primitivo reutilizable `CoachmarkTour` (overlay con spotlight + globo +
  progreso), sin librería externa.
- 4 pasos numerados — **Monto → Cuenta → Categoría → Descripción** — más un paso de
  cierre que enfoca el botón **Guardar**. (Se omite "Tipo": ya está elegido por la
  pestaña. Se incluye "Descripción" porque es opcional/escondida pero es la llave del
  autocategorizador.)
- Arranque **automático** la primera vez que el usuario sin movimientos abre el
  drawer de nuevo movimiento (tab Gasto/Ingreso).
- Salida con **"Omitir guía"** en cualquier paso; completar u omitir **persiste** y
  no vuelve a mostrarse.
- **Reutiliza** el backend ya existente: tabla `user_guidance_events`, server
  actions, hook `useGuidance`. Solo cambia la capa de presentación.

## Capabilities

- `guidance` (modificada): la capacidad de guiar el primer movimiento pasa de hints
  inline a un tour guiado.

## Impact

- **Afectado:** `apps/web/lib/transactions/components/movement-form.tsx` (quita
  InlineGuides, agrega anclas `data-tour` + controlador del tour).
- **Nuevo:** `apps/web/components/ui/coachmark-tour.tsx`.
- **Nuevo guidance id:** `first_movement.tour` (reemplaza el uso de `.type`,
  `.account`, `.category` en el form).
- **i18n:** copy del tour bajo `guidance.first_movement_tour.*` (ES + EN).
- **Sin cambios de DB.** La tabla y las actions ya soportan este caso.
- **Mobile:** fuera de alcance (igual que el change anterior; el flujo nativo aún
  no existe).
