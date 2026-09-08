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

/** Un débito que volvió a su cuenta, en SU moneda. */
export type RevertedDebit = {
  amount: number
  currencyCode: string
  accountName: string
}

/** Summary returned by the RPC, used to give the user concrete feedback. */
export type RevertPaymentSummary = {
  /**
   * Los débitos que se revirtieron, uno por cuenta y moneda. Un resumen mixto pagado en
   * dos monedas devuelve dos: NUNCA se suman ni se convierten entre sí.
   */
  reverted: RevertedDebit[]
  /** Charges that went back to `pending`, excluding the sello when it was deleted. */
  movementsReverted: number
  stampTax: RevertedStampTax
  /** `false` cuando solo se revirtió un grupo de pago y el resumen conserva otros. */
  fullyReverted: boolean
}

type RpcSummary = {
  reverted: Array<{
    amount: number | string | null
    currency_code: string | null
    account_name: string | null
  }> | null
  movements_reverted: number | null
  stamp_tax: string | null
  fully_reverted: boolean | null
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
  /**
   * Grupo de pago a revertir. Omitirlo revierte TODO el resumen, que es lo que ofrece
   * la UI. Un grupo son todas las patas nacidas de una misma operación: revertir una
   * sola dejaría medio pago que el usuario nunca hizo así.
   */
  groupId?: string
}): Promise<CardMutationResult & { summary?: RevertPaymentSummary }> {
  const { supabase, periodId, groupId } = args

  const { data, error } = await supabase.rpc('revert_card_period_payment', {
    p_period_id: periodId,
    ...(groupId ? { p_group_id: groupId } : {}),
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
    if (message.includes('not_latest_payment_group')) {
      return { ok: false, messageKey: 'cards.errors.revert_not_latest_group' }
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
      reverted: (summary.reverted ?? []).map((d) => ({
        amount: Number(d.amount ?? 0),
        currencyCode: d.currency_code ?? 'ARS',
        accountName: d.account_name ?? '',
      })),
      movementsReverted: Number(summary.movements_reverted ?? 0),
      stampTax: isRevertedStampTax(summary.stamp_tax) ? summary.stamp_tax : 'none',
      fullyReverted: summary.fully_reverted ?? true,
    },
  }
}

function isRevertedStampTax(value: string | null): value is RevertedStampTax {
  return value === 'deleted' || value === 'none' || value === 'ambiguous'
}
