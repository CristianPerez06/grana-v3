## 1. Conteo de posiciones — la unión, en los dos lados

- [x] 1.1 Escribir los tests de `occurrencePositionsSpent` (`packages/money-logic`) para los cuatro escenarios del spec —resolver antes, no contar dos veces al llegar la fecha, devolver a revisión antes y después del vencimiento— y verificar que **fallan** contra la implementación actual antes de tocarla
- [x] 1.2 Implementar la unión en `occurrencePositionsSpent` y verificar que los tests de 1.1 pasan y que la suite de `money-logic` sigue verde
- [x] 1.3 Escribir el espejo SQL en la migración `0072` (`create or replace` de `recurrence_positions_spent`, copiada de **`0071`** — 0068 tiene la semántica de pausa vieja) y verificar con el test de paridad SQL↔TS sobre los mismos casos de 1.1
- [x] 1.4 Verificar que `recurrence_positions_spent_batch` (`0070`) no se toca y sigue devolviendo lo mismo que la función por fila

## 2. Migración `0072`

- [x] 2.1 Confirmar contra `origin/main` que `0071` sigue siendo la más alta antes de fijar el número, y dejar el encabezado con el change y el orden de aplicación
- [x] 2.2 RPC de **candidatos** (`SECURITY INVOKER`): mismo tipo funcional y moneda, no vinculado a ninguna ocurrencia, ventana de vencimiento anterior a siguiente **tomada del calendario real (`recurrence_calendar_around`; corregido en revisión 18-09: la versión anterior usaba `± intervalo`)**, orden por proximidad, y el parámetro de ampliar. Verificar que excluye un movimiento ya vinculado y que incluye uno fechado veinte días antes del vencimiento
- [x] 2.3 RPC de **vincular**, con la rama de conversión a compartido en la misma transacción, **validando el vencimiento antes de crearle identidad (`recurrence_admits_occurrence`; agregado en revisión 18-09)**. Verificar que un fallo en cualquiera de los dos pasos no deja ni el reparto aplicado ni el vínculo escrito
- [x] 2.4 Reemplazar las **dos funciones de guarda** de `0049` con la noción de liquidación vigente: dejan de contar una `reversed` con su contraasiento presente y toda fila `contra`; siguen contando `completed` y `pending_receipt`. Verificar los cinco escenarios del delta de `shared`, incluido que revertir una de dos liquidaciones no destraba
- [x] 2.5 Verificar que la corrección de 2.4 **no cambia el cálculo de la deuda**: el original revertido y su contra siguen contando y cancelándose. Un test sobre la deuda derivada antes y después
- [x] 2.6 RPC de **desvincular**: rompe el vínculo y revierte la conversión en la misma transacción, **sin** atrapar `GRN01`. Verificar que con una liquidación vigente falla entero —el movimiento sigue compartido y el vínculo sigue puesto— y que tras revertir esa liquidación la operación se completa
- [x] 2.7 `revoke`/`grant` explícitos en cada función nueva, y self-check antes del COMMIT. Verificar que el self-check falla si se le saca una función a propósito
- [x] 2.8 Firmas de los RPC nuevos en `packages/supabase/src/types.ts`, verificadas contra el SQL aplicado — **escritas a mano por decisión del proyecto: la CLI de Supabase no se usa (18-09). Tras aplicar 0072 se comparó una por una contra las declaraciones de la migración (nombres y orden de los parámetros, cuáles tienen default, y la forma del retorno) y coinciden. `recurrence_admits_occurrence` es el único helper que la app llama por RPC; `settlement_is_live`, `recurrence_step_interval` y `recurrence_split_matches` sólo se usan dentro de SQL, así que no necesitan entrada**

## 3. Lógica compartida (`@grana/recurrences`)

- [x] 3.1 Read de candidatos sobre el RPC de 2.2, con su tipo de dominio. Verificar con tests que cubran ventana, exclusión de vinculados y orden
- [x] 3.2 Mutation de **registrar anticipado**: crear el movimiento con los orquestadores existentes e insertar la ocurrencia ya `confirmed` con su `due_date` real. Verificar que en ningún momento existe una fila `pending` con fecha futura, y que un fallo del INSERT compensa borrando el movimiento como hace hoy `confirmRecurrenceInstance`
- [x] 3.3 Mutation de **vincular** sobre el RPC de 2.3, incluida la elegibilidad de las tres ramas de compartido. Verificar que un movimiento compartido con otro reparto no llega a ofrecerse y que el personal exige la confirmación
- [x] 3.4 Mutation de **desvincular** sobre el RPC de 2.6. Verificar que el camino feliz revierte la conversión y que el rechazo deja el estado intacto
- [x] 3.5 Resolver el mensaje del rechazo según el estado de la liquidación que bloquea: `completed` → revertir; `pending_receipt` propia → cancelar; `pending_receipt` ajena → lo cancela quien la registró; varias → decirlo. Verificar los cuatro casos con tests, y que ningún camino dice «revertir» sobre una pendiente
- [x] 3.6 Extender el modelo de vista de la fila (`review-surface.ts`) para que diga qué acciones ofrece un vencimiento según cómo se resolvió, en un solo lugar para las dos plataformas. Verificar que una ocurrencia resuelta por `created` no ofrece desvincular
- [x] 3.7 Exportar lo nuevo desde `packages/recurrences/src/index.ts` y verificar que `pnpm test` pasa en todo el monorepo

## 4. Web

