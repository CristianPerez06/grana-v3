import { classifyPeriodsLifecycle } from '@grana/money-logic'
import { cardAccent, pillTone, resolveEditCycle } from './presentation'
import type { CardTone } from './grouping'
import type {
  CardPeriodDetail,
  CreditCardDetail,
  ActiveInstallment,
  ActiveInstallmentsResult,
} from './detail-queries'

// Pure builder for the card detail screen. Given the already-fetched detail
// reads it derives the whole view-model — the `apagar`/`curso`/`prox` lifecycle,
// the cycle/close/due day counters, `committedARS`, and the empty-state
// branching — as a discriminated union both web and mobile render with their own
// JSX. No I/O: same input → same output.

/** Which statement the detail view is focused on. */
export type PeriodKey = 'apagar' | 'curso' | 'prox'

/** A statement enriched for the detail view (period + its display transactions). */
export type LifecyclePeriod = CardPeriodDetail

/**
 * Plain, serializable view model the page builds and hands to the detail view.
 * No functions, no Date objects — only data.
 */
export type CardDetailViewModel = {
  cardId: string
  accent: string
  creditLimit: number | null
  /** Already-committed total in ARS (sum across visible statements), for the limit panel. */
  committedARS: number
  hasUSD: boolean
  /** Whether at least one statement is already paid (drives the timeline "Pagado" step). */
  hasPaid: boolean
  /** The three lifecycle statements; `apagar`/`prox` may be absent. */
  apagar: LifecyclePeriod | null
  curso: LifecyclePeriod
  prox: LifecyclePeriod | null
  /** Day X of the current cycle and its total length, for the cycle panel. */
  cursoCycleDay: number
  cursoCycleTotal: number
  /** Installments committed within the current cycle (ARS), or 0. */
  cursoInstallmentsARS: number
  /** Days until the current statement closes. */
  cursoDaysToClose: number
  /** Days until / since the a-pagar statement's due date (negative = overdue). */
  apagarDaysToDue: number | null
  /** Active installment purchases for the "Cuotas en curso" tab. */
  installments: ActiveInstallment[]
  installmentsTotalRemaining: number
}

/** Derived data shared by all render branches (computed before the branching). */
export type CardDetailShared = {
  cardHasHistory: boolean
  institutionName: string | null
  accent: string
  /** Sum to seed the edit drawer / limit panel; 0 for the empty states. */
  committedARS: number
  /** Header pill tone; `'ok'` for the empty states. */
  headerTone: CardTone
  /** Read-only billing cycle for the edit drawer. */
  editCycle: ReturnType<typeof resolveEditCycle>
}

/**
 * The screen state for a card detail route. `not-found` mirrors the web page's
 * `notFound()` for degenerate data (history but no resolvable current cycle).
 */
export type CardDetailState =
  | { kind: 'not-found' }
  | { kind: 'new-card'; shared: CardDetailShared }
  | { kind: 'archived-empty'; shared: CardDetailShared }
  | { kind: 'active'; shared: CardDetailShared; vm: CardDetailViewModel }

const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const daysBetweenISO = (fromISO: string, toISO: string): number => {
  const [ay, am, ad] = fromISO.split('-').map(Number)
  const [by, bm, bd] = toISO.split('-').map(Number)
  const a = new Date(ay, am - 1, ad).getTime()
  const b = new Date(by, bm - 1, bd).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

/** Installments (ARS) imputed to a period = pending children with installment_n. */
const installmentsARSOf = (period: CardPeriodDetail): number =>
  period.transactions
    .filter((tx) => tx.installments_total && tx.installments_total > 1 && tx.currency_code === 'ARS')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)

