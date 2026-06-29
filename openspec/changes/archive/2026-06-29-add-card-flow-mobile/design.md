## Context

El alta de tarjeta vive entera como server action de web: `apps/web/app/_actions/credit-cards.ts → createCreditCard` valida con `createCreditCardSchema` (`@grana/validation`), corre un chequeo de sanidad de fechas (±40 días), deriva el nombre auto leyendo `card_networks` / `institutions`, e inserta `account` (`type=credit`) + `account_currencies` + 2 `card_periods` (P1 real, P2 estimado vía `suggestNextPeriodDates` de `@grana/money-logic`), con rollback manual del account ante fallo de los inserts dependientes.

`@grana/cards` hoy solo expone lecturas (`getCreditCards`, `getCreditCardDebtCheck`, `derivePeriodAlert`). Mobile `/cards` es un slice read-only; su header (`CardsHeader.tsx`) ya scaffoldea el CTA como `AddCardPlaceholder` permanentemente disabled, comentado explícitamente como "until /cards/new mobile exists".

Existe un patrón probado para exactamente este gap: **cuentas**. `@grana/accounts` expone mutaciones con un contrato neutral `AccountMutationResult`; el web action es un shell que traduce con `translatePostgresError` + `revalidatePath`; mobile (`apps/mobile/lib/accounts/mutations.ts`) es un shell que resuelve `userId`, inyecta `today`, llama la MISMA mutación, mapea el resultado neutral a un `ActionResult` nativo (`errorKey` como catalog path) e invalida query keys. La ruta `accounts/new.tsx` + `CreateAccountForm` cierran el círculo. Este change replica ese patrón para el alta de tarjeta.

## Goals / Non-Goals

**Goals:**
- Una única fuente de verdad para la creación de tarjeta: `createCreditCard` en `@grana/cards`, con contrato de resultado neutral (`CardMutationResult`).
- Web sin cambio de comportamiento observable: el server action adelgaza a shell sobre la mutación compartida.
- Alta de tarjeta funcional en mobile: ruta `/cards/new` nativa, `CreateCardForm` idiomático, CTA real en el header.
- Errores neutrales: el paquete nunca traduce; web resuelve con `next-intl`, mobile con `useT`.

**Non-Goals:**
- Paridad completa de cards en mobile: NO se construye detalle, edición, archivar/reactivar, pago de resumen ni registro de consumos/cuotas. Solo el alta.
- Extraer las demás mutaciones de tarjeta (`payCardPeriod`, `registerCardPurchase`, `registerInstallments`, etc.) a `@grana/cards`. Quedan como server actions de web hasta que un change futuro las necesite en mobile.
- Cambios de esquema de base de datos. Es puro movimiento de código + consumer nuevo.

## Decisions

### D1 — Option A (extraer a `@grana/cards`) sobre Option B (reimplementar en mobile)
La lógica de alta es una orquestación de 3 tablas con fechas derivadas, derivación de nombre y rollback — no un insert trivial. Reimplementarla en mobile (como se hizo con `createCustomInstitution`, que SÍ es un insert único) duplicaría lógica de negocio con riesgo real de drift. Extraer mantiene una sola fuente de verdad. La excepción `createCustomInstitution` confirma la regla: se reimplementa solo lo trivial.

### D2 — Contrato neutral `CardMutationResult`, espejo de `AccountMutationResult`
```ts
export type CardMutationResult<T = never> =
  | { ok: true; id?: string }
  | { ok: false; fieldErrors?: Partial<Record<keyof T, string>>; messageKey?: string; errorCode?: string }
```
Firma de la mutación idéntica al patrón de cuentas: `createCreditCard({ supabase, userId, input, today }): Promise<CardMutationResult<CreateCreditCardInput>>`. El paquete recibe el `supabase` client y el `today` por inyección (no los resuelve), para ser agnóstico de plataforma.

### D3 — Los `formError` literales de hoy pasan a `messageKey`
El action actual devuelve castellano pre-traducido (`'La fecha de cierre actual es demasiado antigua.'`, `'Error al crear la tarjeta.'`). El contrato neutral lo prohíbe. La mutación compartida devolverá `messageKey` (p.ej. `cards.errors.current_end_too_old`, `cards.errors.current_end_too_far`, `cards.errors.create_failed`) y ambos consumers agregan esas entradas a su catálogo con el mismo texto. Esto traslada el chequeo de sanidad ±40 días y la derivación de nombre **dentro** de la mutación, de modo que mobile hereda ambos sin reimplementar.

### D4 — Web shell conserva traducción + revalidación
El server action queda como:
```ts
const result = await createCreditCard({ supabase, userId, input, today: getTodayAR() })
if (!result.ok) return mapNeutralToActionResult(result) // messageKey→next-intl, errorCode→translatePostgresError
revalidatePath('/cards'); revalidatePath('/accounts')
return { ok: true, id: result.id }
```
`create-card-form.tsx`, `add-card-button.tsx` y `cards/new/page.tsx` no cambian de interfaz.

