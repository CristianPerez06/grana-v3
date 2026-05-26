## Why

Hoy en v3, al registrar un ingreso/gasto el usuario **tipea la categoría a mano cada vez**, incluso para descripciones que se repiten ("Coto", "Nafta YPF", "Netflix"). Es fricción, y choca con el pilar *"la app sugiere y enseña, nunca impone"*.

grana-v2 tenía un autocategorizador de 2 capas: (1) **historial del usuario** y (2) **keywords del sistema** (diccionario 260+). Este change implementa **solo la Capa 1 (historial)** — barata, personalizada y sin diccionario que mantener. La Capa 2 (keywords) queda como un change aparte.

## What Changes

- Al escribir la **descripción** en un ingreso/gasto, el sistema busca la **última transacción del usuario con esa misma descripción** (exacta, normalizada) y ofrece su categoría (y subcategoría si la había) como **sugerencia en un chip**: *"¿Supermercado? · la última vez lo pusiste ahí"*.
- El chip **sugiere, no autocompleta**: tocarlo aplica la categoría/subcategoría; ignorarlo no hace nada (pilar "sugiere y enseña, nunca impone"). El "porqué" es la parte de *enseñar*.
- Aparece solo cuando hay sugerencia **y** el usuario todavía no eligió categoría. Dispara al salir del campo descripción.
- **Match exacto normalizado** (lowercase + trim); el tipo debe coincidir (un gasto no sugiere categoría de ingreso).
- Solo aplica a **ingreso/gasto** (transfer/ajuste/cambio no tienen categoría).
- **Fuera de alcance:** la Capa 2 (keywords) — su propio change futuro.

## Capabilities

### Modified Capabilities
- `transactions`: agrega la sugerencia de categoría por historial durante el alta de ingreso/gasto.

## Impact

- **Query** (server action o `lib/`): buscar la última tx del user con `description ILIKE <normalizado>`, `category_id` no nulo, `is_parent=false`, tipo coincidente → categoría + subcategoría (+nombres).
- **UI**: un chip de sugerencia en los flujos de alta (form global de Movimientos + alta por-cuenta), junto al campo categoría.
- **Cross-platform**: la query vive en el `lib/` de cada app; mobile la replica después. Para la Capa 1 no hace falta paquete compartido.
- Sin migración, sin cambios de schema. Claves i18n nuevas.
- **Secuencia:** implementar **después de mergear `add-currency-exchange` (Fase 2)** — ambos tocan los mismos forms de alta (`movement-form.tsx`, alta por-cuenta) y main ya re-i18n-izó esos forms; conviene construir sobre el form final para evitar conflictos.
