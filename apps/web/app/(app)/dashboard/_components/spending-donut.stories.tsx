import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { CategorySlice } from '@grana/money-logic'
import { EyeMaskProvider } from './eye-mask-context'
import { SpendingDonut } from './spending-donut'

// Slices as `buildCategorySlices` emits them: sorted desc, exact percentages,
// cumulative offsets. Colors come from the category rows in DB.
const SLICES: CategorySlice[] = [
  { categoryId: 'c1', label: 'Comida', color: '#E79A2B', icon: null, value: 112300, percentage: 38, offset: 0 },
  { categoryId: 'c2', label: 'Servicios', color: '#3A6B8A', icon: null, value: 68400, percentage: 23.1, offset: 38 },
  { categoryId: 'c3', label: 'Transporte', color: '#7C5CD6', icon: null, value: 43200, percentage: 14.6, offset: 61.1 },
  { categoryId: 'c4', label: 'Súper', color: '#11B981', icon: null, value: 41600, percentage: 14.1, offset: 75.7 },
  { categoryId: 'c5', label: 'Salud', color: '#C95C86', icon: null, value: 30000, percentage: 10.2, offset: 89.8 },
]

const meta: Meta<typeof SpendingDonut> = {
  title: 'Dashboard/SpendingDonut',
  component: SpendingDonut,
  parameters: { layout: 'centered' },
  args: {
    slices: SLICES,
    total: 295500,
    currency: 'ARS',
    centerLabel: 'Gastos',
  },
}
export default meta

type Story = StoryObj<typeof SpendingDonut>

export const FiveSlices: Story = {
  decorators: [(Story) => <EyeMaskProvider>{Story()}</EyeMaskProvider>],
}

export const SingleSlice: Story = {
  decorators: [(Story) => <EyeMaskProvider>{Story()}</EyeMaskProvider>],
  args: {
    slices: [
      { categoryId: 'c9', label: 'Entretenimiento', color: null, icon: null, value: 10, percentage: 100, offset: 0 },
    ],
    total: 10,
    currency: 'USD',
  },
}

export const Masked: Story = {
  decorators: [(Story) => <EyeMaskProvider initialMasked>{Story()}</EyeMaskProvider>],
}
