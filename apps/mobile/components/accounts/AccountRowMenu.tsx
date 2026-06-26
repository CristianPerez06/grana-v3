import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react-native'
import type { AccountWithBalances } from '@grana/accounts'
import {
  archiveAccount,
  reactivateAccount,
  deleteAccount,
} from '../../lib/accounts/mutations'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { Popover } from '../ui/Popover'

type Props = {
  account: AccountWithBalances
}

// Row actions via the native action-sheet pattern (Popover bottom-sheet +
// Alert.alert confirmation), mirror of CategoryRow. The archive-vs-delete choice
// respects the package guard: an account with movements is archived, not deleted
// (delete is only offered when `has_transactions` is false).
export function AccountRowMenu({ account }: Props) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const runFromMenu = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  const reportError = (errorKey: string) => {
    Alert.alert(t(errorKey))
  }

  const goEdit = () => {
    router.push({ pathname: '/(app)/accounts/[id]/edit', params: { id: account.id } })
  }

  const handleArchive = () => {
    Alert.alert(
      t('accounts.confirmations.archive_title'),
      t('accounts.confirmations.archive_body'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('accounts.actions.archive'),
          onPress: async () => {
            setPending(true)
            const result = await archiveAccount(queryClient, account.id)
            setPending(false)
            if (!result.ok) reportError(result.errorKey)
          },
        },
      ],
    )
  }

  const handleReactivate = async () => {
    setPending(true)
    const result = await reactivateAccount(queryClient, account.id)
    setPending(false)
    if (!result.ok) reportError(result.errorKey)
  }

  const handleDelete = () => {
    Alert.alert(
      t('accounts.confirmations.delete_title'),
      t('accounts.confirmations.delete_body_no_transactions'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('accounts.actions.delete'),
          style: 'destructive',
          onPress: async () => {
            setPending(true)
            const result = await deleteAccount(queryClient, account.id)
            setPending(false)
            if (!result.ok) reportError(result.errorKey)
          },
        },
      ],
    )
  }

  return (
    <Popover
      open={menuOpen}
      onOpenChange={setMenuOpen}
      trigger={
        <View
          className={`h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card ${
            pending ? 'opacity-50' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel={t('accounts.menu.label')}
        >
          <MoreHorizontal size={18} color={colors.textMuted} />
        </View>
      }
    >
      <MenuItem label={t('accounts.actions.edit')} onPress={() => runFromMenu(goEdit)} />
      {account.is_active ? (
        <>
          <MenuItem
            label={t('accounts.actions.archive')}
            onPress={() => runFromMenu(handleArchive)}
          />
          {!account.has_transactions && (
            <MenuItem
              label={t('accounts.actions.delete')}
              destructive
              onPress={() => runFromMenu(handleDelete)}
            />
          )}
        </>
      ) : (
        <>
          <MenuItem
            label={t('accounts.actions.reactivate')}
            onPress={() => runFromMenu(handleReactivate)}
          />
          {!account.has_transactions && (
            <MenuItem
              label={t('accounts.actions.delete')}
              destructive
              onPress={() => runFromMenu(handleDelete)}
            />
          )}
        </>
      )}
    </Popover>
  )
}

function MenuItem({
  label,
  onPress,
  destructive = false,
}: {
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  return (
    <Pressable onPress={onPress} className="rounded-[10px] px-3 py-3 active:bg-border-soft">
      <Text className={`text-sm ${destructive ? 'text-negative' : 'text-text'}`}>{label}</Text>
    </Pressable>
  )
}
