# Proposal: guard-unsaved-movement-edits

## Why

El formulario de movimiento no sabe si cambió. Dos consecuencias, las dos molestas:

1. **El CTA de guardar está siempre habilitado.** En edición, tocar "Guardar cambios" sin haber cambiado nada dispara igual el `update*`, invalida el cache y cierra como si hubiera pasado algo. Es una escritura a la base para no cambiar ningún dato.
2. **Cerrar el drawer se come los cambios sin avisar.** Y el drawer se cierra por tres caminos: la ✕ del formulario, `Esc`, y un click en el scrim. Los dos últimos son fáciles de disparar sin querer — un tap al costado en un teléfono, un `Esc` de reflejo para cerrar un popover que ya se había cerrado — y se llevan puesto todo lo cargado.

El segundo pega más fuerte en el **alta**, donde se pierde un formulario entero (monto, categoría, cuenta, fecha, descripción), pero vale para los dos modos.

## What Changes

- **El hook compartido expone `isDirty`**: un snapshot serializado de todo lo que el usuario puede cambiar y el submit lee, comparado contra el snapshot del primer render. Se deriva una sola vez en `@grana/movement-form` y lo consumen web y nativa — no se recalcula por plataforma.
- **CTA deshabilitado en edición mientras no haya cambios**, en web y en la nativa. En alta el CTA no cambia: ahí el gate es la validación, no el estado *dirty*.
- **Confirmación al cerrar el drawer con cambios**, en los dos hosts de overlay de web (alta y edición). Cubre **los tres caminos** de cierre porque el host es el embudo: la ✕ del formulario llama a su `onClose`, y Radix rutea `Esc` y el click en el scrim a ese mismo handler. El formulario sólo reporta si está sucio (`onDirtyChange`); la confirmación vive en el host, en un hook compartido (`useDiscardGuard`).
- **Un guardado exitoso no pregunta**: `onSuccess` cierra sin pasar por el guard.

Sin cambios de datos, validación ni contables.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del formulario único incorpora el estado *dirty* — CTA deshabilitado sin cambios en edición, y confirmación al cerrar un overlay con cambios por cualquiera de los caminos de cierre.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` toca `transactions` sobre requirements disjuntos (recurrencias, borrado, edición desde el módulo global). Sin solapamiento.

## Impact

- **`packages/movement-form/src/use-movement-form.ts`** — nuevo `isDirty` derivado y expuesto; `types.ts` lo declara en el resultado del hook. Seis tests nuevos cubren el caso pristine (alta y edición), el cambio, el deshacer, el default de reintegro en el mount y el enable del reintegro.
- **`apps/web/app/(app)/transactions/_components/use-discard-guard.tsx`** (nuevo) — hook que devuelve `requestClose`, `setDirty` y el `AlertDialog` de confirmación, para no duplicarlo en los dos hosts.
- **`apps/web/lib/transactions/components/movement-form.tsx`** — nueva prop `onDirtyChange`, reporte por efecto, y CTA deshabilitado en edición sin cambios.
- **`apps/web/app/(app)/transactions/_components/movement-drawer.tsx`** y **`.../[txId]/_components/global-transaction-detail.tsx`** — cablean el guard en el `onClose` del `Drawer` y del formulario, y montan su diálogo.
- **`apps/mobile/components/transactions/MovementForm.tsx`** — CTA deshabilitado en edición sin cambios.
- **i18n**: cuatro claves nuevas bajo `transactions.discard_changes` (título, cuerpo, descartar, seguir editando), en ambos catálogos.

### Asimetría conocida: la nativa no guarda la navegación hacia atrás

En la app nativa la edición es una **pantalla**, no un overlay: se sale con el back del header, el gesto o el botón físico. Interceptar eso necesita `usePreventRemove` de `@react-navigation/native`, que hoy **no es dependencia directa de `apps/mobile`** (llega sólo transitivamente por `expo-router`), y agregarla excede esta pasada. La nativa recibe el CTA deshabilitado; el guard de salida queda pendiente y anotado acá. El riesgo también es menor: salir sin querer de una pantalla completa es bastante menos probable que cerrar un drawer con un tap al costado.

La ruta web `/transactions/[txId]/edit` tampoco queda guardada, por la razón inversa: no tiene botón de cerrar y se sale navegando, algo que Next no expone un punto para interceptar en navegación de cliente.
