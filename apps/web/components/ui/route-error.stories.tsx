import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NextIntlClientProvider } from 'next-intl'
import esMessages from '@grana/i18n-messages/es.json'
import { RouteError } from './route-error'

const meta: Meta<typeof RouteError> = {
  title: 'UI/RouteError',
  component: RouteError,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof RouteError>

const fakeError = Object.assign(new Error('Connection refused to host db.internal:5432'), {
  digest: 'NEXT_NOT_FOUND',
})

export const Default: Story = {
  args: {
    error: fakeError,
    onRetry: () => alert('retry clicked'),
  },
}

export const WithErrorDetails: Story = {
  args: {
    error: fakeError,
    onRetry: () => alert('retry clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'In development the component shows `error.message` and `error.digest` to aid debugging. In production those details are hidden — only the generic title and the retry button remain.',
      },
    },
  },
}

export const NoErrorMessage: Story = {
  args: {
    error: new Error(''),
    onRetry: () => alert('retry clicked'),
  },
}
