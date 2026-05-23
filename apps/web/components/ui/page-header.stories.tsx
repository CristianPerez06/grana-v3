import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PageHeader } from './page-header'
import { Button } from './button'

const meta: Meta<typeof PageHeader> = {
  title: 'UI/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="w-[640px]">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof PageHeader>

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