- [x] 4.1 Acción «Ya lo pagué» en la fila de una regla cuyo próximo vencimiento no llegó (hub y detalle), reusando el formulario de registro con la fecha en hoy. **Corregido en revisión (18-09): la primera entrega disparaba sin formulario y sólo en el hub; el detalle y el formulario entraron en la segunda ronda.** Verificar a ancho de escritorio y **a ancho de teléfono**
- [x] 4.2 Superficie de candidatos con «Ampliar la búsqueda» siempre visible, la diferencia de importe como información y el orden por proximidad. Verificar que con la lista llena el control de ampliar sigue estando
- [x] 4.3 Confirmación explícita de la conversión a compartido, con el aviso previo cuando ya hay una liquidación vigente que cubre la fecha. Verificar que cancelar no convierte ni vincula
- [x] 4.4 Acción «Desvincular», con el mensaje del caso bloqueado que nombra la acción disponible según el estado de la liquidación. Verificar que el gasto sigue existiendo, que el vencimiento vuelve a «por revisar» en el camino feliz, y que en el bloqueado no cambia nada
- [x] 4.5 Rótulo «vinculado a esta recurrencia» en la ficha del movimiento (`tile-recurrence.tsx`), distinto del de origen. Verificar los dos casos
- [x] 4.6 Server actions en `app/_actions/recurrences.ts` como wrappers finos con auth, `revalidatePath` e invalidación. Verificar que `pnpm lint` y `pnpm typecheck` pasan

## 5. App nativa

- [x] 5.1 Acción «Ya lo pagué» en la fila del hub nativo (`RecurrenceRuleCard`) y en el detalle, con paridad de comportamiento con 4.1. **Corregido en revisión (18-09): la primera entrega sólo cubría el detalle; el hub entró en la segunda ronda.**
- [x] 5.1b Paridad del RECHAZO y del refresco en nativo, corregido en la tercera ronda (18-09): la tabla de mensajes pasó a `@grana/recurrences` (`linkErrorMessageKeys`) porque estaba copiada a mano en las dos apps y la copia nativa se había quedado atrás; y la invalidación de cache pasó a vivir dentro de los componentes nativos, con un helper que relee también saldos y movimientos. Cubierto por tests: la tabla de decisión y el catálogo en los dos idiomas, y el arnés nuevo de `apps/mobile`
- [x] 5.2 Superficie de candidatos como overlay, componiendo `FormSheetBody`/`FormSheetKeyboardView` según lo que lleve adentro — nunca un `ScrollView` a mano — y con el tope de altura en píxeles sobre el scroller. Verificar que el teclado no tapa el contenido
- [x] 5.3 Confirmación de la conversión a compartido y acción «Desvincular», con los mismos mensajes que 4.3 y 4.4
- [x] 5.4 Rótulo «vinculado» en el detalle del movimiento nativo (`apps/mobile/app/(app)/transactions/[txId]/index.tsx`), que hoy no muestra el vínculo con la recurrencia
- [x] 5.5 Mutators en `apps/mobile/lib/recurrences/mutators.ts` e invalidación de cache. Verificar que `pnpm typecheck:mobile` y `pnpm lint:mobile` pasan

## 6. Copys

- [x] 6.1 Claves de las tres acciones, la lista de candidatos, el rótulo «vinculado» y los mensajes del caso compartido en `es.json` **y** `en.json`. Verificar que ninguna superficie arma el nombre de una regla a mano en lugar de usar `recurrenceTitle`

## 7. Cierre

- [x] 7.1 Recorrer el circuito completo de punta a punta: vincular → convertir a compartido → liquidar → cancelar o revertir → desvincular, más pago anticipado y límite. Verificar que cada paso deja el estado que el spec describe
- [x] 7.2 Correr `pnpm verify` completo y dejarlo verde — **corrió de punta a punta en verde el 18-09, después de la segunda ronda de revisión (en la ronda anterior el registro de npm devolvía 503 y sólo se pudo correr eslabón por eslabón).**
- [x] 7.3 Corregido al aplicar (18-09): la migración se caía en el SQL Editor con `operator does not exist: transaction_type = text`. `transactions.type` es un tipo enumerado y `recurrences.movement_type` es texto; se compara llevando el enum a texto, en los candidatos y en el vínculo. El arnés de PGlite declaraba esa columna como texto, así que ningún test podía verlo: ahora declara los enums reales (`transaction_type`, `account_type`), reproduce el fallo sin el arreglo y lo cubre con él
- [x] 7.3 Aplicar los deltas a `openspec/specs/transactions/spec.md`, `openspec/specs/shared-recurrences/spec.md` y `openspec/specs/shared/spec.md`, mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-recurrence-link-movement/` y verificar con `pnpm openspec:check`
- [x] 7.4 Presentar `findings.md` al usuario y borrarlo según lo que decida — **presentados los 14 el 22-09.** Seis se arreglaron en la rama (#5, #10, #11, #12, y los dos que la revisión posterior encontró); cuatro se ticketearon: [#160](https://github.com/CristianPerez06/grana-v3/issues/160) (la cuenta corriente fecha las liquidaciones con el instante técnico), [#161](https://github.com/CristianPerez06/grana-v3/issues/161) (los otros tres caminos siguen diciendo «revertí»), [#162](https://github.com/CristianPerez06/grana-v3/issues/162) (la ficha anuncia como próximo un vencimiento posterior al que tiene sin resolver) y [#163](https://github.com/CristianPerez06/grana-v3/issues/163) («Vencimientos por revisar» con backlog grande); tres ya estaban resueltos al presentarlos; y el #14 —una pendiente con fecha futura que el código de hoy no puede producir— se cierra borrando la regla de prueba que la dejó. El archivo se borra al mergear: está gitignoreado a propósito (`AGENTS.md` § Talking to the user), no viaja en el PR
