import type { DbClient } from '@/lib/supabase/db-client'
import { getTodayAR } from '@/lib/date'
import {
  getCardPeriodsWithStatus as getCardPeriodsWithStatusImpl,
  getOrCreatePeriodForDate as getOrCreatePeriodForDateImpl,
} from '@grana/transactions-mutations'
import {
  getCreditCards as getCreditCardsImpl,
  getCreditCardDebtCheck as getCreditCardDebtCheckImpl,
  getCreditCardDetail as getCreditCardDetailImpl,
  getCardPeriods as getCardPeriodsImpl,
  getCardPeriodDetail as getCardPeriodDetailImpl,
  getActiveInstallments as getActiveInstallmentsImpl,
  getCardNetworks as getCardNetworksImpl,
  getCardPeriodTransactionCount as getCardPeriodTransactionCountImpl,
  summarizeCardsMonth,
} from '@grana/cards'
import type {
  CreditCardSummary,
  CreditCardDebtCheck,
  CardPeriodAlert,
  CardsMonthSummary,
  UpcomingDue,
  CardPeriodDetail,
  CreditCardDetail,
  ActiveInstallment,
  ActiveInstallmentsResult,
  CardNetwork,
} from '@grana/cards'
import { formatDateISO } from './utils'
import type { CardPeriodWithPayment } from './types'

// The cards read slice — both the cross-domain list aggregates and the card
// detail read layer — now lives in `@grana/cards` so mobile can reuse it. The
// web wrappers below inject `getTodayAR()`, keep the existing zero-`today`
// signatures and query keys, and re-export the types so the rest of the app
// keeps importing them from here.
export type {
  CreditCardSummary,
  CreditCardDebtCheck,
  CardPeriodAlert,
  CardsMonthSummary,
  UpcomingDue,
  CardPeriodDetail,
  CreditCardDetail,
  ActiveInstallment,
  ActiveInstallmentsResult,
  CardNetwork,
}

// ─── Debt check for archive/delete guards ─────────────────────────────────────
// Body lives in `@grana/cards`; this web wrapper injects the AR date.

export async function getCreditCardDebtCheck(
  supabase: DbClient,
  accountId: string,
): Promise<CreditCardDebtCheck> {
  return getCreditCardDebtCheckImpl(supabase, accountId, getTodayAR())
}

// ─── Load card periods with payment + tx count ────────────────────────────────
// Bodies live in `@grana/transactions-mutations` so the same write-path queries
// can be reused cross-platform. Web wrappers stay zero-arg (create the
// server-side supabase client themselves).

export async function getCardPeriodsWithStatus(
  supabase: DbClient,
  accountId: string,
): Promise<CardPeriodWithPayment[]> {
  return getCardPeriodsWithStatusImpl(supabase, accountId)
}

export async function getOrCreatePeriodForDate(
  supabase: DbClient,
  accountId: string,
  targetDate: string,
): Promise<string> {
  return getOrCreatePeriodForDateImpl(supabase, accountId, targetDate, getTodayAR())
}

// ─── getCreditCards ───────────────────────────────────────────────────────────
// Body lives in `@grana/cards`; this web wrapper injects the AR date.

export async function getCreditCards(
  supabase: DbClient,
  options: { includeArchived?: boolean; archivedOnly?: boolean } = {},
): Promise<CreditCardSummary[]> {
  return getCreditCardsImpl(supabase, { ...options, today: getTodayAR() })
}

// ─── Listing-level aggregate: "A pagar" + "En curso" + próximos cierres ───────

/**
 * Listing-level summary for the cards hero. Thin DB wrapper: loads the per-card
 * data once via `getCreditCards()` (no N+1) and delegates the derivation to the
 * pure `summarizeCardsMonth()`. See that function for the figure definitions.
 */
export async function getCardsMonthSummary(supabase: DbClient): Promise<CardsMonthSummary> {
  const cards = await getCreditCards(supabase, { includeArchived: false })
  return summarizeCardsMonth(cards, formatDateISO(getTodayAR()))
}

// ─── Card detail read layer ───────────────────────────────────────────────────
// Bodies live in `@grana/cards`; these web wrappers inject the AR date and keep
// the existing zero-`today` signatures + query keys.

export async function getCreditCardDetail(
  supabase: DbClient,
  accountId: string,
): Promise<CreditCardDetail | null> {
  return getCreditCardDetailImpl(supabase, accountId, getTodayAR())
}

export async function getCardPeriods(
  supabase: DbClient,
  accountId: string,
): Promise<CardPeriodDetail[]> {
  return getCardPeriodsImpl(supabase, accountId, getTodayAR())
}

export async function getCardPeriodDetail(
  supabase: DbClient,
  periodId: string,
): Promise<CardPeriodDetail | null> {
  return getCardPeriodDetailImpl(supabase, periodId, getTodayAR())
}

export async function getActiveInstallments(
  supabase: DbClient,
  accountId: string,
): Promise<ActiveInstallmentsResult> {
  return getActiveInstallmentsImpl(supabase, accountId)
}

export async function getCardNetworks(supabase: DbClient): Promise<CardNetwork[]> {
  return getCardNetworksImpl(supabase)
}

export async function getCardPeriodTransactionCount(
  supabase: DbClient,
  periodId: string,
): Promise<number> {
  return getCardPeriodTransactionCountImpl(supabase, periodId)
}
