## REMOVED Requirements

### Requirement: El usuario puede revertir un pago de resumen

**Reason**: Decisión de UX vigente — los pagos de resumen son irreversibles. El usuario está advertido al confirmar el pago (copy actual en `pay-card-period-form.tsx`: *"Una vez confirmado, el pago no se puede revertir. Si registraste un monto o cuenta incorrectos, podés corregirlo con un ajuste de saldo."*). El requirement original quedó implementado en código (`reverseCardPayment` + `ReversePaymentDialog`) pero nunca se expuso al usuario, generando código muerto y contradicción spec/UX.

**Migration**: Para corregir un pago de resumen erróneo, el usuario debe registrar un `adjustment` en la cuenta cash/bank desde la que pagó:

- Si pagó **de más**: adjustment `increase` por la diferencia.
- Si pagó **de menos**: adjustment `decrease` por la diferencia.
- Si pagó **con la cuenta equivocada**: dos adjustments — uno `increase` en la cuenta original equivocada, otro `decrease` en la cuenta correcta (o usar la operación `transfer` entre ambas).

Las cuotas del resumen no se reabren — quedan en `paid` como reflejo histórico de que el resumen sí se canceló (aunque con monto/cuenta corregidos por el adjustment).
