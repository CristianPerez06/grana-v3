## 1. Migración: la tabla y las dos lecturas normativas (D0, D1, D2bis)

- [x] 1.1 Nueva migración `availability_reserve`: `id`, `user_id`, `currency_code`, `amount numeric` **con signo** (guardar positivo, liberar negativo), `date`, `created_at`. Sin ninguna columna de total: el stock se deriva, como todo saldo en Grana
- [x] 1.2 RLS por `user_id` en las cuatro operaciones, con el patrón que ya usan las tablas del repo
- [x] 1.3 CHECK `amount <> 0` y `currency_code` contra las monedas soportadas. **No** poner CHECK de signo: la tabla acepta las dos direcciones y es el write path el que valida el tope y el piso
- [x] 1.4 Índice por `(user_id, currency_code, date)` — es el predicado exacto de las dos funciones
- [x] 1.5 `get_available_sums(p_today date default null)` → `(currency_code, accounts_net, reserved, available)`. **Compone sobre** `get_owned_account_ids()` y `get_account_balance_sums`, no los reemplaza ni los duplica. `p_today` default `null` = fecha financiera AR del usuario, nunca `now()` del servidor
- [x] 1.6 `get_reserve_flow_sums(p_from date, p_to date)` → `(currency_code, reserved_net)`, el neto del rango (guardado menos liberado)
- [x] 1.7 Las dos funciones filtran por `date <= p_today` / `date between p_from and p_to`: una reserva futura no participa (corte temporal, igual que el resto)
- [x] 1.8 Las dos devuelven **fila por moneda con valor cero** cuando el usuario no tiene reservas en esa moneda, en vez de omitirla — si no, cada consumidor tiene que inventar el default
- [x] 1.9 Comentario en la migración explicando por qué el disponible vive acá y no en TS, con el precedente de `0051` (el criterio de "cuenta propia" ya había divergido entre call sites)

## 2. `packages/savings/` (nuevo)

- [x] 2.1 Crear el paquete con la forma de `packages/accounts/`: `queries.ts`, `mutations.ts`, `types.ts`, `index.ts`. Se llama `savings` porque es el lenguaje del producto y porque fases 2 y 4 aterrizan adentro; la tabla se llama `availability_reserve` porque es lo que registra
- [x] 2.2 `getAvailableSums(today?)` — wrapper de la RPC. **No** recompone la resta ni la re-expone en pedazos que inviten a recomponerla
- [x] 2.3 `getReserveFlowSums(from, to)` — wrapper de la RPC del flujo
- [x] 2.4 `getReserveHistory()` — filas con fecha, monto con signo y moneda, con orden determinístico (`date desc, created_at desc, id desc`) para la vista de detalle
- [x] 2.5 `reserveAvailability({ amount, currencyCode, date })` — valida contra `available` de la moneda **leído en el momento de la mutación**, no contra un valor que venga del cliente
- [x] 2.6 `releaseAvailability({ amount, currencyCode, date })` — valida contra `reserved` de la moneda. El stock no puede quedar negativo: sería afirmar que el usuario puede gastar plata que no tiene
- [x] 2.7 Los montos viajan y se comparan como `Money` (decimal.js), nunca como `number` crudo
- [x] 2.8 Tests de las dos mutaciones: tope exacto (guardar todo el disponible pasa; un centavo más no), piso exacto de liberar, moneda cruzada (guardado en ARS no habilita liberar en USD), monto cero y negativo rechazados

## 3. `packages/validation/`

- [x] 3.1 `packages/validation/src/savings.ts` con `reserveAvailabilitySchema` y `releaseAvailabilitySchema`: monto > 0, moneda soportada, fecha válida
- [x] 3.2 El schema **no** valida el tope: el tope depende del estado del servidor y vive en la mutación. El schema valida la forma
- [x] 3.3 Exportar desde `packages/validation/src/index.ts` y agregar los mensajes de error traducidos

## 4. `packages/dashboard/` — consume, no recompone (D2bis, D7, D8)

- [x] 4.1 El hero del dashboard toma `available` de `get_available_sums` **solo cuando el mes seleccionado es el corriente**; en un mes pasado sigue leyendo el saldo al cierre como hoy
- [x] 4.2 Agregar el neto reservado del mes leyendo `get_reserve_flow_sums(inicio, fin)`. **Ningún resto ni suma en TS**
- [x] 4.3 `month-opening.ts`: cuando la card muestra el disponible, `Tenías` se deriva como `Disponible − (Entró − Se fué − Guardaste)`. Es la misma pieza cumpliendo la misma función — cerrar contra el número de arriba — con un término más
- [x] 4.4 **No tocar** `calculateTransactionSums` ni la derivación de `Entró`/`Se fué`: guardar no es un movimiento y el invariante de liquidez (`Entró − Se fué === cambio del saldo de cuentas`) tiene que seguir valiendo intacto
- [x] 4.5 Extender los tipos de `types.ts` con el neto reservado por moneda, marcándolo como opcional/ausente para los meses pasados
- [x] 4.6 Test de reconciliación: `Tenías + Entró − Se fué − Guardaste === Disponible` al centavo, con aritmética exacta y sin tolerancia. Casos: guardado positivo, neto negativo (liberó más de lo que guardó), neto cero, y las dos monedas
- [x] 4.7 Test de que el invariante viejo sigue valiendo en meses pasados: `Tenías + Entró − Se fué === saldo al cierre`

