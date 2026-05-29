import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { GranaIsotype, GranaLogo } from './grana-logo'

const meta: Meta<typeof GranaLogo> = {
  title: 'UI/GranaLogo',
  component: GranaLogo,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof GranaLogo>

export const Wordmark: Story = {
  args: { width: 220 },
}

export const Isotype: StoryObj<typeof GranaIsotype> = {
  render: () => <GranaIsotype size={96} />,
}

export const IsotypeSizes: StoryObj<typeof GranaIsotype> = {
  render: () => (
    <div className="flex items-end gap-4">
      <GranaIsotype size={32} />
      <GranaIsotype size={48} />
      <GranaIsotype size={64} />
      <GranaIsotype size={96} />
    </div>
  ),
}
