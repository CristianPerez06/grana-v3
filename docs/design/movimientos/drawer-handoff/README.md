# Handoff de diseño · Drawer de Registrar / Editar movimiento (desktop)

Referencia de diseño **hi-fi** del formulario de carga/edición de movimientos presentado como **drawer lateral derecho** sobre la lista de `/transactions`. Es la iteración que **reemplaza** la versión "form de página completa" de los exports de Paper del directorio padre (`../05-nuevo-movimiento.png` y `../06-editar-movimiento.png`) en lo que hace al **contenedor y la interacción del drawer**.

> ⚠️ Estos archivos son **referencia de diseño**, NO código de producción. La tarea es recrear este diseño en el codebase real de v3 (React/Next + Tailwind v4) usando los componentes y tokens que ya existen, no copiar el HTML/JS tal cual.

## Archivos

- **`HANDOFF.md`** — el documento de handoff: layout del drawer (header/body/footer), orden de campos por tipo (Gasto/Ingreso/Transferencia/Ajuste/Cambio), selector de categoría con drill de subcategorías, cuotas, reintegro, repetir, tokens, sombras, tipografía, comportamiento e interacciones.
- **`prototype.html`** — prototipo HTML/CSS vanilla del look & feel (incluye todo el CSS del drawer en el `<style>`).
- **`registrar-form.js`** — toda la lógica del prototipo (estado, tabs, formato de monto, popovers + drill, cuotas, toggles, edición, atajos). Útil para los detalles exactos de comportamiento.

## Relación con lo ya implementado (en `main`)

La change de OpenSpec `redesign-movement-form-as-drawer` ya dejó en `main` el drawer **funcional** (alta + edición) reusando el `MovementForm` existente, pero **sin** el restyle hi-fi: hoy el drawer monta el formulario actual adentro. Lo que falta es recrear esta presentación (monto hero, tabs `Segmented`, filas con `Popover` + drill, footer fijo con "+ Otro", header con eyebrow/cerrar/eliminar), más la versión mobile.

## Snapping a v3

El prototipo difiere en un par de verdes/ámbar y usa dots de color arbitrarios. Al implementar, **snapear a los tokens canónicos** de `packages/ui-tokens/src/theme.css` y usar `AccountAvatar` para las cuentas. Ver la sección "Design Tokens" del `HANDOFF.md`.
