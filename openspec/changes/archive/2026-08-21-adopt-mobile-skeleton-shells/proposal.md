## Why

En nativo, las tres secciones que se abren desde el botón "…" del tab bar cargan con un `<Spinner size="md" />` centrado sobre fondo vacío: catorce pantallas entre Cuentas, Tarjetas y las de `/settings/categories`. La raíz de Tarjetas usa un tratamiento distinto pero igual de plano — tres `<SectionFallback>`, cajas de borde punteado con el texto "Cargando…" — y su tira de archivadas devuelve `null` mientras carga, así que el contenido de abajo salta al resolver. Web ya resuelve esas mismas rutas con skeletons shape-matched, y el nativo ya los usa en dashboard, Movimientos, Hogar y el alta/detalle de movimiento ([#55](https://github.com/CristianPerez06/grana-v3/issues/55)).

La causa no es descuido pantalla por pantalla: **el spec manda el spinner**. Dos requirements de `route-loading-and-errors` lo prescriben para nativo — "El loading SHALL usar `<Spinner size="lg" />`", con el patrón `if (isPending) return <ScreenLoading />` escrito dentro del propio requirement. Mientras tanto la capability `dashboard` codificó lo contrario para sus bloques. Hoy el nativo tiene dos reglas de carga contradictorias según en qué sección estés, y quien implementa una pantalla siguiendo el spec al pie de la letra vuelve a escribir el spinner. Sin invertir la regla, esto se repite en la próxima pantalla.

## What Changes

- **Se invierte la regla de carga en nativo**: el estado de carga por defecto de una pantalla mobile pasa a ser un **skeleton shell shape-matched** compuesto sobre `SkeletonBlock`, con la misma definición que ya usa `dashboard` (mismos radios, altura aproximada y cantidad de bloques que el contenido final).
- **`Spinner` queda acotado a indicador de acción en curso** (`<Button loading>`, refresh de una mutación). Deja de ser un estado de pantalla en nativo. El primitivo NO se da de baja: web lo sigue usando en el `loading.tsx` del layout group, y el contrato `SpinnerProps` no cambia.
- **Se cubren las quince superficies** de Cuentas, Tarjetas y Configuración con skeletons propios: lista y detalle de cuentas, los tres bloques de la raíz de Tarjetas, detalle de tarjeta, lista de resúmenes, detalle de resumen, pago, y las tres pantallas bajo `/settings/categories`; más los seis formularios que esperan un catálogo.
- **Cada skeleton es local a su pantalla**, con la forma real de ese contenido — no un shell genérico parametrizado. Es lo que hace web hoy (cada `loading.tsx` compone el suyo) y es lo único que cumple "shape-matched" de verdad.
- **La raíz de Configuración queda exenta y escrita como excepción**: no monta ninguna query, lee `showCents` y el locale de contexto y renderiza sincrónico.
- **El chrome sigue visible desde el primer paint**: el skeleton reemplaza sólo el cuerpo; `PageHeader` / `FormScreen` y sus acciones se quedan, con la acción primaria `disabled` mientras la data no está.
- **Se migra también `/transactions/recurring/new`**: al volverse normativa la regla general, era la única pantalla del resto de la app que seguía usando `<Spinner>` como estado de pantalla. Dejarla afuera habría archivado un requirement con una violación en el árbol.
- **Se limpian las claves i18n de carga** que quedan huérfanas al sacar los `SectionFallback` de la raíz de Tarjetas, previa verificación de consumidores.
- **Web no cambia.**

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `route-loading-and-errors`: el requirement que prescribía `<Spinner size="lg" />` como estado de carga de una pantalla nativa se da de baja y lo reemplaza uno que exige un skeleton shell shape-matched y acota el uso de `Spinner` a indicador de acción — se da de baja entero porque su scenario afirmaba el comportamiento que este change elimina, y conviene que eso quede escrito como baja, no como edición silenciosa. El requirement de "toda ruta o pantalla nueva" se modifica en su bullet mobile. Se agrega, además, el requirement de cobertura que enumera las superficies de Cuentas, Tarjetas y Configuración y sus excepciones — el mismo tipo de inventario por ruta que la capability ya aloja para las variantes de in-page chrome de web.

## Impact

- **Mobile** (`apps/mobile/`): quince superficies pierden su `<Spinner size="md" />` / `<SectionFallback>` de carga. Skeletons nuevos colocados junto al componente cuya forma espejan (`components/accounts/`, `components/cards/`, `components/cards/detail/`, `components/categories/`), nombrados `<Componente>Skeleton`.
- **Web**: sin cambios.
- **i18n**: sin claves nuevas. Quedan huérfanas `cards.route.hero_loading` y `cards.route.wallet_loading` al reemplazar los `SectionFallback` de carga — se dan de baja sólo tras verificar que ningún otro módulo las consume.
- **Base de datos**: ninguna migración.
- **Riesgo**: bajo y acotado a estados de carga. Ninguna lectura, escritura ni derivación de dinero se toca. El riesgo real es que un skeleton no coincida con la forma final y la pantalla salte al resolver, que es exactamente lo que la verificación mira pantalla por pantalla.
