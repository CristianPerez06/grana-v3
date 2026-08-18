# Design: unify-detail-actions-in-topbar

## Decisión — la topbar gana; la barra inferior se va

La disposición mobile anterior ("···" para Eliminar + barra fija full-width para Editar) venía de un criterio razonable: **thumb-reach**. La acción principal, al alcance del pulgar; la secundaria, escondida para no competir.

Se cambia por tres razones concretas:

1. **Parte en dos las acciones del mismo objeto.** Editar abajo, Eliminar arriba y detrás de un tap extra. Para entender qué se puede hacer con el movimiento hay que mirar dos lugares de la pantalla.
2. **La barra tapa el final de la página.** El contenedor tenía que compensar con `pb-24`, y aun así la barra flota sobre el contenido con un gradiente. Es un costo permanente para una acción que se usa una vez cada varias visitas al detalle.
3. **La app nativa ya hace lo otro y funciona.** Renderiza los dos iconos en el `PageHeader` desde el principio. No es una hipótesis sobre teléfonos: es el patrón que ya corre en el teléfono.

El **trade-off asumido** es real y vale nombrarlo: en un teléfono grande, un icono de 42px en la esquina superior derecha es más difícil de alcanzar que un botón full-width al pie. Se compensa parcialmente con que la topbar es **sticky** en viewport angosto — el icono está siempre ahí, no hay que scrollear hasta arriba para encontrarlo. Y el detalle no es una pantalla de uso repetitivo: se entra a mirar, y a veces a editar.

## Divergencia visual permitida entre plataformas

La app nativa dibuja los dos iconos en **blanco sobre el `PageHeader` navy**; la web los dibuja sobre página clara (Eliminar bordeado con hover en tono peligro, Editar en sólido navy). No es una divergencia a corregir: cada header tiene su fondo y cada plataforma resuelve el contraste con sus propios tokens. Lo que el spec fija —y lo que esta change unifica— es la **disposición**: dos iconos, contiguos, en la topbar, gateados por los mismos permisos.

## Fuera de alcance

- El `AlertDialog` de borrado, su copy contextual y el flujo de recurrencia sembrada. Se tocan cero.
- El detalle de movimiento en contexto de cuenta y el detalle de período de tarjeta, que tienen sus propias topbars.
- El primitivo `dropdown-menu`, que sigue en uso en Configuración → Categorías.
