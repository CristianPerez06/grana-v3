import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MonthBalanceChart } from './month-balance-chart'
import type { MonthBalanceDay } from '@/lib/dashboard/types'

const meta: Meta<typeof MonthBalanceChart> = {
  title: 'Dashboard/MonthBalanceChart',
  component: MonthBalanceChart,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[640px] rounded-2xl border border-border bg-card p-6">
        {Story()}
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MonthBalanceChart>

const buildDays = (
  totalDays: number,
  step: (day: number) => { income: number; expense: number },
): MonthBalanceDay[] => {
  const out: MonthBalanceDay[] = []
  let acc = 0
  for (let d = 1; d <= totalDays; d++) {
    const { income, expense } = step(d)
    acc += income - expense
    out.push({ day: d, accumulatedBalance: acc, dailyIncome: income, dailyExpense: expense })
  }
  return out
}

export const HappyMonth: Story = {
  args: {
    days: buildDays(31, (d) => {
      if (d === 15) return { income: 850_000, expense: 0 }
      if (d % 3 === 0) return { income: 0, expense: 18_000 }
      return { income: 0, expense: 6_000 }
    }),
  },
}

export const FlatZeroMonth: Story = {
  args: {
    days: buildDays(31, () => ({ income: 0, expense: 0 })),
  },
}

export const NegativeMonth: Story = {
  args: {
    days: buildDays(30, (d) => {
      if (d === 10) return { income: 200_000, expense: 0 }
      return { income: 0, expense: 12_000 }
    }),
  },
}

export const ShortMonth: Story = {
  args: {
    days: buildDays(28, (d) => ({
      income: d === 5 ? 500_000 : 0,
      expense: d % 2 === 0 ? 10_000 : 5_000,
    })),
  },
}
