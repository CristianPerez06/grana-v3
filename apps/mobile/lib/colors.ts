// Mirror temporal de un subset de tokens de `@grana/ui-tokens` para uso en JS
// (props `color` de React Native, valores inline `style`). NativeWind ya
// resuelve las clases utilitarias (`bg-card`, `text-text-soft`, etc.) leyendo
// el mismo paquete vía `tailwind.config.js`; este archivo cubre los casos
// donde el componente necesita el valor numérico directamente.
//
// Cuando aterrice el codegen TS que genera estos valores desde `theme.css`
// (ver memoria `project_ui_tokens_tailwind_v4`), reemplazar este archivo por
// un import del package.

export const colors = {
  navy: '#0B1A2B',
  positive: '#10B981',
  error: '#C54B3C',
  text: '#0B1A2B',
  textSoft: '#8A94A3',
  card: '#FFFFFF',
  borderSoft: '#EEF1F4',
  white: '#FFFFFF',
} as const
