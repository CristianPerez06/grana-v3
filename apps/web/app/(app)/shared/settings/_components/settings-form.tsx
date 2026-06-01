'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { leaveHousehold, updateHouseholdConfig } from '@/app/_actions/shared'
import type { Household } from '@/lib/shared/types'
import { InviteCard } from '../../_components/invite-card'

export function SettingsForm({ household }: { household: Household }) {
  const t = useTranslations('shared')
  const router = useRouter()

  const [name, setName] = useState(household.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const twoMembers = household.members.length === 2

  // Default split (only meaningful with two members). Seed from stored split.
  const [firstPct, setFirstPct] = useState<number>(() => {
    const stored = household.defaultSplit.find((s) => s.user_id === household.members[0]?.userId)
    return stored?.percentage ?? 50
  })

  const run = async (fn: () => Promise<{ ok: boolean; formError?: string }>) => {
    setBusy(true)
    setError(null)
    try {
      const r = await fn()
      if (!r.ok) setError(r.formError ?? 'Error')
      else router.refresh()
      return r.ok
    } finally {
      setBusy(false)
    }
  }

  const saveName = () => run(() => updateHouseholdConfig({ name: name.trim() }))

  const saveSplit = () =>
    run(() =>
      updateHouseholdConfig({
        default_split: [
          { user_id: household.members[0].userId, percentage: firstPct },
          { user_id: household.members[1].userId, percentage: 100 - firstPct },
        ],
      }),
    )

  const onLeave = async () => {
    const ok = await run(() => leaveHousehold())
    if (ok) {
      router.push('/shared')
      router.refresh()
    }
  }

  const nameOf = (userId: string) =>
    household.members.find((m) => m.userId === userId)?.fullName ?? ''

  return (
    <div className="flex flex-col gap-8">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Name */}
      <section className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">{t('settings.name_label')}</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={busy || !name.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </section>

      {/* Members */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('settings.members_title')}
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {household.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between p-3 text-sm">
              <span>{m.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {m.isCreator ? t('settings.creator_badge') : t('settings.member_badge')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Default split */}
      {twoMembers && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('settings.default_split_title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('settings.default_split_hint')}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm">{nameOf(household.members[0].userId)}</span>
            <input
              type="number"
              min={1}
              max={99}
              value={firstPct}
              onChange={(e) => setFirstPct(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              · {nameOf(household.members[1].userId)} {100 - firstPct}%
            </span>
            <button
              type="button"
              onClick={saveSplit}
              disabled={busy}
              className="ml-auto rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </section>
      )}

      {/* Invite */}
      {!twoMembers && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('invite.title')}
          </h2>
          <InviteCard />
        </section>
      )}

      {/* Leave */}
      <section className="flex flex-col gap-2 border-t border-border pt-6">
        <button
          type="button"
          onClick={onLeave}
          disabled={busy}
          className="w-fit rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
        >
          {t('settings.leave_action')}
        </button>
      </section>
    </div>
  )
}
