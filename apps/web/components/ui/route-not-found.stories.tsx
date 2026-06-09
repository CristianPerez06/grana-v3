import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NextIntlClientProvider } from 'next-intl'
import esMessages from '@grana/i18n-messages/es.json'
import { RouteNotFound } from './route-not-found'

const meta: Meta<typeof RouteNotFound> = {
  title: 'UI/RouteNotFound',
  component: RouteNotFound,
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

type Story = StoryObj<typeof RouteNotFound>

const ns = esMessages.notFound

export const Generic: Story = {
  args: {
    title: ns.generic.title,
    description: ns.generic.description,
    backHref: '/dashboard',
    backLabel: ns.generic.back_label,
  },
}

export const Cards: Story = {
  args: {
    title: ns.cards.title,
    description: ns.cards.description,
    backHref: '/cards',
    backLabel: ns.cards.back_label,
  },
}

export const Accounts: Story = {
  args: {
    title: ns.accounts.title,
    description: ns.accounts.description,
    backHref: '/accounts',
    backLabel: ns.accounts.back_label,
  },
}

export const Transactions: Story = {
  args: {
    title: ns.transactions.title,
    description: ns.transactions.description,
    backHref: '/transactions',
    backLabel: ns.transactions.back_label,
  },
}

export const Categories: Story = {
  args: {
    title: ns.categories.title,
    description: ns.categories.description,
    backHref: '/settings/categories',
    backLabel: ns.categories.back_label,
  },
}
