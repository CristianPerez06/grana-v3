'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <Label htmlFor="household-name">{t('settings.name_label')}</Label>
        <div className="flex gap-2">
          <Input
            id="household-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={saveName}
            loading={busy}
            disabled={!name.trim()}
            className="w-auto shrink-0 px-4"
          >
            OK
          </Button>
        </div>
      </section>

      {/* Members */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
          {t('settings.members_title')}
        </h2>
        <Card asChild>
          <ul className="flex flex-col divide-y divide-border-soft">
            {household.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between p-4 text-sm">
                <span className="font-medium text-text">{m.fullName}</span>
                <span className="text-xs text-text-muted">
                  {m.isCreator ? t('settings.creator_badge') : t('settings.member_badge')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Default split */}
      {twoMembers && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
            {t('settings.default_split_title')}
          </h2>
          <p className="text-xs text-text-muted">{t('settings.default_split_hint')}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text">{nameOf(household.members[0].userId)}</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={firstPct}
              onChange={(e) => setFirstPct(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="w-20"
            />
            <span className="text-sm text-text-muted">
              · {nameOf(household.members[1].userId)} {100 - firstPct}%
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={saveSplit}
              loading={busy}
              className="ml-auto w-auto shrink-0 px-4"
            >
              OK
            </Button>
          </div>
        </section>
      )}

      {/* Invite */}
      {!twoMembers && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
            {t('invite.title')}
          </h2>
          <InviteCard />
        </section>
      )}

      {/* Leave */}
      <section className="flex flex-col gap-2 border-t border-border pt-6">
        <Button
          type="button"
          variant="destructive"
          onClick={onLeave}
          loading={busy}
          className="w-auto self-start px-4"
        >
          {t('settings.leave_action')}
        </Button>
      </section>
    </div>
  )
}
