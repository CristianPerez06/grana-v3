import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { moduleHasSavings } from '@grana/savings'
import type { Purpose } from '@grana/savings'
import { getTodayAR } from '@grana/money-logic'
import { PageHeader } from '../../components/ui/PageHeader'
import { SavingsHeadline, SavingsEmpty } from '../../components/savings/SavingsHeadline'
import { SavingsBreakdown } from '../../components/savings/SavingsBreakdown'
import { SavingsLedger } from '../../components/savings/SavingsLedger'
import { SavingsDrawer } from '../../components/savings/SavingsDrawer'
import type { SavingsDrawerInitialView } from '../../components/savings/SavingsDrawer'
import { useSavingsDetail } from '../../lib/savings/queries'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'

type Currency = 'ARS' | 'USD'

/** `null` mientras el overlay nunca se abrió. Un solo dueño del estado, y es esta pantalla. */
type DrawerState = SavingsDrawerInitialView | null

/**
 * Los tres botones globales entran sin propósito elegido: el destino se decide
 * adentro, con los chips, y no antes de saber el monto.
 */
const SAVE_ARS = {
  kind: 'form',
  mode: 'save',
  currency: 'ARS',
  purposeId: null,
  locked: false,
} as const satisfies DrawerState
const RELEASE_ARS = {
  kind: 'form',
  mode: 'release',
  currency: 'ARS',
  purposeId: null,
  locked: false,
} as const satisfies DrawerState
const ALLOCATE_ARS = {
  kind: 'allocate',
  currency: 'ARS',
  purpose: null,
  direction: 'allocate',
} as const satisfies DrawerState

/**
 * **Ahorro e inversión**, nativo. Espejo de `/savings` en web, y por las mismas
 * razones: la operatoria de ahorro necesita una casa propia, y mientras vivía
 * cosida al dashboard no se podía ocultar, ni poner detrás de un plan, ni
 * apagar (E2).
 *
 * La pantalla es la LECTURA —el total, el desglose, el puente y el historial— y
 * el overlay son los ACTOS. Por eso el overlay abre directo a lo que se tocó y
 * ya no tiene vista raíz.
 *
 * Una sola consulta compartida (`useSavingsDetail`) y no tres como en web: acá
 * no hay streaming de secciones ni Suspense por bloque, así que partirla en tres
 * solo agregaría estados de carga que nadie ve.
 */
export default function SavingsScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const today = getTodayAR()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const { sums, history, monthNet, purposeSums, purposes } = useSavingsDetail(
    true,
    monthStart,
    today,
  )

  // Dos estados y no uno: el overlay no tiene vista raíz, así que necesita saber
  // a qué abre — y si al cerrar se borrara esa vista, se desmontaría de golpe y
  // perdería la animación de salida.
  const [view, setView] = useState<DrawerState>(null)
  const [open, setOpen] = useState(false)
  const setDrawer = (next: SavingsDrawerInitialView) => {
    setView(next)
    setOpen(true)
  }

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['savings'] })
  }, [queryClient])

  const loading = sums == null
  const rows = sums ?? []
  const hasAnythingSaved = moduleHasSavings(rows)

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('nav.savings')}
        backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}
      />

      <ScrollView
        contentContainerClassName="px-4 pt-5 gap-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.navy} />
        }
      >
        {loading ? (
          <View className="items-center py-16">
            <Text className="text-[13px] text-text-soft">{t('common.loading')}</Text>
          </View>
        ) : (
          <>
            <SavingsHeadline
              sums={rows}
              onSave={() => setDrawer(SAVE_ARS)}
              onRelease={() => setDrawer(RELEASE_ARS)}
              onAllocate={() => setDrawer(ALLOCATE_ARS)}
            />

            {hasAnythingSaved ? (
              <SavingsBreakdown
                purposeSums={purposeSums}
                purposes={purposes}
                onOpenPurpose={(purpose: Purpose, currency: Currency) =>
                  setDrawer({ kind: 'group', currency, purpose })
                }
                onNewPurpose={() => setDrawer({ kind: 'purposeForm', purpose: null })}
                onRestAllocate={(currency: Currency) =>
                  setDrawer({ kind: 'allocate', currency, purpose: null, direction: 'allocate' })
                }
                // «Sin destino» viene PRESELECCIONADO, no bloqueado. Se tocó su
                // enlace, así que es lo que se quiere sacar — pero bloquearlo
                // cerraba una puerta que existe: con $60.000 sin destino y
                // $70.000 pedidos, la pantalla decía «no podés» y escondía los
                // propósitos, que era justo de donde podía salir el resto.
                onRestRelease={(currency: Currency) =>
                  setDrawer({
                    kind: 'form',
                    mode: 'release',
                    currency,
                    purposeId: null,
                    locked: false,
                  })
                }
              />
            ) : (
              <SavingsEmpty onSave={() => setDrawer(SAVE_ARS)} />
            )}

            {hasAnythingSaved && (
              <SavingsLedger sums={rows} history={history} monthNet={monthNet} />
            )}
          </>
        )}
      </ScrollView>

      {/* No se monta hasta el primer uso: quien solo viene a mirar cuánto tiene
          no paga su carga. */}
      {view != null && (
        <SavingsDrawer visible={open} onClose={() => setOpen(false)} initialView={view} />
      )}
    </View>
  )
}