export function resolveCardDetailState({
  cardDetail,
  periods,
  installments,
  todayISO,
}: {
  cardDetail: CreditCardDetail
  /** The descending detail list (`getCardPeriods`), used to resolve lifecycle periods to full detail. */
  periods: CardPeriodDetail[]
  installments: ActiveInstallmentsResult
  todayISO: string
}): CardDetailState {
  const today = parseISODate(todayISO)

  const institutionName =
    cardDetail.other_network_name ??
    (cardDetail.institution as { name?: string } | null)?.name ??
    null

  const accent = cardAccent(
    {
      id: cardDetail.id,
      name: cardDetail.name,
      color_key: cardDetail.color_key,
      icon_key: cardDetail.icon_key,
    },
    cardDetail.institution,
  )

  const editCycle = resolveEditCycle(cardDetail.periods, todayISO)
  const cardHasHistory = cardDetail.periods.some((p) => p.has_payment || p.tx_count > 0)

  const sharedBase = { cardHasHistory, institutionName, accent, editCycle }

  // ── Empty state: tarjeta nueva (no history) ─────────────────────────────────
  if (!cardHasHistory && cardDetail.is_active) {
    return {
      kind: 'new-card',
      shared: { ...sharedBase, committedARS: 0, headerTone: 'ok' },
    }
  }

  // ── Empty state: archived without pendings ──────────────────────────────────
  const hasPendings =
    cardDetail.debtCheck.hasPendingDebt ||
    cardDetail.periods.some((p) => !p.has_payment && p.tx_count > 0)

  if (!cardDetail.is_active && !hasPendings) {
    return {
      kind: 'archived-empty',
      shared: { ...sharedBase, committedARS: 0, headerTone: 'ok' },
    }
  }

  // ── Classify the lifecycle (apagar / curso / prox) ──────────────────────────
  const lifecycle = classifyPeriodsLifecycle(cardDetail.periods, today)
  const byId = new Map(periods.map((p) => [p.id, p]))

  // Resolve each lifecycle period to its full detail (with transactions).
  const apagar = lifecycle.apagar ? byId.get(lifecycle.apagar.id) ?? null : null
  const curso = lifecycle.curso ? byId.get(lifecycle.curso.id) ?? null : null
  const prox = lifecycle.prox ? byId.get(lifecycle.prox.id) ?? null : null

  // Curso is the anchor; if classification couldn't find one (degenerate data),
  // fall back to the latest unpaid period detail.
  const cursoPeriod = curso ?? periods.find((p) => !p.has_payment) ?? periods[0]
  if (!cursoPeriod) return { kind: 'not-found' }

  const cursoCycleTotal = Math.max(1, daysBetweenISO(cursoPeriod.start_date, cursoPeriod.end_date))
  const cursoCycleDayRaw = daysBetweenISO(cursoPeriod.start_date, todayISO)
  const cursoCycleDay = Math.max(0, Math.min(cursoCycleTotal, cursoCycleDayRaw))
  const cursoDaysToClose = Math.max(0, daysBetweenISO(todayISO, cursoPeriod.end_date))

  const apagarDaysToDue = apagar ? daysBetweenISO(todayISO, apagar.due_date) : null

  const committedARS = [apagar, cursoPeriod, prox]
    .filter((p): p is CardPeriodDetail => p !== null)
    .reduce((sum, p) => sum + p.pendingAmountARS, 0)

  const hasUSD = cardDetail.currencies.some(
    (c) => c.currency_code === 'USD' && c.is_active,
  )

  const vm: CardDetailViewModel = {
    cardId: cardDetail.id,
    accent,
    creditLimit: cardDetail.credit_limit,
    committedARS,
    hasUSD,
    hasPaid: cardDetail.periods.some((p) => p.has_payment),
    apagar,
    curso: cursoPeriod,
    prox,
    cursoCycleDay,
    cursoCycleTotal,
    cursoInstallmentsARS: installmentsARSOf(cursoPeriod),
    cursoDaysToClose,
    apagarDaysToDue,
    installments: installments.items,
    installmentsTotalRemaining: installments.totalRemaining,
  }

  const headerTone = pillTone(
    apagar?.alert ?? cursoPeriod.alert,
    apagar?.variant ?? cursoPeriod.variant,
  )

  return {
    kind: 'active',
    shared: { ...sharedBase, committedARS, headerTone },
    vm,
  }
}
