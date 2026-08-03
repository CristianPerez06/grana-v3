# Tareas — split de `project-conventions`

Este change no toca código. Todas las tareas son sobre specs y sobre la verificación de que la reubicación fue textualmente exacta.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Clasificar los 27 requirements del spec maestro y asignarle destino a cada uno.
- [x] 1.2 Extraer los 17 cuerpos reubicados **verbatim** con un script que falla si algún requirement queda sin clasificar o si un título no existe.
- [x] 1.3 Emitir los deltas `## ADDED Requirements` de `cards` (5), `transactions` (2), `schema-base` (1), `onboarding` (1), `route-loading-and-errors` (1), `repo-architecture` (3) y `ui-foundations` (4).
- [x] 1.4 Escribir el delta `## REMOVED Requirements` de `project-conventions` con los 17 requirements, cada uno con `**Reason**` (declarando "reubicación, no deprecación" + destino nombrado) y `**Migration**`.
- [x] 1.5 Escribir los 3 `## MODIFIED Requirements` de reparación de punteros (`transactions`, `route-loading-and-errors`, `page-header`).

## 2. Verificación previa al archivado

- [x] 2.1 `npx openspec validate split-project-conventions --strict` pasa con exit code 0.
- [x] 2.2 Confirmar que cada uno de los 17 cuerpos `ADDED` es **byte a byte idéntico** al bloque original del spec maestro (`diff` bloque a bloque, no lectura). Cero diferencias.
- [x] 2.3 Confirmar la aritmética: `grep -c '^### Requirement:'` sobre el spec maestro da 27; los deltas `ADDED` suman 17; el delta `REMOVED` lista 17; los títulos `REMOVED` y `ADDED` coinciden exactamente como conjuntos.
- [x] 2.4 Confirmar que cada requirement reubicado conserva al menos un `SHALL` o `MUST` (el parser rechaza el archive si no).
- [x] 2.5 Confirmar que los 3 `MODIFIED` difieren de su original **únicamente** en la cláusula de referencia declarada en el `proposal.md`, y en nada más.
- [x] 2.6 Confirmar que la prosa de todos los archivos del change está en español y que las keywords del parser están en inglés (el change no puede violar la spec que edita).

## 3. Archivado (en la branch, antes del merge a `main`)

- [x] 3.1 Aplicar los deltas a los specs maestros de las 7 capabilities existentes tocadas. El spec maestro NO debe quedar con secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 3.2 Crear `openspec/specs/repo-architecture/spec.md` con sus 3 requirements y un `Purpose` real de 2-4 líneas — **no** dejar el placeholder `TBD - created by archiving change ...`.
- [x] 3.3 Crear `openspec/specs/ui-foundations/spec.md` con sus 4 requirements y un `Purpose` real de 2-4 líneas.
- [x] 3.4 **Reescribir el `Purpose` de `project-conventions`.** El actual menciona "la política web↔mobile de implementaciones paralelas con API idéntica", que se va a `repo-architecture`. El nuevo `Purpose` debe describir sólo lo que queda: repo-como-memoria, bilingüismo, branching, merge squash sobre historia lineal, y el workflow de OpenSpec.
- [x] 3.5 Verificar que `project-conventions` queda con exactamente 10 requirements y que ninguno de los 17 reubicados sobrevive ahí.
- [x] 3.6 Actualizar `AGENTS.md`: la línea "Cross-cutting modules (`schema-base`, `profiles`, `i18n`, `card-networks`, `project-conventions`) underpin everything else" debe incluir `repo-architecture` y `ui-foundations`. Revisar también si la tabla "Modules" necesita filas para las dos capabilities nuevas.
- [x] 3.7 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-split-project-conventions/`.
- [x] 3.8 `pnpm openspec:check` pasa (falla si quedó algún `Purpose: TBD`). Ejecutado de verdad: `openspec:check OK`, exit 0. NOTA operativa: el `pnpm` del PATH resuelve a un shim de corepack roto en este entorno (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` con Node 22 + pnpm 11); el script corrió vía `npx pnpm@10 openspec:check`. El gate no lo cubre CI todavía (ver 4.5).
- [x] 3.9 `npx openspec validate --specs --strict` pasa sobre los specs maestros ya sincronizados.

## 4. Coordinación

