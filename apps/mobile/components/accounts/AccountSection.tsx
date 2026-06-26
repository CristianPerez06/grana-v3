import { Text, View } from 'react-native'
import type { AccountWithBalances } from '@grana/accounts'
import { AccountRow } from './AccountRow'

type Props = {
  title: string
  accounts: AccountWithBalances[]
  /** Archived sections render with a dashed border to read as subordinate. */
  archived?: boolean
}

// A titled group of account rows (Efectivo / Cuentas bancarias / Archivadas).
// Renders nothing when empty so the caller can drop it unconditionally.
export function AccountSection({ title, accounts, archived = false }: Props) {
  if (accounts.length === 0) return null

  return (
    <View className="flex-col gap-2.5">
      <View className="flex-row items-baseline gap-2 px-1">
        <Text className="text-xs font-extrabold uppercase tracking-[0.08em] text-text-muted">
          {title}
        </Text>
        <Text className="text-xs font-semibold text-text-soft">· {accounts.length}</Text>
      </View>
      <View
        className={`overflow-hidden rounded-[18px] bg-card ${
          archived ? 'border border-dashed border-border-soft' : 'border border-border'
        }`}
      >
        {accounts.map((account, index) => (
          <View
            key={account.id}
            className={index === 0 ? '' : 'border-t border-border-soft'}
          >
            <AccountRow account={account} />
          </View>
        ))}
      </View>
    </View>
  )
}
