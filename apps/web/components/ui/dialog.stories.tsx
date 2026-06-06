import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Button } from './button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './dialog'

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Dialog>

function DialogDemo({
  loading = false,
  error,
}: {
  loading?: boolean
  error?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-8">
      <div className="w-40">
        <Button onPress={() => setOpen(true)}>Abrir dialog</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Confirmar archivar cuenta">
        <DialogHeader>¿Archivar «Galicia · Débito»?</DialogHeader>
        <DialogBody>
          <p>
            La cuenta queda con sus movimientos intactos pero deja de aparecer en la lista activa.
            Podés reactivarla cuando quieras.
          </p>
          {error && <p className="text-sm font-medium text-negative">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" loading={loading}>
            Archivar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

export const Idle: Story = { render: () => <DialogDemo /> }
export const Loading: Story = { render: () => <DialogDemo loading /> }
export const WithError: Story = {
  render: () => <DialogDemo error="No pudimos archivar la cuenta. Probá de nuevo." />,
}

function NonDestructiveDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-8">
      <div className="w-40">
        <Button onPress={() => setOpen(true)}>Abrir dialog</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Confirmar acción">
        <DialogHeader>¿Continuar con la acción?</DialogHeader>
        <DialogBody>
          <p>Esto solo es informativo — el CTA primario usa la variante default.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onPress={() => setOpen(false)}>Continuar</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

export const NonDestructive: Story = { render: () => <NonDestructiveDemo /> }
