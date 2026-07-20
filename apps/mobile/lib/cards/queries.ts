// Cards read layer for mobile. The query bodies and pure aggregation live in
// `@grana/cards` (shared with web); these wrappers inject the native Supabase
// client + `getTodayAR()` and keep the app's zero-arg signatures. Types are
// re-exported so the rest of the mobile app keeps importing them from here.

import { supabase } from '../supabase'
import { getTodayAR } from '../date'
import { formatDateISO } from './utils'
import {
  getCreditCards as getCreditCardsImpl,
  getCardNetworks as getCardNetworksImpl,
  getCreditCardDetail as getCreditCardDetailImpl,
  getCardPeriods as getCardPeriodsImpl,
  getCardPeriodDetail as getCardPeriodDetailImpl,
  getActiveInstallments as getActiveInstallmentsImpl,
  summarizeCardsMonth,
} from '@grana/cards'
import type {
  CreditCardSummary,
  CardsMonthSummary,
  UpcomingDue,
  CardNetwork,
  CardPeriodAlert,
  CreditCardDetail,
  CardPeriodDetail,
  ActiveInstallment,
  ActiveInstallmentsResult,
} from '@grana/cards'

export type {
  CreditCardSummary,
  CardsMonthSummary,
  UpcomingDue,
  CardNetwork,
  CardPeriodAlert,
  CreditCardDetail,
  CardPeriodDetail,
  ActiveInstallment,
  ActiveInstallmentsResult,
}

// ─── getCreditCards ────────────────────────────────────────────────────────────
// Full per-card summary (`inProgress` + `activeInstallmentsCount` included),
// identical shape to web — both consume the shared `@grana/cards` read slice.

export async function getCreditCards(
  options: { includeArchived?: boolean; archivedOnly?: boolean } = {},
): Promise<CreditCardSummary[]> {
  return getCreditCardsImpl(supabase, { ...options, today: getTodayAR() })
}

// ─── Listing-level aggregate: "A pagar" + "En curso" + próximos cierres ───────

export async function getCardsMonthSummary(): Promise<CardsMonthSummary> {
  const cards = await getCreditCards({ includeArchived: false })
  return summarizeCardsMonth(cards, formatDateISO(getTodayAR()))
}

// ─── Card networks catalog ─────────────────────────────────────────────────────

export async function getCardNetworks(): Promise<CardNetwork[]> {
  return getCardNetworksImpl(supabase)
}

// ─── Detail read layer ─────────────────────────────────────────────────────────
// Thin wrappers over the shared `@grana/cards` detail reads: inject the native
// client + `getTodayAR()`, keep zero-arg signatures (bar `id`). The `/cards/[id]`
// screen fetches these three and feeds them to `resolveCardDetailState`. The
// nested-route reads (`getCardPeriodDetail`/`getCardPeriodTransactionCount`) are
// deferred with the routes that consume them.

export async function getCreditCardDetail(id: string): Promise<CreditCardDetail | null> {
  return getCreditCardDetailImpl(supabase, id, getTodayAR())
}

export async function getCardPeriods(id: string): Promise<CardPeriodDetail[]> {
  return getCardPeriodsImpl(supabase, id, getTodayAR())
}

export async function getCardPeriodDetail(periodId: string): Promise<CardPeriodDetail | null> {
  return getCardPeriodDetailImpl(supabase, periodId, getTodayAR())
}

export async function getActiveInstallments(id: string): Promise<ActiveInstallmentsResult> {
  return getActiveInstallmentsImpl(supabase, id)
}
