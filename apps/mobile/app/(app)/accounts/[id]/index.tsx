import { useCallback } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pencil, Plus } from 'lucide-react-native'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { AccountDetailHero } from '../../../../components/accounts/AccountDetailHero'
import { AccountDetailSkeleton } from '../../../../components/accounts/AccountDetailSkeleton'
import { PendingReimbursementsCard } from '../../../../components/accounts/PendingReimbursementsCard'
import { MovementsSection } from '../../../../components/accounts/MovementsSection'
import {
  useAccountDetail,
  useAccountMovements,
  usePendingReimbursements,
} from '../../../../lib/accounts/queries'
import { useT } from '../../../../lib/locale-context'
import { colors } from '../../../../lib/colors'

export default function AccountDetailScreen() {
  const t = useT()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const accountQ = useAccountDetail(id)
  const movementsQ = useAccountMovements(id)
  const reimbursementsQ = usePendingReimbursements(id)

  const account = accountQ.data
  const movements = movementsQ.data ?? []
  const reimbursements = reimbursementsQ.data ?? []

  // "+ Agregar moneda" when ARS or USD is missing or currently inactive.
  const canAddCurrency = account
    ? (() => {
        const codes = new Set(account.currencies.map((c) => c.currency_code))
        const hasInactive = account.currencies.some((c) => !c.is_active)
        return !codes.has('ARS') || !codes.has('USD') || hasInactive
      })()
    : false

  const goEdit = () =>
    router.push({ pathname: '/(app)/accounts/[id]/edit', params: { id } })
  const goCurrency = () =>
    router.push({ pathname: '/(app)/accounts/[id]/currency', params: { id } })

  const onRefresh = useCallback(() => {
    void accountQ.refetch()
    void movementsQ.refetch()
    void reimbursementsQ.refetch()
  }, [accountQ, movementsQ, reimbursementsQ])

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={account ? account.name : t('accounts.title')}
        backLink={{ href: '/(app)/accounts', label: t('accounts.title') }}
        actions={
          <Pressable
            onPress={goEdit}
            disabled={!account}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.actions.edit')}
            accessibilityState={{ disabled: !account }}
            className={`h-9 w-9 items-center justify-center rounded-[12px] border border-white/15 ${
              account ? '' : 'opacity-50'
            }`}
          >
            <Pencil size={16} color={colors.white} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="gap-5 px-6 py-6"
        refreshControl={
          <RefreshControl
            refreshing={accountQ.isRefetching || movementsQ.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.navy}
          />
        }
      >
        {accountQ.isPending ? (
          <AccountDetailSkeleton />
        ) : accountQ.isError || !account ? (
          <Text className="text-center text-sm text-text-muted">
            {t('accounts.errors.account_not_found')}
          </Text>
        ) : (
          <>
            <AccountDetailHero account={account} />

            <PendingReimbursementsCard items={reimbursements} />

            {canAddCurrency && (
              <Pressable
                onPress={goCurrency}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 self-start rounded-full bg-emerald-soft px-3.5 py-2"
              >
                <Plus size={14} color={colors.emeraldDeep} />
                <Text className="text-[13px] font-bold text-emerald-deep">
                  {t('accounts.actions.addCurrency')}
                </Text>
              </Pressable>
            )}

            <MovementsSection
              movements={movements}
              accountId={id}
              loading={movementsQ.isPending}
            />
          </>
        )}
      </ScrollView>
    </View>
  )
}
