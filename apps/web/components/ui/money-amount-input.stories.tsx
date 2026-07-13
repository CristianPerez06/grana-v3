import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { es } from '@grana/i18n-messages'
import { MoneyAmountInput } from './money-amount-input'
import { MoneyCalculatorPopover } from './money-calculator-popover'

// Interactive harness: a real MoneyAmountInput + calculator, echoing the
// CANONICAL value emitted via onChange so a test (or a human) can see exactly
// what leaves the component vs. what is displayed.
const Harness = ({ allowNegative = false }: { allowNegative?: boolean }) => {
  const [value, setValue] = useState('')
  return (
    <div className="flex w-[320px] flex-col gap-3">
      <div className="flex items-center gap-2 rounded-[13px] border-[1.5px] border-border bg-card px-4 py-3">
        <span className="text-lg font-bold text-text-soft">$</span>
        <MoneyAmountInput
          value={value}
          onChange={setValue}
          allowNegative={allowNegative}
          placeholder="0"
          data-testid="amount"
          className="w-full min-w-0 bg-transparent text-[26px] font-extrabold tabular-nums text-text outline-none placeholder:text-text-soft"
        />
        <MoneyCalculatorPopover seed={value} onResult={setValue} allowNegative={allowNegative} className="shrink-0" />
      </div>
      <pre data-testid="canonical" className="rounded bg-page px-3 py-2 text-sm">
        canonical: {value || '(empty)'}
      </pre>
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'UI/MoneyAmountInput',
  component: Harness,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="es" messages={es}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof Harness>

export const Default: Story = { args: {} }

export const AllowNegative: Story = { args: { allowNegative: true } }
