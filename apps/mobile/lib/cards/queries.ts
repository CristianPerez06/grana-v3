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
  summarizeCardsMonth,
} from '@grana/cards'
import type {
  CreditCardSummary,
  CardsMonthSummary,
  UpcomingDue,
  CardNetwork,
  CardPeriodAlert,
} from '@grana/cards'

export type {
  CreditCardSummary,
  CardsMonthSummary,
  UpcomingDue,
  CardNetwork,
  CardPeriodAlert,
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
