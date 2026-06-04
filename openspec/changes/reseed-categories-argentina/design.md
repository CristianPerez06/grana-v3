# Design — Reseed de categorías (Argentina)

## Context

El catálogo del sistema se siembra una sola vez en `0006_seed_categories.sql` (17 categorías / 31 subcategorías, todas con `user_id IS NULL`). Como `Supabase` es online-only y las migraciones se aplican pegando SQL en el dashboard, `0006` ya está aplicada en prod: **editarla no re-corre nada en prod**. Por eso el enriquecimiento va en una migración nueva.

El nombre visible de una categoría/subcategoría **de sistema** no sale del campo `name` de la DB, sino de i18n (`canonical_name` como clave en `categories.*` / `subcategories.*`). El `name` en DB es solo la etiqueta semilla / fallback. Esto implica:

- Agregar una categoría de sistema **exige** agregar su clave i18n en todos los locales, o `next-intl` lanza `MISSING_MESSAGE`.
- "Renombrar" el display de una categoría de sistema = editar el value en i18n. **No** se toca `canonical_name` (inmutable por spec).

## Goals / Non-Goals

**Goals**
- Catálogo por defecto más completo y argentino, sin huérfanas con 0 subcategorías (salvo `Reintegros/Cashback`, que se deja sin subcategorías a propósito).
- Cambio 100% aditivo y seguro para datos existentes.

**Non-Goals**
- Neutralización pan-LatAm de términos (Nafta vs Gasolina, Obra social vs EPS): se mantiene el sabor AR.
- i18n por país (es-AR vs es-MX): diferido. Hoy un solo string español sirve para todos los locales `es`.
- Cambiar `canonical_name` existentes o borrar subcategorías.
- Cambios en `apps/web` / `apps/mobile` (leen de DB + i18n; las filas nuevas aparecen solas).

## Decisions

### 1. Migración nueva incremental (no editar 0006)
`0028_reseed_categories_argentina.sql` con el mismo patrón que `0006`: `INSERT ... ON CONFLICT DO NOTHING`, las subcategorías se insertan haciendo `join` a `categories` por `canonical_name` con `user_id IS NULL`. Idempotente: re-correrla no duplica. La categoría nueva (`cuidado-personal`) se inserta en el bloque de categorías; sus subcategorías y las de las categorías existentes, en el bloque de subcategorías.

### 2. Renombres de display vía i18n
- `transporte-publico`: value es → `"SUBE/Transporte público"`; en → `"SUBE/Public transport"`.
- `intereses-cuenta-remunerada`: value es → `"Intereses"`; en → `"Interest"`.

`canonical_name` queda igual en ambos casos. El `name` en DB puede dejarse como está (no se muestra para sistema); no es necesario un UPDATE.

### 3. `Reintegros/Cashback` queda sin subcategorías
Decisión de producto: la categoría padre alcanza; el usuario puede crear las suyas. No se fuerzan subcategorías redundantes (Cashback/Devoluciones significaban lo mismo).

### 4. Guardrails que el change DEBE incluir (si no, rompen)
- `validate_schema.sql`: asserts `raise exception` de conteo (17/12/31) → (18/13/71); sumar los `canonical_name` nuevos a los arrays verificados en 8.1D/8.1E.
- i18n `es.json` + `en.json`: claves nuevas para las 41 entradas (1 cat + 40 subcats) + 2 renombres de value.

## Risks / Trade-offs

- **Catálogo más cargado** (71 subcats): más para mantener/traducir y un selector inicial más largo. Mitigado: la app ya soporta archivar/crear, y los rubros elegidos son de uso real (canasta INDEC + apps AR).
- **Olvido de una clave i18n** → `MISSING_MESSAGE` en runtime para esa categoría de sistema. Mitigado: la tarea de verificación incluye un chequeo de que cada `canonical_name` nuevo tiene clave en ambos locales.

## Migration Plan

1. Crear y aplicar `0028` en el dashboard de Supabase (prod) y en cualquier entorno de desarrollo.
2. Desplegar i18n + `validate_schema.sql` + docs en el mismo cambio.
3. Correr `validate_schema.sql` post-migración: debe reportar 18/13/71 sin excepciones.

## Open Questions

Ninguna pendiente: catálogo, slugs, enfoque AR y manejo de `Reintegros/Cashback` ya están decididos con el usuario.

---

## Apéndice A — Catálogo completo (fuente de verdad para la implementación)

`canonical_name` entre paréntesis. `[existente]` = ya en `0006` (no se inserta de nuevo, queda por contexto). El resto es **NUEVO** y se inserta en `0028`.

