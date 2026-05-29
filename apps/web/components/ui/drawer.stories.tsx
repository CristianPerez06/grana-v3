import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Button } from './button'
import { Drawer } from './drawer'

const meta: Meta<typeof Drawer> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Drawer>

function DrawerDemo({ side }: { side?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-8">
      <div className="w-40">
        <Button onPress={() => setOpen(true)}>Abrir drawer</Button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} side={side} ariaLabel="Demo drawer">
        <div className="border-b border-border bg-card px-7 py-5">
          <p className="text-2xl font-extrabold tracking-tight text-text">Registrar movimiento</p>
        </div>
        <div className="flex-1 overflow-y-auto p-7">
          <p className="text-sm text-text-muted">Cuerpo scrolleable del drawer.</p>
        </div>
        <div className="border-t border-border bg-card px-7 py-4">
          <Button onPress={() => setOpen(false)}>Cerrar</Button>
        </div>
      </Drawer>
    </div>
  )
}

export const Right: Story = { render: () => <DrawerDemo side="right" /> }
export const Left: Story = { render: () => <DrawerDemo side="left" /> }
