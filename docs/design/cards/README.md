# Propuesta de UI para tarjetas

## Contexto

La ruta raíz `/cards` ya está bastante cerca del sistema visual nuevo: usa `PageHeader`, CTA con `Button`, secciones con `Suspense`, skeletons por sección, hero de resumen mensual y wallet de tarjetas. No hace falta cambiar su modelo de producto.

Esta propuesta documenta una evolución visual pequeña para que `/cards` se alinee mejor con `/accounts`, `/accounts/[id]` y `/dashboard`: headers más consistentes, filas menos comprimidas en mobile y una jerarquía más clara entre el hero mensual, el wallet y las archivadas.

## Inventario real

Datos disponibles:

- Header: título `Tarjetas`, subtítulo con cantidad de tarjetas activas y mes, acción `Agregar tarjeta`.
- Catálogos para el drawer de alta: instituciones activas y redes de tarjeta activas.
- Hero "A pagar este mes": total ARS, total USD separado, `hasToPay`, próximo vencimiento y lista de próximos vencimientos.
- Próximos vencimientos: tarjeta, fecha de cierre, fecha de vencimiento, monto ARS, monto USD, alerta y si ya cuenta como "a pagar".
- Wallet: tarjetas activas con nombre, red, monedas activas, período activo, monto pendiente ARS/USD, pill de estado, límite opcional, cuotas activas y link al resumen.
- Empty state cuando no hay tarjetas activas.
- Archivadas: sección colapsable opcional con nombre y link al detalle.
- Estados: skeleton del hero, skeleton del wallet, skeleton de archivadas, error por sección y error de ruta.

Componentes reales:

- `CardsLayout`
- `CardsHeader`
- `AddCardButton`
- `CardsErrorBoundary`
- `CardsMonthHeroContainer`
- `CardsMonthHero`
- `WalletContainer`
- `WalletSection`
- `Wallet`
- `WalletCard`
- `ArchivedCardsContainer`
- `ArchivedCardsSection`
- `CardsMonthHeroSkeleton`
- `WalletSkeleton`
- `ArchivedCardsSkeleton`
- `SectionFallback`
- `RouteError`

## Recomendación

No haría un rediseño grande. La ruta ya comunica bien su dominio. Haría estos ajustes:

- Mantener el hero "A pagar este mes", pero acercarlo al lenguaje del dashboard: superficie clara, monto principal con ARS dominante y USD subordinado, próximos vencimientos en filas escaneables.
- En mobile, evitar filas con nombre largo + monto grande en una sola línea. Los próximos vencimientos y las tarjetas del wallet deberían apilar identidad arriba y montos debajo cuando el ancho sea estrecho.
- Normalizar el header de sección "Mis tarjetas": usar el patrón de sección de `/accounts` con título pequeño/semibold y hint subordinado, sin que el hint compita en una sola línea en mobile.
- Mantener el wallet web como grilla y mobile como carrusel, porque eso ya está en OpenSpec.
- Mantener archivadas como sección secundaria colapsable; no subirla visualmente al mismo nivel que las activas.

No propongo nuevos totales, filtros, búsquedas, acciones ni queries.

## Observación de implementación

Durante la inspección, `apps/mobile/components/cards/CreditCardItem.tsx` navega a `router.push('/cards')` al tocar una tarjeta. La spec de `cards` dice que cada card debe navegar a `/cards/[id]`. Esto no es parte del mock visual, pero conviene corregirlo cuando se implemente el pase de UI.

## Dirección visual

Desktop: mantener una ruta amplia y tranquila. Hero mensual arriba, wallet en grilla de dos columnas, archivadas al final. Las tarjetas activas siguen siendo cards individuales; no convertirlas en lista.

Mobile: una sola columna. Hero mensual apilado, wallet como carrusel con una card por viewport y peek de la siguiente, y filas internas con nombres/montos que puedan partirse en más de una línea.

## Archivos de trabajo

- [web/cards.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/web/cards.html) - mock web desktop.
- [mobile/cards.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/mobile/cards.html) - mock mobile nativo.
- [components/route-shell.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/route-shell.html)
- [components/cards-header.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/cards-header.html)
- [components/month-hero.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/month-hero.html)
- [components/wallet-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/wallet-section.html)
- [components/wallet-card.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/wallet-card.html)
- [components/archived-cards-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/archived-cards-section.html)
- [components/empty-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/empty-state.html)
- [components/loading-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/loading-state.html)
- [components/error-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards/components/error-state.html)
