import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FormField } from './form-field'

const meta: Meta<typeof FormField> = {
  title: 'UI/FormField',
  component: FormField,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof FormField>

export const Default: Story = {
  args: { label: 'Email', name: 'email', type: 'email', placeholder: 'you@example.com' },
}

export const WithDescription: Story = {
  args: {
    label: 'Password',
    name: 'password',
    type: 'password',
    description: 'Must be at least 8 characters.',
  },
}

export const WithError: Story = {
  args: {
    label: 'Email',
    name: 'email',
    type: 'email',
    defaultValue: 'not-an-email',
    error: 'Please enter a valid email address.',
  },
}

export const Disabled: Story = {
  args: { label: 'Username', name: 'username', disabled: true, defaultValue: 'cristian' },
}
