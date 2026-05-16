import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ArrowRight } from 'lucide-react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
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

type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Log in' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Sign up' } }
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancel' } }
export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete account' },
}
export const Loading: Story = { args: { loading: true, children: 'Saving...' } }
export const WithIcon: Story = {
  args: {
    children: (
      <>
        Continue <ArrowRight className="h-4 w-4" />
      </>
    ),
  },
}
export const AsLink: Story = {
  args: { asChild: true, children: <a href="#">Anchor styled as button</a> },
}
export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } }
