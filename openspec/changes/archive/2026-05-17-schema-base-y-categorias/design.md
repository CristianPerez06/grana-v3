## Contexto

Grana v3 tiene auth funcionando y el scaffold del monorepo listo, pero cero tablas de dominio. Este cambio establece el piso sobre el que se construye todo lo demás: tablas seed inmutables del mercado argentino, el modelo de categorías de 2 niveles, y los utilitarios de dominio que aplican en todo el codebase.

Estado actual: `supabase/migrations/` solo tiene `0001_profiles.sql`. `packages/validation/` solo tiene esquemas de auth.

## Goals / Non-Goals

**Goals:**
- Crear las tablas seed (currencies, institutions, card_networks) con datos del mercado argentino
- Crear el modelo de categorías y subcategorías con soporte sistema + usuario
- Introducir el tipo `Money` con `decimal.js` como capa de aritmética monetaria segura
- Introducir `getTodayAR()` como fuente única de "hoy" en timezone argentino
- Exponer CRUD de categorías en Configuración

**Non-Goals:**
- Tablas de cuentas, transacciones, o cualquier otro módulo de dominio
- UI de gestión de instituciones o redes de tarjeta (son seed inmutable)
- Autocategorizador (depende de historial de transacciones — módulo futuro)
- Traducción de categorías propias del usuario (son personales, sin clave i18n)

## Decisiones

### D1 — Migraciones como única fuente de verdad del schema

Las migraciones en `supabase/migrations/` son la única fuente de verdad. No se mantiene ningún `schema.sql` de referencia. Los tipos TypeScript se generan a partir de Supabase (`packages/supabase/src/types.ts`).

**Por qué:** v2 tenía dos archivos `schema.sql` divergentes entre sí y ambos desactualizados respecto a la DB real. Mantener un archivo de referencia además de las migraciones crea deuda desde el primer día.

**Alternativa descartada:** `schema.sql` de referencia + migraciones. Requiere sincronización manual permanente.

### D2 — Tipo `Money` en `packages/validation`

La aritmética monetaria usa un branded type `Money` respaldado por `decimal.js`. Vive en `packages/validation/src/money.ts`.

**Por qué:** evita bugs de punto flotante en operaciones monetarias (0.1 + 0.2 ≠ 0.3 en JS nativo). `packages/validation` ya es cross-platform y sin dependencias de plataforma — es el lugar correcto para tipos de dominio puros.

**Regla de uso:** nunca operar sobre `number` directamente para montos. Toda operación monetaria pasa por `Money`. Los valores se almacenan como `NUMERIC(18,2)` en DB y se deserializan a `Money` al llegar a la capa de aplicación.

**Alternativa descartada:** `packages/domain` nuevo. Más correcto semánticamente, pero genera overhead de configuración por una sola clase hoy. Se puede extraer en el futuro si crece.

### D3 — `getTodayAR()` en `apps/web/lib/date.ts`

Helper que retorna la fecha actual en `America/Argentina/Buenos_Aires`. Es la única forma permitida de obtener "hoy" en contextos financieros.

**Por qué:** Argentina no observa DST. El offset UTC−3 es constante. Sin este helper, operaciones ejecutadas entre las 21:00 y las 00:00 AR calculan "hoy" como mañana en UTC, corrompiendo fechas de transacciones. Este bug existió en v2.

**Alternativa descartada:** promover a `packages/` directamente. Se promueve cuando mobile lo necesite.

### D4 — `canonical_name` inmutable en categorías

Cada categoría tiene `name` (display, editable) y `canonical_name` (slug, inmutable desde creación). El `canonical_name` es asignado por el sistema en el momento del INSERT, derivado del nombre inicial, y nunca puede cambiar.

**Por qué:** el autocategorizador (módulo futuro) matchea keywords contra `canonical_name`. Si el nombre visual cambia, el matching no se rompe. También permite migrations de catálogo sin perder el vínculo semántico.

**Implementación:** `canonical_name = slugify(name)` al insertar. Restricción a nivel de DB: columna sin default de actualización, sin trigger de sync.

### D5 — `user_id IS NULL` para entidades del sistema

Categorías y subcategorías del sistema tienen `user_id IS NULL`. Las del usuario tienen `user_id = auth.uid()`. Este patrón aplica a cualquier entidad que tenga variantes seed + usuario.

**RLS:**
- `user_id IS NULL` → SELECT para todos los usuarios autenticados, sin UPDATE/DELETE.
- `user_id = auth.uid()` → SELECT/INSERT/UPDATE/DELETE solo para el propietario.

