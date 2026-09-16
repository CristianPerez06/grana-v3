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

/**
 * An unresolved occurrence of `rule`, due on `due_date`.
 *
 * The rule's name and the occurrence's own `description` are SEPARATE arguments
 * on purpose. Filling both with the same string — which the first version of this
 * suite did — hides the whole question of which one the notice reads.
 */
const owed = (
  rule: string,
  ruleName: string,
  due_date: string,
  over: { description?: string | null; category?: unknown; rule_category_id?: string | null } = {},
) =>
  ({
    id: `${rule}-${due_date}`,
    due_date,
    scheduled_date: due_date,
    status: 'pending',
    amount: 45_000,
    currency_code: 'ARS',
    description: 'description' in over ? over.description : ruleName,
    account: { id: 'a1', name: 'Billetera', type: 'cash' },
    destination_account: null,
    category: over.category ?? null,
    subcategory: null,
    recurrence: {
      id: rule,
      description: ruleName,
      category_id: over.rule_category_id ?? null,
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

  it('avisa UNA SOLA VEZ que todavía se está reconstruyendo, sin colgárselo a cada regla', () => {
    materialization.mockReturnValue({ remaining: 12 })
    show([
      owed('r1', 'Celular', '2026-06-10'),
      owed('r1', 'Celular', '2026-07-10'),
      owed('r2', 'Alquiler', '2026-07-23'),
      owed('r2', 'Alquiler', '2026-08-23'),
    ])

    // Overdue occurrences materialize in bounded runs, so the numbers on screen
    // are what exists so far — but `remaining` is ONE number for the whole run.
    expect(screen.getAllByText('recurrences.pending.stuck_rebuilding')).toHaveLength(1)
    expect(screen.getAllByText(/recurrences\.pending\.stuck\(/)).toHaveLength(2)
  })

  it('una regla PAUSADA no afirma que se está recuperando SU atraso', () => {
    // `remaining` belongs to the active rule; the generator only ever queries
    // `status = 'active'`, so nothing is being recovered for the paused one.
    // Attributing the flag per rule made its line say the opposite.
    materialization.mockReturnValue({ remaining: 12 })
    const paused = [
      owed('r-pausada', 'Gimnasio', '2026-06-10'),
      owed('r-pausada', 'Gimnasio', '2026-07-10'),
    ].map((row) => ({ ...(row as object), recurrence: { ...(row as { recurrence: object }).recurrence, status: 'paused' } })) as never[]
    const active = [owed('r-activa', 'Alquiler', '2026-07-23'), owed('r-activa', 'Alquiler', '2026-08-23')]
    show([...paused, ...active])

    // Both rules are named, each with its own count, and the rebuild sentence is
    // said once for the screen — not once per rule, and not about the paused one.
    expect(screen.getAllByText(/recurrences\.pending\.stuck\(/)).toHaveLength(2)
    expect(screen.getAllByText('recurrences.pending.stuck_rebuilding')).toHaveLength(1)
  })
})

/**
 * THE NOTICE NAMES THE RULE, so it has to read the RULE.
 *
 * `instance.description` and `instance.category` are the occurrence's own
 * snapshot and can be edited one row at a time. Reading them let a single edited
 * pendiente rename the notice, and kept the old name after the rule was renamed.
 */
describe('de dónde sale el nombre', () => {
  it('usa el nombre ACTUAL de la regla, no el de la ocurrencia', () => {
    show([
      owed('r1', 'Fibra hogar', '2026-06-10', { description: 'Internet' }),
      owed('r1', 'Fibra hogar', '2026-07-10', { description: 'Internet' }),
    ])

    expect(screen.getByText(/"rule":"Fibra hogar"/)).toBeTruthy()
    expect(screen.queryByText(/"rule":"Internet"/)).toBeNull()
  })

  it('editar UNA pendiente no renombra el aviso', () => {
    show([
      owed('r1', 'Alquiler', '2026-06-10', { description: 'Alquiler + expensas de junio' }),
      owed('r1', 'Alquiler', '2026-07-10'),
    ])

    // Scoped to the notice: the ROW below does show the occurrence's own
    // description, and that is correct — it describes that occurrence. What must
    // not happen is the notice taking its name from it.
    const notice = screen.getByText(/recurrences\.pending\.stuck\(/)
    expect(notice.textContent).toContain('"rule":"Alquiler"')
    expect(notice.textContent).not.toContain('expensas de junio')
  })

  it('sin descripción, cae en la categoría sólo si sigue siendo la de la regla', () => {
    const catOfRule = { id: 'c-rule', name: 'Servicios', canonical_name: null, user_id: 'u1' }
    show([
      owed('r1', '', '2026-06-10', { description: null, category: catOfRule, rule_category_id: 'c-rule' }),
      owed('r1', '', '2026-07-10', { description: null, category: catOfRule, rule_category_id: 'c-rule' }),
    ])

    expect(screen.getByText(/"rule":"Servicios"/)).toBeTruthy()
  })

  it('una categoría cambiada en la ocurrencia NO nombra al aviso', () => {
    // The occurrence points somewhere else than the rule does, so it is a
    // per-occurrence override and cannot speak for the rule.
    const otherCat = { id: 'c-otra', name: 'Regalos', canonical_name: null, user_id: 'u1' }
    show([
      owed('r1', '', '2026-06-10', { description: null, category: otherCat, rule_category_id: 'c-rule' }),
      owed('r1', '', '2026-07-10', { description: null, category: otherCat, rule_category_id: 'c-rule' }),
    ])

    expect(screen.queryByText(/"rule":"Regalos"/)).toBeNull()
    expect(screen.getByText(/"rule":"transactions\.types\.expense"/)).toBeTruthy()
  })
})
