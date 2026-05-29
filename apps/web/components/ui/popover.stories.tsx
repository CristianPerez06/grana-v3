import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Popover } from './popover'

const meta: Meta<typeof Popover> = {
  title: 'UI/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof Popover>

const ITEMS = ['Galicia · Débito', 'Galicia Visa', 'Billetera', 'Efectivo', 'Chanchito']

export const AccountList: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState(ITEMS[0])
    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button className="w-64 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 text-left text-sm font-semibold text-text">
            {selected}
          </button>
        }
      >
        {ITEMS.map((item) => (
          <button
            key={item}
            onClick={() => {
              setSelected(item)
              setOpen(false)
            }}
            className="flex w-full items-center rounded-[10px] px-3 py-2.5 text-left text-sm text-text hover:bg-[#FBFCFD]"
          >
            {item}
          </button>
        ))}
      </Popover>
    )
  },
}
