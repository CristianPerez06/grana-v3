import type { QueryClient } from '@tanstack/react-query'
import {
  createCreditCard as createCreditCardMutation,
  type CardMutationResult,
} from '@grana/cards'
import { getTodayAR } from '@grana/money-logic'
import { supabase } from '../supabase'
import { invalidateAfterCardMutation } from './invalidation'

// Native analogue of the web shell `createCreditCard` in
// `apps/web/app/_actions/credit-cards.ts`. No 'use server': screens call this
// directly. It resolves the userId, injects `today`, calls the SAME `@grana/cards`
// mutation the web shell calls, maps the neutral result to a native `ActionResult`,
// and on success invalidates the affected query keys. The lib never translates —
// `errorKey` is a catalog path the screen resolves with `useT`; `fieldErrors` are
// already-localized yup strings passed through.

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; errorKey: string; fieldErrors?: Record<string, string> }

// Same mapping as web's translatePostgresError for the `card` kind.
function mapPostgresError(code: string | undefined): string {
  if (code === '23505') return 'cards.errors.duplicate'
  return 'cards.errors.generic'
}

function mapResult(result: CardMutationResult): ActionResult {
  if (result.ok) return { ok: true, id: result.id }
  if (result.fieldErrors) {
    return {
      ok: false,
      errorKey: 'cards.errors.create_failed',
      fieldErrors: result.fieldErrors as Record<string, string>,
    }
  }
  if (result.messageKey) return { ok: false, errorKey: result.messageKey }
  if (result.errorCode) return { ok: false, errorKey: mapPostgresError(result.errorCode) }
  return { ok: false, errorKey: 'cards.errors.create_failed' }
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

export async function createCreditCard(
  queryClient: QueryClient,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await createCreditCardMutation({ supabase, userId, input, today: getTodayAR() }),
  )
  if (result.ok) invalidateAfterCardMutation(queryClient)
  return result
}
