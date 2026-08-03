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

- [ ] 3.1 Aplicar los deltas a los specs maestros de las 7 capabilities existentes tocadas. El spec maestro NO debe quedar con secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [ ] 3.2 Crear `openspec/specs/repo-architecture/spec.md` con sus 3 requirements y un `Purpose` real de 2-4 líneas — **no** dejar el placeholder `TBD - created by archiving change ...`.
- [ ] 3.3 Crear `openspec/specs/ui-foundations/spec.md` con sus 4 requirements y un `Purpose` real de 2-4 líneas.
- [ ] 3.4 **Reescribir el `Purpose` de `project-conventions`.** El actual menciona "la política web↔mobile de implementaciones paralelas con API idéntica", que se va a `repo-architecture`. El nuevo `Purpose` debe describir sólo lo que queda: repo-como-memoria, bilingüismo, branching, merge squash sobre historia lineal, y el workflow de OpenSpec.
- [ ] 3.5 Verificar que `project-conventions` queda con exactamente 10 requirements y que ninguno de los 17 reubicados sobrevive ahí.
- [ ] 3.6 Actualizar `AGENTS.md`: la línea "Cross-cutting modules (`schema-base`, `profiles`, `i18n`, `card-networks`, `project-conventions`) underpin everything else" debe incluir `repo-architecture` y `ui-foundations`. Revisar también si la tabla "Modules" necesita filas para las dos capabilities nuevas.
- [ ] 3.7 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-split-project-conventions/`.
- [ ] 3.8 `pnpm openspec:check` pasa (falla si quedó algún `Purpose: TBD`).
- [ ] 3.9 `npx openspec validate --specs --strict` pasa sobre los specs maestros ya sincronizados.

## 4. Coordinación

- [ ] 4.1 Confirmar el orden de merge con la change activa `cards-mobile-density`, que también toca `cards`. Orden propuesto: `cards-mobile-density` primero. No hay solapamiento de requirements; si el orden se invierte sólo hace falta rebasear.
- [ ] 4.2 Dejar registradas como changes siguientes las tres piezas que este change difiere a propósito: `dedupe-relocated-invariants` (los 4 solapamientos), la regla de admisión a capabilities meta (ver `proposal.md` → "Seguimiento recomendado"), y la corrección de la ruta de primitivos mobile (ver `proposal.md` → "Deuda detectada", punto 3).
- [ ] 4.4 **Input explícito para `dedupe-relocated-invariants`: quién es el dueño de `fx_rate_to_ars` (`I-CRED-11`).** Este change lo reubica a `transactions` y no decide la propiedad, porque decidirla es una edición de contenido. Las dos posiciones, para que la change de dedup las resuelva en vez de heredarlas:
  - **A favor de `transactions`** (lo que hace este change): la columna y su enforcement son `transactions.fx_rate_to_ars`; `transactions` **ya tiene** su propio requirement sobre la misma regla (`openspec/specs/transactions/spec.md`, "El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS"), escrito antes de este change; y colocalizar ambos textos en un solo archivo vuelve trivial la fusión.
  - **A favor de `cards`**: es un invariante `I-CRED-*` y los otros cinco van a `cards`; el `Purpose` de `transactions` dice "los consumos y cuotas de tarjeta de crédito viven en `cards`"; y un lector de `cards` hoy no encuentra `I-CRED-11`.
  - **Recomendación**: al fusionar los dos textos en `transactions`, dejar en `cards` una referencia cruzada a `I-CRED-11`. Eso cierra el problema de descubribilidad sin reubicar. Si en cambio se decide que el texto que sobrevive es el de `I-CRED-11`, entonces la regla completa SHALL mudarse a `cards` en esa misma change.
- [ ] 4.3 La corrección de la ruta de primitivos mobile se vuelve **más urgente por efecto de este change**, y por eso se registra aparte. Hoy la contradicción `apps/mobile/components/` (requirement de paridad web↔mobile) vs `apps/mobile/components/ui/` (requirement de capas de componentes) vive en un solo archivo y es difícil de pasar por alto. Después del archivado queda repartida entre `repo-architecture` y `ui-foundations`, dos capabilities autoritativas distintas que se contradicen sin saberlo. El valor correcto es `apps/mobile/components/ui/`: en el repo los primitivos viven ahí y `apps/mobile/components/` sólo contiene carpetas por feature. No se corrige en este change porque sería una edición de contenido normativo, que es exactamente lo que este change se prohíbe.
