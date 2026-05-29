import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Switch } from './switch'

const meta: Meta<typeof Switch> = {
  title: 'UI/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof Switch>

export const Off: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)
    return <Switch checked={checked} onValueChange={setChecked} ariaLabel="Demo" />
  },
}

export const On: Story = {
  render: () => {
    const [checked, setChecked] = useState(true)
    return <Switch checked={checked} onValueChange={setChecked} ariaLabel="Demo" />
  },
}

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4">
      <Switch checked={false} onValueChange={() => {}} disabled ariaLabel="Off disabled" />
      <Switch checked onValueChange={() => {}} disabled ariaLabel="On disabled" />
    </div>
  ),
}
