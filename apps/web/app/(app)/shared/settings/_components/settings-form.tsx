'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { updateHouseholdConfig } from '@/app/_actions/shared'
import type { Household } from '@/lib/shared/types'
import { InviteCard } from '../../_components/invite-card'
import { DefaultSplitEditDrawer } from './default-split-edit-drawer'
import { LeaveHouseholdDialog } from './leave-household-dialog'
import { NameEditDrawer } from './name-edit-drawer'

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

  // Drawer open + remount keys (bump on open so each drawer re-seeds its draft
  // from the current household values).
  const [nameOpen, setNameOpen] = useState(false)
  const [nameKey, setNameKey] = useState(0)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitKey, setSplitKey] = useState(0)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const openName = () => {
    setNameKey((k) => k + 1)
    setNameOpen(true)
  }
  const openSplit = () => {
    setSplitKey((k) => k + 1)
    setSplitOpen(true)
  }

  const twoMembers = household.members.length === 2

  // Default split (only meaningful with two members). Seed from stored split.
  const firstPct =
    household.defaultSplit.find((s) => s.user_id === household.members[0]?.userId)?.percentage ?? 50

  const nameOf = (userId: string) =>
    household.members.find((m) => m.userId === userId)?.fullName ?? ''

  // Drawers own their submit/error state; the parent just runs the existing
  // mutation and refreshes on success, returning the result so the drawer can
  // render any error inline and close itself only when it succeeds.
  const saveName = async (name: string) => {
    const r = await updateHouseholdConfig({ name })
    if (r.ok) router.refresh()
    return r
  }

  const saveSplit = async (first: number) => {
    const r = await updateHouseholdConfig({
      default_split: [
        { user_id: household.members[0].userId, percentage: first },
        { user_id: household.members[1].userId, percentage: 100 - first },
      ],
    })
    if (r.ok) router.refresh()
    return r
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t('settings.name_label')}</SectionTitle>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-text-muted">{t('setup.name_label')}</span>
              <span className="truncate text-sm font-semibold text-text">{household.name}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openName}
              className="w-auto shrink-0 px-4"
            >
              {t('settings.edit_action')}
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
                  m.isCreator ? 'bg-navy/10 text-navy' : 'bg-border-soft text-text-muted'
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-text">
                    {nameOf(household.members[0].userId)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-text-muted">
                    {firstPct}%
                  </span>
                </div>
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-text">
                    {nameOf(household.members[1].userId)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-text-muted">
                    {100 - firstPct}%
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openSplit}
                className="w-auto shrink-0 px-4"
              >
                {t('settings.edit_action')}
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

      <NameEditDrawer
        key={`name-${nameKey}`}
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        initialName={household.name}
        onSave={saveName}
      />
      {twoMembers && (
        <DefaultSplitEditDrawer
          key={`split-${splitKey}`}
          open={splitOpen}
          onClose={() => setSplitOpen(false)}
          firstName={nameOf(household.members[0].userId)}
          secondName={nameOf(household.members[1].userId)}
          initialFirstPct={firstPct}
          onSave={saveSplit}
        />
      )}
      <LeaveHouseholdDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} />
    </div>
  )
}
