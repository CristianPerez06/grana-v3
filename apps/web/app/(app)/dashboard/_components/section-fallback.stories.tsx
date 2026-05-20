import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SectionFallback } from './section-fallback'

const meta: Meta<typeof SectionFallback> = {
  title: 'Dashboard/SectionFallback',
  component: SectionFallback,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="w-[480px]">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof SectionFallback>

export const Default: Story = {
  args: { message: 'No pudimos cargar los próximos eventos.' },
}

export const HeroError: Story = {
  args: { message: 'No pudimos cargar tu disponible.' },
}
