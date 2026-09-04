## Why

Dos problemas que se veían como uno solo: "faltan entidades en la lista".

**El catálogo se quedó corto donde el usuario tiene plata.** Se sembró en `0003` con bancos y billeteras, y desde entonces solo creció con `0034` (Santa Fe). Pero el saldo de una cuenta comitente en un broker o de una cuenta en un exchange es plata real que el usuario quiere ver al lado de sus cuentas bancarias, y para eso la única salida era crearse una institución custom — que existe para un solo usuario y hay que rehacer en cada cuenta nueva.

**Y algunas que sí estaban no se dejaban encontrar.** Los cuatro pickers de institución filtraban con `name.toLowerCase().includes(query)`, sin plegar diacríticos. Tipear `uala` NO matchea la fila `Ualá`; tipear `nacion` no matchea `Nación`. La fila estaba en la base y aparecía en la lista sin filtrar, pero desaparecía apenas el usuario empezaba a escribir — y el dropdown entonces le ofrecía "+ Agregar institución", así que el camino natural era terminar con un duplicado custom de una entidad que ya estaba en el catálogo. El owner reportó las dos entidades acentuadas del catálogo (`Ualá`, `Nación`) como "faltantes"; ese fue el síntoma que destapó el bug.

## What Changes

- **Cinco entidades nuevas en el catálogo**, en una sola migración: IOL (InvertirOnline) y Cocos Capital (brokers ALyC), Binance (exchange), AstroPay y ARQ (ex DolarApp) (billeteras multimoneda).
- **El catálogo deja de ser solo "bancos y billeteras argentinas".** Suma brokers y un exchange global usado desde Argentina. La distinción que importa sigue siendo `icon_type`: `bank` (ícono `landmark`) queda reservado para entidades con licencia bancaria; todo lo demás es `wallet`.
- **La búsqueda de instituciones pliega diacríticos**, en las cuatro superficies que la ofrecen (alta/edición de cuenta y alta/edición de tarjeta, web y nativo), vía un único `filterInstitutions` en `@grana/accounts`. `uala` encuentra `Ualá`; `Ualá` sigue encontrando `Ualá`.

### Alternativas descartadas

- **Re-insertar defensivamente Brubank y Ualá.** Se hizo y se revirtió: las dos estaban sembradas desde `0003` y ninguna migración las borra. Insertarlas de nuevo hubiera "arreglado" el síntoma sin tocar la causa, y el bug de la búsqueda habría seguido escondido para la próxima entidad acentuada.
- **Una migración por entidad.** Cinco archivos para cinco `INSERT` sin dependencias entre sí. Una sola migración se aplica una vez y se lee de una.
- **Nombres cortos ("IOL", "ARQ").** El filtro es por substring, así que el nombre es la única superficie de búsqueda. `IOL (InvertirOnline)` y `ARQ (ex DolarApp)` matchean las dos formas en que el usuario puede conocer la entidad.

## Capabilities

### Modified Capabilities

- `schema-base`: el requirement del catálogo pre-cargado cambia de alcance (suma brokers y exchange, sube el piso de entidades) y explicita el criterio de `icon_type`.
- `accounts`: se agrega un requirement sobre el matching de la búsqueda de instituciones, compartido por las cuatro superficies.

## Impact

- `supabase/migrations/0062_seed_institutions_catalog.sql` — nuevo, seed-only.
- `packages/accounts/src/institution-search.ts` — nuevo, con tests.
- Los cuatro pickers: `bank-selector.tsx` y `card-form-ui.tsx` (web), `BankSelector.tsx` e `InstitutionPickerModal.tsx` (mobile).

Sin cambios de schema: no hay que regenerar `packages/supabase/src/types.ts`.

**Deuda conocida, no incluida:** el monograma del avatar es blanco fijo, así que sobre un `brand_color` claro no se lee. Binance (`#F0B90B`) lo expone, y Lemon (`#B5FF00`) ya lo hacía desde `0003`. El fix correcto es elegir el color del texto por luminancia del fondo, en las dos plataformas; queda para una change propia. Los `brand_color` de IOL, Cocos, AstroPay y ARQ son aproximaciones: las fuentes de branding estaban bloqueadas por el egress proxy de la sesión. Corregirlos es un `UPDATE` por slug, no una migración.
