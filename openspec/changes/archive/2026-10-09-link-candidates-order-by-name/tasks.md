## 1. Base de datos

- [x] 1.1 Escribir `supabase/migrations/0077_link_candidates_order_by_name.sql` (confirmar que la última en `main` sigue siendo 0075 y que 0076 es de esta rama): `recurrence_movement_linkable` excluye el sello de un pago anterior al vínculo; `recurrence_link_candidates` ordena por coincidencia de nombre, importe, fecha e id; autochequeo. Verificar con 1.3.
- [x] 1.2 Arnés PGlite: `transactions.card_period_id` y `period_payments.stamp_tax_link_known` (default `true`), y aplicación de 0077. Verificar que los tests existentes siguen en verde.
- [x] 1.3 Tests: el sello viejo no se ofrece ni se vincula (GRN19); un sello cargado a mano en una cuenta sí se ofrece; el orden pone primero la coincidencia por descripción (sin distinguir mayúsculas ni acentos) y, en una regla sin descripción, por subcategoría o categoría; la cuenta no ordena. Actualizar el orden esperado en `link-candidates-read.test.ts` y el título del test de orden en `link-movement-rpc.test.ts`.

## 2. Verificación

- [x] 2.1 `pnpm verify` en verde.
- [ ] 2.2 Pegar 0077 en el SQL Editor (paso manual del usuario) y repetir el QA de la lista: «Impuesto de sellos · Visa Galicia · 20 jun» ya no aparece, y lo que coincide por nombre va primero.
