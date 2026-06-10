## Context

El rediseño visual de `/shared/settings` (ancho `760px`, secciones en paneles, lista de integrantes con avatar de iniciales, split más legible, loading espejado) ya está implementado en la branch como ajuste puramente visual de datos existentes — eso, por `docs/design/route-ui-system.md`, no requería OpenSpec. Lo que esta change captura son las **tres diferencias del handoff que sí cruzan la línea**: una nueva interacción (confirmar antes de salir) y dos copys nuevos (descripción de la zona destructiva, captions del split). El primitivo de diálogo ya existe (`Dialog`, especificado en `overlay-primitives`); no se inventa UI nueva, sólo se compone.

## Goals / Non-Goals

**Goals:**
- Cerrar las diferencias del mock que implican comportamiento o copy nuevo, por la vía spec + i18n.
- Reusar el primitivo `Dialog` y el patrón de `AccountConfirmDialog` (sin primitivo nuevo).
- Mantener intacta la regla de negocio: salir sigue bloqueado server-side si hay deuda viva.
- Dejar el copy nuevo en ambos catálogos i18n para que mobile lo herede.

**Non-Goals:**
- Implementar `/shared/settings` en mobile (la ruta nativa no existe).
- Cambiar el primitivo `Button` para el rojo sólido del mock.
- Tocar derivación de deuda, settlement, invite, queries de gastos, o cualquier otra ruta de `/shared`/`/settings`.

## Decisions

### Decisión 1 — Confirmar antes de salir con el primitivo `Dialog` (comportamiento nuevo)

El botón "Salir del hogar" deja de invocar `leaveHousehold` directamente: abre un `Dialog` de confirmación. La salida sólo ocurre al presionar el CTA destructivo del diálogo. Se sigue el patrón exacto de `apps/web/app/(app)/accounts/_components/account-confirm-dialog.tsx`: caller controla `open`; el CTA queda `loading` durante la action; el `formError` (incluido el bloqueo por deuda viva) se renderiza inline en el `DialogBody` sin cerrar el panel; en éxito el caller cierra y redirige a `/shared`.

- **Por qué OpenSpec:** agregar un paso de confirmación es comportamiento nuevo de la capa de UI, no reordenamiento visual. El README del handoff lo marcó como bloqueante para implementarlo.
- **Alternativa considerada:** salida de un click + `Alert` de "deshacer". Rechazada: no está en el mock (zona destructiva con confirmación) y "deshacer" sería aún más comportamiento nuevo.
- **Regla de negocio intacta:** `leaveHousehold` ya bloquea server-side si hay deuda viva; el diálogo no duplica esa lógica, sólo muestra el `formError` resultante en su cuerpo.

### Decisión 2 — Copy nuevo en i18n (ambos catálogos), CTAs reusados

Cinco claves nuevas bajo `shared.settings.*` (título y cuerpo de confirmación, descripción de la zona destructiva, dos captions del split), idénticas en estructura en `es.json` y `en.json`. El CTA de confirmar reusa `shared.settings.leave_action` ("Salir del hogar") y el de cancelar reusa `common.cancel` ("Cancelar") — no se duplican.

### Decisión 3 — Captions del split como copy, sin tocar la lógica del split

La sección de split por defecto rotula a ambos integrantes: nombre real (de `getHousehold().members`) + caption de rol. Se sigue editando sólo el porcentaje del primer integrante; el segundo se deriva `100 - primero`. La validación/clamping (≥1, ≤99, suma 100) no cambia.

### Decisión 4 — El componente de diálogo queda web-local

`leave-household-dialog.tsx` se colocaliza en `_components/` de la ruta. Un solo consumidor (web); por la regla de ≥2 consumidores no se promueve a contrato compartido. El copy sí va a i18n compartido.

## Risks / Trade-offs

- **[Botón destructivo suave vs. rojo sólido del mock]** → Aceptado como divergencia deliberada. Usar `<Button variant="destructive">` (suave) honra la regla de "usar el primitivo existente"; un override sólido por instancia (estilo el verde de WhatsApp en `InviteCard`) se evita para no normalizar overrides de color en acciones destructivas. Sin delta de spec.
- **[El diálogo agrega fricción a una acción poco frecuente]** → Es el comportamiento pedido (confirmación en zona destructiva); la fricción es intencional para una acción irreversible.
- **[Drift de claves i18n]** → Mitigación: agregar cada clave a `es.json` y `en.json` en el mismo commit; la paridad de catálogos lo verifica.
- **[Solapamiento con `shared-settings-web-design-parity`]** → Ambas changes editan `specs/shared/spec.md` pero requirements distintos (esta: salir + split por defecto; la otra: dashboard del hogar + idioma). Independientes; archivables en cualquier orden.