### D6 — Seed data en migraciones con `ON CONFLICT DO NOTHING`

Las inserciones de seed (currencies, institutions, card_networks, system categories) usan `INSERT ... ON CONFLICT DO NOTHING`. Esto hace las migraciones idempotentes: se pueden re-ejecutar sin errores.

**Por qué:** Supabase ejecuta migraciones en orden y no re-ejecuta las ya aplicadas, pero la idempotencia protege ante resets de DB local y futuros tests de integración.

### D7 — `canonical_name` como clave de traducción para categorías del sistema

Los nombres de las categorías del sistema se traducen usando `canonical_name` como clave en `packages/i18n-messages`. El campo `name` en DB es el display name en español y actúa como fallback.

**Flujo de display:**
```
t(`categories.${category.canonical_name}`)  → traducción activa
  fallback: category.name                   → español desde DB
```

Las categorías propias del usuario no tienen entrada en i18n (son personales). Siempre muestran `category.name`. El mismo patrón aplica a subcategorías usando `subcategories.${subcategory.canonical_name}`.

**Por qué canonical_name y no id:** el `canonical_name` es estable, legible, y semánticamente significativo. Un UUID como clave i18n sería opaco. El `canonical_name` inmutable garantiza que la clave i18n nunca cambia aunque el nombre visual se actualice.

**Cross-platform:** `packages/i18n-messages` ya existe y es compartido entre web y mobile (futuro). Las traducciones de categorías viven ahí y están disponibles en todas las plataformas sin duplicación.

### D8 — Reglas de slugify para `canonical_name`

```
1. Lowercase
2. Normalizar unicode (NFD) y remover diacríticos: á→a, é→e, í→i, ó→o, ú→u, ü→u, ñ→n
3. Reemplazar espacios y separadores por guión: " " → "-"
4. Remover todo carácter que no sea [a-z0-9-]
5. Colapsar guiones múltiples en uno: "--" → "-"
6. Trim guiones al inicio y al final
```

Ejemplos: `"Ropa y calzado"` → `"ropa-y-calzado"` · `"Comida"` → `"comida"` · `"Reintegros / Cashback"` → `"reintegros-cashback"`

**Importante:** v2 usaba guiones bajos en algunos canonical_names (ej: `ropa_y_calzado`). V3 usa guiones en todos los casos para consistencia con convenciones de URL y slugs.

### D9 — Tipo ENUM para `categories.type` y `transactions.type` (anticipado)

El campo `type` de categories usa `TEXT` con un CHECK constraint (`'income'`, `'expense'`, `'both'`), no un ENUM de Postgres. Esto facilita agregar valores futuros sin `ALTER TYPE` que requiere bloqueos de tabla.

**Alternativa descartada:** ENUM de Postgres. Más expresivo en el schema pero costoso de modificar.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| `decimal.js` suma ~30KB al bundle de `packages/validation` | Aceptable para una app financiera. Tree-shaking lo limita a los módulos que lo importen. |
| Seed de institutions desactualizado en el futuro | Las institutions son seed inmutable en DB. Actualizaciones se hacen vía nueva migración. La UI no expone edición. |
| `canonical_name` collision si dos usuarios crean una categoría con el mismo nombre | Unique constraint es `(user_id, canonical_name)` — colisiones solo dentro del mismo usuario. Sistema y usuario tienen namespaces separados por el valor de `user_id`. |
| Categorías del sistema no son localizables | Fuera de scope para v1. El campo `name` es el display name en español. |

## Plan de Migración

```
0002_seed_currencies.sql          → currencies (ARS, USD, EUR)
0003_seed_institutions.sql        → institutions (28 AR)
0004_seed_card_networks.sql       → card_networks (7 redes AR)
0005_categories.sql               → tablas categories + subcategories + RLS
0006_seed_categories.sql          → 13 categorías sistema + subcategorías
```

Cada migración es atómica. Si falla, Supabase hace rollback de esa migración solamente.

## Open Questions

_(ninguna bloqueante — todas las decisiones relevantes están tomadas)_

---

## Apéndice A — Categorías del sistema (seed)

Fuente: migraciones 019 y 034 de v2. Los `canonical_name` en v3 usan guiones (no guiones bajos como en v2).

### Categorías de gastos (12)

