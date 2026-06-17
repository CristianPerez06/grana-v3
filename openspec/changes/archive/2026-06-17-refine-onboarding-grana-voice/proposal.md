## Why

El onboarding actual es funcional pero desconectado. No comunica la propuesta de valor de Grana ni baja la ansiedad del usuario con dinero. El tono es corporativo ("Una plataforma de gestión financiera"), cuando el usuario nuevo necesita sentir que alguien entiende la vida real: números que no cierran perfecto, ARS y USD separados, control sin drama.

Y peor: al terminar, lo suelta en un **dashboard vacío sin rumbo**. Falta un latido de decisión que lo oriente según cómo quiere usar la app.

La oportunidad: reescribir el onboarding con tono Grana (amigable, cotidiano, con confianza contable) y cerrarlo con una **bifurcación accionable ("Tu Grana, tu decisión")** que materializa el modelo mental novato/experto: ¿llevás todo en una billetera (simple) o personalizás tus cuentas reales (detalle)? Según la elección, la app lo lleva al primer paso de cada camino.

## What Changes

- **Welcome**: Reescritura de copy para establecer promesa clara y tono cercano
- **Initial Balance**: Mejor explicación de qué es el saldo inicial (punto de partida, no ingreso); copy que valide la imprecisión de la vida real
- **Done**: Muestra resumen del saldo, marca onboarding como completado, y reemplaza el CTA único por la **bifurcación de modo de uso** (web)
  - Web: dos cards — **A "Una billetera y listo"** → `/dashboard?nuevo=1` (abre el drawer de movimiento + tour); **B "Mis cuentas, al detalle"** → `/accounts?nuevaCuenta=1` (abre el drawer de alta de cuenta). Al elegir, una confirmación cálida reemplaza toda la pantalla (botón "Vamos 🚀" + "Volver") antes de rutear. **Sin escape: hay que elegir A o B.**
  - Mobile: CTA único "Ir al dashboard" (el flujo de alta móvil no existe aún; sin fork)
- **Drawers (web)**: se abren automáticamente desde query param —movimiento con `/dashboard?nuevo=1`, alta de cuenta con `/accounts?nuevaCuenta=1`— para que ambos caminos se presenten en drawer (consistente), ya que los drawers no son rutas. El param se limpia tras abrir.
- **i18n**: Canon español → traducción EN (la voz nace en español)

Sin pantallas nuevas (el fork vive dentro de `done`), sin modo de usuario persistente, sin hints contextuales, sin alta de movimiento en mobile.

## Capabilities

### Modified Capabilities
- `onboarding`: El flujo setup inicial cambia su propuesta de valor y tono, y su cierre ofrece la bifurcación billetera/cuentas que rutea al primer paso de cada camino. El usuario sale del onboarding con rumbo, no a un dashboard vacío.
- `transactions`: El drawer de alta de movimiento gana la capacidad de abrirse desde un query param (`/dashboard?nuevo=1`), para que flujos fuera del layout `(app)` —como el cierre del onboarding— puedan llevar al usuario directo al alta.
- `accounts`: El drawer de alta de cuenta gana la capacidad de abrirse desde un query param (`/accounts?nuevaCuenta=1`), para que el camino B del onboarding presente la creación de cuenta en drawer (consistente con el resto de la app).

## Impact

**Código**:
- `apps/web/app/(onboarding-wizard)/onboarding/welcome/page.tsx` → reescritura de copy
- `apps/web/app/(onboarding-wizard)/onboarding/initial-balance/_components/initial-balance-form.tsx` → reescritura de labels/hints
- `apps/web/app/(onboarding-wizard)/onboarding/done/page.tsx` → reemplaza CTA único por la bifurcación A/B con confirmación intermedia (probablemente extraído a un client component, ya que el fork requiere estado de selección)
- `apps/web/app/(app)/...` → consumidor que lee `?nuevo=1` y dispara `openCreate()` del `MovementDrawerContext` (candidato: dentro de `MovementDrawerProvider`/`MovementDrawerLoader` o un pequeño efecto en el dashboard)
- `apps/mobile/app/(onboarding)/welcome.tsx` → reescritura de copy
- `apps/mobile/app/(onboarding)/initial-balance.tsx` → reescritura de copy
- `apps/mobile/app/(onboarding)/done.tsx` → actualiza CTA a dashboard (sin fork)

**i18n**:
- `packages/i18n-messages/src/es.json` → copy canon español (incluye copy del fork: encabezado, 2 cards, 2 confirmaciones, escape)
- `packages/i18n-messages/src/en.json` → traducción

**Decisiones arquitectónicas**:
- El fork vive dentro de `done`, no agrega pantallas (D6)
- Confirmación cálida intermedia antes de rutear (D7)
- Puente query-param para el camino A; camino B es ruta real (D8)
- La elección es solo ruteo, sin modo persistente (D9 — follow-up aparte)
- No se incluye alta móvil de movimiento ni fork en mobile (pendiente para cuando exista flujo nativo)
- Tono liviano sin perder confianza contable (un guiño máximo por pantalla)
