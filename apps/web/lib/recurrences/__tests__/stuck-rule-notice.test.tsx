// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'

/**
 * THE APP SAYS WHEN A RULE STOPPED MOVING.
 *
 * A rule that piles up unresolved occurrences used to look exactly like a rule
 * the user opened yesterday: a few more rows in a flat list, and nothing naming
 * the situation. That silence is what let #96 run for three months instead of
 * three days.
 *
 * The threshold has its own table tests in `@grana/recurrences`. What is under
 * test here is the SURFACE: one line per stuck rule and never a total, the count
 * saying whether the backlog is still being rebuilt, and a rule that is merely
 * late not being named at all.
 */

const materialization = vi.fn<() => { remaining: number } | null>(() => ({ remaining: 0 }))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const full = namespace ? `${namespace}.${key}` : key
    return values == null ? full : `${full}(${JSON.stringify(values)})`
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/lib/recurrences/materialization-context', () => ({
  useRecurrenceMaterialization: () => materialization(),
}))
vi.mock('@/lib/preferences-context', () => ({ useShowCents: () => false }))
vi.mock('@/lib/date', async () => {
  const actual = await vi.importActual<typeof import('@/lib/date')>('@/lib/date')
  // Fixed, because "overdue" is relative to it. LOCAL midnight, the shape the
  // real `getTodayAR` returns.
  return { ...actual, getTodayAR: () => new Date(2026, 8, 15) }
})

const { PendingRecurrencesBlock } = await import(
  '@/lib/recurrences/components/pending-recurrences-block'
)

afterEach(() => {
  cleanup()
  materialization.mockReturnValue({ remaining: 0 })
})

/** An unresolved occurrence of `rule`, due on `due_date`. */
const owed = (rule: string, name: string, due_date: string) =>
  ({
    id: `${rule}-${due_date}`,
    due_date,
    scheduled_date: due_date,
    status: 'pending',
    amount: 45_000,
    currency_code: 'ARS',
    description: name,
    account: { id: 'a1', name: 'Billetera', type: 'cash' },
    destination_account: null,
    category: null,
    subcategory: null,
    recurrence: {
      id: rule,
      description: name,
      movement_type: 'expense',
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

describe('el aviso de regla trabada', () => {
  it('nombra la regla, desde cuándo y cuántos hay', () => {
    show([
      owed('r1', 'Celular', '2026-06-10'),
      owed('r1', 'Celular', '2026-07-10'),
      owed('r1', 'Celular', '2026-08-10'),
    ])

    expect(
      screen.getByText(
        'recurrences.pending.stuck({"rule":"Celular","since":"10 de jun de 2026","count":3})',
      ),
    ).toBeTruthy()
  })

  it('una línea POR REGLA, nunca un total', () => {
    show([
      owed('r1', 'Celular', '2026-06-10'),
      owed('r1', 'Celular', '2026-07-10'),
      owed('r2', 'Alquiler', '2026-07-23'),
      owed('r2', 'Alquiler', '2026-08-23'),
    ])

    // Two stuck rules are two sentences. A single line summing them would say
    // "tenés 4 vencimientos trabados", which describes a situation nobody is in.
    expect(screen.getAllByText(/recurrences\.pending\.stuck\(/)).toHaveLength(2)
    expect(screen.getByText(/"rule":"Celular"/)).toBeTruthy()
    expect(screen.getByText(/"rule":"Alquiler"/)).toBeTruthy()
  })

  it('NO nombra a una regla que sólo está atrasada', () => {
    // One late vencimiento is someone who did not open the app over the weekend.
    // The row already says "venció hace N días" and that is enough.
    show([owed('r1', 'Celular', '2026-09-12')])

    expect(screen.queryByText(/recurrences\.pending\.stuck\(/)).toBeNull()
  })

  it('dice que el conteo es parcial mientras se reconstruye el atraso', () => {
    materialization.mockReturnValue({ remaining: 12 })
    show([owed('r1', 'Celular', '2026-06-10'), owed('r1', 'Celular', '2026-07-10')])

    // Overdue occurrences materialize in bounded runs, so the number on screen is
    // what exists so far. Presenting it as the total would state a figure the
    // system does not have.
    expect(screen.getByText(/recurrences\.pending\.stuck_partial\(/)).toBeTruthy()
    expect(screen.queryByText(/recurrences\.pending\.stuck\(/)).toBeNull()
  })
})
