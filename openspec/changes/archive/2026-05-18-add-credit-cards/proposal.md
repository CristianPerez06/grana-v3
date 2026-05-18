## Why

Las tarjetas de crédito son el diferencial de Grana en el mercado argentino. Los usuarios viven con cuotas sin interés como modo de compra dominante y necesitan ver con claridad cuánto deben, cuándo cierra cada resumen y cuándo lo tienen que pagar — sin que esa deuda contamine su saldo disponible. Hoy v3 todavía no modela este tipo de cuenta: `accounts.type` solo acepta `cash` y `bank`, y `transactions` no contempla cuotas ni estados de pago. Sin tarjetas, el módulo `transactions` recién archivado queda incompleto para el caso de uso central del producto.

## What Changes

- Extender el tipo de cuenta para aceptar tarjetas de crédito, con sus datos propios (banco, red, límite, monedas) y la invariante de que **no descuentan saldo disponible** hasta que se paga el resumen.
- Introducir el concepto de **resumen / período de tarjeta** con cuatro fechas (start, end, due, paid_at derivado) y un rolling automático que garantiza siempre dos resúmenes vivos por delante.
- Soportar **registrar consumos en tarjeta** (1 cuota o N cuotas sin interés, ARS y USD), con asignación automática al resumen correspondiente.
- Soportar **pago de resumen** como operación atómica reversible: registra el gasto en la cuenta de pago, marca el resumen como pagado, marca las cuotas que cayeron en ese resumen como pagas, y crea el siguiente período con fechas sugeridas por promedio histórico.
- Soportar **mora visible** desde V1: cuando un resumen vence sin pago, la card del listado se marca en rojo con "Vencido hace N días".
- Adaptar **el onboarding del modo novato** para que auto-cree "Mi plata" (cash) + una tarjeta default cargando una sola fecha ("¿cuándo cierra tu actual resumen?"). El resto de las fechas se estiman y la app las confirma cuando el usuario paga el primer resumen.
- El **módulo Tarjetas es idéntico en ambos modos** (novato y experto). Es el diferencial de Grana y no se recorta para el novato; lo único que el novato no ve es el módulo Cuentas.
- Quedan **fuera de scope V1** (anchors registrados para futuro): intereses (punitorios y financieros), pago mínimo/parcial, pago bimoneda del resumen, reabrir período pagado, importación automática de fechas, cierre manual anticipado.

## Capabilities

### New Capabilities

- `cards`: Modela tarjetas de crédito como tipo de cuenta, sus resúmenes (períodos), el rolling automático de fechas, las alertas de vencimiento y mora, y la sección "Tarjetas" de la app (listado, detalle, historial de resúmenes, edición de fechas, archivado con regla R-tarjeta).
- `card-networks`: Catálogo seed de redes de tarjeta (Visa, Mastercard, Amex, Cabal, Naranja, Naranja X, Mercado Pago) con metadata de marca (color, ícono) para uso compartido entre tarjetas.

### Modified Capabilities

- `accounts`: Extender `type` para aceptar `credit`. Agregar campos exclusivos de tarjeta (`credit_limit`, `network_id` XOR `other_network_name`) con sus constraints. Definir el invariante "tarjeta no descuenta disponible" y las reglas de archivado bloqueado por deuda pendiente.
- `transactions`: Soportar consumos en tarjeta (`status` pending/paid, `due_date`, `card_period_id`, `fx_rate_to_ars`). Soportar cuotas (madre/hija vía `is_parent`, `parent_id`, `installment_n`, `installments_total`). Definir las reglas de pago de resumen y reversión.
- `auth`: El onboarding novato auto-crea "Mi plata" (cuenta cash) y una tarjeta default "Mi tarjeta" a partir de una sola fecha cargada por el usuario. El onboarding experto sigue sin cambios.
- `project-conventions`: Agregar los invariantes I-CRED-* al contrato del motor contable.

## Impact

- **Schema**: nuevas columnas en `accounts` y `transactions`; nuevas tablas `card_networks`, `card_periods`, `period_payments`. Migración seed para `card_networks`. Sin migración de datos legacy (v3 es greenfield).
- **Backend**: nuevas server actions (`createCreditCard`, `registerCardPurchase`, `registerInstallments`, `payCardPeriod`, `reverseCardPayment`, `updatePeriodDates`, `deactivateCreditCardAccount`) y queries (`getCreditCards`, `getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `suggestNextPeriodDates`). RLS heredada de `accounts`/`transactions`; nuevas policies para `card_periods` y `period_payments` por join con la cuenta padre.
- **Frontend**: nuevas pantallas (listado de tarjetas con carrusel, detalle de tarjeta, historial de resúmenes, detalle de período, pago de resumen, alta y edición de tarjeta, edición de fechas). Componentes portados/refinados desde v2.
- **Onboarding novato**: nuevo paso de "fecha de cierre actual" y auto-creación de entidades default. El flujo experto queda sin cambios.
- **Helpers contables**: `getTodayAR()`, tipo `Money`, ordering determinístico (`date ASC, created_at ASC, id ASC`) — todos ya existentes, se reutilizan.
- **Dependencias previas**: `accounts` y `transactions` (ya done). Este change los extiende.
- **Dependencias posteriores**: el dashboard novato (sección "Tarjeta a pagar"), el dashboard experto, y eventualmente los módulos `shared` y `savings` consumirán las nuevas APIs sin requerir cambios contractuales adicionales aquí.
