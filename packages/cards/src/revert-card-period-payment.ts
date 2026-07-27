import type { GranaSupabaseClient } from '@grana/supabase'
import type { CardMutationResult } from './mutations'

/** What the reversal did to the statement's impuesto de sellos movement. */
export type RevertedStampTax =
  /** Deleted — identified by the explicit link, or by an unambiguous heuristic on a legacy payment. */
  | 'deleted'
  /** There was none. */
  | 'none'
  /**
   * Legacy payment (predates the explicit link) whose period holds more than one
   * candidate sello. Nothing was deleted: the consumer MUST tell the user a sello
   * stayed in the statement for manual review.
   */
  | 'ambiguous'

/** Summary returned by the RPC, used to give the user concrete feedback. */
export type RevertPaymentSummary = {
  /** Amount of the debit expense that went back to the payment account. */
  revertedAmount: number
  /** Name of the account the money returned to. */
  paymentAccountName: string
  /** Charges that went back to `pending`, excluding the sello when it was deleted. */
  movementsReverted: number
  stampTax: RevertedStampTax
}

type RpcSummary = {
  reverted_amount: number | string | null
  payment_account_name: string | null
  movements_reverted: number | null
  stamp_tax: string | null
}

/**
 * Undo the payment of a card statement. Single source of truth shared by web and
 * mobile: delegates the whole reversal to the `revert_card_period_payment` RPC so it
 * happens in ONE transaction.
 *
 * Atomicity has to live in the database here (unlike `payCardPeriod`, which orchestrates
 * with manual rollback): the `paid → pending` sweep touches rows that already existed
 * before the operation, so a half-applied reversal leaves a statement nobody can
 * reconstruct — there is no record of which charges were pending beforehand.
 *
 * Reverts the MONEY only. The dates the payment confirmed for the running cycle, the
 * eager estimated period and any consumo reassignment stay as they are: they are facts
 * read off the paper statement, true regardless of whether the payment was entered
 * correctly. The card's learned `stamp_tax_rate` is likewise untouched.
 *
 * Error text is neutral (`messageKey`/`errorCode`), never translated here.
 */
export async function revertCardPeriodPayment(args: {
  supabase: GranaSupabaseClient
  periodId: string
}): Promise<CardMutationResult & { summary?: RevertPaymentSummary }> {
  const { supabase, periodId } = args

  const { data, error } = await supabase.rpc('revert_card_period_payment', {
    p_period_id: periodId,
  })

  if (error) {
    // A later statement of the same card is already paid — reversals go newest first.
    // The blocking period's closing date travels in `details` (RAISE ... USING DETAIL),
    // so we name it without parsing the message.
    if (error.code === 'GRN02') {
      const blockingDate = (error.details ?? '').trim()
      return {
        ok: false,
        messageKey: 'cards.errors.revert_later_period_paid',
        messageParams: blockingDate
          ? { date: blockingDate.split('-').reverse().join('/') }
          : undefined,
      }
    }

    // The RPC's own guards arrive as plain `raise exception` (SQLSTATE P0001).
    const message = error.message ?? ''
    if (message.includes('period_not_found')) {
      return { ok: false, messageKey: 'cards.errors.period_not_found' }
    }
    if (message.includes('not_owner') || message.includes('not_authenticated')) {
      return { ok: false, messageKey: 'cards.errors.period_no_access' }
    }
    if (message.includes('period_not_paid')) {
      return { ok: false, messageKey: 'cards.errors.period_not_paid' }
    }

    return { ok: false, errorCode: error.code, messageKey: 'cards.errors.revert_failed' }
  }

  const summary = data as RpcSummary | null
  if (!summary) {
    return { ok: false, messageKey: 'cards.errors.revert_failed' }
  }

  return {
    ok: true,
    summary: {
      revertedAmount: Number(summary.reverted_amount ?? 0),
      paymentAccountName: summary.payment_account_name ?? '',
      movementsReverted: Number(summary.movements_reverted ?? 0),
      stampTax: isRevertedStampTax(summary.stamp_tax) ? summary.stamp_tax : 'none',
    },
  }
}

function isRevertedStampTax(value: string | null): value is RevertedStampTax {
  return value === 'deleted' || value === 'none' || value === 'ambiguous'
}
