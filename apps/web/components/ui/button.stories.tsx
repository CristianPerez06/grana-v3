import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ArrowRight, Eye } from 'lucide-react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
}
export default meta

type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Guardar' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Cancelar' } }
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ver más' } }
export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Eliminar cuenta' },
}
export const Link: Story = { args: { variant: 'link', children: 'Olvidé mi contraseña' } }
export const Loading: Story = { args: { loading: true, children: 'Guardando...' } }
export const WithIcon: Story = {
  args: {
    children: (
      <>
        Continuar <ArrowRight className="h-4 w-4" />
      </>
    ),
  },
}
export const Disabled: Story = { args: { disabled: true, children: 'No disponible' } }
export const Icon: Story = {
  args: { variant: 'ghost', size: 'icon', 'aria-label': 'Mostrar', children: <Eye size={18} /> },
}

export const AllVariants: Story = {
  name: 'All variants',
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-8">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-col gap-3">
          <p className="text-xs font-mono text-text-soft uppercase tracking-wide">{size}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size={size}>Primary</Button>
            <Button variant="secondary" size={size}>Secondary</Button>
            <Button variant="ghost" size={size}>Ghost</Button>
            <Button variant="destructive" size={size}>Destructive</Button>
            <Button variant="link" size={size}>Link</Button>
            <Button variant="primary" size={size} loading>Loading</Button>
            <Button variant="primary" size={size} disabled>Disabled</Button>
          </div>
        </div>
      ))}
    </div>
  ),
}