- [ ] 4.1 Confirmar el orden de merge con la change activa `cards-mobile-density`, que también toca `cards`. Orden propuesto: `cards-mobile-density` primero. No hay solapamiento de requirements; si el orden se invierte sólo hace falta rebasear.
- [ ] 4.2 Dejar registradas como changes siguientes **todas** las piezas que este change difiere a propósito. La lista completa, para que ninguna quede sólo anotada en la prosa del `proposal.md`:
  - ~~`dedupe-relocated-invariants`~~ — **SALDADA** (archivada 2026-08-03): los 4 solapamientos resueltos, `fx_rate_to_ars` queda en `transactions` con referencia cruzada desde `cards`, y la deuda 4 (invariante de período abierto debilitado) eliminada. Además destapó y corrigió una contradicción real: `accounts` excluía del saldo sólo los consumos `pending`, cuando el código excluye `pending` y `paid` por igual.
  - La regla de admisión a capabilities meta (ver `proposal.md` → "Seguimiento recomendado").
  - ~~La corrección de la ruta de primitivos mobile~~ — **SALDADA** por la change `fix-mobile-primitives-path` (archivada 2026-08-03).
  - **Deuda 1 — "Bimoneda por defecto" está desactualizado.** Nombra rutas que no existen (`/onboarding/perfil`, `/onboarding/saldo-actual`; las reales son `/onboarding/welcome`, `/onboarding/initial-balance`, `/onboarding/done`), viola la regla "código en inglés" con segmentos en español, y dos de sus scenarios describen una pantalla de perfil y un "según el modo" que la change archivada `remove-user-modes` eliminó. Ahora vive en `onboarding`.
  - ~~**Deuda 2 — el requirement de layout del monorepo está desactualizado.**~~ **SALDADA** por `refresh-monorepo-layout` (archivada 2026-08-03), que además le sacó el inventario de paquetes para que no vuelva a desactualizarse por la misma causa. Texto original: Dice "la app actual es `apps/web/`" y habla de `apps/mobile/` como futuro, cuando existe hace meses; y enumera 4 packages cuando hoy hay 14. Ahora vive en `repo-architecture`.
  - ~~**Deuda 4 — el invariante de período abierto está debilitado.**~~ **SALDADA** por `dedupe-relocated-invariants`. La cláusula "o, alternativamente" une dos condiciones y lo vuelve no verificable; la versión que ya tenía `cards` no tiene esa ambigüedad. Se resuelve junto con el solapamiento correspondiente en `dedupe-relocated-invariants`.
- [x] 4.4 **RESUELTO** por `dedupe-relocated-invariants` (archivada 2026-08-03): la propiedad queda en `transactions`, con referencia cruzada a `I-CRED-11` desde el requirement de off-ledger de `cards`. Texto original de la decisión pendiente: **Input explícito para `dedupe-relocated-invariants`: quién es el dueño de `fx_rate_to_ars` (`I-CRED-11`).** Este change lo reubica a `transactions` y no decide la propiedad, porque decidirla es una edición de contenido. Las dos posiciones, para que la change de dedup las resuelva en vez de heredarlas:
  - **A favor de `transactions`** (lo que hace este change): la columna y su enforcement son `transactions.fx_rate_to_ars`; `transactions` **ya tiene** su propio requirement sobre la misma regla (`openspec/specs/transactions/spec.md`, "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS"), escrito antes de este change; y colocalizar ambos textos en un solo archivo vuelve trivial la fusión.
  - **A favor de `cards`**: es un invariante `I-CRED-*` y los otros cinco van a `cards`; el `Purpose` de `transactions` dice "los consumos y cuotas de tarjeta de crédito viven en `cards`"; y un lector de `cards` hoy no encuentra `I-CRED-11`.
  - **Recomendación**: al fusionar los dos textos en `transactions`, dejar en `cards` una referencia cruzada a `I-CRED-11`. Eso cierra el problema de descubribilidad sin reubicar. Si en cambio se decide que el texto que sobrevive es el de `I-CRED-11`, entonces la regla completa SHALL mudarse a `cards` en esa misma change.
- [x] 4.3 **SALDADA** por `fix-mobile-primitives-path` (archivada 2026-08-03): `repo-architecture` ahora dice `apps/mobile/components/ui/`, el scenario cita el archivo que existe, y una cláusula de desempate nombra a `ui-foundations` como dueña del tema. Texto original: la corrección de la ruta de primitivos mobile se vuelve **más urgente por efecto de este change**, y por eso se registra aparte. Hoy la contradicción `apps/mobile/components/` (requirement de paridad web↔mobile) vs `apps/mobile/components/ui/` (requirement de capas de componentes) vive en un solo archivo y es difícil de pasar por alto. Después del archivado queda repartida entre `repo-architecture` y `ui-foundations`, dos capabilities autoritativas distintas que se contradicen sin saberlo. El valor correcto es `apps/mobile/components/ui/`: en el repo los primitivos viven ahí y `apps/mobile/components/` sólo contiene carpetas por feature. No se corrige en este change porque sería una edición de contenido normativo, que es exactamente lo que este change se prohíbe.
- [ ] 4.5 **Los dos gates de specs no corren en CI.** `.github/workflows/ci.yml` tiene cuatro jobs (`quality`, `web-build`, `web-test`, `monorepo-health`) y ninguno referencia openspec, así que ni `pnpm openspec:check` ni `npx openspec validate --specs --strict` se ejecutan en un PR. Los dos son rápidos y no necesitan build, y son el único guardarraíl de la spec en un repo cuyo principio fundacional es que la spec es la memoria. Registrar una change siguiente que agregue un job `specs` a `ci.yml`. Detectado al archivar este change, cuando 3.8 quedó sin poder verificarse ni local ni en CI.
