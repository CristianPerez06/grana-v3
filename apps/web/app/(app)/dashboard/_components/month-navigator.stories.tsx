import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MonthNavigator } from './month-navigator'

const meta: Meta<typeof MonthNavigator> = {
  title: 'Dashboard/MonthNavigator',
  component: MonthNavigator,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof MonthNavigator>

export const BothEnabled: Story = {
  args: {
    year: 2026,
    month: 4,
    prevHref: '/dashboard?month=2026-03',
    nextHref: '/dashboard?month=2026-05',
  },
}

export const CurrentMonth: Story = {
  args: {
    year: 2026,
    month: 5,
    prevHref: '/dashboard?month=2026-04',
    nextHref: undefined,
  },
}

export const TwelveMonthsBack: Story = {
  args: {
    year: 2025,
    month: 5,
    prevHref: undefined,
    nextHref: '/dashboard?month=2025-06',
  },
}
