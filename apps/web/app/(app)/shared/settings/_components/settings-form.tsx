'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateHouseholdConfig } from '@/app/_actions/shared'
import type { Household } from '@/lib/shared/types'
import { InviteCard } from '../../_components/invite-card'
import { LeaveHouseholdDialog } from './leave-household-dialog'

// Up-to-two-letter initials from a member's full name (visual only — derived
// from the existing `fullName`, no new data).
const initialsOf = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-text-muted">
    {children}
  </h2>
)

export function SettingsForm({ household }: { household: Household }) {
  const t = useTranslations('shared')
  const router = useRouter()

  const [name, setName] = useState(household.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

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

  const nameOf = (userId: string) =>
    household.members.find((m) => m.userId === userId)?.fullName ?? ''

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Name */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t('settings.name_label')}</SectionTitle>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="household-name" className="text-xs text-text-muted">
                {t('setup.name_label')}
              </Label>
              <Input
                id="household-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={saveName}
              loading={busy}
              disabled={!name.trim()}
              className="w-full shrink-0 px-5 sm:w-auto"
            >
              OK
            </Button>
          </div>
        </div>
      </section>

      {/* Members */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t('settings.members_title')}</SectionTitle>
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {household.members.map((m) => (
            <li
              key={m.userId}
              className="flex min-h-16 items-center justify-between gap-3 border-t border-border-soft p-4 first:border-t-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-border-soft text-xs font-extrabold text-navy"
                  aria-hidden
                >
                  {initialsOf(m.fullName)}
                </span>
                <span className="truncate text-sm font-semibold text-text">{m.fullName}</span>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  m.isCreator
                    ? 'bg-emerald-soft text-emerald-deep'
                    : 'bg-border-soft text-text-muted'
                }`}
              >
                {m.isCreator ? t('settings.creator_badge') : t('settings.member_badge')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Default split */}
      {twoMembers && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle>{t('settings.default_split_title')}</SectionTitle>
          <p className="-mt-1 text-xs text-text-muted">{t('settings.default_split_hint')}</p>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">
                      {nameOf(household.members[0].userId)}
                    </span>
                    <span className="truncate text-xs font-medium text-text-muted">
                      {t('settings.default_split_first_label')}
                    </span>
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={firstPct}
                    onChange={(e) =>
                      setFirstPct(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                    }
                    className="w-20 text-center tabular-nums"
                    aria-label={nameOf(household.members[0].userId)}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">
                      {nameOf(household.members[1].userId)}
                    </span>
                    <span className="truncate text-xs font-medium text-text-muted">
                      {t('settings.default_split_complement_label')}
                    </span>
                  </span>
                  <span className="inline-flex h-11 items-center text-sm font-semibold tabular-nums text-text-muted">
                    {100 - firstPct}%
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={saveSplit}
                loading={busy}
                className="w-full shrink-0 px-5 sm:w-auto"
              >
                OK
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Invite */}
      {!twoMembers && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle>{t('invite.title')}</SectionTitle>
          <div className="rounded-2xl border border-border bg-card p-4">
            <InviteCard />
          </div>
        </section>
      )}

      {/* Leave */}
      <section className="flex flex-col gap-2.5 border-t border-border pt-5">
        <p className="text-xs text-text-muted">{t('settings.leave_description')}</p>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setLeaveOpen(true)}
          className="w-auto self-start px-5"
        >
          {t('settings.leave_action')}
        </Button>
      </section>

      <LeaveHouseholdDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} />
    </div>
  )
}
