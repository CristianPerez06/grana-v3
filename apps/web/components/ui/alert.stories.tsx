import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Alert } from './alert'

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
  argTypes: {
    variant: { control: 'select', options: ['info', 'success', 'error', 'warning'] },
  },
}
export default meta

type Story = StoryObj<typeof Alert>

export const Info: Story = {
  args: { variant: 'info', children: 'A new version is available.' },
}
export const Success: Story = {
  args: { variant: 'success', children: 'Your changes have been saved.' },
}
export const ErrorAlert: Story = {
  name: 'Error',
  args: {
    variant: 'error',
    children: 'Invalid login credentials. Please try again.',
  },
}
export const Warning: Story = {
  args: { variant: 'warning', children: 'Your session is about to expire.' },
}
export const WithTitle: Story = {
  args: {
    variant: 'success',
    title: 'Check your email',
    children: 'We sent a confirmation link to verify your account.',
  },
}
