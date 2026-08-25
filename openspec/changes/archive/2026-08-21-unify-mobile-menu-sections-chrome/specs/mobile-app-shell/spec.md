## ADDED Requirements

### Requirement: El tab bar se muestra sólo en los tabs reales, y toda sección del Menú declara su propia salida

La navegación de `apps/mobile` SHALL responder a una regla de dos mitades que se mueven juntas.

**Mitad 1 — visibilidad del tab bar.** El tab bar SHALL renderizarse únicamente en las pantallas de los tres tabs reales (`dashboard`, `transactions`, `home`). Toda sección top-level alcanzable desde el botón de menú del tab bar (el `AppMenu`) SHALL estar registrada en `CHROMELESS_SECTIONS` de `apps/mobile/components/layout/TabBar.tsx`, de modo que la lista sea exactamente "las secciones que se abren desde el botón …". Al momento de este change son `accounts`, `cards` y `settings`. El chromeless alcanza a la sección completa, subrutas incluidas (`/settings/categories/**`, `/accounts/[id]`, `/cards/new`, …): ninguna de ellas es un tab, así que el tab bar sólo podría mostrarse detached, sin slot resaltado.

**Mitad 2 — salida visible.** Toda sección listada en `CHROMELESS_SECTIONS` SHALL declarar un `backLink` al dashboard en su **pantalla raíz**, con `href` fijo `'/(app)/dashboard'` y label `t('nav.dashboard')` (ver capability `page-header` para el estilo canónico y el requisito de primer paint). Sin esta mitad, ocultar el tab bar deja a la pantalla sin ninguna navegación visible: sólo quedan las salidas de sistema (botón físico Atrás en Android, gesto de swipe en iOS), que no son affordances en pantalla.

Agregar una sección al `AppMenu` SHALL implicar las dos mitades a la vez. Cumplir una sola es un defecto: sin la mitad 1 el tab bar aparece detached; sin la mitad 2 la pantalla queda sin salida.

Las rutas hijas de una sección chromeless SHALL seguir declarando su propio back-link al parent inmediato, no al dashboard.

`CHROMELESS_SECTIONS` (secciones enteras alcanzables desde el Menú) y `CHROMELESS_SCREENS` (pantallas pusheadas dentro del stack de un tab, como `['transactions', 'new']` o las subpantallas de Compartido) son dos listas con reglas distintas y SHALL mantenerse separadas. En particular, la entrada `['home', 'settings']` de `CHROMELESS_SCREENS` es la pantalla de **configuración del Hogar** pusheada sobre el tab Hogar, y NO tiene relación con la sección `settings`; agregar `settings` a `CHROMELESS_SECTIONS` no la reemplaza ni la vuelve redundante.

#### Scenario: Cada sección del Menú se abre sin tab bar y con back-link

- **WHEN** un usuario abre el `AppMenu` desde el botón … del tab bar y navega a Cuentas, Tarjetas o Configuración
- **THEN** la pantalla se renderiza sin tab bar
- **AND** el header muestra el back-link `← Inicio` (`← Home` en `en`) arriba del título
- **AND** presionarlo navega al dashboard

#### Scenario: Los tabs reales conservan el tab bar y no muestran back-link

- **WHEN** un usuario está en `dashboard`, `transactions` o `home`
- **THEN** el tab bar se muestra con el slot correspondiente resaltado
- **AND** el header de esas pantallas NO declara `backLink`

#### Scenario: Las rutas hijas de una sección chromeless mantienen su propio back-link

- **WHEN** un usuario navega a `/cards/new`, `/cards/[id]`, `/accounts/[id]` o `/settings/categories/**`
- **THEN** la pantalla sigue sin tab bar
- **AND** su header muestra el back-link al parent inmediato (no al dashboard)
- **AND** no se apilan dos headers

#### Scenario: Una sección nueva del Menú cumple las dos mitades

- **WHEN** se agrega al `AppMenu` una entrada que navega a una sección top-level nueva
- **THEN** el segmento de esa sección SHALL sumarse a `CHROMELESS_SECTIONS`
- **AND** su pantalla raíz SHALL declarar `backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}`

#### Scenario: La configuración del Hogar sigue siendo una pantalla pusheada del tab Hogar

- **WHEN** un usuario entra a la configuración del Hogar desde el tab Hogar
- **THEN** la pantalla sigue renderizándose chromeless por la entrada `['home', 'settings']` de `CHROMELESS_SCREENS`
- **AND** su back-link sigue apuntando al Hogar, no al dashboard

### Requirement: Las secciones chromeless compensan el safe-area inferior en su contenido scrolleable

En una sección chromeless no hay tab bar, y con él desaparece el único elemento que pintaba el safe-area inferior (el tab bar aplica `paddingBottom: Math.max(14, insets.bottom)`). El contenedor scrolleable raíz de cada sección de `CHROMELESS_SECTIONS` SHALL agregar un padding inferior de al menos `insets.bottom` a su `contentContainer`, de modo que la última fila del contenido quede alcanzable y no tapada por el home indicator de iOS ni por la barra de gestos de Android.

Las pantallas de formulario pusheadas ya cumplen esta regla vía el `contentClassName` por defecto de `FormScreen` (`pb-28`) y NO requieren cambios.

#### Scenario: La última fila de una sección chromeless queda por encima del home indicator

- **WHEN** un usuario scrollea hasta el final de Cuentas, Tarjetas o Configuración en un dispositivo con safe-area inferior mayor a cero
- **THEN** la última fila del contenido se ve completa por encima del home indicator / barra de gestos
- **AND** el espacio libre bajo esa fila es al menos `insets.bottom`
