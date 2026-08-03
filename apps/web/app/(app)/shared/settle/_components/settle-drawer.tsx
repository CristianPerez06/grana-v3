'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import type { BalanceCurrency } from '@grana/money-logic'
import { SettleForm } from './settle-form'

type SettleAccount = {
  id: string
  name: string
  institutionName?: string | null
  balances: Record<BalanceCurrency, number>
}

/**
 * "Saldar" as a drawer (same pattern as the movement form) — triggered from the
 * home's debt tile. Wraps the (enhanced) SettleForm; on success the form calls
 * `onDone` to close. The /shared/settle route still renders the same form for
 * deep links.
 */
export function SettleDrawer({
  owed,
  accounts,
  partnerName,
  appStartDate = null,
  triggerClassName,
}: {
  owed: Partial<Record<BalanceCurrency, number>>
  accounts: SettleAccount[]
  partnerName: string
  appStartDate?: string | null
  triggerClassName?: string
}) {
  const t = useTranslations('shared')
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button className={triggerClassName ?? 'w-auto px-4'} onPress={() => setOpen(true)}>
        <Send size={16} /> {t('settle.title')}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} ariaLabel={t('settle.title')}>
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-soft">
              {t('title')} · {(partnerName || '').trim().split(/\s+/)[0]}
            </span>
            <h2 className="text-lg font-bold text-text">{t('settle.title')}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-muted hover:text-text"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <SettleForm
            owed={owed}
            accounts={accounts}
            partnerName={partnerName}
            appStartDate={appStartDate}
            onDone={() => setOpen(false)}
          />
        </div>
      </Drawer>
    </>
  )
}
