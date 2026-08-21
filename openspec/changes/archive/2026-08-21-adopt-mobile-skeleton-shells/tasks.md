## 1. Spec

- [x] 1.1 Delta `specs/route-loading-and-errors/spec.md`: el requirement de loading/error en mobile va `REMOVED` (con Reason y Migration — su scenario afirmaba el spinner) y lo reemplaza uno `ADDED` (skeleton shape-matched, `Spinner` acotado a acción en curso, chrome siempre visible, prohibición de texto "Cargando…" y de estado vacío como placeholder); el de "toda nueva ruta o pantalla" va `MODIFIED` completo con su bullet mobile actualizado
- [x] 1.2 Requirement `ADDED` de cobertura: inventario de las quince superficies de Cuentas, Tarjetas y Configuración, convención de naming y ubicación, prohibición del shell genérico parametrizado, y las dos excepciones escritas (raíz de Configuración, tiras de archivadas)
- [x] 1.3 `openspec validate adopt-mobile-skeleton-shells` pasa

## 2. Cuentas — lista y detalle

- [x] 2.1 `AccountsListSkeleton` en `components/accounts/`: espeja `AccountSection` (grupo Efectivo + grupo Bancos con sus filas), con la cantidad de filas que entra arriba del fold. Consumirlo en `app/(app)/accounts/index.tsx` en lugar del `<Spinner size="md" />`
- [x] 2.2 Verificar que el botón "Crear" del header sigue `disabled` mientras `institutionsQ` no resuelve, y que el header no se tapa en ningún momento
- [x] 2.3 `AccountDetailSkeleton` en `components/accounts/`: espeja `AccountDetailHero` + `MovementsSection` (hero navy con avatar, nombre y saldo; card de movimientos con N filas). Consumirlo en `app/(app)/accounts/[id]/index.tsx`
- [x] 2.4 La tira de cuentas archivadas sigue sin dibujar nada mientras carga (decisión 4 del design) — verificar que no se le agregó skeleton por inercia

## 3. Tarjetas — raíz

- [x] 3.1 `CardsMonthHeroSkeleton` en `components/cards/`: espeja `CardsMonthHero`. Reemplaza el `<SectionFallback message={t('cards.route.hero_loading')} />`
- [x] 3.2 `WalletSkeleton` en `components/cards/`: espeja `Wallet` (filas de tarjeta con avatar, nombre y monto). Reemplaza el `<SectionFallback message={t('cards.route.wallet_loading')} />`
- [x] 3.3 La tira de archivadas (`ArchivedCardsSection`) mantiene el `return null` mientras carga; dejarlo comentado como decisión, no como pendiente
- [x] 3.4 Verificar que los estados de **error** de los tres bloques siguen usando `SectionFallback` con su mensaje — este change no los toca

## 4. Tarjetas — detalle, resúmenes y pago

- [x] 4.1 `CardDetailSkeleton` en `components/cards/detail/`: espeja `CardDetailHeader` + `CardDetailView`. Consumirlo en `app/(app)/cards/[id]/index.tsx`
- [x] 4.2 `PeriodListSkeleton` en `components/cards/`: espeja las filas de resumen con su `PeriodStatusPill`. Consumirlo en `app/(app)/cards/[id]/periods/index.tsx`
- [x] 4.3 `PeriodDetailSkeleton` en `components/cards/`: espeja el encabezado del resumen (montos + pill) y la `MovementList`. Consumirlo en `app/(app)/cards/[id]/periods/[periodId]/index.tsx` — reusar `MovementListSkeleton`, que ya existe, para la parte de movimientos
- [x] 4.4 `PayPeriodSkeleton`: espeja el formulario de pago (cuenta de débito, monto, fecha, botón). Consumirlo en `.../[periodId]/pay.tsx`

## 5. Configuración — categorías

