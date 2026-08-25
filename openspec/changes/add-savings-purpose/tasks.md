# Tasks: add-savings-purpose

## 1. Migración y lectura normativa (D1, D2, D3, D4, D5, D6)

- [x] 1.1 `0058_savings_purpose.sql`: tabla `savings_purpose` (nombre, ícono, RLS por usuario), sin filas de sistema
- [x] 1.2 Índice único `(user_id, lower(btrim(name)))` y check de nombre no vacío
- [x] 1.3 `availability_reserve.purpose_id` nullable, **`ON DELETE SET NULL`**, sin backfill
- [x] 1.4 `get_purpose_sums(date)`: stock por (propósito, moneda), con el nombre y el ícono resueltos, incluyendo el grupo nulo y los grupos que suman cero
- [x] 1.5 Self-check `do $check$` que falla la migración si la regla de borrado deja de ser SET NULL
- [x] 1.6 Verificar que `get_available_sums` y `get_reserve_flow_sums` quedan **sin tocar**
- [x] 1.7 Tests PGlite sobre el SQL real: agrupación, grupo nulo, bimoneda, neteo de signos, grupo en cero, corte temporal, coincidencia con `get_available_sums`, borrado que preserva la plata, nombre duplicado, nombre vacío

## 2. El piso en el write path (D2, D10)

- [x] 2.1 `getPurposeSums` y `getReservedForPurpose` en `@grana/savings`
- [x] 2.2 `purpose_id` opcional y nullable en los schemas de guardar y volver a usar
- [x] 2.3 El piso de volver a usar pasa a ser el del (propósito, moneda); el tope de guardar NO cambia
- [x] 2.4 Verificación de pertenencia del propósito contra la base antes de insertar
- [x] 2.5 `savings.errors.exceeds_purpose_reserved`, que nombra el propósito y dice el monto
- [x] 2.6 Tests del write path: total que alcanza pero propósito que no, mensaje con nombre, «Sin destino» como grupo, propósito ajeno, guardar sin tope por propósito

## 3. Tipos generados

- [x] 3.1 `packages/supabase/src/types.ts`: `savings_purpose`, `purpose_id` y `get_purpose_sums`

## 4. El selector y el alta (D6, D7)

- [x] 4.1 Fila de propósito en el drawer de Guardar, con el propósito actual o *Sin destino*
- [x] 4.2 Pantalla de selección dentro del mismo drawer: propósitos del usuario con su monto, y las sugerencias que todavía no tiene
- [x] 4.3 Tocar una sugerencia crea el propósito **del usuario**, con el nombre precargado y editable en el momento
- [x] 4.4 Alta manual con nombre libre y selector de ícono
- [x] 4.5 El nombre duplicado se rechaza con un mensaje que dice cuál ya existe, no con un error genérico
- [x] 4.6 Sugerencias en `packages/i18n-messages` (es/en): Emergencia, Viaje, Auto, Casa, Estudio

## 5. El detalle agrupado (D3, D9)

- [x] 5.1 El detalle del guardado se agrupa por propósito, con el monto de cada grupo
- [x] 5.2 «Sin destino» aparece como un grupo más, al final
- [x] 5.3 Tocar un grupo abre sus acciones **heredando el propósito**: sin selector
- [x] 5.4 Abrir *Volver a usar* desde el total con más de un grupo con saldo pide primero de cuál sale, con los montos a la vista
- [x] 5.5 El historial de cada grupo, acotado igual que el de la fase 1
- [x] 5.6 ~~Asignar ⇄ desasignar tocando un movimiento del historial~~ — **reemplazado por 10.x**: atar el propósito a una fila puntual estaba mal (D11)

## 10. La corrección: repartir en vez de etiquetar (D11, D12, D13)

