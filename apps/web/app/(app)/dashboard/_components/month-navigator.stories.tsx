import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MonthNavigator } from './month-navigator'

const meta: Meta<typeof MonthNavigator> = {
  title: 'Dashboard/MonthNavigator',
  component: MonthNavigator,
  parameters: { layout: 'centered' },
  args: {
    onPrev: fn(),
    onNext: fn(),
  },
}
export default meta

type Story = StoryObj<typeof MonthNavigator>

export const BothEnabled: Story = {
  args: {
    year: 2026,
    month: 4,
  },
}

export const CurrentMonth: Story = {
  args: {
    year: 2026,
    month: 5,
    onNext: undefined,
  },
}

export const TwelveMonthsBack: Story = {
  args: {
    year: 2025,
    month: 5,
    onPrev: undefined,
  },
}