| name | canonical_name | color | icon |
|------|---------------|-------|------|
| Comida | `comida` | #F59E0B | 🍔 |
| Transporte | `transporte` | #3B82F6 | 🚌 |
| Salud | `salud` | #10B981 | 🏥 |
| Educación | `educacion` | #06B6D4 | 📚 |
| Entretenimiento | `entretenimiento` | #8B5CF6 | 🎬 |
| Ropa y calzado | `ropa-y-calzado` | #EC4899 | 👕 |
| Hogar | `hogar` | #14B8A6 | 🏠 |
| Servicios | `servicios` | #F97316 | ⚡ |
| Tecnología | `tecnologia` | #64748B | 📱 |
| Impuestos | `impuestos` | #EF4444 | 🏛️ |
| Financiero | `financiero` | #6366F1 | 🏦 |
| Otros gastos | `otros-gastos` | #6B7280 | 📦 |

### Categorías de ingresos (5)

| name | canonical_name | color | icon |
|------|---------------|-------|------|
| Sueldo | `sueldo` | #10B981 | 💼 |
| Freelance | `freelance` | #0EA5E9 | 💻 |
| Inversiones | `inversiones` | #8B5CF6 | 📈 |
| Otros ingresos | `otros-ingresos` | #6B7280 | 💰 |
| Reintegros / Cashback | `reintegros-cashback` | #F59E0B | 🔄 |

### Subcategorías del sistema (31)

| Categoría padre | name | canonical_name |
|-----------------|------|---------------|
| comida | Supermercado | `supermercado` |
| comida | Restaurante | `restaurante` |
| comida | PedidosYa | `pedidosya` |
| comida | Rappi | `rappi` |
| comida | Cafetería | `cafeteria` |
| transporte | Nafta | `nafta` |
| transporte | Uber / Cabify | `uber-cabify` |
| transporte | Transporte público | `transporte-publico` |
| transporte | Estacionamiento | `estacionamiento` |
| salud | Farmacia | `farmacia` |
| salud | Médico | `medico` |
| salud | Obra social | `obra-social` |
| entretenimiento | Netflix / Streaming | `netflix-streaming` |
| entretenimiento | Cine | `cine` |
| entretenimiento | Salidas | `salidas` |
| entretenimiento | Juegos | `juegos` |
| servicios | Luz | `luz` |
| servicios | Gas | `gas` |
| servicios | Internet | `internet` |
| servicios | Celular | `celular` |
| ropa-y-calzado | Ropa | `ropa` |
| ropa-y-calzado | Calzado | `calzado` |
| ropa-y-calzado | Accesorios | `accesorios` |
| hogar | Alquiler | `alquiler` |
| hogar | Limpieza | `limpieza` |
| hogar | Muebles | `muebles` |
| hogar | Reparaciones | `reparaciones` |
| impuestos | Impuesto de sellos | `impuesto-de-sellos` |
| financiero | Comisión compra USD | `comision-compra-usd` |
| financiero | Constitución plazo fijo | `constitucion-plazo-fijo` |
| financiero | Intereses cuenta remunerada | `intereses-cuenta-remunerada` |

---

## Apéndice B — Instituciones financieras argentinas (seed)

28 instituciones. Las 15 primeras son bancos (`icon_type: bank`), las 13 siguientes son billeteras (`icon_type: wallet`).

| name | brand_color |
|------|------------|
| Banco Santander | #E31937 |
| BBVA | #004481 |
| Banco Galicia | #F37021 |
| Banco Nación | #0055A5 |
| Banco Provincia | #006633 |
| Banco Macro | #003366 |
| Brubank | #6B27D5 |
| Banco Hipotecario | #0066B3 |
| HSBC | #DB0011 |
| ICBC | #C8102E |
| Banco Comafi | #003DA5 |
| Banco Patagonia | #00529B |
| Banco Ciudad | #00A0E0 |
| Banco Supervielle | #0076CE |
| Banco Credicoop | #006341 |
| Mercado Pago | #009EE3 |
| Ualá | #7B61FF |
| Naranja X | #FF6600 |
| Personal Pay | #00B4E6 |
| Prex | #00BFA5 |
| Cuenta DNI | #0055A5 |
| Lemon | #B5FF00 |
| Belo | #4ADE80 |
| + 5 más a confirmar con datos reales de v2 | — |

---

## Apéndice C — Redes de tarjeta (seed)

| name | slug | brand_color |
|------|------|------------|
| Visa | `visa` | #1A1F71 |
| Mastercard | `mastercard` | #EB001B |
| American Express | `amex` | #006FCF |
| Cabal | `cabal` | #0A4D8C |
| Naranja | `naranja` | #FF6900 |
| Naranja X | `naranja-x` | #000000 |
| Mercado Pago | `mercado-pago` | #00B1EA |
