## Context

Quince superficies nativas resuelven su carga con un `<Spinner size="md" />` centrado dentro de un `View className="items-center py-12"`: cinco en Cuentas, seis en Tarjetas, tres bajo `/settings/categories` y el pago de resumen. La raíz de Tarjetas es el caso aparte: tres `<SectionFallback>` —cajas de borde punteado con texto— para el hero, la billetera y las archivadas, más una tira de archivadas que devuelve `null` mientras carga.

Lo necesario para hacerlo bien ya existe: `SkeletonBlock` (`components/ui/`) encapsula el pulse sobre Reanimated y respeta `useReducedMotion()`, y sobre él se construyeron siete skeletons para dashboard, movimientos y Hogar. Web resuelve estas mismas rutas con skeletons shape-matched propios (`active-accounts-skeleton`, `wallet-skeleton`, `cards-month-hero-skeleton`, y un `loading.tsx` por ruta de detalle y de formulario), así que hay referencia de forma para cada pantalla.

El obstáculo no es técnico sino normativo: `route-loading-and-errors` **prescribe el spinner** en dos requirements, con el patrón `if (isPending) return <ScreenLoading />` escrito adentro. La capability `dashboard` prescribe lo contrario para sus bloques. Cualquier pantalla nueva que siga el spec vuelve a introducir el problema.

## Goals / Non-Goals

**Goals:**

- Que el spec tenga una sola regla de carga para nativo, y que sea la de skeleton shape-matched.
- Que las tres secciones del Menú carguen sin saltos de layout ni cajas de texto.
- Que quede escrito qué NO lleva skeleton, con su razón, para que nadie lo "complete" después.

**Non-Goals:**

- Tocar los estados de **error** de estas pantallas. Hoy usan `RouteError` o un texto de fallo; su rediseño es otro asunto (el error de la card de saldo tiene ticket propio, #53).
- Tocar web, que ya cumple.
- Dar de baja el primitivo `Spinner`: se le acota el uso, pero sigue existiendo para acciones en vuelo y para el `loading.tsx` del layout group de web.
- Unificar los skeletons entre plataformas: web usa `div` + `animate-pulse` y nativo `SkeletonBlock`; esa asimetría es la política del repo.

## Decisions

**1. El spec va primero, y el change es tanto de spec como de código.** Si sólo se agregan skeletons, los dos requirements que mandan spinner quedan en pie y la próxima pantalla nativa nace mal. Los dos se reescriben `MODIFIED` completos —el de loading/error en mobile y el de "toda pantalla nueva"— y se agrega el requirement de cobertura con el inventario de las quince superficies.

**2. Un skeleton local por pantalla, sin shell genérico.** Se descartó explícitamente un `<FormSkeleton rows={n} />` compartido para los seis formularios que esperan catálogo. Son estructuralmente iguales *hoy* (`FormScreen` + `isPending`), pero sus formas no lo son: un select, un input de monto, una fila de chips de red y un par de campos de fecha lado a lado se aplanan todos al mismo rectángulo. El punto del ticket es que el skeleton tenga la forma del contenido; un shell parametrizado lo cumple sólo de nombre. Web toma la misma decisión: cada `loading.tsx` compone el suyo.

Trade-off aceptado: más archivos y algo de markup repetido entre formularios parecidos. Si más adelante aparece duplicación real y aburrida (la misma fila label+campo escrita idéntica muchas veces), la extracción de un primitivo chico es un change aparte, con la regla de extracción del repo.

**3. El skeleton reemplaza el cuerpo, nunca el chrome.** Es la regla de chrome siempre visible que ya rige para las rutas hijas: `PageHeader` / `FormScreen`, back-link y slots de acción se pintan desde el primer paint, y la acción primaria va `disabled` mientras su data no está. La lista de Cuentas ya lo hace con el botón "Crear" atado a `institutionsQ.isSuccess`; ese es el patrón a replicar, no a inventar.

**4. Los bloques condicionales no dibujan skeleton.** Las tiras de archivadas (Tarjetas y Cuentas) existen sólo si hay elementos archivados. Un skeleton ahí prometería contenido que en la mayoría de las cuentas nunca aparece, y al resolver en nada haría saltar el layout. Se mantiene el `null` actual y se escribe como decisión, no como omisión. Es la misma regla que la tira "Compartido" del dashboard.

**5. La raíz de Configuración queda exenta.** No monta ninguna query: lee `showCents` del `PreferencesProvider` y el locale del contexto, y renderiza sincrónico. Sin estado de carga no hay skeleton que escribir. Va escrito en el spec porque, mirando la lista de secciones, la ausencia parece un olvido.

**6. El copy de carga no desaparece: cambia de canal.** Un skeleton no muestra texto, pero su nodo raíz anuncia `accessibilityState={{ busy: true }}` + `accessibilityLabel`, como ya hacen los skeletons del dashboard y de movimientos. Así que `cards.route.hero_loading` y `cards.route.wallet_loading` **no quedan huérfanas**: dejan de pintarse en una caja punteada y pasan a ser lo que anuncia el lector de pantalla. Lo mismo para `accounts.route.active_loading` y `archived_loading`, que hoy ni se usan.

Las superficies sin key propia (detalle de cuenta, detalle de tarjeta, resúmenes, resumen, pago, las tres de categorías y los formularios) reciben una key específica en `es` y `en`. Nada de un `common.loading` genérico para todas: la regla del dashboard ya prohíbe reusar un mensaje único para bloques distintos, y un label genérico es peor que ninguno para quien navega con lector de pantalla.

**7. La forma se copia del componente real, no del web.** Web es referencia de composición (qué bloques hay y en qué orden), pero las medidas salen del componente nativo que el skeleton espeja: mismas alturas de fila, mismos radios, misma cantidad de filas visibles arriba del fold. Cada skeleton se escribe leyendo su componente par.

## Risks / Trade-offs

- **Un skeleton que no coincide con la forma final produce el salto que venía a evitar** → la verificación es pantalla por pantalla, comparando el frame de carga con el resuelto; el criterio de aceptación es "el contenido ocupa el mismo lugar".
- **Quince superficies es mucha superficie para una sola pasada** → las tareas están agrupadas por sección y son independientes entre sí; el change se puede implementar y verificar por partes sin dejar el árbol en un estado intermedio inconsistente (cada pantalla migrada es autocontenida).
- **`SkeletonBlock` tiene una trampa conocida** documentada en su propio código: pasar `className` y `style` en el mismo `Animated.View` hace que NativeWind ignore las clases y el bloque colapse a 0×0. Los skeletons nuevos lo componen, no lo reimplementan, así que heredan el arreglo — pero conviene no "optimizar" ese componente al pasar.
- **Sin tests que cubran esto**: el repo no tiene tests de UI nativa. La red de seguridad es el checklist en dispositivo más `lint`/`typecheck`, y un grep final que garantice que no quedó ningún `<Spinner>` como estado de pantalla en las tres secciones.
