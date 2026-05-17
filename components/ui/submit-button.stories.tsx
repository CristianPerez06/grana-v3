import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SubmitButton } from './submit-button'

const meta: Meta<typeof SubmitButton> = {
  title: 'UI/SubmitButton',
  component: SubmitButton,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
}
export default meta

type Story = StoryObj<typeof SubmitButton>

export const Default: Story = { args: { children: 'Submit' } }
export const Pending: Story = { args: { pending: true, children: 'Submitting...' } }
export const SecondaryPending: Story = {
  args: { pending: true, variant: 'secondary', children: 'Saving...' },
}
