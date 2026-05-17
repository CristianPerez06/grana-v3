import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PasswordField } from './password-field'

const meta: Meta<typeof PasswordField> = {
  title: 'UI/PasswordField',
  component: PasswordField,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof PasswordField>

export const Default: Story = {
  args: { label: 'Password', name: 'password' },
}

export const WithDescription: Story = {
  args: {
    label: 'Password',
    name: 'password',
    description: 'Must be at least 8 characters with one letter and one number.',
  },
}

export const WithError: Story = {
  args: {
    label: 'Password',
    name: 'password',
    defaultValue: 'short',
    error: 'Password must be at least 8 characters.',
  },
}
