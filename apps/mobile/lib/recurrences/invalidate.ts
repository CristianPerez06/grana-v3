import type { QueryClient } from '@tanstack/react-query'

// Cache invalidation for recurrence mutations — the mobile twin of web's
// `revalidateAfterRecurrenceMutation`. Lifecycle changes (pause/resume/delete,
// skip, accept/dismiss) shift the hub and the feed's pending block, both keyed
// under `['recurrences']`. TanStack matches by prefix.
export function invalidateAfterRecurrenceMutation(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['recurrences'] })
}

// RESOLVER UN VENCIMIENTO TOCA LA PLATA, no sólo la recurrencia. Confirmar,
// registrar por anticipado y vincular dejan un movimiento colgado de la
// ocurrencia; desvincular lo suelta y —si la vinculación lo había convertido en
// compartido— mueve la deuda del hogar. Todo eso corre el saldo de la cuenta, el
// feed de movimientos, los agregados del dashboard y el resumen de la tarjeta.
//
// Se llama «resolution» y no «confirm» porque el nombre viejo describía UN camino
// de los cuatro, y los tres que llegaron después se colgaron del helper angosto:
// el hub nativo seguía mostrando el saldo y los movimientos de antes después de
// registrar un pago. El gemelo en web es `revalidateAfterRecurrenceMutation` +
// `revalidateAfterMovementMutation`, que las server actions llaman siempre juntos.
export function invalidateAfterRecurrenceResolution(queryClient: QueryClient): void {
  for (const key of [['recurrences'], ['transactions'], ['dashboard'], ['accounts'], ['cards']]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}
