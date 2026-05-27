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

## Cómo se consume

```css
/* apps/web/app/globals.css */
@import "@grana/ui-tokens/theme.css";
```
