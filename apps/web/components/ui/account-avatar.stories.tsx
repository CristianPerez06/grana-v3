import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ACCOUNT_COLOR_KEYS, ACCOUNT_ICON_KEYS } from '@grana/ui-contracts'
import { AccountAvatar } from './account-avatar'

const meta: Meta<typeof AccountAvatar> = {
  title: 'UI/AccountAvatar',
  component: AccountAvatar,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    colorKey: { control: 'select', options: [null, ...ACCOUNT_COLOR_KEYS] },
    iconKey: { control: 'select', options: [null, ...ACCOUNT_ICON_KEYS] },
  },
}
export default meta

type Story = StoryObj<typeof AccountAvatar>

export const WithIcon: Story = {
  args: { colorKey: 'violet', colorOverride: null, iconKey: 'piggy-bank', monogram: 'A', size: 'md' },
}

export const Monogram: Story = {
  args: { colorKey: 'teal', colorOverride: null, iconKey: null, monogram: 'B', size: 'md' },
}

export const InstitutionOverride: Story = {
  args: { colorKey: null, colorOverride: '#FA5F0C', iconKey: 'landmark', monogram: 'G', size: 'md' },
}

export const Small: Story = {
  args: { colorKey: 'indigo', colorOverride: null, iconKey: 'wallet', monogram: 'W', size: 'sm' },
}

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {ACCOUNT_COLOR_KEYS.map((c) => (
        <AccountAvatar key={c} colorKey={c} colorOverride={null} iconKey="wallet" monogram="$" size="md" />
      ))}
    </div>
  ),
}

export const AllIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {ACCOUNT_ICON_KEYS.map((i) => (
        <AccountAvatar key={i} colorKey="slate" colorOverride={null} iconKey={i} monogram="?" size="md" />
      ))}
    </div>
  ),
}
