import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import esMessages from '@grana/i18n-messages/es.json'
import { DatePicker } from './date-picker'
import { todayISO } from '@/lib/date'

const meta: Meta<typeof DatePicker> = {
  title: 'UI/DatePicker',
  component: DatePicker,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <div className="w-[280px]">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof DatePicker>

/** Built-in field trigger: input-like box that opens the full month on click. */
export const FieldVariant: Story = {
  render: () => {
    const [value, setValue] = useState(todayISO())
    return <DatePicker value={value} onChange={setValue} placeholder="Elegí una fecha" />
  },
}

/** Empty state shows the placeholder until a day is picked. */
export const Empty: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return <DatePicker value={value} onChange={setValue} placeholder="Elegí una fecha" />
  },
}

/** `min` disables earlier days (e.g. a recurrence end date bounded by its start). */
export const WithMin: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return <DatePicker value={value} onChange={setValue} min={todayISO()} placeholder="Desde hoy en adelante" />
  },
}

/** Custom trigger (`trigger` prop) — the host renders its own clickable element. */
export const CustomTrigger: Story = {
  render: () => {
    const [value, setValue] = useState(todayISO())
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        trigger={
          <button
            type="button"
            className="rounded-[10px] border border-border bg-card px-4 py-3 text-sm font-semibold text-text"
          >
            📅 {value || 'Elegí una fecha'}
          </button>
        }
      />
    )
  },
}
