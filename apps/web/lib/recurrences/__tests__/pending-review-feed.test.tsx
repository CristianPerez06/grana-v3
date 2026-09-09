// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'

/**
 * A FAILED READ IS NOT AN EMPTY LIST.
 *
 * The container used to fold the error into "render nothing", which tells the
 * user they have nothing to review when the truth is that nobody knows — the
 * same defect as a swallowed materialization error, one layer up. It is
 * invisible to a helper unit test, because both states render the same amount of
 * markup unless you look at what it says.
 */

const readPending = vi.fn()
const readAccounts = vi.fn()

vi.mock('@/lib/recurrences/queries', () => ({
  getPendingRecurrenceInstances: () => readPending(),
}))
vi.mock('@/lib/accounts/queries', () => ({
  getAccounts: () => readAccounts(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))
// The block itself is rendered by its own surface tests; here the container's
// three answers are what is under test, so a stand-in keeps the DOM readable.
vi.mock('@/lib/recurrences/components/pending-recurrences-block', () => ({
  PendingRecurrencesBlock: ({ pending }: { pending: { id: string }[] }) => (
    <ul data-testid="pending-block">
      {pending.map((instance) => (
        <li key={instance.id}>{instance.id}</li>
      ))}
    </ul>
  ),
}))

const { PendingRecurrencesBlockContainer } = await import(
  '@/lib/recurrences/components/pending-recurrences-block-container'
)

const renderContainer = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingRecurrencesBlockContainer />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  readPending.mockReset()
  readAccounts.mockReset()
  readAccounts.mockResolvedValue({ cash: [], bank: [], credit: [] })
})
afterEach(cleanup)

describe('pending review feed', () => {
  it('a failed read shows an error with a retry', async () => {
    readPending.mockRejectedValue(new Error('network'))
    renderContainer()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('recurrences.materialization.read_failed_title')
    expect(screen.queryByTestId('pending-block')).toBeNull()

    readPending.mockResolvedValue([{ id: 'i1' }])
    await act(async () => {
      screen.getByRole('button', { name: 'recurrences.materialization.retry' }).click()
    })
    await waitFor(() => expect(screen.getByTestId('pending-block')).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an empty list renders nothing — and says nothing about a failure', async () => {
    readPending.mockResolvedValue([])
    const { container } = renderContainer()
    await waitFor(() => expect(readPending).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('rows that were read are handed to the block', async () => {
    readPending.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }])
    renderContainer()
    const block = await screen.findByTestId('pending-block')
    expect(block.textContent).toBe('i1i2')
  })
})
