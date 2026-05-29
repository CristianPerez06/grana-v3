import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Segmented } from './segmented'

const meta: Meta<typeof Segmented> = {
  title: 'UI/Segmented',
  component: Segmented,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof Segmented>

const TYPES = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'cambio', label: 'Cambio' },
]

export const FiveOptions: Story = {
  render: () => {
    const [value, setValue] = useState('gasto')
    return (
      <div className="w-[520px]">
        <Segmented value={value} options={TYPES} onValueChange={setValue} ariaLabel="Tipo de movimiento" />
      </div>
    )
  },
}

export const WithDisabledOptions: Story = {
  render: () => {
    // Edit mode: type can't be changed — every non-active option is disabled.
    const value = 'ingreso'
    const options = TYPES.map((o) => ({ ...o, disabled: o.value !== value }))
    return (
      <div className="w-[520px]">
        <Segmented value={value} options={options} onValueChange={() => {}} ariaLabel="Tipo (edición)" />
      </div>
    )
  },
}
