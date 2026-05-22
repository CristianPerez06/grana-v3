# settings Specification

## Purpose

Agrupa las preferencias de visualización y la administración personal del usuario bajo la ruta `/settings`. Incluye el toggle de mostrar/ocultar centavos en todos los importes (persistido por cookie de 1 año, sin afectar los cálculos), y el acceso a la gestión de categorías personalizadas y subcategorías (las categorías de sistema se ven pero no se editan). Es UI-only: no muta el ledger ni la lógica de cálculo.

## Requirements

### Requirement: El usuario MUST poder activar o desactivar la visualización de centavos

El sistema MUST ofrecer una preferencia llamada "Mostrar centavos" que controla si los montos monetarios se muestran con decimales o redondeados al entero más cercano. Esta preferencia SHALL aplicar a todos los montos de la app (ARS y USD) en todas las vistas donde se muestre dinero: cuentas, transacciones y tarjetas.

La preferencia SHALL persistir entre sesiones mediante una cookie con `maxAge` de 1 año. El valor por defecto SHALL ser `false` (sin centavos).

Implementación:
- Cookie: `show_cents` (`'true'` | `'false'`), path `/`, `sameSite: lax`.
- Server action `setShowCents(value: boolean)` escribe la cookie y llama `revalidatePath('/', 'layout')`.
- Helper `getShowCents(): Promise<boolean>` lee la cookie en Server Components.
- `PreferencesContext` expone el valor a Client Components vía hook `useShowCents()`.
- El layout `(app)/layout.tsx` lee la preferencia y envuelve los hijos con `PreferencesProvider`.
- Las funciones `formatARS(amount, showCents)` y `formatUSD(amount, showCents)` de `lib/format.ts` aceptan el parámetro y ajustan `maximumFractionDigits` (0 sin centavos, 2 con centavos).

#### Scenario: Preferencia desactivada (valor por defecto)

- **WHEN** el usuario no ha configurado la preferencia o la tiene en `false`
- **THEN** los montos se muestran sin decimales (ej: `$ 333`, `U$S 100`)

#### Scenario: Preferencia activada

- **WHEN** el usuario activa "Mostrar centavos" en `/settings`
- **THEN** todos los montos de la app muestran 2 decimales (ej: `$ 333,34`, `U$S 100,00`)
- **AND** el cambio es inmediato en la misma sesión y persiste en sesiones futuras

#### Scenario: Cambio de preferencia

- **WHEN** el usuario cambia el toggle en `/settings`
- **THEN** el sistema escribe la cookie y recarga el layout
- **AND** todos los montos visibles reflejan la nueva preferencia sin recargar la página manualmente

---

### Requirement: El usuario MUST poder administrar sus categorías personalizadas desde configuración

El sistema SHALL proveer acceso a la gestión de categorías (crear, editar, archivar subcategorías y categorías propias) desde la sección `/settings/categories`. Las categorías de sistema SHALL ser visibles pero no editables.

#### Scenario: Acceso a categorías desde settings

- **WHEN** el usuario navega a `/settings`
- **THEN** ve un enlace a "Administrar categorías" que lleva a `/settings/categories`
