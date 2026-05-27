## MODIFIED Requirements

### Requirement: La sección "Balance del mes" muestra un gráfico de línea acumulada con navegador mensual

La sección SHALL renderizar un gráfico de línea cuyo eje X representa los días del mes seleccionado (1 a 28/29/30/31 según el mes), eje Y representa el balance acumulado en ARS desde el día 1 del mes hasta cada día inclusive (`balance acumulado = Σ ingresos − Σ gastos hasta el día i`), y cuyo trazo conecta esos puntos con interpolación lineal. La línea SHALL cruzar el eje X cuando el acumulado pase por cero (visualmente puede destacarse cuándo el usuario está "en verde" vs "en rojo" del mes).

Encima del gráfico, la sección SHALL mostrar un navegador mensual `◀ MES AÑO ▶` con el nombre del mes seleccionado. Las flechas SHALL permitir navegar hasta 12 meses hacia atrás desde el mes actual. La flecha derecha SHALL deshabilitarse cuando el mes seleccionado es el actual (no se navega hacia el futuro). El mes actual SHALL ser el seleccionado por default al montar la tarjeta.

La tarjeta SHALL ser un componente cliente que posee el mes seleccionado en **estado local**. La navegación entre meses NO SHALL modificar la URL ni provocar una navegación de ruta: cambiar de mes NO recarga la página (web) ni desmonta/remonta la tarjeta (mobile). El mes seleccionado NO se persiste en la URL ni se conserva tras un refresh; al volver a montar, la tarjeta SHALL abrir en el mes actual.

Al navegar a un mes, la tarjeta SHALL obtener los datos del lado del cliente (web: vía server action; mobile: vía TanStack Query) y SHALL mostrar un **estado de carga propio**: un spinner que reemplaza únicamente el área del gráfico y del footer (balance, ingresos, gastos), manteniendo visibles e interactivos el título de la sección y el navegador mensual.

Si el fetch de un mes falla, la tarjeta SHALL mostrar un **estado de error compacto** en el área del gráfico + footer, con opción de reintentar, manteniendo visibles el título y el navegador mensual.

En los estados de carga y de error, el alto y el ancho de la tarjeta SHALL permanecer constantes respecto del estado con datos (sin layout shift).

El navegador mensual NUNCA SHALL desbordar los límites de la tarjeta. En web, incluso cuando la columna del grid es angosta (viewport entre ~1024px y ~1088px), el navegador SHALL mantenerse íntegro dentro de la tarjeta y el título de la sección SHALL ceder espacio (truncarse) antes que permitir que la flecha derecha se salga del contenedor.

Debajo del gráfico, la sección SHALL mostrar el balance final del mes seleccionado (positivo o negativo, con signo y color), y los totales de ingresos y gastos del mes en una línea pequeña.

El gráfico SHALL considerar solo transacciones con estado `confirmed` (es decir: no `pending` de tarjeta). En la práctica esto significa: ingresos en cash/bank, gastos en cash/bank, y pagos de resúmenes (que son gastos en cash/bank). Consumos en tarjeta `pending` y cuotas `pending` NO entran al gráfico.

El cálculo SHALL usar exclusivamente la moneda ARS. El gráfico NO renderiza datos en USD ni hace conversiones.

#### Scenario: Mes con sueldo a mitad de mes muestra subida brusca

- **WHEN** el mes seleccionado es mayo 2026 y el usuario tuvo un ingreso de $ 850.000 el día 15 y gastos repartidos durante el mes
- **THEN** el gráfico muestra una pendiente decreciente desde el día 1 al 14 (gastos sin ingresos), un salto vertical hacia arriba el día 15 (sueldo), y una pendiente suavemente decreciente desde el 15 hasta fin de mes

#### Scenario: Navegar al mes anterior recarga los datos sin recargar la página

- **WHEN** el usuario en mayo 2026 toca la flecha izquierda
- **THEN** la tarjeta obtiene y muestra los datos de abril 2026
- **AND** la flecha derecha se habilita (ya no estamos en el mes actual)
- **AND** la URL no cambia y el resto de la página (Hero, "Lo que viene") no se vuelve a renderizar

#### Scenario: El estado de carga reemplaza solo el gráfico y el footer

- **WHEN** el usuario navega a un mes cuyos datos aún no están disponibles y el fetch está en curso
- **THEN** el área del gráfico y del footer muestra un spinner
- **AND** el título de la sección y el navegador mensual siguen visibles e interactivos
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos

#### Scenario: El estado de error permite reintentar sin perder el navegador

- **WHEN** el fetch de los datos del mes seleccionado falla
- **THEN** el área del gráfico y del footer muestra un mensaje de error compacto con una acción de reintentar
- **AND** el título de la sección y el navegador mensual siguen visibles
- **AND** al reintentar, la tarjeta vuelve a obtener los datos del mismo mes seleccionado
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos

#### Scenario: La flecha derecha está deshabilitada en el mes actual

- **WHEN** el usuario está viendo el mes actual
- **THEN** la flecha derecha del navegador está deshabilitada visual y funcionalmente

#### Scenario: Límite de 12 meses hacia atrás

- **WHEN** el usuario navegó 12 meses hacia atrás y toca la flecha izquierda
- **THEN** la flecha izquierda está deshabilitada y la navegación no avanza

#### Scenario: El navegador no desborda la tarjeta en viewports angostos (web)

- **WHEN** el viewport tiene un ancho entre ~1024px y ~1088px (la columna izquierda del grid del dashboard queda angosta)
- **THEN** el navegador mensual, incluida la flecha derecha, queda contenido dentro de los límites de la tarjeta
- **AND** el título de la sección se trunca si hace falta para dejar espacio, en lugar de empujar el navegador fuera del contenedor

#### Scenario: Consumo en tarjeta no impacta el gráfico

- **WHEN** el usuario registra un consumo de $ 30.000 en su tarjeta el día 10 del mes
- **THEN** el gráfico del mes actual NO refleja ese consumo como bajada
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí aparece como bajada en la fecha del pago

#### Scenario: Mes sin movimientos confirmados muestra línea plana

- **WHEN** el mes seleccionado no tiene ningún ingreso ni gasto confirmado
- **THEN** el gráfico muestra una línea horizontal sobre el eje X (acumulado = 0)
- **AND** debajo muestra "Ingresos $ 0 · Gastos $ 0" y "Balance + $ 0"
