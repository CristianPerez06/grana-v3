## 1. Capa de datos (sin N+1)

- [x] 1.1 En `getCreditCards()` (`apps/web/lib/cards/queries.ts`), derivar el **período en curso** por tarjeta (el `unpaidPeriod` con `start_date <= hoy <= end_date`, sin pago) usando los períodos + `amountByPeriod` ya cargados, y exponer `inProgressARS` / `inProgressUSD` en `CreditCardSummary` (0 si no hay período abierto o su saldo es 0).
- [x] 1.2 En `getCardsMonthSummary()`, agregar `inProgressARS` / `inProgressUSD` al tipo `CardsMonthSummary` y sumarlos sobre todas las tarjetas activas (incluidas las que también tienen un "a pagar"). Verificar que NO se solapan con `toPayARS/USD` (separación por `end_date`).
- [x] 1.3 Construir `nextCloses` desde el período en curso de cada tarjeta (`{ endDate, cardName }`, **sin monto**), capado en `NEXT_CLOSES_CAP` (6); incluye la tarjeta cuyo "a pagar" cerró pero su resumen siguiente sigue abierto.
- [x] 1.4 Actualizar el JSDoc de `getCardsMonthSummary` / `summarizeCardsMonth` para documentar las dos cifras y los próximos cierres.

## 2. UI web del hero

- [x] 2.1 Actualizar `CardsMonthHero` (web) para renderizar **dos cifras** a la izquierda — "A pagar (ahora)" y "En curso" (con caption "se sigue sumando hasta el cierre") — cada una en Bimoneda (ARS primario + USD subordinado, nunca sumados/convertidos), con jerarquía que subordine "En curso" a "A pagar".
- [x] 2.2 Empty-state: "A pagar" muestra `$ 0` cuando es cero (retirar el uso de `month_hero.empty` para esa cifra); "En curso" muestra `$ 0` cuando no hay resúmenes abiertos con saldo.
- [x] 2.3 "Próximos cierres": filas `fecha · nombre` (sin monto — el monto vive en el detalle de cada tarjeta), mostrando hasta `NEXT_CLOSES_CAP` (6).
- [x] 2.4 Responsive del hero (web): en viewports angostos las dos cifras y la lista de próximos cierres se apilan sin romper la jerarquía; verificar mobile-width del browser. (La app nativa mobile NO entra en este change.)

## 3. i18n

- [x] 3.1 Agregar las claves `cards.month_hero.*` para los rótulos "A pagar" y "En curso" + el caption "se sigue sumando hasta el cierre", en `es.json` y `en.json`.
- [x] 3.2 Retirar o re-purposear `cards.month_hero.empty` (ya no se usa para "A pagar"); confirmar que no queda referenciada.

## 4. Tests

- [x] 4.1 Tests de `getCardsMonthSummary` (lógica pura / helper en `lib/cards/`): caso con solo "a pagar", solo "en curso", ambos, y el caso clave de una tarjeta con **dos resúmenes vivos** (cerrado-impago + abierto) — verificar que cada monto cae en la cifra correcta sin doble conteo.
- [x] 4.2 Test del empty-state: sin cerrados-impagos → "A pagar" = `$ 0` (no texto); con abiertos con saldo → "En curso" > 0.

## 5. Verificación y cierre

- [x] 5.1 Correr `pnpm --filter web typecheck`, `lint` y `test`.
- [x] 5.2 Verificación funcional en `/cards`: dos cifras ("A pagar" + "En curso"), `$ 0` cuando no hay cerrados, próximos cierres sin monto (cap 6). Confirmado por el tech lead.
- [x] 5.3 Confirmar la open question pendiente del design con el tech lead (mobile en este change o follow-up) antes de cerrar.
- [x] 5.4 Archivar el change OpenSpec (sync del spec maestro) EN la branch, antes de mergear.
