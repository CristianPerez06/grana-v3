## Why

La navegación de mobile tiene una regla única aplicada a medias: el tab bar es de los tres tabs reales (Inicio, Movimientos, Hogar), y las secciones que se abren desde el botón "…" del tab bar (Cuentas, Tarjetas, Configuración) tienen que renderizarse sin tab bar y ofrecer un back-link `← Inicio` en su header. Hoy sólo Cuentas cumple las dos mitades: **Tarjetas es chromeless pero no declara back-link, así que quien aterriza ahí se queda sin ninguna navegación en pantalla** — sólo le quedan las salidas de sistema (botón físico Atrás, gesto de swipe), que no son affordances visibles. Configuración, al revés, sigue mostrando el tab bar detached.

El bug reportado es Tarjetas ([#50](https://github.com/CristianPerez06/grana-v3/issues/50)), pero la causa es de consistencia: la lista `CHROMELESS_SECTIONS` del `TabBar` y la declaración de `backLink` en cada pantalla raíz son dos decisiones independientes que nadie obliga a moverse juntas, y el spec no tiene la regla escrita para mobile — la del back-link canónico está redactada sólo para las **rutas hijas** de web. Ese es el hueco por el que se coló el bug y el que lo repetiría la próxima sección que se agregue al Menú.

## What Changes

- **Las tres secciones del Menú pasan a ser chromeless**: `'settings'` se suma a `CHROMELESS_SECTIONS` en `TabBar.tsx`, de modo que la lista sea exactamente "las secciones alcanzables desde el botón … del tab bar". Alcanza a toda la sección, hijas incluidas (`/settings/categories/**`), que ya declaran su propio back-link.
- **Las tres pantallas raíz declaran `backLink`**: `CardsHeader` y `settings/index.tsx` pasan `backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}`; Cuentas ya lo hace y queda como referencia de forma. El href es **fijo al dashboard**, no `router.back()`, para que el destino sea determinístico venga de donde venga la navegación (Menú, deep link, o las cards del dashboard que linkean a estas secciones).
- **Los scrollers raíz de las tres secciones compensan el safe-area inferior** que el tab bar ya no cubre. Hoy ninguna de las tres lo hace (`px-6 py-6` pelado): en Cuentas y Tarjetas es un gap latente y en Configuración sería una regresión nueva al sacarle el tab bar.
- **Sin copy nuevo**: se usa la clave existente `nav.dashboard` ("Inicio" en `es`, "Home" en `en`).
- **Sin cambio de altura de header**: `PageHeader` ya renderiza un spacer `h-5` cuando `backLink` está ausente, así que la fila del link lo reemplaza sin mover el contenido de abajo.
- **Web no cambia.** En `apps/web` estas tres son *section roots* y su salida es el sidebar (md+) / el drawer de la top bar (narrow); el spec `page-header` ya dice que el back-link canónico aplica a las rutas hijas, no a la root.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mobile-app-shell`: se escribe la regla de visibilidad del tab bar como contrato de dos mitades — el tab bar SHALL renderizarse sólo en los tres tabs reales, y toda sección alcanzable desde el botón de menú SHALL estar en `CHROMELESS_SECTIONS` **y** declarar `backLink` al dashboard en su pantalla raíz. Se agrega además la compensación del safe-area inferior en las secciones chromeless con scroll.
- `page-header`: el back-link canónico gana su equivalente mobile. Hoy el requirement existe sólo para rutas hijas de web; se agrega la regla que cubre las raíces de sección chromeless de mobile (estilo `← {label}`, visible desde el primer paint) y se deja explícito que las pantallas raíz de los tres tabs NO llevan back-link.

## Impact

- **Mobile** (`apps/mobile/`): `components/layout/TabBar.tsx` (una entrada en `CHROMELESS_SECTIONS` + comentario), `components/cards/CardsHeader.tsx` y `app/(app)/settings/index.tsx` (prop `backLink`), y los tres scrollers raíz de `accounts/index.tsx`, `cards/index.tsx` y `settings/index.tsx` (padding inferior por `insets.bottom`).
- **Web**: sin cambios.
- **i18n**: sin claves nuevas.
- **Base de datos**: ninguna migración.
- **Riesgo**: bajo. Todo el cambio es de chrome de navegación; no toca lecturas, escrituras ni números. El riesgo a vigilar es confundir la sección `settings` con la entrada `['home', 'settings']` de `CHROMELESS_SCREENS` (la pantalla de ajustes del Hogar), que no se toca.
