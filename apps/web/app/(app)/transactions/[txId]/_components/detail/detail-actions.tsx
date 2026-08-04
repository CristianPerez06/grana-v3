'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslations } from 'next-intl'
import {
  deleteTransaction,
  resolveSeededRecurrenceAndDelete,
} from '@/app/_actions/transactions'
import type { SeededRecurrenceInfo } from '@grana/transactions-mutations'
import type { SeededRecurrenceResolution } from '@grana/recurrences'
import { invalidateAfterMovementMutation } from '@/lib/transactions/invalidation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemDestructive,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

// Acciones del detalle en la topbar (handoff): desktop muestra "Eliminar"
// (icon button) + "Editar" (botón sólido navy); mobile colapsa "Eliminar" en
// un menú "···" y deja "Editar" en una barra fija inferior (thumb-reach).
// La lógica (permisos, borrado con AlertDialog contextual, invalidación) es la
// misma que el TxActionsMenu original — solo cambia la disposición.

type Props = {
  transactionId: string
  canEdit: boolean
  canDelete: boolean
  isParent: boolean
  isCardPayment: boolean
  /** When set, "Editar" opens the in-context drawer instead of navigating. */
  onEdit?: () => void
}

export const DetailActions = ({
  transactionId,
  canEdit,
  canDelete,
  isParent,
  isCardPayment,
  onEdit,
}: Props) => {
  const t = useTranslations('transactions.detail.actions')
  const tSeed = useTranslations('transactions.seeded_recurrence')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Set when the delete comes back reporting that this movement seeded a
  // recurrence rule. The dialog then asks what to do with the rule instead of
  // just refusing — the movement cannot be deleted until the user decides.
  const [seeded, setSeeded] = useState<SeededRecurrenceInfo | null>(null)

  if (!canEdit && !canDelete) return null

  const goEdit = () =>
    onEdit ? onEdit() : router.push(`/transactions/${transactionId}/edit`)

  // Un pago de resumen no se borra desde acá: deshacerlo revierte todo el resumen
  // (movimientos a pendiente, sello, gasto-débito) y eso vive en el detalle del
  // período. El diálogo explica dónde, en vez de ofrecer un borrado que la base
  // rechaza igual (FK RESTRICT de period_payments). Mismo trato que la cuota hija.
  const deleteWarning = isCardPayment
    ? t('delete_blocked_card_payment')
    : isParent
      ? t('delete_warning_parent')
      : t('delete_warning_default')

  const finishDeleted = () => {
    invalidateAfterMovementMutation(queryClient)
    setDeleteOpen(false)
    setSeeded(null)
    router.push('/transactions')
  }

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteTransaction(transactionId)
      if (result.ok) {
        finishDeleted()
      } else if (result.seededRecurrence) {
        // Not an error to read — a decision to make. Keep the dialog open and
        // swap it into the two-choice mode.
        setSeeded(result.seededRecurrence)
      } else {
        setError(result.formError ?? t('delete_warning_default'))
      }
    })
  }

  const handleResolveSeeded = (resolution: SeededRecurrenceResolution) => {
    if (!seeded) return
    setError(null)
    startTransition(async () => {
      const result = await resolveSeededRecurrenceAndDelete(
        transactionId,
        seeded.id,
        resolution,
      )
      if (result.ok) finishDeleted()
      else setError(result.formError ?? t('delete_warning_default'))
    })
  }

  const formatNext = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <>
      {/* Desktop: Eliminar (icon) + Editar (solid) */}
      <div className="hidden items-center gap-1.5 sm:flex">
        {canDelete && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={t('delete')}
            title={t('delete')}
            className="grid size-[42px] place-items-center rounded-xl border border-border bg-card text-text transition-colors hover:border-[#EBC9C0] hover:bg-error-soft hover:text-terracotta-deep"
          >
            <Trash2 size={18} strokeWidth={2} aria-hidden />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={goEdit}
            aria-label={t('edit')}
            title={t('edit')}
            className="grid size-[42px] place-items-center rounded-xl bg-navy text-white transition-opacity hover:opacity-90"
          >
            <Pencil size={18} strokeWidth={2.2} aria-hidden />
          </button>
        )}
      </div>

      {/* Mobile: "···" con las acciones secundarias (Eliminar) */}
      {canDelete && (
        <div className="flex sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('more')}
                className="grid size-[42px] place-items-center rounded-xl border border-border bg-card text-text"
              >
                <MoreHorizontal size={20} strokeWidth={2.2} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItemDestructive onSelect={() => setDeleteOpen(true)}>
                <Trash2 size={16} strokeWidth={2} aria-hidden />
                {t('delete')}
              </DropdownMenuItemDestructive>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Mobile: barra inferior fija con "Editar" (thumb-reach) */}
      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex bg-gradient-to-t from-page from-70% to-transparent px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:hidden">
          <Button
            size="lg"
            className="h-[50px] rounded-[14px] bg-navy text-[15.5px] font-bold text-white hover:bg-navy/90"
            onPress={goEdit}
          >
            <Pencil size={16} strokeWidth={2.2} aria-hidden />
            {t('edit_movement')}
          </Button>
        </div>
      )}

      <AlertDialog.Root
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setSeeded(null)
            setError(null)
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-navy/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-[16px] font-bold text-text">
              {seeded ? tSeed('title') : t('delete')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
              {seeded
                ? seeded.description
                  ? tSeed('body', { rule: seeded.description })
                  : tSeed('body_untitled')
                : deleteWarning}
            </AlertDialog.Description>

            {seeded?.next_occurrence && (
              <p className="mt-2 text-[12.5px] font-semibold text-text-soft">
                {tSeed('next_occurrence', { date: formatNext(seeded.next_occurrence) })}
              </p>
            )}

            {error && <p className="mt-3 text-[13px] text-expense">{error}</p>}

            {seeded ? (
              // Las dos salidas son igual de válidas, así que van apiladas y con
              // su explicación, no como un par de botones sin contexto.
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleResolveSeeded('unlink')}
                  disabled={isPending}
                  className="flex flex-col items-start gap-0.5 rounded-[12px] border border-border bg-card px-4 py-3 text-left transition-colors hover:border-navy/40 disabled:opacity-50"
                >
                  <span className="text-[13.5px] font-semibold text-text">{tSeed('unlink')}</span>
                  <span className="text-[12px] leading-snug text-text-muted">
                    {tSeed('unlink_hint')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveSeeded('delete_rule')}
                  disabled={isPending}
                  className="flex flex-col items-start gap-0.5 rounded-[12px] border border-[#EBC9C0] bg-error-soft px-4 py-3 text-left transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <span className="text-[13.5px] font-semibold text-terracotta-deep">
                    {tSeed('delete_rule')}
                  </span>
                  <span className="text-[12px] leading-snug text-text-muted">
                    {tSeed('delete_rule_hint')}
                  </span>
                </button>
                <AlertDialog.Cancel asChild>
                  <button
                    type="button"
                    className="mt-1 h-10 self-end rounded-[12px] px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
                    disabled={isPending}
                  >
                    {tSeed('cancel')}
                  </button>
                </AlertDialog.Cancel>
              </div>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <AlertDialog.Cancel asChild>
                  <button
                    type="button"
                    className="h-10 rounded-[12px] border border-border bg-card px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
                    disabled={isPending}
                  >
                    {isCardPayment ? t('got_it') : t('cancel')}
                  </button>
                </AlertDialog.Cancel>
                {/* Sin confirmación destructiva para un pago de resumen: el diálogo
                    informa dónde se deshace, no ofrece borrarlo. */}
                {!isCardPayment && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="h-10 rounded-[12px] bg-expense px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {t('delete_confirm')}
                  </button>
                )}
              </div>
            )}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}