### D5 — Mobile: ruta `/cards/new` siguiendo `accounts/new`
`apps/mobile/app/(app)/cards.tsx` (archivo plano) se convierte en carpeta `cards/` con `index.tsx` (el contenido actual, ruta `/cards` intacta), `new.tsx` (gemela de `accounts/new.tsx`: carga catálogos con `useQuery`, renderiza `CreateCardForm`) y `_layout.tsx` (Stack `headerShown:false`, como cuentas). Las tabs nativas no cambian: `/cards` se sigue alcanzando desde Menú y `/cards/new` es una pantalla pusheada.

### D6 — `lib/cards/mutations.ts` + invalidación
Wrapper fino análogo a `lib/accounts/mutations.ts`: `requireUserId()`, llama `createCreditCard` de `@grana/cards`, mapea a `ActionResult` nativo (`{ ok:false, errorKey }`), e invalida el prefijo `['cards']` (cubre wallet, month-summary, networks, archived, count). Se añade un `invalidateAfterCardMutation(queryClient)` para encapsularlo.

### D7 — `CreateCardForm` nativo reusa primitivos existentes
Mismo nombre/props públicas que web. Reusa `BankSelector` (institución), `MoneyAmountInput` (límite), `Input`/pills para red XOR nombre custom, y un `DateField` nativo nuevo (cierre + vencimiento). Las monedas son **bimoneda fija (ARS+USD)** como en web (el form no expone selector de moneda). El design ref HTML se OMITIÓ por decisión del usuario: el `create-card-form.tsx` de web es el diseño canónico y mobile lo espeja idiomáticamente.

### D9 — Fix folded-in: ICU plurals en el translator mobile (descubierto en smoke test)
El header de grupo del wallet mostraba el ICU crudo (`{count, plural, …}`) porque `apps/mobile/lib/i18n.ts` solo hacía interpolación `{key}` simple. Bug pre-existente (no del alta) que afecta las 16 claves plural del catálogo. Se folded-in por decisión del usuario: se añadió a `translate`/`interpolate` un evaluador mínimo de `plural` (matcher de llaves balanceadas, match exacto `=N` primero, `#`→valor). **`Intl.PluralRules` NO existe en Hermes** (tira `Cannot read property 'prototype' of undefined`), así que la categoría CLDR se codifica a mano: es+en usan `one` iff n===1, else `other`. Web no se toca (next-intl ya resuelve ICU). Único archivo: `apps/mobile/lib/i18n.ts`.

### D8 — Date picker nativo (decisión tomada durante apply)
Mobile no tenía primitivo de fecha (ningún form nativo había pedido fechas al usuario). Se añade `@react-native-community/datetimepicker` (Expo-compatible, SDK 54) y un primitivo reusable `components/ui/DateField.tsx` que abre el picker nativo y emite `YYYY-MM-DD`. Elegido sobre un input enmascarado JS por UX (la fecha se lee del extracto y se elige en calendario) y porque también desbloquea el form de movimientos mobile pendiente. **Costo:** dependencia nativa → requiere `pod install` + dev build (no es JS-only OTA).

## Risks / Trade-offs

- **Migración literal→messageKey cambia la fuente del texto de error en web** → Mitigación: agregar las entradas de catálogo con el MISMO texto castellano que hoy; verificar visualmente el flujo de error en web tras el rewire.
- **Reestructura `cards.tsx`→carpeta puede romper navegación/deep-links** → Mitigación: `index.tsx` preserva el path `/cards` idéntico; smoke test de navegación desde Menú y del back desde `/cards/new`.
- **La mutación hace lecturas extra a Supabase (network/institution para el nombre)** → ya ocurría en el action; sin cambio de costo, solo de ubicación. La RLS de `card_networks`/`institutions` aplica igual con el client inyectado.
- **Drift de catálogos i18n entre web y mobile** → ambos consumen `@grana/i18n-messages`; las nuevas keys `cards.errors.*` se agregan una vez y se referencian por ambos.

## Migration Plan

Sin migración de datos. Orden seguro: (1) extraer mutación + tipos a `@grana/cards` con tests; (2) rewire web shell y verificar paridad de comportamiento; (3) construir consumer mobile. Rollback = revertir el commit; no hay estado persistido nuevo.

## Open Questions

- ¿Presentación del alta en mobile como ruta pusheada (elegida, paridad con `accounts/new`) o como bottom-sheet? Se asume ruta salvo que el design ref indique lo contrario.
- ¿El chequeo de sanidad ±40 días debería relajarse o ser configurable? Se mantiene tal cual al moverlo; cualquier cambio de regla es fuera de scope.
