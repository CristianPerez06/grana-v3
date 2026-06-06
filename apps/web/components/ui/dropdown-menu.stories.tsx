import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Pencil, Archive, Trash2, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemDestructive,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'

const meta: Meta = {
  title: 'UI/DropdownMenu',
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj

function MenuDemo({ includeDelete = true }: { includeDelete?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Acciones de la cuenta"
          className="inline-flex size-9 items-center justify-center rounded-lg text-text-soft transition-colors hover:bg-border-soft hover:text-text cursor-pointer"
        >
          <MoreVertical className="size-[17px]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => console.log('editar')}>
          <Pencil className="size-4" aria-hidden /> Editar
        </DropdownMenuItem>
        <DropdownMenuItemDestructive onSelect={() => console.log('archivar')}>
          <Archive className="size-4" aria-hidden /> Archivar
        </DropdownMenuItemDestructive>
        {includeDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItemDestructive onSelect={() => console.log('eliminar')}>
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </DropdownMenuItemDestructive>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const ActiveWithTransactions: Story = { render: () => <MenuDemo includeDelete={false} /> }
export const ActiveWithoutTransactions: Story = { render: () => <MenuDemo /> }
