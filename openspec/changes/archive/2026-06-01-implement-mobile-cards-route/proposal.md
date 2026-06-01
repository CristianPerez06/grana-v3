## Why

El módulo `/cards` ya existe en web con su layout final (header + hero del mes + wallet + archivadas, cada sección aislada con su propio fallback). En mobile, la pantalla `/cards` está como stub: solo renderiza un carousel de tarjetas. Falta llevar el resto del módulo a paridad para que el usuario tenga la misma experiencia desde mobile (a pagar este mes, próximos vencimientos, archivadas), siguiendo el patrón de chrome-siempre-visible ya codificado en el spec `cards` y en `route-loading-and-errors`.

## What Changes

- **Pantalla `/cards` mobile** pasa a tener cuatro zonas (de arriba a abajo): `CardsHeader` (PageHeader con título, subtítulo con count, CTA "Agregar tarjeta" en estado disabled placeholder), `CardsMonthHero` (single-column), `Wallet` (carrusel — implementación mobile del concepto wallet), y `ArchivedCardsSection` (fila colapsable, oculta cuando N=0).
- **Cada sección mobile fetcha su propia data con react-query** y muestra un `SectionFallback`-equivalente mientras carga o si falla, para que un error en una sección no tire la ruta ni esconda el header (misma filosofía que web `/cards`, expresada vía react-query en lugar de `<Suspense>` + Server Components).
- **CTA "Agregar tarjeta" en mobile renderiza disabled** en este change. Va a habilitarse cuando aterrice `/cards/new` mobile (fuera de scope). El placeholder visual respeta la presencia del CTA en el header sin abrir un flujo a medio hacer.
- **Rename cross-platform a `Wallet`**: mobile `CreditCardCarousel` → `Wallet`; web `WalletGrid` → `Wallet`, `WalletGridSection` → `WalletSection`, `WalletGridContainer` → `WalletContainer`. El nombre público pasa a ser el mismo en ambas plataformas; la implementación interna sigue siendo grid (web) o carrusel (mobile), siguiendo `project-conventions` (cross-platform components: mismos nombres, distintas implementaciones).
- **Nueva query mobile `getCardsMonthSummary()`** en `apps/mobile/lib/cards/queries.ts`, espejando la forma del web (`toPayARS`, `toPayUSD`, `hasUSD`, `hasToPay`, `nextDue`, `upcoming[]`). La query queda en `lib/` del app por convención repo ("Supabase queries stay in each app's lib/").
- **Sin diseño Paper para mobile**: este change traduce el web a idiomas mobile (PageHeader custom, FlatList horizontal en lugar de grid 2-col, Pressable+state en lugar de `<details>`). La ausencia de design refs es deliberada y no un gap.

Fuera de scope: `/cards/new`, `/cards/[id]` y cualquier hijo de `/cards` en mobile (siguen sin existir tras este change).

## Capabilities

### New Capabilities

(ninguna — todo va sobre el spec `cards` existente)

### Modified Capabilities

- `cards`: dos requirements pasan a ser cross-platform en lugar de web-only.
  - El requirement actual *"El listado de tarjetas se muestra como wallet en grilla con hero de pago mensual"* pasa a *"El listado de tarjetas se muestra como wallet con hero de pago mensual"*, con cláusulas web (grilla 2-col en `md+`) y mobile (carrusel horizontal), y el nombre público del componente `Wallet` compartido en ambas plataformas.
  - El requirement actual *"El header de `/cards` se renderiza desde el primer paint y sus secciones cargan independientemente (web)"* pierde el qualifier `(web)` y agrega una cláusula mobile: PageHeader monta antes de que resuelvan las queries, count subtitle muestra `-` mientras carga, CTA disabled placeholder hasta que aterrice `/cards/new` mobile, cada sección usa react-query con su propio `SectionFallback`-equivalente, y un error en una sección nunca tira la ruta ni esconde el header.

## Impact

**Mobile (nuevo / agregado)**
- `apps/mobile/lib/cards/queries.ts`: agrega `getCardsMonthSummary()` y su tipo.
- `apps/mobile/components/cards/Wallet.tsx`: renombrado desde `CreditCardCarousel.tsx`.
- `apps/mobile/components/cards/CardsMonthHero.tsx`: nuevo.
- `apps/mobile/components/cards/ArchivedCardsSection.tsx`: nuevo (colapsable con Pressable + state local).
- `apps/mobile/components/cards/CardsHeader.tsx`: nuevo (PageHeader + count query + CTA disabled).
- `apps/mobile/app/(app)/cards.tsx`: pasa de stub a composición de las cuatro zonas.
- `apps/mobile/components/dashboard/SectionFallback.tsx`: se reutiliza tal cual (ya existe y ya lo usa `cards.tsx`).

**Web (refactor de nombres — sin cambio de comportamiento)**
- `apps/web/app/(app)/cards/_components/wallet-grid.tsx` → `wallet.tsx` (export `Wallet`).
- `apps/web/app/(app)/cards/_components/wallet-grid-section.tsx` → `wallet-section.tsx` (export `WalletSection`).
- `apps/web/app/(app)/cards/_components/wallet-grid-container.tsx` → `wallet-container.tsx` (export `WalletContainer`).
- `apps/web/app/(app)/cards/page.tsx`: actualiza imports.

**Specs**
- `openspec/specs/cards/spec.md`: dos requirements modificados (ver Modified Capabilities).

**Sin impacto en**
- DB / esquema (no hay migraciones).
- API / actions (la lógica de pago, edición de fechas, archivado, alta, detalle no se toca).
- Web `/cards/[id]`, `/cards/new` (intactos salvo imports si referenciaran los renombrados — los no referencian).
- i18n del web (las keys siguen siendo las mismas; el component rename es solo de archivos/exports).

**Dependencias / convenciones honradas**
- pnpm only en comandos y docs.
- Mobile usa `PageHeader` custom, nunca el header nativo del stack.
- Cross-platform components: mismos nombres, distintas implementaciones (`feedback_cross_platform_components`).
- Queries Supabase quedan en `lib/` del app (no en un paquete shared todavía).
