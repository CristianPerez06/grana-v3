import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Household } from '../../../lib/shared/queries'
import { getHousehold } from '../../../lib/shared/queries'
import {
  leaveHousehold,
  updateHouseholdConfig,
} from '../../../lib/shared/mutators'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Drawer } from '../../../components/ui/Drawer'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/FormField'
import { Alert } from '../../../components/ui/Alert'
import { SkeletonBlock } from '../../../components/ui/SkeletonBlock'
import { InviteCard } from '../../../components/shared/InviteCard'
import { CARD } from '../../../components/shared/ui'
import { useT, type TFn } from '../../../lib/locale-context'

export default function SettingsScreen() {
  const t = useT()
  const householdQuery = useQuery({ queryKey: ['shared', 'household'], queryFn: getHousehold })
  const household = householdQuery.data ?? null
  const backLink = { href: '/home', label: t('common.back') }

  return (
    <View className="flex-1 bg-page">
      <PageHeader title={t('shared.settings.title')} backLink={backLink} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-16">
        {householdQuery.isPending ? (
          <View className="flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} className={`${CARD} gap-3 p-5`}>
                <SkeletonBlock className="h-3 w-20 rounded" />
                <SkeletonBlock className="h-5 w-40 rounded" />
              </View>
            ))}
          </View>
        ) : household ? (
          <SettingsBody household={household} t={t} />
        ) : (
          <View className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <Text className="text-sm text-text-muted">{t('shared.dashboard.empty')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function SettingsBody({ household, t }: { household: Household; t: TFn }) {
  const router = useRouter()
  const twoMembers = household.members.length === 2
  const firstPct =
    household.defaultSplit.find((s) => s.user_id === household.members[0]?.userId)?.percentage ?? 50

  const [nameOpen, setNameOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  return (
    <View className="flex-col gap-6">
      {/* Name */}
      <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
        <Text className="text-xs font-medium uppercase text-text-soft">
          {t('shared.settings.name_label')}
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-text">{household.name}</Text>
          <Button variant="ghost" size="sm" onPress={() => setNameOpen(true)}>
            {t('shared.settings.edit_action')}
          </Button>
        </View>
      </View>

      {/* Members */}
      <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
        <Text className="text-xs font-medium uppercase text-text-soft">
          {t('shared.settings.members_title')}
        </Text>
        {household.members.map((m, i) => (
          <View key={m.userId} className="flex-row items-center justify-between py-1">
            <Text className="text-base text-text">{i === 0 ? t('shared.dashboard.vos') : m.fullName}</Text>
            <Text className="text-xs text-text-soft">
              {m.isCreator ? t('shared.settings.creator_badge') : t('shared.settings.member_badge')}
            </Text>
          </View>
        ))}
      </View>

      {/* Default split (only with two members) */}
      {twoMembers && (
        <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
          <Text className="text-xs font-medium uppercase text-text-soft">
            {t('shared.settings.default_split_title')}
          </Text>
          <Text className="text-xs text-text-muted">{t('shared.settings.default_split_hint')}</Text>
          <View className="flex-row items-center justify-between pt-1">
            <Text className="text-base text-text">
              {household.members[0].fullName}: {firstPct}% · {household.members[1].fullName}:{' '}
              {100 - firstPct}%
            </Text>
            <Button variant="ghost" size="sm" onPress={() => setSplitOpen(true)}>
              {t('shared.settings.edit_action')}
            </Button>
          </View>
        </View>
      )}

      {/* Invite (only when fewer than two members) */}
      {!twoMembers && <InviteCard />}

      {/* Leave */}
      <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
        <Text className="text-sm text-text-muted">{t('shared.settings.leave_description')}</Text>
        <Button variant="destructive" onPress={() => setLeaveOpen(true)}>
          {t('shared.settings.leave_action')}
        </Button>
      </View>

      <NameEditDrawer
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        initial={household.name}
        t={t}
      />
      {twoMembers && (
        <SplitEditDrawer
          open={splitOpen}
          onClose={() => setSplitOpen(false)}
          initialFirstPct={firstPct}
          household={household}
          t={t}
        />
      )}
      <LeaveDrawer
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onLeft={() => router.replace('/home')}
        t={t}
      />
    </View>
  )
}

function NameEditDrawer({
  open,
  onClose,
  initial,
  t,
}: {
  open: boolean
  onClose: () => void
  initial: string
  t: TFn
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await updateHouseholdConfig(queryClient, { name: name.trim() })
      if (res.ok) onClose()
      else setError(res.formError ?? Object.values(res.fieldErrors ?? {})[0] ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={t('shared.settings.name_drawer_title')}>
      <View className="flex-col gap-4 p-5">
        <Text className="text-lg font-semibold text-text">
          {t('shared.settings.name_drawer_title')}
        </Text>
        <FormField
          label={t('shared.settings.name_label')}
          value={name}
          onChangeText={setName}
          maxLength={50}
          autoFocus
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button variant="primary" onPress={save} loading={saving} disabled={!name.trim()}>
          {t('common.save')}
        </Button>
      </View>
    </Drawer>
  )
}

function SplitEditDrawer({
  open,
  onClose,
  initialFirstPct,
  household,
  t,
}: {
  open: boolean
  onClose: () => void
  initialFirstPct: number
  household: Household
  t: TFn
}) {
  const queryClient = useQueryClient()
  const [pct, setPct] = useState(String(initialFirstPct))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const clamped = Math.max(1, Math.min(99, Number(pct) || 1))

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await updateHouseholdConfig(queryClient, {
        default_split: [
          { user_id: household.members[0].userId, percentage: clamped },
          { user_id: household.members[1].userId, percentage: 100 - clamped },
        ],
      })
      if (res.ok) onClose()
      else setError(res.formError ?? Object.values(res.fieldErrors ?? {})[0] ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={t('shared.settings.split_drawer_title')}>
      <View className="flex-col gap-4 p-5">
        <Text className="text-lg font-semibold text-text">
          {t('shared.settings.split_drawer_title')}
        </Text>
        <FormField
          label={`${household.members[0].fullName} · ${t('shared.settings.default_split_first_label')}`}
          value={pct}
          onChangeText={setPct}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text className="text-sm text-text-muted">
          {household.members[1].fullName} · {t('shared.settings.default_split_complement_label')}:{' '}
          {100 - clamped}%
        </Text>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button variant="primary" onPress={save} loading={saving}>
          {t('common.save')}
        </Button>
      </View>
    </Drawer>
  )
}

function LeaveDrawer({
  open,
  onClose,
  onLeft,
  t,
}: {
  open: boolean
  onClose: () => void
  onLeft: () => void
  t: TFn
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const confirm = async () => {
    setError(null)
    setLeaving(true)
    try {
      const res = await leaveHousehold(queryClient)
      if (res.ok) {
        onClose()
        onLeft()
      } else {
        setError(res.formError ?? t('shared.settings.leave_blocked'))
      }
    } finally {
      setLeaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={t('shared.settings.leave_confirm_title')}>
      <View className="flex-col gap-4 p-5">
        <Text className="text-lg font-semibold text-text">
          {t('shared.settings.leave_confirm_title')}
        </Text>
        <Text className="text-sm text-text-muted">{t('shared.settings.leave_confirm_body')}</Text>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <View className="flex-col gap-2">
          <Button variant="destructive" onPress={confirm} loading={leaving}>
            {t('shared.settings.leave_action')}
          </Button>
          <Button variant="ghost" onPress={onClose}>
            {t('common.cancel')}
          </Button>
        </View>
      </View>
    </Drawer>
  )
}
