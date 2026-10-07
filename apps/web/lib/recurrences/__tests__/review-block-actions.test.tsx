// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * WHAT A ROW OF «VENCIMIENTOS POR REVISAR» OFFERS, AND HOW THE BLOCK STARTS.
 *
 * #162: a vencimiento that already existed only had Confirmar and Omitir, so a
 * user who had already loaded the movement could duplicate it or skip it and
 * lose the link. The row now offers «Ya lo tengo cargado» too — and not «Ya lo
 * pagué», because Confirmar already is that action.
 *
 * And the block starts collapsed whatever it holds (`link-from-review-block`),
 * with the stuck-rule lines outside the fold so a backlog is not hidden by it.
 */

const getCandidates = vi.fn(async () => [])

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const full = namespace ? `${namespace}.${key}` : key
    return values == null ? full : `${full}(${JSON.stringify(values)})`
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/lib/recurrences/materialization-context', () => ({
  useRecurrenceMaterialization: () => ({ remaining: 0 }),
}))
vi.mock('@/lib/preferences-context', () => ({ useShowCents: () => false }))
vi.mock('@/app/_actions/recurrences', () => ({
  confirmRecurrenceInstance: vi.fn(),
  skipRecurrenceInstance: vi.fn(),
  linkMovementToRecurrence: vi.fn(),
  getRecurrenceLinkCandidates: (...args: unknown[]) => getCandidates(...(args as [])),
}))
vi.mock('@/lib/date', async () => {
  const actual = await vi.importActual<typeof import('@/lib/date')>('@/lib/date')
  return { ...actual, getTodayAR: () => new Date(2026, 9, 7) }
})

const { PendingRecurrencesBlock } = await import(
  '@/lib/recurrences/components/pending-recurrences-block'
)

afterEach(() => {
  cleanup()
  getCandidates.mockClear()
})

const owed = (rule: string, due_date: string) =>
  ({
    id: `${rule}-${due_date}`,
    due_date,
    scheduled_date: due_date,
    status: 'pending',
    amount: 900_000,
    currency_code: 'ARS',
    description: 'Sueldo',
    account: { id: 'a1', name: 'Banco', type: 'bank' },
    destination_account: null,
    household_id: null,
    category: null,
    subcategory: null,
    recurrence: {
      id: rule,
      description: 'Sueldo',
      category: null,
      category_id: null,
      subcategory: null,
      subcategory_id: null,
      movement_type: 'income',
      frequency: 'monthly',
      status: 'active',
      currency_code: 'ARS',
    },
  }) as never

const show = (pending: unknown[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PendingRecurrencesBlock pending={pending as never} />
    </QueryClientProvider>,
  )

const header = () => screen.getByRole('button', { expanded: false })

describe('el bloque de vencimientos por revisar', () => {
  it('arranca plegado aunque haya vencidos, con el conteo a la vista', () => {
    show([owed('r1', '2026-08-25'), owed('r2', '2026-09-25'), owed('r3', '2026-10-01')])

    expect(header()).toBeTruthy()
    expect(screen.getByText('recurrences.pending.count({"count":3})')).toBeTruthy()
    expect(screen.queryByText('recurrences.pending.confirm')).toBeNull()
  })

  it('plegado, sigue nombrando las reglas trabadas', () => {
    show([owed('r1', '2026-08-25'), owed('r1', '2026-09-25')])

    expect(screen.getByRole('button', { expanded: false })).toBeTruthy()
    expect(screen.getByText(/recurrences\.pending\.stuck\(/)).toBeTruthy()
  })

  it('una vencida y una futura no son una regla trabada, y las dos cuentan', () => {
    show([owed('r1', '2026-09-25'), owed('r1', '2026-11-23')])

    expect(screen.queryByText(/recurrences\.pending\.stuck\(/)).toBeNull()
    expect(screen.getByText('recurrences.pending.count({"count":2})')).toBeTruthy()
  })

  it('cada fila ofrece Confirmar, «Ya lo tengo cargado» y Omitir, y no «Ya lo pagué»', () => {
    show([owed('r1', '2026-09-25'), owed('r1', '2026-11-23')])
    fireEvent.click(header())

    expect(screen.getAllByText('recurrences.pending.confirm')).toHaveLength(2)
    expect(screen.getAllByText('recurrences.link.already_loaded')).toHaveLength(2)
    expect(screen.getAllByText('recurrences.pending.skip')).toHaveLength(2)
    expect(screen.queryByText(/recurrences\.link\.already_paid\./)).toBeNull()
  })

  it('«Ya lo tengo cargado» busca candidatos para ESE vencimiento, aunque sea futuro', () => {
    show([owed('r1', '2026-11-23')])
    fireEvent.click(header())

    fireEvent.click(screen.getByText('recurrences.link.already_loaded'))

    expect(getCandidates).toHaveBeenCalledWith('r1', '2026-11-23', false)
  })
})
