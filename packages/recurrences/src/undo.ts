import type { GranaSupabaseClient } from '@grana/supabase'
import {
  DELETE_GUARD_CODES,
  deleteTransaction,
  type DeleteTransactionResult,
} from '@grana/transactions-mutations'
import { describeBlockingSettlements, type BlockingSettlements } from './link'

/**
 * DELETING A MOVEMENT, AND THE TWO DOORS OF «DESHACER» (#104).
 *
 * «Deshacer» on a rule's history row and «Eliminar» on the movement's detail are
 * ONE operation: both delete the movement, and the database reopens the
 * occurrence it resolved (0075). This is the call both doors make, on both apps,
 * so they cannot answer differently.
 *
 * It lives here and not in `@grana/transactions-mutations` for the direction of
 * the dependency: describing WHICH settlement blocks the delete — revert it,
 * cancel it, or wait for the other member to — is `describeBlockingSettlements`,
 * which is this package's. Without it the rejection said «revertí» even over a
 * pending settlement, which cannot be reverted.
 */
export async function deleteMovementExplained(
  supabase: GranaSupabaseClient,
  userId: string,
  transactionId: string,
  options: { today?: string } = {},
): Promise<DeleteTransactionResult & { blockedBy?: BlockingSettlements }> {
  const result = await deleteTransaction(supabase, userId, transactionId, options)
  if (result.ok || result.errorCode !== 'GRN01') return result

  const blockedBy = await describeBlockingSettlements(supabase, { transactionId, userId })
  return { ...result, blockedBy: blockedBy ?? { action: 'unknown', multiple: false } }
}

/**
 * WHICH MESSAGE A REJECTED DELETE GETS — as i18n keys relative to
 * `transactions.delete_errors.`, one table for both apps. Web used to hold these
 * as literal Spanish strings and native showed «Algo salió mal» for all of them,
 * so the native door of «Deshacer» could not say what to resolve first.
 *
 * Every message names WHERE the block is resolved. Returns `null` for a failure
 * that is not one of these rejections, so the caller keeps its own message.
 * `seeded_recurrence` is not here: it is a question, not a rejection.
 */
export function deleteErrorMessageKeys(result: {
  errorCode?: string
  blockedBy?: BlockingSettlements
}): string[] | null {
  switch (result.errorCode) {
    case DELETE_GUARD_CODES.installmentChild:
      return ['installment_child']
    case DELETE_GUARD_CODES.paid:
      return ['paid']
    case DELETE_GUARD_CODES.settlement:
      return ['settlement']
    case DELETE_GUARD_CODES.cardPayment:
      return ['card_payment']
    case 'GRN01': {
      // Same rule as unlinking (`linkErrorMessageKeys`): name the action the
      // blocking settlement's state allows, and «unknown» is the default — never
      // the most specific advice.
      const action = result.blockedBy?.action
      const key =
        action === 'revert'
          ? 'blocked_revert'
          : action === 'cancel_own'
            ? 'blocked_cancel_own'
            : action === 'cancel_other'
              ? 'blocked_cancel_other'
              : 'blocked_unknown'
      return result.blockedBy?.multiple ? [key, 'blocked_multiple'] : [key]
    }
    default:
      return null
  }
}

/** Every key `deleteErrorMessageKeys` can return, for the catalog test. */
export const DELETE_ERROR_MESSAGE_KEYS: readonly string[] = [
  'installment_child',
  'paid',
  'settlement',
  'card_payment',
  'blocked_revert',
  'blocked_cancel_own',
  'blocked_cancel_other',
  'blocked_unknown',
  'blocked_multiple',
]
