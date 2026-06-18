## ADDED Requirements

### Requirement: La sección "En qué se fue" muestra los créditos por categoría fuera de la dona

Cuando, para el mes y la moneda activa, una o más categorías tengan **neto en crédito** (reintegros recibidos del mes superan el gasto del mes de esa categoría → neto negativo), la sección "En qué se fue" SHALL mostrar esos créditos como **fila(s) aparte, fuera de la dona** (una dona no puede representar una porción negativa). Cada fila de crédito SHALL mostrar el dot/color de la categoría + nombre + el monto devuelto, en tono positivo/verde, con un rótulo del tipo "te devolvieron" (vía i18n, sin string hardcodeado). La dona y su total central SHALL seguir derivándose solo de las categorías con neto positivo. Aplica idéntico en web y en la app nativa, reutilizando la anatomía existente de la card (sin card ni layout nuevos). Los montos de los créditos participan del eye-mask como el resto de los importes.

Cuando ninguna categoría quede en crédito, la sección NO SHALL renderizar la zona de créditos (no ensucia la card del caso común).

#### Scenario: Una categoría en crédito se muestra fuera de la dona

- **WHEN** en el mes/moneda activa la categoría "Comida" recibió $10.000 de reintegros y no tuvo gasto ese mes (neto −$10.000)
- **THEN** la dona NO incluye a "Comida"
- **AND** debajo de la leyenda aparece una fila "te devolvieron · Comida $10.000" en tono verde
- **AND** el monto del crédito se enmascara con el eye-mask

#### Scenario: Sin créditos no se renderiza la zona

- **WHEN** ninguna categoría del mes/moneda activa queda en crédito
- **THEN** la sección no muestra ninguna fila de "te devolvieron"
- **AND** la card se ve igual que hoy

#### Scenario: La dona ignora los créditos en su total

- **WHEN** hay categorías con gasto positivo y además una en crédito
- **THEN** la dona y su total central se calculan solo con las categorías de neto positivo
- **AND** los créditos quedan fuera del cálculo de la dona
