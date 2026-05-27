## Why

Hoy las cuentas `cash`/`bank` no tienen identidad visual: la lista es solo nombres + números, y el `brand_color` que ya guardamos por institución no se renderiza (solo aparece el nombre del banco como badge de texto gris). Esto va en contra del pilar de marca "personalidad propia" y dificulta distinguir cuentas de un vistazo —sobre todo en los pickers de cuenta, donde equivocarse de cuenta tiene costo contable. Cada app de referencia (Spendee, Mobills, Wallet, Monarch) le da a cada cuenta un avatar (color + ícono); Grana no.

De paso, el spec de `accounts` describe un drift: el requirement de "lista agrupada por tipo" menciona una sección de Tarjetas en carrusel, pero en V3 `accounts` y `cards` son módulos/capabilities separados y la lista de cuentas nunca renderiza tarjetas.

## What Changes

- **Avatar de cuenta**: cada cuenta `cash`/`bank` tiene un avatar visual = **color + ícono**, con **monograma (1ª letra del nombre) como fallback** cuando no hay ícono elegido.
- **Paleta curada** de ~8 colores como tokens nuevos en `@grana/ui-tokens`, afinados para NO colisionar con los colores semánticos (`emerald` = ingreso/positivo, `terracotta` = negativo).
- **Set curado de ~16 íconos** lucide (wallet, banknote, piggy-bank, coins, vault, briefcase, dollar-sign, landmark, credit-card, building-2, house, car, plane, graduation-cap, gift, hand-coins), todos verificados en la versión instalada.
- **Nuevas columnas** `accounts.color_key` y `accounts.icon_key` (text, nullable). Sin backfill de valores ni cambios en el trigger de signup: `NULL` significa "derivar automáticamente" (ver siguiente punto).
- **Semántica unificada `NULL` = auto**: en `NULL`, el avatar se deriva automáticamente — bancos heredan vivo el branding de la institución; efectivo recibe color determinístico + ícono `wallet`. Un valor explícito = override del usuario que queda fijo.
- **Auto-asignación determinística** de color para cuentas `cash` sin elección (hash del id → índice de paleta) para que no salgan todas iguales.
- **Componente `AccountAvatar`** con implementación web + mobile y `AccountAvatarProps` compartido en `@grana/ui-contracts`. Es el primer ladrillo de paridad mobile del módulo cuentas.
- **Selector de color/ícono** en los formularios de crear/editar cuenta (web).
- **Render del avatar** en: lista de cuentas, header de detalle y breakdown del hero del dashboard. (Los pickers de cuenta de los formularios usan un `<select>` nativo que no puede renderizar avatares; mostrarlos ahí queda para un change posterior que reemplace el control por un dropdown custom.)
- **Corrección de spec (Drift A)**: el requirement de la lista de cuentas pasa a describir únicamente `cash` + `bank`; las tarjetas viven en la capability `cards`.

## Capabilities

### New Capabilities
<!-- Ninguna capability nueva: la identidad visual es parte del módulo accounts existente. -->

### Modified Capabilities
- `accounts`: nuevo requirement "cada cuenta tiene un avatar visual (color + ícono) con herencia de institución y fallback a monograma"; modificación del requirement "computa/muestra el detalle" y "lista agrupada por tipo" para incluir el avatar y corregir el Drift A (la lista describe solo cash + bank, sin carrusel de tarjetas).

## Impact

- **DB / migración** (`supabase/migrations/`): nueva migración que agrega `color_key`, `icon_key` a `accounts` (nullable, sin default). Sin backfill de valores ni cambios en el trigger `handle_new_user_default_account` (las filas existentes y "Efectivo" quedan en `NULL` = auto). Regenerar `packages/supabase/src/types.ts`.
- **`@grana/ui-tokens`**: nueva paleta `--account-*` (CSS vars + export del listado de keys).
- **`@grana/ui-contracts`**: nuevo `AccountAvatarProps`; registry de keys (color/ícono) y resolver puro con cadena de fallback (ubicación exacta del resolver se decide en design.md).
- **`apps/web`**: componente `AccountAvatar`, selector de color/ícono en `create-account-form`/`edit-account-form`, render en `account-row`, `account-detail-header`, hero del dashboard y pickers de cuenta. Tipos `AccountWithBalances`/queries amplían los campos `color_key`/`icon_key`.
- **`apps/mobile`**: componente `AccountAvatar` (RN) consumiendo el mismo contract (sin construir aún la lista mobile completa).
- **`@grana/validation`**: `createAccountSchema`/`updateAccountSchema` aceptan `color_key`/`icon_key` opcionales validados contra el registry.
- **Spec** `openspec/specs/accounts/spec.md`: aplicar deltas al archivar.
