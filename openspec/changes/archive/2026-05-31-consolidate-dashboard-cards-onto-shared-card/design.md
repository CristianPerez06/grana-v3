# Diseño — Consolidar las tarjetas del dashboard sobre `Card`

## Estado actual

```
PRIMITIVO Card  apps/web/components/ui/card.tsx
  shell:  rounded-[var(--radius-lg)] (12px) border border-border bg-card shadow-sm   ← SIN padding
  partes: CardHeader (p-6) · CardContent (p-6 pt-0) · CardFooter (p-6 pt-0)
  contrato: CardProps = { className?, children? } en @grana/ui-contracts
  IMPORTADO POR: nadie (leftover de shadcn)

5 SECCIONES DASHBOARD  apps/web/app/(app)/dashboard/_components/
  cada una re-tipea a mano:  rounded-2xl border border-border bg-card p-6 shadow-sm
  ├─ hero-section            min-h-[10rem]
  ├─ month-balance-section   h-full min-h-[26rem] flex flex-col overflow-hidden
  ├─ upcoming-fortnight      h-full min-h-[20rem]
  ├─ welcome-first-move-card border-emerald/30 bg-emerald/5   (variante de énfasis, a mano)
  └─ category-teaser         rounded-lg p-4 SIN bg-card  ← el bug: deriva del resto
```

El primitivo y la práctica del dashboard discrepan en una sola cosa real (radio: 12px vs 18px) y, por lo demás, el dashboard ya usa el shell correcto a mano. El teaser es el único que derivó de verdad.

## Decisión 1 — Modelo composable (shell sin padding + sub-partes)

Elegido explícitamente: se mantiene el kit shadcn (`Card` shell vacío + `CardHeader`/`CardContent`/`CardFooter` que llevan el padding). El padding vive en las **piezas**, no en el shell.

| Alternativa | Veredicto |
|---|---|
| **Composable (shell vacío + piezas con padding)** ✅ | Decisión del usuario. Conserva el kit existente; flexible para contenido full-bleed; el caso sin header ya tiene patrón (`CardContent pt-6`). |
| Shell con `p-6` horneado + sin sub-partes | Más simple, pero descartado: chocaría con `CardContent` (doble padding) y tira a la basura las sub-partes. |

**Consecuencia operativa — `pt-0` asume header.** `CardContent` es `p-6 pt-0` (espera un `CardHeader` arriba que aporte el padding superior). Las tarjetas **sin header** (Hero, bienvenida) usan `CardContent className="pt-6"` para reponer el tope — patrón que la story `Default` ya usa. Las tarjetas con **fila título ↔ acción** (teaser, balance del mes) ponen un `flex items-center justify-between` dentro de `CardHeader` (que es `flex flex-col`), no mapean a título+descripción vertical.

## Decisión 2 — Radio canónico `rounded-2xl` (token `--radius-2xl`)

Trampa de tokens resuelta. En este Tailwind v4 los radios viven dentro de `@theme inline`, así que las utilidades **son** los tokens:

```
  rounded-lg  → --radius-lg  0.75rem (12px)   ← el primitivo Card hoy
  rounded-xl  → --radius-xl  1rem    (16px)   ← "2xl" de Tailwind vanilla, red herring
  rounded-2xl → --radius-2xl 1.125rem(18px)   ← lo que las 5 tarjetas ya renderizan
```

- Las tarjetas del dashboard ya usan `rounded-2xl` = 18px (token), consistente.
- Paper (`design-refs/.../dashboard-desktop.jsx`, líneas 128/184/276) dibuja las tarjetas con `rounded-2xl`. Su valor literal vanilla (16px) es no-autoritativo; por la regla del repo se traduce al **token `rounded-2xl`** que el código ya usa.
- Por eso el `Card` adopta `rounded-2xl` (la utilidad, ya respaldada por el token). **Cero cambio visual** en las tarjetas existentes; el único delta es el teaser, que sube de `rounded-lg`(12) a `rounded-2xl`(18) — parte del fix.

## Decisión 3 — `variant` web-local vía intersection (no forzar mobile)

El usuario pidió usar el mismo `Card` con una **variante `emerald`** (no un override de `className`). La convención `project-conventions` exige que los props comunes vivan en el contrato `@grana/ui-contracts` y, si se agregan ahí, mobile queda obligado a implementarlos (TS rompe `apps/mobile/components/ui/Card.tsx` hasta que lo haga).

Para mantener el scope **web-only**, `variant` se agrega como **prop extra web-local** vía intersection —lo que la misma convención permite explícitamente para props propias de una plataforma:

```ts
// apps/web/components/ui/card.tsx
type CardProps = ContractCardProps & { variant?: 'default' | 'emerald' } & DivProps
```

Cuando mobile necesite la variante (su `WelcomeFirstMoveCard`), se **promueve `variant` al contrato** y se implementa en ambos lados. Tensión asumida: por un tiempo la variante existe solo en web; es deliberado y documentado, no divergencia silenciosa.

## Mapeo por sección

```
  Hero            Card + CardContent(pt-6)                       min-h-[10rem]
  Balance del mes Card + CardHeader(título + navegador mensual,  h-full min-h-[26rem]
                       fila justify-between) + CardContent(chart) flex flex-col overflow-hidden
  Lo que viene    Card + CardHeader(título) + CardContent(listas) h-full min-h-[20rem]
  Bienvenida      Card variant="emerald" + CardContent(pt-6)
  Teaser          Card + CardHeader(título + "Ver desglose",      (gana bg-card → fin del gris)
                       fila justify-between) + CardContent(barras)
```

## Riesgos

- **Balance del mes: estado de carga/error sin layout shift.** La spec exige spinner/error compacto que reemplaza solo el área de chart+footer manteniendo título y navegador visibles, y alto/ancho constantes. Migrar a `CardHeader`/`CardContent` NO debe alterar eso. Mitigación: el navegador y el título van en `CardHeader` (siempre visibles), el área async en `CardContent`; verificar paridad de comportamiento tras migrar.
- **El teaser cambia de fondo (gris → blanco).** Es el fix pedido, no una regresión. Confirmar visualmente que se ve como tarjeta par.
- **Mobile intacto.** Al no tocar el contrato, `pnpm --filter mobile typecheck` no debe verse afectado; verificar.
- **Radio del primitivo 12px → 18px.** Como `Card` no tiene importadores hoy, no impacta otras pantallas; solo cambia cómo se ven las stories de Card. Sin riesgo de regresión externa.