- [x] 10.1 `0059_purpose_allocation.sql`: tabla `savings_purpose_allocation`, y fuera `availability_reserve.purpose_id`
- [x] 10.2 «Sin destino» pasa a ser **el resto**, derivado en `get_purpose_sums`
- [x] 10.3 El invariante en un trigger, disparado desde **las dos** tablas
- [x] 10.4 `write_reserve`: la reserva y su reparto en una transacción, con el orden invertido según la dirección
- [x] 10.5 Self-check que impide reintroducir `purpose_id` en la reserva
- [x] 10.6 `allocateToPurpose` / `unallocateFromPurpose` en el paquete, con su piso y su copy
- [x] 10.7 Pantalla de **destinar / quitar destino** por monto (D14), en las dos superficies; el historial de guardados deja de ser tocable
- [x] 10.8 El historial de un grupo pasa a ser el de sus **repartos**; «Sin destino» no tiene historial propio
- [x] 10.10 El verbo es **Destinar**, no "Apartar": esa palabra ya significa *guardar* en el copy de la tira de sugerencia de la fase 1 (D14)
- [x] 10.9 Tests: 24 sobre el SQL real, incluidos los dos lados del trigger y la atomicidad de `write_reserve`

## 6. Editar y borrar (D4, D5)

- [x] 6.1 Renombrar y cambiar el ícono de un propósito
- [x] 6.2 Borrar avisa **cuánta plata se reasigna, por moneda**, y que vuelve a «Sin destino»
- [x] 6.3 Borrar un propósito vacío no necesita aviso

## 7. Mobile — paridad

- [x] 7.1 Selector y detalle agrupado en el `SavingsDrawer` nativo, como pantallas propias dentro del mismo sheet
- [x] 7.2 Naming espejo web↔mobile
- [x] 7.3 **No reformar las pantallas de la fase 1 que todavía no se probaron en dispositivo** (issue #58): las de la fase 2 se agregan al lado, para que un fallo en nativo se pueda atribuir a una fase o a la otra

## 8. Cierre

- [x] 8.1 Verificar que el dashboard no cambió: ningún número, ninguna fila nueva
- [x] 8.2 Sumar al issue #58 la sección de QA nativo de la fase 2 — quedó dividido en parte A (fase 1) y parte B (fase 2), con la indicación de correr A completa antes de B: es lo que hace atribuible un fallo a una fase o a la otra
- [x] 8.3 Actualizar `docs/modelo-de-dinero.md` si alguna decisión de esta fase corrige el documento — no hizo falta: la fase se implementó como el documento la describe, y las dos decisiones nuevas (D7 nombre único, D8 jerarquía diferida) son de implementación, no correcciones del modelo
- [x] 8.4 `pnpm openspec:check`, lint, typecheck (web y mobile) y tests en verde
- [ ] 8.5 **No archivar** hasta el QA nativo, y **no mergear** con la fase 1 y 2 solas: `feature/add-savings-set-aside` es la branch de integración del modelo y sube con las fases que lo completan. Una branch por fase se probó y se descartó: con merge squash a `main` todo colapsa en un commit igual, así que la branch extra no compraba nada y sí partía el trabajo en dos lugares

## 11. El eje de lectura (D16, D17)

- [x] 11.1 El detalle se organiza por propósito; cada fila muestra sus monedas sin sumarlas, y crece solo cuando el dato lo pide
- [x] 11.2 Los dos números de cabecera —guardado y para gastar— bimoneda, sin selector
- [x] 11.3 El selector de moneda baja a los formularios, donde determina el tope o el piso
- [x] 11.4 *Cómo se ve en tu banco* plegado: el puente, la nota y el neto del mes
- [x] 11.5 El historial plegado y bimoneda, en una sola consulta
- [x] 11.6 El neto del mes pierde el signo: el verbo ya lleva la dirección
- [x] 11.7 Paridad nativa

## 12. Menos pantallas por entidad (D18, D19, D20)

- [x] 12.1 Fuera «Guardar» de la vista de un propósito: cambia el total, no el grupo
- [x] 12.2 «Destinar más» pasa a botón principal y reemplaza al enlace que decía lo mismo
- [x] 12.3 Los propósitos, como chips dentro del formulario de guardar; el selector queda para crear
- [x] 12.4 La fecha, al control compacto con atajos Hoy / Ayer del alta de movimientos
- [x] 12.5 Paridad nativa
