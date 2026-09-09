// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'

/**
 * Regressions for the "vencimientos por revisar" surfaces.
 *
 * Step 6 rewired eighteen UI files and added no test, and the three defects it
 * was fixing are all invisible to a unit test of the pure helpers: they are
 * about what a screen SHOWS. Each case here is one of them.
 */

const generateAction = vi.fn()
const refresh = vi.fn()

vi.mock('@/app/_actions/recurrences', () => ({
  generateDueRecurrenceInstancesAction: () => generateAction(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))
// Key passthrough: what matters is WHICH message the surface picks, not how it
// reads in Spanish — the wording is asserted by the i18n key suite.
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

const { RecurrenceMaterializationProvider } = await import(
  '@/lib/recurrences/materialization-context'
)
const { MaterializationNotice } = await import(
  '@/lib/recurrences/components/materialization-notice'
)

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

const renderNotice = (queryClient: QueryClient = makeQueryClient()) => {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RecurrenceMaterializationProvider>
        <MaterializationNotice />
      </RecurrenceMaterializationProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

beforeEach(() => {
  // React 19 refuses `act(...)` unless the environment declares itself a test
  // one; without it every state update logs a warning instead of flushing.
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  generateAction.mockReset()
  refresh.mockReset()
})
afterEach(cleanup)

describe('materialization notice', () => {
  it('a failed run is an alert with a retry, not a silent nothing', async () => {
    // The defect: the old trigger swallowed the failure in an empty `catch`, so
    // a user whose backlog could not be rebuilt saw a screen identical to a user
    // with nothing to review — the opposite claim to the true one.
    generateAction.mockResolvedValue({ created: 0, remaining: 0, error: 'boom' })
    renderNotice()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('recurrences.materialization.failed_title')

    generateAction.mockResolvedValue({ created: 3, remaining: 0, error: null })
    await act(async () => {
      screen.getByRole('button', { name: 'recurrences.materialization.retry' }).click()
    })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(generateAction).toHaveBeenCalledTimes(2)
  })

  it('an unfinished rebuild says how much is left and can be continued', async () => {
    // A batch is capped, so a year of daily backlog takes several runs. Without
    // this the user has to reopen the app once per batch to see their own
    // history, with nothing on screen telling them to.
    generateAction.mockResolvedValue({ created: 50, remaining: 120, error: null })
    renderNotice()

    await screen.findByText('recurrences.materialization.remaining')
    generateAction.mockResolvedValue({ created: 50, remaining: 70, error: null })
    await act(async () => {
      screen.getByRole('button', { name: 'recurrences.materialization.continue' }).click()
    })
    await waitFor(() => expect(generateAction).toHaveBeenCalledTimes(2))
    // Still owed, so the notice stays: continuing must not look like finishing.
    expect(screen.getByText('recurrences.materialization.remaining')).toBeTruthy()
  })

  it('says nothing when the run owed nothing', async () => {
    generateAction.mockResolvedValue({ created: 0, remaining: 0, error: null })
    const { container } = renderNotice()
    await waitFor(() => expect(generateAction).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('materializing new occurrences refreshes what shows them', async () => {
    // Creating rows nobody re-reads is the same as not creating them: the feed
    // and the movement list are cached, and the server-rendered surfaces need
    // `router.refresh()`.
    generateAction.mockResolvedValue({ created: 2, remaining: 0, error: null })
    // Seeded BEFORE mounting: the run fires on mount, and a key that does not
    // exist yet cannot be marked invalidated.
    const queryClient = makeQueryClient()
    await queryClient.prefetchQuery({
      queryKey: ['recurrences', 'pending-instances'],
      queryFn: async () => [],
    })
    await queryClient.prefetchQuery({
      queryKey: ['transactions', 'page'],
      queryFn: async () => [],
    })
    renderNotice(queryClient)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(
      queryClient.getQueryState(['recurrences', 'pending-instances'])?.isInvalidated,
    ).toBe(true)
    expect(queryClient.getQueryState(['transactions', 'page'])?.isInvalidated).toBe(true)
  })

  it('a run that created nothing does not churn the caches', async () => {
    generateAction.mockResolvedValue({ created: 0, remaining: 4, error: null })
    renderNotice()
    await screen.findByText('recurrences.materialization.remaining')
    expect(refresh).not.toHaveBeenCalled()
  })
})
