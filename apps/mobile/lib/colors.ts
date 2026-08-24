// Mirror temporal de un subset de tokens de `@grana/ui-tokens` para uso en JS
// (props `color` de React Native, valores inline `style`). NativeWind ya
// resuelve las clases utilitarias (`bg-card`, `text-text-soft`, etc.) leyendo
// el mismo paquete vía `tailwind.config.js`; este archivo cubre los casos
// donde el componente necesita el valor numérico directamente.
//
// Cuando aterrice el codegen TS que genera estos valores desde `theme.css`
// (ver memoria `project_ui_tokens_tailwind_v4`), reemplazar este archivo por
// un import del package.

import type { AccountColorKey } from '@grana/ui-contracts'

export const colors = {
  navy: '#0B1A2B',
  positive: '#10B981',
  emeraldDeep: '#059669',
  error: '#C54B3C',
  slate: '#3A6B8A',
  plum: '#8A6E98',
  terracotta: '#B56A5A',
  warningDeep: '#B45309',
  text: '#0B1A2B',
  textMuted: '#6B7683',
  textSoft: '#8A94A3',
  card: '#FFFFFF',
  border: '#E6EAEF',
  borderSoft: '#EEF1F4',
  white: '#FFFFFF',
} as const

// Category palette — mirror of the `--cat-*` tokens in theme.css/tokens.cjs.
// Positional fallback for donut slices whose category has no DB color (same
// order as the web SpendingDonut fallback). Keep in sync with tokens.cjs.
export const catPalette = [
  '#10B981', // cat-1
  '#3A6B8A', // cat-3
  '#D9952F', // cat-6
  '#8A6E98', // cat-5
  '#C05C84', // cat-7
  '#B56A5A', // cat-4
  '#0D9488', // cat-2
] as const

// Account avatar palette — mirror of the `--account-*` tokens in
// @grana/ui-tokens/theme.css. RN can't read CSS vars, so these values are used
// inline by `AccountAvatar`. Keep in sync with theme.css (web has a sync test).
export const accountColors: Record<AccountColorKey, string> = {
  slate: '#3A6B8A',
  indigo: '#4C56C0',
  violet: '#7B57C0',
  plum: '#8A6E98',
  magenta: '#C04D86',
  teal: '#1F8F9C',
  cyan: '#2C7FB8',
  clay: '#A8794E',
}
