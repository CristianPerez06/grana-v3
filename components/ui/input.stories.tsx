import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = { args: { placeholder: 'you@example.com' } }
export const WithValue: Story = { args: { defaultValue: 'cristian@example.com' } }
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Can't touch this" },
}
export const Invalid: Story = {
  args: { invalid: true, defaultValue: 'not-an-email' },
}
export const Password: Story = {
  args: { type: 'password', defaultValue: 'hunter2' },
}