### Gastos (13 categorías)

**Comida** (`comida`) [existente]
- Supermercado (`supermercado`) [existente] · Restaurante (`restaurante`) [existente] · PedidosYa (`pedidosya`) [existente] · Rappi (`rappi`) [existente] · Cafetería (`cafeteria`) [existente]
- Kiosco/Almacén (`kiosco-almacen`) · Verdulería (`verduleria`) · Carnicería (`carniceria`)

**Transporte** (`transporte`) [existente]
- Nafta (`nafta`) [existente] · SUBE/Transporte público (`transporte-publico`) [existente, display nuevo] · Uber/Cabify (`uber-cabify`) [existente] · Estacionamiento (`estacionamiento`) [existente]
- Peajes (`peajes`) · Service/Mecánico (`service-mecanico`) · Seguro auto (`seguro-auto`) · VTV (`vtv`) · Patente (`patente`)

**Salud** (`salud`) [existente]
- Farmacia (`farmacia`) [existente] · Médico (`medico`) [existente] · Obra social (`obra-social`) [existente]
- Prepaga (`prepaga`)

**Educación** (`educacion`) [existente]
- Cuota colegio (`cuota-colegio`) · Universidad (`universidad`) · Cursos (`cursos`) · Útiles/Libros (`utiles-libros`)

**Entretenimiento** (`entretenimiento`) [existente]
- Netflix/Streaming (`netflix-streaming`) [existente] · Cine (`cine`) [existente] · Salidas (`salidas`) [existente] · Juegos (`juegos`) [existente]

**Ropa y calzado** (`ropa-y-calzado`) [existente]
- Ropa (`ropa`) [existente] · Calzado (`calzado`) [existente] · Accesorios (`accesorios`) [existente]

**Hogar** (`hogar`) [existente]
- Alquiler (`alquiler`) [existente] · Limpieza (`limpieza`) [existente] · Muebles (`muebles`) [existente] · Reparaciones (`reparaciones`) [existente]
- Expensas (`expensas`)

**Servicios** (`servicios`) [existente]
- Luz (`luz`) [existente] · Gas (`gas`) [existente] · Internet (`internet`) [existente] · Celular (`celular`) [existente]
- Agua (`agua`) · Cable/TV (`cable-tv`)

**Cuidado personal** (`cuidado-personal`) · **CATEGORÍA NUEVA**, `type = expense`
- Peluquería (`peluqueria`) · Gimnasio (`gimnasio`) · Cosmética/Higiene (`cosmetica-higiene`) · Skin care (`skin-care`)

**Tecnología** (`tecnologia`) [existente]
- Dispositivos (`dispositivos`) · Apps y suscripciones (`apps-y-suscripciones`) · Gadgets (`gadgets`)

**Impuestos** (`impuestos`) [existente]
- Impuesto de sellos (`impuesto-de-sellos`) [existente]
- Monotributo (`monotributo`) · Tasas municipales (`tasas-municipales`)

**Financiero** (`financiero`) [existente]
- Comisión compra USD (`comision-compra-usd`) [existente] · Plazo fijo (`constitucion-plazo-fijo`) [existente] · Intereses (`intereses-cuenta-remunerada`) [existente, display nuevo]
- Comisiones bancarias (`comisiones-bancarias`) · Compra dólar/MEP (`compra-dolar-mep`)

**Otros gastos** (`otros-gastos`) [existente]
- Regalos (`regalos`) · Donaciones (`donaciones`)

### Ingresos (5 categorías)

**Sueldo** (`sueldo`) [existente]
- Salario (`salario`) · Aguinaldo (`aguinaldo`) · Bono (`bono`)

**Freelance** (`freelance`) [existente]
- Honorarios (`honorarios`) · Proyectos (`proyectos`)

**Inversiones** (`inversiones`) [existente]
- Plazo fijo (`plazo-fijo`) · Dividendos (`dividendos`) · Alquileres cobrados (`alquileres-cobrados`) · Dólar/MEP (`dolar-mep`)

**Otros ingresos** (`otros-ingresos`) [existente]
- Venta (`venta`) · Regalo recibido (`regalo-recibido`)

**Reintegros/Cashback** (`reintegros-cashback`) [existente]
- _(sin subcategorías, a propósito)_

### Conteos resultantes
- Categorías de sistema: **18** (13 `expense` + 5 `income`).
- Subcategorías de sistema: **71** (31 existentes + 40 nuevas).
