## 1. Read-path: queries y types

- [x] 1.1 Agregar `name` al embed de institución en `getCreditCards()` (`apps/web/lib/cards/queries.ts`): `institution:institutions(name, brand_color, icon_type)`.
- [x] 1.2 Exponer el nombre del banco en `CreditCardSummary` (campo `institution_name: string | null` o `name` dentro del objeto `institution`).
- [x] 1.3 Derivar y exponer `inUse: boolean` en `CreditCardSummary` (`activePeriod.tx_count > 0 || activeInstallmentsCount > 0`).
- [x] 1.4 Reflejar los mismos cambios en el gemelo mobile de `lib/cards/queries` (tipos + embed) y verificar que `getCardsMonthSummary` queda sin cambios (ya expone `nextDue` + `upcoming`).
- [x] 1.5 Regenerar/ajustar tipos de Supabase si hiciera falta y correr el typecheck del paquete de queries.
- [x] 1.6 Agregar `nextCloses` a `CardsMonthSummary` (web + mobile): lista de **una tarjeta por fila** (`{ endDate, cardName }`), ordenada por fecha de cierre (`end_date >= today`), capada en 3. Es fecha de cierre, no de vencimiento.

## 2. Lógica pura compartible (`lib/cards/`)

- [x] 2.1 Helper `groupCardsByBank(cards)`: agrupa por `institution_name`, con grupo fallback "Sin banco" siempre último; cada grupo expone nombre, color del banco, count, `inUse` count, total a pagar ARS/USD y próximo vencimiento.
- [x] 2.2 Orden: grupos por su vencimiento más urgente; filas dentro del grupo por vencimiento ascendente. Modo "Todas" (plano) ordenado por vencimiento ascendente con sin-ciclo al final.
- [x] 2.3 Badge de urgencia del grupo: derivar el peor estado del grupo (rojo > ámbar > neutro) desde `pillTone`/alert de cada tarjeta.
- [x] 2.4 Regla de auto-colapso: un grupo arranca colapsado solo si todas sus tarjetas están al día (alert `none`) y en $0 (ARS y USD); expandido si alguna tiene alert ≠ none o saldo > 0.
- [x] 2.5 Helper de uso del resumen: `min(100, round(pendingARS / credit_limit * 100))`, o `null` (→ "—") cuando `credit_limit` es null.
- [x] 2.6 Filtros: `Por banco` (default), `Todas`, `En uso` (por `inUse`), `Vencen pronto` (alert ≠ none), `Con saldo` (ARS>0 o USD>0). Tests unitarios de cada helper.

## 3. i18n

- [x] 3.1 Agregar claves de filtros (`cards.compact.filters.*`), estado de fila, encabezado de grupo ("N tarjetas · M en uso", total a pagar), "Sin banco", "uso"/"uso —", y copy del cuerpo colapsado, en `packages/i18n-messages` (es + en).

## 4. Web: vista compacta

- [x] 4.1 Rediseñar el hero `cards-month-hero.tsx` a card **navy** a 2 columnas (`bg-surface-dark text-white`, patrón del hero del dashboard): izquierda A pagar ARS/USD; derecha **Próximos cierres** (una tarjeta por fila `fecha · nombre`, capada en 3) vía `summary.nextCloses`. Skeleton actualizado a navy 2-col.
- [x] 4.2 Crear los controles de vista con el primitivo `Segmented` (`Por banco` / `Todas` / `En uso` / `Vencen pronto` / `Con saldo`) con estado runtime.
- [x] 4.3 Componente de grupo de banco desplegable (`BankGroupCard`): encabezado (chevron `lucide-react`, dot, nombre, count, "M en uso", total a pagar, badge de urgencia) + cuerpo colapsable; estado inicial desde la regla de auto-colapso (2.4).
- [x] 4.4 Fila de tarjeta de 2 líneas (`CompactCardRow`, fila un poco más alta): fila 1 (monograma de red + nombre | monto resumen bimoneda apilada | `CardStatusPill`); fila 2 (tres `DateStat` apilados **CIERRE / VENCE / USO**, con Uso = % del resumen o **"Sin límite"**). Reutiliza `cardAccent`, `cardMonogram`, `formatDayMonth`.
- [x] 4.5 Reemplazar `wallet.tsx` + `wallet-card.tsx` por `cards-compact-view.tsx`; mantenido el nombre público `Wallet`. Empty state intacto. `wallet-skeleton.tsx` actualizado a la forma compacta.
- [x] 4.6 Bimoneda apilada (USD subordinado); montos `tabular-nums`; $0 en `text-text-soft`; no se ocultan negativos/clamped. Click en fila → `/cards/[id]`.
- [x] 4.7 Sección "Archivadas" y CTA "Agregar tarjeta" intactos (sin tocar).

## 5. Mobile: lista densa equivalente

- [x] 5.1 Cableado `networkNames` en `cards.tsx` (nueva query `getCardNetworks` mobile + `['cards','networks']`) y pasado a `Wallet`.
- [x] 5.2 `CardsMonthHero` mobile rediseñado a card **navy** (`bg-navy`, patrón del hero del dashboard): A pagar + **Próximos cierres** (una tarjeta por fila, capada en 3) vía `summary.nextCloses`, apilado, respetando el eye-mask.
- [x] 5.3 Controles de vista con el primitivo `Segmented` mobile, estado runtime.
- [x] 5.4 Grupo de banco desplegable mobile (`BankGroupMobile`, `Pressable` + `useState`; sin `<details>`), encabezado con badge de urgencia + estado inicial por auto-colapso.
- [x] 5.5 Fila de 2 líneas (`CompactRowMobile`, un poco más alta): identidad + monto bimoneda + dot de estado; tres `MDateStat` apilados **CIERRE / VENCE / USO** (Uso = % o "Sin límite"). Respeta el eye-mask. Reemplaza `CreditCardItem` (eliminado).
- [x] 5.6 `Wallet.tsx` mobile reescrito (carrusel → lista densa agrupada); tap en fila → `/cards/[id]`.

## 6. QA y cierre

- [x] 6.1 Casos borde cubiertos por tests unitarios del helper (sin banco, sin límite → "—", bimoneda/`cardHasBalance`, vencido = tono `due` y grupo no colapsa, 100% al día/$0 = auto-colapsa) — 14 tests verdes.
- [x] 6.2 Paridad semántica web/mobile garantizada por el helper puro espejado (`grouping.ts` idéntico) + mismos filtros/orden/colapso; sin JSX compartido.
- [x] 6.3 Typecheck (0 errores web + mobile) y lint limpios; vista cotejada contra `docs/mockups/cards-compact-final.png` a nivel de composición. PENDIENTE: QA visual en la app corriendo (tech lead, según norma del repo).
- [x] 6.4 `openspec validate` OK. El sync del spec maestro `openspec/specs/cards/spec.md` se hace al archivar (no en la branch de implementación).
- [x] 6.5 Polish relacionado: migración `0032_abbreviate_amex_network.sql` (red "American Express" → "Amex" en `card_networks`, label + autogen futuro) + `0033_rename_amex_card_accounts.sql` (rename de los nombres ya guardados en `accounts.name` de tarjetas existentes).
