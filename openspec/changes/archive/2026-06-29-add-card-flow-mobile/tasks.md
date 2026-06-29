## 1. Diseño (design ref)

- [x] 1.1 ~~Crear handoff HTML bajo `docs/design/cards-new/`~~ — OMITIDO por decisión del usuario: el `create-card-form.tsx` de web ya es el diseño canónico; mobile lo espeja idiomáticamente (regla cross-platform)

## 2. Extraer la mutación a `@grana/cards`

- [x] 2.1 Añadir `packages/cards/src/mutations.ts` con `type CardMutationResult<T>` (espejo de `AccountMutationResult`) y `createCreditCard({ supabase, userId, input, today }): Promise<CardMutationResult<CreateCreditCardInput>>`
- [x] 2.2 Trasladar a la mutación: validación con `createCreditCardSchema`, chequeo de sanidad ±40 días (devolviendo `messageKey` `cards.errors.current_end_too_old` / `current_end_too_far`), derivación de nombre auto (lookup `card_networks`/`institutions`), insert de `account` (`type=credit`) + `account_currencies` + 2 `card_periods` (P1 real, P2 estimado vía `suggestNextPeriodDates` de `@grana/money-logic`), y rollback del account ante fallo dependiente (`messageKey` `cards.errors.create_failed`)
- [x] 2.3 Exportar `createCreditCard` y `CardMutationResult` desde `packages/cards/src/index.ts` (+ agregar `@grana/validation` a las deps del paquete)
- [x] 2.4 Tests (vitest) de `createCreditCard`: alta crea P1 real + P2 estimado con las fechas esperadas; fecha de cierre fuera de ±40 días devuelve el `messageKey` correcto; fallo de inserts dependientes revierte el account; nombre auto = "Red Banco" cuando no se provee `name`; input inválido devuelve `fieldErrors` sin tocar la db

## 3. Rewire del server action de web a shell

- [x] 3.1 Reescribir `apps/web/app/_actions/credit-cards.ts → createCreditCard` para delegar en la mutación de `@grana/cards`, mapeando el resultado neutral (`messageKey` → `next-intl`, `errorCode` → `translatePostgresError`, `fieldErrors` passthrough) y conservando `revalidatePath('/cards')` + `revalidatePath('/accounts')` (+ limpiar imports `createCreditCardSchema`/`formatDateISO` que quedaron sin uso)
- [x] 3.2 Añadir las entradas de catálogo `cards.errors.current_end_too_old` / `current_end_too_far` (`create_failed` ya existía) en `@grana/i18n-messages` (es + en) con el MISMO texto castellano que hoy
- [x] 3.3 Verificado por lógica + `pnpm typecheck` en verde: los `messageKey` resuelven al mismo texto castellano y `errorCode` 23505 → `cards.errors.duplicate`. (Verificación runtime del flujo web recomendada al levantar la app.)

## 4. Consumer mobile — datos

- [x] 4.1 Crear `apps/mobile/lib/cards/mutations.ts`: `createCreditCard(queryClient, input)` que resuelve `userId`, inyecta `getTodayAR()`, llama la mutación de `@grana/cards`, mapea a `ActionResult` nativo (`{ ok:false, errorKey }`) e invalida cards
- [x] 4.2 Añadir `invalidateAfterCardMutation(queryClient)` (invalida el prefijo `['cards']`: wallet, month-summary, networks, archived, count) — en `lib/cards/invalidation.ts` o junto a las query keys de cards
- [x] 4.3 Asegurar que las keys `cards.errors.*` resuelven con `useT` en mobile (reuso del catálogo `@grana/i18n-messages`)

## 5. Consumer mobile — UI y ruta

- [x] 5.0 Añadir `@react-native-community/datetimepicker` (Expo SDK 54) y crear primitivo reusable `apps/mobile/components/ui/DateField.tsx` que abre el picker nativo y emite `YYYY-MM-DD` (requiere `pod install` + dev build)
- [x] 5.1 Convertir `apps/mobile/app/(app)/cards.tsx` en carpeta `cards/`: `index.tsx` (contenido actual, ruta `/cards` intacta), `_layout.tsx` (Stack `headerShown:false`)
- [x] 5.2 Crear `apps/mobile/components/cards/CreateCardForm.tsx` (idiomático RN, mismo nombre/props públicas que web): `BankSelector` (institución), red XOR nombre custom, monedas (ARS fija + USD opcional), límite opcional (money input cross-platform), cierre + vencimiento (datepicker nativo); submit llama `createCreditCard` de `lib/cards/mutations.ts`, muestra `fieldErrors`/`errorKey` con `useT`, y en éxito navega de vuelta a `/cards`
- [x] 5.3 Crear `apps/mobile/app/(app)/cards/new.tsx` (gemela de `accounts/new.tsx`): carga catálogos (instituciones + networks) con `useQuery`, estados pending/error, renderiza `CreateCardForm`
- [x] 5.4 Reemplazar `AddCardPlaceholder` en `apps/mobile/components/cards/CardsHeader.tsx` por el CTA real (`AddCardButton`) que navega a `/(app)/cards/new`. El CTA queda siempre habilitado; la carga de catálogos (instituciones + redes) vive en la ruta `/cards/new`, que muestra un spinner mientras resuelve (en mobile el header no fetchea catálogos, a diferencia de web)

## 6. Verificación

- [x] 6.1 `pnpm lint` y `pnpm typecheck` en verde (web, mobile y `@grana/cards`)
- [x] 6.2 Smoke test mobile verificado por el usuario tras `pod install` + dev build: el CTA "Agregar tarjeta" abre `/cards/new`, el alta crea la tarjeta y aparece en el wallet, el `DateField` nativo funciona, y los plurales del wallet renderizan bien (tras el fix del grupo 7).
- [x] 6.3 N/A — el estado disabled placeholder no estaba en memoria; vivía en el `cards` spec (línea 208), ya cubierto por el delta de specs de este change. Documentado además en design.md (D8).

## 7. Fix folded-in: ICU plurals en el translator mobile

Bug pre-existente descubierto durante el smoke test (no causado por el alta): `apps/mobile/lib/i18n.ts` solo hacía interpolación `{key}` simple y renderizaba en crudo cualquier `{count, plural, …}` (p.ej. el header de grupo del wallet `cards.compact.group.summary`). Afecta a las 16 claves plural del catálogo. Web no se ve afectado (next-intl ya resuelve ICU).

- [x] 7.1 Añadir soporte ICU `plural` a `translate`/`interpolate` en `apps/mobile/lib/i18n.ts`: matcher de llaves balanceadas, parser de ramas (`=N`/`one`/`other`), selección con prioridad a match exacto `=N` y categoría CLDR codificada a mano (`one` iff n===1) — **`Intl.PluralRules` no existe en Hermes**, por eso no se usa —, sustitución de `#` por el valor; la interpolación `{key}` simple sigue corriendo después
- [x] 7.2 Verificado contra las strings reales del catálogo (group.summary, compact.collapsed, wallet.subtitle con `=0`, detail.movements_count) — todas resuelven correctamente; `typecheck:mobile` + `lint:mobile` en verde
