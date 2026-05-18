## Por qué

Grana v3 no tiene ninguna tabla de dominio todavía. Todo lo que viene (movimientos, cuentas, tarjetas, economía compartida, sobres) depende de un schema fundacional correcto desde el inicio. Este cambio establece ese piso: las tablas seed inmutables, el modelo de categorías, y los utilitarios de dominio que aplican en todo el codebase.

## Qué Cambia

- **Nuevo:** migraciones SQL que crean las tablas seed (`currencies`, `institutions`, `card_networks`) con sus datos pre-cargados para el mercado argentino
- **Nuevo:** tablas de categorías y subcategorías con soporte para categorías del sistema (seed, inmutables) y propias del usuario (editables), incluyendo el campo `canonical_name` inmutable para el autocategorizador
- **Nuevo:** tipo `Money` en `packages/validation` respaldado por `decimal.js` — aritmética monetaria segura sin punto flotante
- **Nuevo:** helper `getTodayAR()` en `apps/web/lib/date.ts` — fuente única de "hoy" en timezone `America/Argentina/Buenos_Aires`
- **Nuevo:** server actions y queries para el CRUD de categorías y subcategorías
- **Nuevo:** UI de gestión de categorías (lista, crear, editar, archivar) dentro de Configuración

## Capacidades

### Capacidades Nuevas

- `schema-base`: Tablas seed y fundacionales del modelo de dominio — currencies, institutions (28 AR), card_networks (7 redes), categories, subcategories. Incluye las convenciones de tipos monetarios y de fechas que aplican a todo el proyecto.
- `categories`: CRUD de categorías y subcategorías — catálogo de 2 niveles (sistema + usuario), con `canonical_name` inmutable, archivado suave, y restricción de eliminación cuando hay transacciones asociadas.

### Capacidades Modificadas

_(ninguna — no hay specs existentes de dominio)_

## Impacto

- **`supabase/migrations/`**: nuevas migraciones (0002 en adelante) para todas las tablas mencionadas
- **`packages/supabase/src/types.ts`**: se regenera con los nuevos tipos de DB
- **`packages/validation/src/`**: nuevo módulo `money.ts` con el tipo `Money` y helpers de aritmética
- **`apps/web/lib/date.ts`**: nuevo helper `getTodayAR()`
- **`apps/web/app/(app)/settings/categories/`**: nueva sección en configuración
- **Sin breaking changes** — no hay código de dominio existente que romper
