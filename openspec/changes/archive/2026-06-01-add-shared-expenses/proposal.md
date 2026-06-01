## Why

Las parejas y convivientes que usan grana hoy registran gastos comunes (super, alquiler, servicios) cada uno por su lado, sin forma de saber quién pagó qué ni cuánto se deben entre sí. v2 resolvía esto con su módulo de Economía Familiar, pero quedó pendiente de portar a v3. El módulo **Compartido** trae esa capacidad reconstruida sobre las bases de v3 (contabilidad real, deuda derivada, bimoneda), no como un tracker paralelo tipo Splitwise sino integrado al ledger: un gasto compartido **es** una transacción real que impacta el saldo de quien pagó, y la deuda se deriva de los splits.

## What Changes

- **Vínculo entre dos personas ("hogar compartido").** Una persona crea un hogar e invita a otra con un código (válido 48 h). Modelado con tabla `household` + `household_member` (junction) para no cerrar la puerta a N participantes en el futuro, aunque la Fase 1 se limita a 2 miembros.
- **Gasto compartido = transacción real + splits.** Toggle "Compartir" en el form de gasto existente. El gasto impacta el `disponible` de quien pagó (transacción normal con `is_shared = true` + `household_id`); los splits por porcentaje se persisten en `shared_expense_split`. Soporta gastos cash/débito de una vez **y gastos de tarjeta en cuotas** (los splits viven en las cuotas hijas; las cuotas futuras no impactan la deuda hasta su vencimiento).
- **Deuda neta derivada, nunca persistida, por moneda.** Se calcula en cada lectura a partir de los splits menos las liquidaciones registradas. Separada por ARS/USD (nunca agregada).
- **Dashboard del hogar.** Balance derivado por moneda ("le debés a X" / "X te debe" / "están al día"), gastos compartidos recientes, acceso a saldar deuda.
- **Saldar deuda con handshake liviano.** Quien paga registra la liquidación (sale de su cuenta ya). A quien recibe le aparece "recibiste $X de Y, ¿en qué cuenta?" y al asignar cuenta se acredita en la suya. Ambas patas son movimientos de un tipo propio `settlement` (sin categoría, impactan el `disponible` pero no cuentan como gasto/ingreso categorizable). Sin aceptar/rechazar: corrección libre mientras está pendiente; revertir una liquidación ya completada usa una operación privilegiada (porque cruza la frontera de usuario).
- **Reintegro compartido (ambos subtipos).** Si un gasto compartido tiene un reintegro asociado (`reimbursement`, subtipo "a cuenta" o "en resumen"), el beneficio se reparte: el reintegro **hereda el split** del gasto origen (`is_shared` + `household_id` + filas en `shared_expense_split`) y **reduce la deuda por la parte del otro miembro**. Solo el reintegro **recibido** afecta la deuda (el pendiente no); el "en resumen" alinea su efecto con el período de tarjeta, como el consumo que reduce. Esto evita que quien recibe el reintegro se quede con el beneficio entero mientras el otro paga sobre el monto bruto.
- **RLS multi-usuario (nuevo en v3).** Hasta hoy todo es `user_id = auth.uid()`. Se introduce lectura cruzada acotada: un miembro puede **leer** las transacciones `is_shared = true` y los splits de su hogar, además de las cuentas del partner que necesita para seleccionar al liquidar.
- **Settings del hogar.** Nombre, split por defecto (ej. 50·50), invitar miembro, salir del hogar (bloqueado si hay deuda viva).
- **Fuera de alcance (fases futuras):** 3+ participantes, propuestas/negociación de split.

## Capabilities

### New Capabilities
- `shared`: Módulo Compartido. Vínculo de hogar entre dos personas, gastos compartidos con split por porcentaje (incluyendo cuotas), cálculo de deuda neta derivada por moneda, liquidación de deuda con handshake liviano, e invitaciones por código.

### Modified Capabilities
- `transactions`: Una `expense` (cash/débito o tarjeta en cuotas) puede marcarse como compartida, persistiendo splits asociados; las transacciones compartidas y sus splits son legibles por el otro miembro del hogar. Un `reimbursement` sobre un gasto compartido también es compartido (hereda split) y reduce la deuda al recibirse. La liquidación de deuda genera un `expense` (quien paga) y un `income` (quien recibe) reales.

## Impact

- **DB / migraciones:** nueva migración `0022` (nuevo valor de enum `transaction_type` = `settlement`; tablas `household`, `household_member`, `household_invite`, `shared_expense_split`, `settlement`; columnas `is_shared` + `household_id` en `transactions`; helper `is_household_member` `SECURITY DEFINER` y políticas RLS de lectura cruzada por hogar — primer caso de lectura cross-user en v3; función `SECURITY DEFINER` para revertir liquidaciones completadas).
- **`packages/money-logic/src/balance.ts`:** actualizar los guards exhaustivos para el tipo `settlement` (impacta `disponible`, se excluye de gasto/ingreso y de analytics por categoría).
- **`packages/money-logic`:** lógica pura nueva de cálculo de deuda neta por moneda y reparto de splits con `Money.split()` (reparto de residuo sin perder centavos), con exclusión de cuotas futuras.
- **`packages/validation`:** schemas Yup para crear hogar, unirse por código, gasto compartido (splits suman 100, mín. 1% c/u), liquidación.
- **`packages/i18n-messages`:** catálogo `shared` (es/en).
- **`apps/web`:** rutas `/shared` (dashboard, settings, saldar deuda, setup/invitación), toggle de split en el form de gasto, server actions en `app/_actions/shared.ts`.
- **`apps/mobile`:** paridad de feature (pantallas propias, lógica compartida vía packages).
- **Auth/RLS:** primer caso de lectura cruzada entre usuarios en v3; requiere diseño cuidadoso de políticas e índices.