## 5. Web — drawer, línea del dashboard y detalle (D4, D7, D9, D10)

- [ ] 5.1 `apps/web/app/_actions/savings.ts`: server actions sobre `@grana/savings`, con `validate-action-input` y el manejo de error del repo
- [ ] 5.2 `apps/web/lib/savings/components/save-money-drawer.tsx` sobre `overlay-primitives`. Monto con `MoneyAmountInput` (nunca `<input type="number">`)
- [ ] 5.3 El drawer muestra el cálculo **del momento**: disponible actual → monto a guardar → remanente. **No** lo calcula contra el ingreso que lo abrió: la reserva es fungible y no pertenece a ningún movimiento
- [ ] 5.4 Contexto de origen: viniendo de un ingreso hereda la moneda, prellena con el porcentaje y **no** pide fecha. Suelto, ofrece moneda solo si el usuario tiene saldo en más de una, y fecha con hoy por defecto
- [ ] 5.5 El copy no sugiere en ningún lado que hubo una transferencia
- [ ] 5.6 Línea *Guardaste este mes* en la zona clara de la card de saldo: **debajo de una regla**, a lo ancho, rótulo izquierda / monto derecha, con signo menos y en **emerald** (el terracota está reservado para por pagar y vencido)
- [ ] 5.7 La línea se renderiza solo si el mes seleccionado es el corriente **y** el neto es distinto de cero. En cualquier otro caso la zona queda exactamente como estaba, sin regla
- [ ] 5.8 La línea respeta el eye toggle, incluido el signo: un menos suelto al lado de los puntos filtra la dirección que la máscara oculta
- [ ] 5.9 `savings-detail-drawer.tsx`: total guardado por moneda (stock), neto del mes (flujo) e historial con fecha, más las acciones Guardar y Liberar. Se llega **tocando el monto**, como al detalle de un resumen de tarjeta
- [ ] 5.10 **No** agregar entrada de navegación

## 6. Mobile — paridad

- [ ] 6.1 `apps/mobile/components/savings/SaveMoneySheet.tsx` sobre `FormSheetBody` (tiene input)
- [ ] 6.2 `apps/mobile/components/savings/SavingsDetailSheet.tsx`
- [ ] 6.3 `apps/mobile/lib/savings/{queries,mutations}.ts` sobre `@grana/savings`
- [ ] 6.4 La línea del dashboard en nativo, con la composición apilada que ya usa la zona clara
- [ ] 6.5 Naming espejo web↔mobile según la convención del dashboard

## 7. La sugerencia al ingreso, sobre `guidance` (D5, D6)

- [ ] 7.1 Registrar el evento en el catálogo de `guidance`, de modo que visto / descartado / completado queden por usuario y la tira deje de aparecer si el usuario la descarta
- [ ] 7.2 La tira se ofrece después de registrar un `income` **por cualquier camino** —alta manual o confirmación de una instancia recurrente— y como máximo **una vez por mes calendario**. Un `reimbursement` no la dispara
- [ ] 7.3 El monto sugerido sale del **porcentaje** de la vez anterior, derivado del historial; la primera vez es 10%. Sin pantalla de configuración
- [ ] 7.4 El copy formula una propuesta de comportamiento, no una recomendación financiera: el monto es *sugerido*, no la cifra que Grana aconseja
- [ ] 7.5 Test de la regla de frecuencia: dos ingresos en el mismo mes ofrecen la tira una sola vez

## 8. Copy e i18n

- [ ] 8.1 `packages/i18n-messages`: Guardar, Liberar, Guardado, *Guardaste este mes*, el copy del drawer, el de la sugerencia, y los errores de tope y de piso
- [ ] 8.2 Los errores dicen el número: *"Tenés $300.000 disponibles"*, no *"monto inválido"*
- [ ] 8.3 Cambiar `accounts.labels.balance` de "Saldo" a **"Saldo en esta cuenta"** (y su par en inglés). Es el único cambio fuera de `savings` y `dashboard`, y es copy: después de esta fase el número del dashboard deja de significar lo mismo que el de la cuenta, y dos rótulos iguales para dos cosas distintas es la confusión que la fase viene a evitar. Verificar que entra en el hero del detalle de cuenta en ancho de teléfono sin cortarse

## 9. Cierre

- [ ] 9.1 Aviso no bloqueante cuando un gasto lleva el disponible por debajo de cero, con el patrón que ya existe. **No** reducir el guardado para que el número cierre
- [ ] 9.2 Verificar que Movimientos no muestra nada nuevo y que ningún saldo de cuenta cambió: guardar no es un hecho del ledger
- [ ] 9.3 Actualizar la tabla de módulos de `AGENTS.md`: módulo 16 `savings` pasa de 🔲 Planned a ✅ Done con el alcance real de la fase 1 (guardar/liberar y disponible real; propósitos y posiciones siguen pendientes)
- [ ] 9.4 `pnpm openspec:check`, lint, typecheck y tests en verde
