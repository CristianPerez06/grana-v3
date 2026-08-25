import type { Preview } from '@storybook/nextjs-vite'
import { withThemeByClassName } from '@storybook/addon-themes'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'
import '../app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    // Several components switch treatment at `md` (768px) — most visibly
    // `PageHeader`, which becomes a full-bleed navy band below it. A decorator
    // that constrains the container cannot trigger that: media queries key off
    // the preview iframe's width, which is what this controls.
    //
    // `grana` is the reference narrow viewport: 390px is the iPhone 14/15
    // logical width and the same one the design handoff mocks at
    // (`docs/design/web-mobile-chrome/`).
    viewport: {
      options: {
        grana: {
          name: 'grana — mobile (390px)',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        ...INITIAL_VIEWPORTS,
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
}

export default preview
