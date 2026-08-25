import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PageHeader } from './page-header'
import { Button } from './button'

/**
 * `PageHeader` renders two treatments: plain text in the content flow at `md`
 * and up, and a full-bleed navy band below it (see the component's doc
 * comment). The switch is a media query, so it keys off the preview iframe's
 * width — the `Mobile*` stories below pin it via the viewport toolbar.
 */
const meta: Meta<typeof PageHeader> = {
  title: 'UI/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="w-[640px]">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof PageHeader>

// ── Desktop treatment (md and up) ───────────────────────────────────────────

export const TitleOnly: Story = {
  args: { title: 'Cuentas' },
}

export const WithBackLink: Story = {
  args: {
    title: 'Crear cuenta',
    backLink: { href: '/accounts', label: 'Cuentas' },
  },
}

export const WithActions: Story = {
  args: {
    title: 'Período actual',
    actions: <Button variant="ghost">Editar fechas</Button>,
  },
}

export const WithBackLinkAndActions: Story = {
  args: {
    title: '01/05/2026 – 31/05/2026',
    backLink: { href: '/cards/123/periods', label: 'Resúmenes' },
    actions: <Button variant="ghost">Editar fechas</Button>,
  },
}

export const WithDescription: Story = {
  args: {
    title: 'Categorías',
    description: 'Gestioná tus categorías de ingresos y gastos.',
  },
}

export const WithDescriptionAndActions: Story = {
  args: {
    title: 'Categorías',
    description: 'Gestioná tus categorías de ingresos y gastos.',
    actions: <Button>+ Agregar</Button>,
  },
}

// ── Mobile treatment (below md) ─────────────────────────────────────────────

/**
 * The navy band is full-bleed: it cancels the shell's content padding with
 * negative margins (`-mx-4 -mt-5`, matching `app-shell.tsx`'s `px-4 py-5`).
 * Stories reproduce that wrapper so the band is previewed in the same box it
 * renders in, instead of floating in Storybook's own padding.
 */
const mobileStory = (args: Story['args']): Story => ({
  args,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'grana' } },
  decorators: [
    (Story) => (
      <div className="min-h-dvh bg-page">
        <div className="mx-auto w-full max-w-5xl px-4 py-5">{Story()}</div>
      </div>
    ),
  ],
})

/** Tab root: no back link, but its slot is reserved so the band keeps height. */
export const MobileTabRoot: Story = mobileStory({
  title: 'Movimientos',
  description: 'Historial de ingresos, gastos y transferencias.',
  actions: <Button className="w-auto">+ Registrar</Button>,
})

/** Chromeless section root: the back link is the only way out — no tab bar. */
export const MobileChromelessRoot: Story = mobileStory({
  title: 'Tarjetas',
  description: '3 tarjetas · agosto 2026',
  backLink: { href: '/dashboard', label: 'Inicio' },
  actions: <Button className="w-auto">+ Agregar</Button>,
})

/** Nested screen: the back link points at the parent, not the dashboard. */
export const MobileNested: Story = mobileStory({
  title: 'Visa Santander',
  backLink: { href: '/cards', label: 'Tarjetas' },
  actions: <Button variant="ghost">Editar</Button>,
})

/**
 * Loading. The chrome is whole from first paint: the back link and its label
 * are real, the action is present but disabled. Only a *dynamic* title would
 * fall back to a placeholder — never a skeleton over the header.
 */
export const MobileLoading: Story = mobileStory({
  title: 'Cuentas',
  backLink: { href: '/dashboard', label: 'Inicio' },
  actions: (
    <Button className="w-auto" disabled>
      + Nueva
    </Button>
  ),
})

/** Bare title — shows the reserved back-link slot keeping the band's height. */
export const MobileTitleOnly: Story = mobileStory({ title: 'Cuentas' })
