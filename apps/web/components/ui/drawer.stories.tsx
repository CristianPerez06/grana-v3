import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Button } from './button'
import { Drawer } from './drawer'

/**
 * `Drawer` is a side panel at `md` and up and a bottom sheet below it. The
 * switch is a media query on the preview iframe's width, so the `Sheet*`
 * stories pin it via the viewport toolbar rather than by constraining a
 * container.
 */
const meta: Meta<typeof Drawer> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Drawer>

function DrawerDemo({ side, rows = 1 }: { side?: 'right' | 'left'; rows?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-8">
      <div className="w-40">
        <Button onPress={() => setOpen(true)}>Abrir drawer</Button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} side={side} ariaLabel="Demo drawer">
        {/* The header / scrollable body / footer triple most consumers use.
            It is what lets the sheet hug short content and still hand the body
            a bounded scroll region once the panel hits its 90dvh cap. */}
        <div className="shrink-0 border-b border-border bg-card px-7 py-5">
          <p className="text-2xl font-extrabold tracking-tight text-text">Registrar movimiento</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-7">
          <div className="flex flex-col gap-4">
            {Array.from({ length: rows }, (_, i) => (
              <p key={i} className="text-sm text-text-muted">
                Cuerpo scrolleable del drawer.
              </p>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-card px-7 py-4">
          <Button onPress={() => setOpen(false)}>Cerrar</Button>
        </div>
      </Drawer>
    </div>
  )
}

// ── Side panel (md and up) ──────────────────────────────────────────────────

export const Right: Story = { render: () => <DrawerDemo side="right" /> }
export const Left: Story = { render: () => <DrawerDemo side="left" /> }

// ── Bottom sheet (below md) ─────────────────────────────────────────────────

const sheetStory = (rows: number): Story => ({
  globals: { viewport: { value: 'grana' } },
  render: () => <DrawerDemo side="right" rows={rows} />,
})

/**
 * Short content: the sheet hugs it and leaves the page visible above. `side`
 * and `widthPx` are inert at this width — the same call renders a right-hand
 * panel above `md`.
 */
export const SheetShort: Story = sheetStory(1)

/** Enough content to hit the 90dvh cap, so the body scrolls inside the sheet. */
export const SheetTall: Story = sheetStory(40)
