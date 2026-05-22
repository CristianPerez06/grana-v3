import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Spinner } from './spinner'

const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  parameters: { layout: 'centered' },
  argTypes: { size: { control: 'select', options: ['sm', 'md', 'lg'] } },
}
export default meta

type Story = StoryObj<typeof Spinner>

export const Small: Story = { args: { size: 'sm' } }
export const Medium: Story = { args: { size: 'md' } }
export const Large: Story = { args: { size: 'lg' } }

export const OverCardBg: Story = {
  args: { size: 'lg' },
  decorators: [
    (Story) => (
      <div className="flex h-48 w-72 items-center justify-center rounded-xl bg-card shadow-sm">
        <Story />
      </div>
    ),
  ],
}

export const OverPageBg: Story = {
  args: { size: 'lg' },
  decorators: [
    (Story) => (
      <div className="flex h-48 w-72 items-center justify-center rounded-xl bg-page">
        <Story />
      </div>
    ),
  ],
}
