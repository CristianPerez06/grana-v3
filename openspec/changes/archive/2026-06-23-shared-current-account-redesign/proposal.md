## Why

Es el **Paso 3** (final) del rediseño de Compartido: el rediseño visible, sobre la base ya estabilizada (Paso 1 seguridad, Paso 2 modelo devengado + bimoneda). El doc de decisiones (`docs/design/shared/decisiones-rediseno.md`) define la **cuenta corriente como columna vertebral** del módulo: un libro que corre entre las dos personas donde cada gasto compartido suma la parte del otro, cada reintegro y liquidación resta, y hay un saldo que corre — con **estados de asiento** y, clave, **reversión por contraasiento (nunca borrado)**. Hoy esa cuenta corriente **no existe**: la deuda se muestra como un número suelto en el hero, el historial de liquidaciones y la composición de la deuda están dispersos, y revertir una liquidación **borra** la historia (`reverse_settlement`). El handoff de diseño (`docs/design/shared/redesign/`) define las tres pantallas: home rediseñada, cuenta corriente nueva y saldar como drawer.

## What Changes

Se implementa en **fases** (es el paso más grande; cada fase es un commit coherente sobre esta rama):

**Fase A · Cuenta corriente (lectura) — B9, B12.** Nueva ruta `/shared/cuenta-corriente`: el **extracto** cronológico derivado (cada asiento con su composición y "qué cambia" en castellano), las **dos cards de saldo** bimoneda, la **ecuación** colapsable ("Cómo llegamos a este saldo": partes del otro + tus partes − reintegros/liquidaciones = saldo), el divisor **"Hoy"** y el tramo **"Lo que se viene"** (proyección). La derivación del libro es una función pura nueva en `@grana/money-logic`. Read-only: no persiste saldo.

**Fase B · Contraasiento — B2, B9.** `reverse_settlement` deja de **borrar**: la reversión preserva la liquidación (estado `reversed`) y agrega un **contraasiento** (asiento opuesto que anula el efecto en el saldo), de modo que el extracto muestra ambas líneas (`Revertida` tachada + `Contraasiento`). Migración + cambio de la RPC. La guarda B2 (no borrar gasto con liquidación viva) del Paso 1 se mantiene; el camino para deshacer es el contraasiento.

**Fase C · Home rediseñada — B8, A2, A3.** El hero pasa a **"Gasto del hogar · neto"** (A3: neto protagonista, bruto/reintegros al costado), la **deuda sale del hero** a una franja/tile propia fija en "hoy" (B8), con accesos **Saldar** + **Cuenta corriente**. El **navegador de mes gobierna solo la actividad** del mes (gasto/desglose); la deuda y la proyección son "hoy" y no se mueven con el navegador (A2). El **drill inline por categoría se conserva**. "Lo que se viene" como tile de proyección.

**Fase D · Saldar como drawer — B10, B11.** Saldar pasa de ruta a **drawer** (mismo patrón que el alta de movimiento): **montos rápidos** Total/parcial con el resto registrado (B11), cuenta de origen con su **saldo disponible**, **aviso de saldo negativo** (ya hecho en Paso 2), y la **anotación pedagógica** (B10: preview del monto por persona + "la parte de Caro se registra como deuda a tu favor"). El resto del flujo (enviado → tarea del receptor → recibo) se apoya en el handshake `settlement` ya existente.

## Capabilities

### New Capabilities
<!-- Ninguna nueva: la cuenta corriente es una superficie de la capability `shared`. -->

### Modified Capabilities
- `shared`: se agrega la **cuenta corriente** (extracto derivado + ecuación + estados + proyección) como superficie del módulo; la **reversión de liquidación pasa a contraasiento** (preserva historia, no borra); la **home se reorganiza** (deuda fuera del hero, neto protagonista, navegador gobierna solo la actividad); **saldar pasa a drawer** con montos rápidos y anotación pedagógica.

## Impact

- **`packages/money-logic/src/shared.ts`** — nueva derivación del libro: una función pura que, de los splits + settlements + sus fechas, produce el **extracto** (asientos cronológicos con importe firmado, "qué cambia", saldo corriente) y la **ecuación** (los cuatro agregados), por moneda. Reutiliza el gating ya existente (`countsByPeriod`, `gateSplit`).
- **`apps/web/lib/shared/queries.ts`** — `getCurrentAccount(supabase, currency?)`: arma el extracto + ecuación + saldo + proyección desde `collectDebtInputs` (ya existe).
- **`apps/web/app/(app)/shared/cuenta-corriente/`** — ruta nueva (page + componentes; extracto, ecuación colapsable, cards de saldo, selector ARS/USD, proyección).
- **`supabase/migrations/00XX_settlement_contraasiento.sql`** — estado `reversed` + reversal como contraasiento; `reverse_settlement` reescrita (preserva, no borra). Regenerar tipos.
- **`apps/web/app/(app)/shared/(home)/page.tsx`** — rediseño del hero (neto), deuda fuera del hero, navegador solo-actividad, tiles, accesos.
- **`apps/web/app/(app)/shared/settle/`** → drawer (overlay-primitives `Drawer`), montos rápidos, anotación pedagógica; el disparador vive en la home/cuenta corriente.
- **`openspec/specs/shared/spec.md`** — actualizar el requirement de dashboard (A2: navegador gobierna solo la actividad — hoy promete que también mueve la proyección; A3: neto), el de saldar (drawer + montos rápidos + anotación), el del receptor/reversión (contraasiento); **agregar** el requirement de cuenta corriente.
- **Mobile:** lo lleva el tech lead; se dejan la derivación pura (en `money-logic`) y los contratos estables. Web responsive (breakpoint 560px del handoff).
