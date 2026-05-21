## 1. Borrar el componente UI huérfano

- [x] 1.1 Borrar el archivo `apps/web/app/(app)/cards/[id]/periods/[periodId]/_components/reverse-payment-dialog.tsx`.
- [x] 1.2 Verificar con grep que no quedaron imports rotos a `ReversePaymentDialog` o al path del archivo.

## 2. Borrar el server action

- [x] 2.1 Borrar la función `reverseCardPayment` y su sección de comentarios en `apps/web/app/_actions/credit-cards.ts` (sección "── 4.6: reverseCardPayment ──").
- [x] 2.2 Verificar con grep que no queda ningún caller a `reverseCardPayment` en el código (excluyendo el archivo del change y el archive de openspec).

## 3. Validar el repo después de la limpieza

- [x] 3.1 `pnpm --filter web exec tsc --noEmit` — type-check sin nuevos errores.
- [x] 3.2 `pnpm --filter web lint` — sin nuevos warnings/errores.

## 4. Validación spec + archivo

- [x] 4.1 `openspec validate remove-reverse-card-payment --strict` y resolver issues si los hubiera.
- [x] 4.2 Archivar el change con `openspec-archive-change` una vez aceptado, lo que aplica los deltas al spec activo.
