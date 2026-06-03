# @grana/ui-tokens

Design tokens de Grana (paleta de marca, superficies, texto) compartidos entre web y mobile. Tailwind v4 es CSS-first, así que la **fuente de verdad es `theme.css`**; el mirror en JS (`tokens.cjs`) se genera por codegen.

## Por qué este package existe

Un solo lugar para los colores/variables de marca evita que web y mobile driftee en tonos. Web consume el CSS directo; mobile (cuando aterrice) consume el objeto JS generado, sin re-tipear hex a mano.

## Qué exporta

| Export | Qué es |
|---|---|
| `@grana/ui-tokens/theme.css` | Variables CSS (`:root` + variante `.dark`) y `@custom-variant dark`. **Fuente de verdad.** Web lo importa en `globals.css`. |
| `@grana/ui-tokens/tokens` | `tokens.cjs` — objeto `{ colors: { <name>: { DEFAULT, dark? } } }` para Tailwind/RN. **Generado**, no editar a mano. |

## Reglas

- **Editá `theme.css`, nunca `tokens.cjs`.** Tras tocar `theme.css`, regenerá el mirror:
  ```bash
  pnpm --filter @grana/ui-tokens codegen
  ```
  `scripts/codegen.mjs` extrae las vars de `:root` y `.dark` de `theme.css` y reescribe `tokens.cjs`.
- **Colores semánticos, no genéricos.** El negativo es `terracotta`, no rojo (ver paleta en `theme.css`). Traducí referencias de diseño a tokens — nunca pegues hex sueltos en componentes.
- **En mobile, evitá los aliases shadcn-style.** Ver sección "Aliases shadcn-style" abajo — `bg-muted`, `bg-background`, `bg-primary`, etc. solo funcionan en web.

## Cómo se consume

```css
/* apps/web/app/globals.css */
@import "@grana/ui-tokens/theme.css";
```

```js
// apps/mobile/tailwind.config.js
const { colors } = require('@grana/ui-tokens/tokens')
module.exports = {
  presets: [require('nativewind/preset')],
  theme: { extend: { colors } },
}
```

## Aliases shadcn-style — **gotcha cross-platform**

Algunos tokens en `tokens.cjs` están definidos como referencias a CSS variables, no como hex literales. Esto es deliberado: permite que un override de la var en `theme.css` se propague a múltiples aliases sin re-codegen. Pero **solo funciona en web**, porque el browser resuelve `var(--…)` en runtime. En native, NativeWind pasa la string tal cual a RN; RN no entiende CSS variables, y el background renderiza **transparente** (síntoma típico: el View tiene el tamaño correcto pero es invisible, solo se ven los píxeles residuales del `rounded`).

| Alias web | Apunta a | Token nativo equivalente |
|---|---|---|
| `bg-muted` / `text-muted-foreground` | `var(--border-soft)` / `var(--text-muted)` | `bg-border-soft` / `text-text-muted` |
| `bg-background` / `text-foreground` | `var(--page)` / `var(--text)` | `bg-page` / `text-text` |
| `bg-card` / `text-card-foreground` | `var(--card)` / `var(--text)` | `bg-card` / `text-text` |
| `bg-primary` / `text-primary-foreground` | `var(--navy)` / `var(--white)` | `bg-navy` / `text-white` |
| `bg-secondary` / `bg-accent` / `bg-destructive` | varias `var(--…)` | usar el structural directamente |

**Regla operativa**: en web podés usar el alias o el structural — son equivalentes. En mobile **siempre** usá el structural directamente (`bg-border-soft`, `bg-page`, `bg-card`, `bg-navy`, `bg-emerald`, etc.). Hasta que la codegen aplane los aliases a hex literales en `tokens.cjs`, esto sigue siendo un foot-gun.

