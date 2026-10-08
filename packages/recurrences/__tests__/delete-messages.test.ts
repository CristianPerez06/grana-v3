import { describe, expect, it } from 'vitest'
import { DELETE_GUARD_CODES } from '@grana/transactions-mutations'
import { DELETE_ERROR_MESSAGE_KEYS, deleteErrorMessageKeys } from '../src/undo'

describe('deleteErrorMessageKeys', () => {
  it('cada guarda de borrado tiene su mensaje', () => {
    expect(deleteErrorMessageKeys({ errorCode: DELETE_GUARD_CODES.installmentChild })).toEqual([
      'installment_child',
    ])
    expect(deleteErrorMessageKeys({ errorCode: DELETE_GUARD_CODES.paid })).toEqual(['paid'])
    expect(deleteErrorMessageKeys({ errorCode: DELETE_GUARD_CODES.settlement })).toEqual([
      'settlement',
    ])
    expect(deleteErrorMessageKeys({ errorCode: DELETE_GUARD_CODES.cardPayment })).toEqual([
      'card_payment',
    ])
  })

  it('una liquidación pendiente pide cancelarla, nunca revertirla', () => {
    expect(
      deleteErrorMessageKeys({ errorCode: 'GRN01', blockedBy: { action: 'cancel_own', multiple: false } }),
    ).toEqual(['blocked_cancel_own'])
    expect(
      deleteErrorMessageKeys({ errorCode: 'GRN01', blockedBy: { action: 'cancel_other', multiple: false } }),
    ).toEqual(['blocked_cancel_other'])
  })

  it('sin saber qué liquidación traba, no aconseja revertir', () => {
    expect(deleteErrorMessageKeys({ errorCode: 'GRN01' })).toEqual(['blocked_unknown'])
  })

  it('avisa cuando hay más de una', () => {
    expect(
      deleteErrorMessageKeys({ errorCode: 'GRN01', blockedBy: { action: 'revert', multiple: true } }),
    ).toEqual(['blocked_revert', 'blocked_multiple'])
  })

  it('lo que no es un rechazo de borrado vuelve null', () => {
    expect(deleteErrorMessageKeys({ errorCode: '23505' })).toBeNull()
    expect(deleteErrorMessageKeys({ errorCode: DELETE_GUARD_CODES.seededRecurrence })).toBeNull()
  })

  it('la lista de claves es exactamente lo que el mapeo produce', () => {
    const produced = new Set<string>()
    for (const errorCode of Object.values(DELETE_GUARD_CODES)) {
      for (const k of deleteErrorMessageKeys({ errorCode }) ?? []) produced.add(k)
    }
    for (const action of ['revert', 'cancel_own', 'cancel_other', 'unknown'] as const) {
      for (const k of deleteErrorMessageKeys({ errorCode: 'GRN01', blockedBy: { action, multiple: true } }) ?? []) {
        produced.add(k)
      }
    }
    expect([...produced].sort()).toEqual([...DELETE_ERROR_MESSAGE_KEYS].sort())
  })
})
