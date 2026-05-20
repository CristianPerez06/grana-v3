import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MaskedAmount } from './masked-amount'
import { EyeMaskProvider } from './eye-mask-context'

const meta: Meta<typeof MaskedAmount> = {
  title: 'Dashboard/MaskedAmount',
  component: MaskedAmount,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof MaskedAmount>

export const VisibleARS: Story = {
  args: { amount: 287_450, currency: 'ARS' },
  decorators: [(Story) => <EyeMaskProvider>{Story()}</EyeMaskProvider>],
}

export const VisibleUSD: Story = {
  args: { amount: 1_240.5, currency: 'USD', showCentsOverride: true },
  decorators: [(Story) => <EyeMaskProvider>{Story()}</EyeMaskProvider>],
}

export const MaskedARS: Story = {
  args: { amount: 287_450, currency: 'ARS' },
  decorators: [
    (Story) => <EyeMaskProvider initialMasked>{Story()}</EyeMaskProvider>,
  ],
}

export const VisibleZero: Story = {
  args: { amount: 0, currency: 'ARS' },
  decorators: [(Story) => <EyeMaskProvider>{Story()}</EyeMaskProvider>],
}
