import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Label } from './label'
import { Input } from './input'

const meta: Meta<typeof Label> = {
  title: 'UI/Label',
  component: Label,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof Label>

export const Default: Story = { args: { children: 'Email' } }

export const ForInput: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor="story-input">Email</Label>
      <Input id="story-input" placeholder="you@example.com" />
    </div>
  ),
}
