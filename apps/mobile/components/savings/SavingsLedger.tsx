import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { RESERVE_HISTORY_LIMIT } from '@grana/savings'
import type { AvailableSums, ReserveEntry } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT, useLocale } from '../../lib/locale-context'
import { formatShortDate } from '../transactions/detail/format'
import { colors } from '../../lib/colors'

type Currency = 'ARS' | 'USD'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/**
 * El pie del módulo: por qué el banco muestra otro número, y qué se hizo.
 *
 * Vivía adentro del overlay, en la vista de detalle que se podó — y NO se borró
 * con ella. El puente es lo que evita que alguien abra su home banking, vea otra
 * cifra y le crea al banco; el historial es lo que hace auditable el total.
 *
 * Los dos van plegados y al pie: son la explicación y la prueba, no lo que se
 * viene a hacer. Quien entra a guardar no paga su altura.
 */
export const SavingsLedger = ({
  sums,
  history,
  monthNet,
}: {
  sums: AvailableSums[]
  history: { entries: ReserveEntry[]; hasMore: boolean }
  monthNet: (currency: Currency) => number
}) => {
  const t = useT()
  const locale = useLocale()
  const [bankOpen, setBankOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const rowFor = (currency: Currency): AvailableSums =>
    sums.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }

  // ARS siempre; USD solo cuando tiene algo que decir. La mayoría tiene pesos y
  // nada más, y un bloque de dólares en cero les cobra altura por un dato que no
  // tienen.
  const currencies = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === 'ARS' || row.reserved !== 0 || row.available !== 0
  })

  return (
    <View className="rounded-3xl border border-border-soft bg-card px-4 py-3.5">
      <Pressable
        accessibilityRole="button"
        onPress={() => setBankOpen((v) => !v)}
        className="min-h-[44px] flex-row items-center gap-1.5"
      >
        <ChevronRight
          size={13}
          color={colors.textSoft}
          style={{ transform: [{ rotate: bankOpen ? '90deg' : '0deg' }] }}
        />
        <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.bank_fold')}
        </Text>
      </Pressable>
      {bankOpen && (
        <View className="mt-1.5 gap-2.5">
          {currencies.map((currency) => (
            <BankBridge key={currency} currency={currency} sums={rowFor(currency)} />
          ))}
          <Text className="px-1 text-[12.5px] leading-snug text-text-soft">
            {t('savings.gap_note')}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => setHistoryOpen((v) => !v)}
        className="mt-3 min-h-[44px] flex-row items-center gap-1.5"
      >
        <ChevronRight
          size={13}
          color={colors.textSoft}
          style={{ transform: [{ rotate: historyOpen ? '90deg' : '0deg' }] }}
        />
        <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.history_count', { count: String(history.entries.length) })}
        </Text>
      </Pressable>
      {historyOpen && (
        <View className="mt-1.5">
          {/* El neto del mes, arriba de la lista que resume: el mismo flujo
              contado de dos maneras. Vivía en el puente, donde competía con una
              pregunta distinta. */}
          {currencies.some((c) => monthNet(c) !== 0) && (
            <View className="mb-2 gap-0.5 rounded-xl bg-border-soft px-3 py-2">
              {currencies
                .filter((c) => monthNet(c) !== 0)
                .map((c) => (
                  <View key={c} className="flex-row justify-between">
                    {/* Los MISMOS verdes y terracotas que web, y no `positive`
                        con `text-muted`: eran dos verdes distintos, y el negativo
                        pintado de gris apagado no se leía como negativo sino como
                        deshabilitado. */}
                    <Text className="text-[13px] text-text-muted">
                      {t(
                        monthNet(c) < 0
                          ? 'savings.this_month_released'
                          : 'savings.this_month_saved',
                      )}
                    </Text>
                    <Text
                      className={`text-[13px] font-extrabold ${
                        monthNet(c) >= 0 ? 'text-emerald-deep' : 'text-terracotta-deep'
                      }`}
                    >
                      {money(Math.abs(monthNet(c)), c)}
                    </Text>
                  </View>
                ))}
            </View>
          )}
          {history.entries.length === 0 ? (
            <Text className="text-[13px] text-text-soft">{t('savings.empty_history')}</Text>
          ) : (
            history.entries.map((entry) => (
              <View
                key={entry.id}
                className="flex-row items-center justify-between border-t border-border-soft py-2.5"
              >
                <Text className="text-[14px] font-semibold text-text">
                  {entry.amount >= 0 ? t('savings.entry_saved') : t('savings.entry_released')}
                  <Text className="text-[12px] font-medium text-text-soft">
                    {' '}
                    {formatShortDate(entry.date, locale)}
                  </Text>
                </Text>
                <Text
                  className={`text-[14px] font-extrabold ${
                    entry.amount >= 0 ? 'text-emerald-deep' : 'text-terracotta-deep'
                  }`}
                >
                  {entry.amount >= 0 ? '+' : '−'}
                  {money(Math.abs(entry.amount), entry.currencyCode)}
                </Text>
              </View>
            ))
          )}
          {history.hasMore && (
            <Text className="mt-2 text-[12px] text-text-soft">
              {t('savings.history_truncated', { count: String(RESERVE_HISTORY_LIMIT) })}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

/**
 * Por qué el banco muestra otro número.
 *
 * Sin esto, quien abre su cuenta y ve un total distinto al de acá no tiene dónde
 * entender la diferencia — y le cree al banco.
 *
 * Es SOLO la conciliación. El flujo del mes vive en el historial: una cosa es
 * «por qué los dos números no coinciden» y otra «cuánto me moví este mes».
 * Mezcladas, la explicación deja de explicar.
 */
const BankBridge = ({ currency, sums }: { currency: Currency; sums: AvailableSums }) => {
  const t = useT()

  return (
    <View className="rounded-xl bg-border-soft px-3 py-2.5">
      <Text className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-text-soft">
        {currency}
      </Text>
      {/* Los rótulos nombran los DOS sistemas: la pregunta acá no es «cuánto
          tengo en cuentas» sino «por qué mi banco dice otra cosa». */}
      <View className="flex-row justify-between py-0.5">
        <Text className="text-[13px] text-text-muted">{t('savings.bank_shows')}</Text>
        <Text className="text-[13px] font-semibold text-text">
          {money(sums.accountsNet, currency)}
        </Text>
      </View>
      <View className="flex-row justify-between py-0.5">
        <Text className="text-[13px] text-text-muted">{t('savings.saved_in_grana')}</Text>
        <Text className="text-[13px] font-semibold text-emerald-deep">
          {`−${money(sums.reserved, currency)}`}
        </Text>
      </View>
      <View className="mt-1 flex-row justify-between border-t border-border pt-1.5">
        <Text className="text-[13px] text-text-muted">{t('savings.spendable_in_grana')}</Text>
        <Text className="text-[13px] font-extrabold text-text">
          {money(sums.available, currency)}
        </Text>
      </View>
    </View>
  )
}
