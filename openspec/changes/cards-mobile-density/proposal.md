## Why

En `apps/mobile`, la vista compacta de `/cards` mete demasiada información en filas de una sola línea y a ancho de teléfono no entra:

- **Encabezado de grupo de banco** (`Wallet.tsx` → `BankGroupMobile`): chevron + dot de marca + nombre del banco + "N tarjetas · M en uso" + total a pagar + badge de urgencia, todo en un único `flex-row`. Dentro de la card el ancho útil es ~310pt y ese contenido necesita ~420pt, así que RN aprieta los nodos de texto y el badge queda cortado. Ningún `<Text>` tiene `numberOfLines`, con lo cual el colapso es impredecible: un banco con nombre largo puede empujar el monto fuera de pantalla. Web ya resolvió su versión angosta escondiendo el meta (`hidden sm:inline`) y truncando el nombre; mobile no tiene ninguna de las dos protecciones.
- **Controles de vista**: un `Segmented` de 5 opciones (`Por banco` / `Todas` / `En uso` / `Vencen pronto` / `Con saldo`). El primitivo reparte `flex-1` entre las opciones → ~62pt cada una, mientras que "Vencen pronto" necesita ~95pt. No es un problema de ajuste fino: cinco opciones no entran en una fila de teléfono. Además el control mezcla dos conceptos: `Por banco` es un **modo de vista** (agrupado vs plano) y las otras cuatro son **predicados** sobre la misma lista.

## What Changes

- **Encabezado de grupo a dos líneas (mobile)**. El encabezado pasa de una fila a dos:
  - Línea 1: dot de marca + nombre del banco (una línea, truncado, `shrink`) + total a pagar del banco alineado a la derecha.
  - Línea 2: "N tarjetas · M en uso" + chip de urgencia alineado a la derecha, indentada bajo el nombre.
  - El chevron queda centrado verticalmente respecto de las dos líneas.
- **Chip de urgencia solo cuando hay urgencia (mobile)**. Hoy un grupo `ok` renderiza igual el chip "Al día", que ocupa ~55pt sin aportar información — el estado "al día" ya se lee de la ausencia de deuda y de los dots por fila. El chip pasa a renderizarse solo cuando `group.tone !== 'ok'`, mostrando el próximo vencimiento. Web mantiene el badge siempre visible → el escenario diverge y se etiqueta `(mobile)`.
- **Controles de vista separados en dos (mobile)**. El `Segmented` de 5 opciones se parte según el concepto:
  - Un `Segmented` de 2 opciones: `Por banco` (default) | `Lista`. Es el modo de vista.
  - Una fila de chips de filtro que aparece **solo en modo `Lista`**: `Todas` (default) / `En uso` / `Vencen pronto` / `Con saldo`, cada uno con el conteo de resultados (p. ej. "En uso 3"), para poder saltear filtros vacíos sin tocarlos.
  - Semántica preservada: `Por banco` = el agrupado actual; `Lista` + `Todas` = la vista plana que hoy da el filtro `Todas`. Al volver a `Por banco` el filtro elegido queda inerte (el agrupado siempre muestra todas las tarjetas), como hoy.
  - Web mantiene el `Segmented` único de 5 opciones → el escenario diverge y se etiqueta `(mobile)`.
- **Nuevo label i18n** para el modo `Lista`; los cuatro labels de predicado se reutilizan tal cual.
- **Fix de tokens inexistentes en el tono "por vencer" (mobile)**. `Wallet.tsx` usa `bg-amber`, `bg-amber/10` y `text-amber` para el tono `soon`, y **`amber` no existe** ni en `@grana/ui-tokens` ni como color pelado de Tailwind (la paleta default solo tiene escalas `amber-500`…). NativeWind no genera esas clases, así que hoy el dot de estado de una tarjeta "por vencer" es **invisible** y el chip de su grupo queda sin fondo ni color — justo el estado que el requirement vinculante de estado por fila pide que nunca se pierda. Pasan al token real `warning` / `warning-soft`. Entra en este change porque toca exactamente las dos superficies que estamos rediseñando.
- **No alcanza**: semántica contable, lectura de datos, orden, regla de auto-colapso, filas de 2 líneas por tarjeta, hero del mes, sección Archivadas, ni `apps/web`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`: el requirement del listado compacto fija hoy el encabezado de grupo como una fila única con badge siempre presente, y los controles de vista como una sola fila de filtros/orden. Se agregan escenarios `(mobile)` para el encabezado a dos líneas, el chip condicional y los dos controles separados con conteos, dejando explícito que web conserva el comportamiento actual. El requirement de estado por fila se refuerza: el indicador SHALL usar un token existente del design system (el tono "por vencer" hoy es invisible en mobile por una clase inexistente).

## Impact

- **Código**: `apps/mobile/components/cards/Wallet.tsx` (encabezado de grupo + controles de vista); un componente nuevo de fila de chips en `apps/mobile/components/cards/` o `apps/mobile/components/ui/` según cuán genérico quede; `packages/cards/src/grouping.ts` para un helper puro que cuente coincidencias por filtro (la lógica de vista vive en el package, no en `apps/`); `packages/i18n-messages/src/{es,en}.json` para el label del modo `Lista`.
- **Sin cambios**: queries, mutations, migraciones, contratos de `@grana/ui-contracts`, `apps/web`.
- **Riesgo**: bajo. Es presentación + estado local de UI. El riesgo real es de paridad: el listado deja de verse igual en web y mobile, y eso queda documentado con escenarios etiquetados en vez de quedar como drift silencioso.
- **Tests**: el helper de conteo por filtro se cubre en los tests puros de `packages/cards/src/__tests__/`.