- [x] 5.1 `CategoryListSkeleton` en `components/categories/`: espeja `CategoryList` (filas con icono, nombre y chevron). Consumirlo en `app/(app)/settings/categories/index.tsx`
- [x] 5.2 `SubcategoryListSkeleton` en `components/categories/`: espeja la lista de subcategorías. Consumirlo en `app/(app)/settings/categories/[id]/subcategories/index.tsx`
- [x] 5.3 `EditCategoryFormSkeleton` en `components/categories/`: espeja `EditCategoryForm` (nombre, pickers de icono y color, botón). Consumirlo en `app/(app)/settings/categories/[id]/edit.tsx`
- [x] 5.4 Confirmar que la raíz `settings/index.tsx` queda sin tocar (no tiene queries)

## 6. Formularios que esperan catálogo

- [x] 6.1 `CreateAccountFormSkeleton` (espeja `CreateAccountForm`) → `app/(app)/accounts/new.tsx`
- [x] 6.2 `EditAccountFormSkeleton` (espeja `EditAccountForm`) → `app/(app)/accounts/[id]/edit.tsx`
- [x] 6.3 `AccountCurrencySkeleton` (espeja el bloque de monedas: `Label` + `MoneyAmountInput` + botón) → `app/(app)/accounts/[id]/currency.tsx`
- [x] 6.4 `CreateCardFormSkeleton` (espeja `CreateCardForm`: nombre, banco, chips de red, cierre y vencimiento) → `app/(app)/cards/new.tsx`
- [x] 6.5 `EditCardFormSkeleton` (espeja `EditCardForm`) → `app/(app)/cards/[id]/edit.tsx`
- [x] 6.6 Verificar que ninguno introdujo un shell genérico parametrizado y que los seis conservan el `FormScreen` visible durante la carga
- [x] 6.7 `RecurrenceFormSkeleton` (espeja `RecurrenceForm`) → `app/(app)/transactions/recurring/new.tsx`: única pantalla fuera de las tres secciones que seguía usando `<Spinner>` como estado de pantalla, y la regla general ahora la alcanza

## 7. i18n y accesibilidad

- [x] 7.1 Reusar como `accessibilityLabel` las keys de carga que ya existen: `accounts.route.active_loading`, `accounts.route.archived_loading`, `cards.route.hero_loading`, `cards.route.wallet_loading`, `cards.route.archived_loading` — no se borran, cambian de canal
- [x] 7.2 Agregar key específica en `es.json` y `en.json` para las superficies que no tienen (detalle de cuenta, detalle de tarjeta, resúmenes, resumen, pago, lista de categorías, subcategorías, edición de categoría y los formularios), sin reusar `common.loading` para varias
- [x] 7.3 Verificar que cada skeleton declara `accessibilityState={{ busy: true }}` en su raíz y que los bloques internos no declaran atributos de accesibilidad
- [x] 7.4 Correr el test de claves i18n que escanea los fuentes

## 8. Verificación

- [x] 8.1 Por cada pantalla migrada: el estado de carga tiene la forma del contenido final y al resolver no hay salto de layout
- [x] 8.2 El chrome (`PageHeader` / `FormScreen`, back-link, acciones) se ve desde el primer paint en todas, con la acción primaria `disabled` mientras su data no está
- [x] 8.3 Con "reducir movimiento" activo, los bloques quedan en opacidad estática sin pulse
- [x] 8.4 `grep -rn "<Spinner" apps/mobile/app` no devuelve ningún uso como estado de pantalla en las tres secciones
- [x] 8.5 Los estados de error siguen como estaban (`RouteError` / `SectionFallback` con mensaje)
- [x] 8.6 Web: sin cambios en `/accounts`, `/cards` ni `/settings`
- [x] 8.7 `pnpm lint:mobile`, `pnpm typecheck:mobile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm openspec:check` en verde

## 9. Archivo

- [x] 9.1 Mover la carpeta a `openspec/changes/archive/2026-08-21-adopt-mobile-skeleton-shells/`
- [x] 9.2 Integrar el delta en `openspec/specs/route-loading-and-errors/spec.md` (sin secciones de delta en el master)
- [x] 9.3 `pnpm openspec:check` pasa en la rama
