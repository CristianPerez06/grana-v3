import { Pressable, Text, View } from 'react-native'
import { ArrowDown, ArrowUp, Split } from 'lucide-react-native'
import { moduleHasSavings, moduleRowFor } from '@grana/savings'
import type { AvailableSums } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'

type Currency = 'ARS' | 'USD'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/**
 * El mismo número, partido en símbolo y dígitos — espejo de `moneyParts` en web.
 *
 * Se parte lo que devuelve `Intl` y NO se arma «símbolo + número» por separado:
 * el separador de miles, los decimales y el espacio los decide `Intl` para
 * `es-AR`, y recomponerlos a mano es la forma de que esta pantalla muestre un
 * formato apenas distinto del resto de la app.
 */
const moneyParts = (amount: number, currency: Currency): { symbol: string; digits: string } => {
  const formatted = money(amount, currency)
  const start = formatted.search(/\d/)
  return start <= 0
    ? { symbol: '', digits: formatted }
    : { symbol: formatted.slice(0, start).trim(), digits: formatted.slice(start) }
}

/**
 * El total guardado, y las tres acciones que lo mueven. Espejo nativo de
 * `savings-headline.tsx`.
 *
 * Es UNA card oscura a todo el ancho, con la botonera de zócalo adentro. El
 * oscuro no es decoración: ancla el total por tratamiento y no solo por tamaño,
 * y es el mismo `navy` de la card de saldo del dashboard — que las dos
 * superficies oscuras de la app sean la MISMA es lo que las hace leer como un
 * sistema y no como dos pantallas parecidas.
 *
 * La jerarquía que sostiene: acá está el TOTAL, y todo lo que viene abajo
 * —«Sin destino», los propósitos— son partes de él.
 */
export const SavingsHeadline = ({
  sums,
  onSave,
  onRelease,
  onAllocate,
}: {
  sums: AvailableSums[]
  onSave: () => void
  onRelease: () => void
  onAllocate: () => void
}) => {
  const t = useT()
  const hasAnythingSaved = moduleHasSavings(sums)

  return (
    <View className="overflow-hidden rounded-3xl">
      <View className="bg-navy px-[18px] pb-4 pt-[18px]">
        <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-navy-muted">
          {t('savings.total_saved')}
        </Text>

        {/* La card se parte en DOS MITADES, una por moneda, y se APILAN cuando no
            entran. El quiebre lo decide el CONTENIDO —cada mitad mide lo que mide
            su número— y no el ancho de la pantalla: con ocho cifras en las dos
            monedas no entran juntas en ningún teléfono, y con «$ 1.150.000» y
            «US$ 900» sí.

            El divisor no es un elemento sino el borde de cada mitad: `border-l`
            para el corte vertical, `border-t` para el horizontal, y el recorte
            del contenedor —que empieza 1px arriba y 1px a la izquierda— se come
            los que darían contra el marco. Así la línea aparece siempre ENTRE las
            dos y nunca alrededor, en las dos direcciones. Un divisor como
            elemento, al partirse la fila, quedaba como una rayita vertical al
            costado del monto de abajo. */}
        <View className="mt-[15px] overflow-hidden">
          <View className="-ml-px -mt-px flex-row flex-wrap">
            <DarkAmount value={moduleRowFor(sums, 'ARS').reserved} currency="ARS" />
            <DarkAmount value={moduleRowFor(sums, 'USD').reserved} currency="USD" />
          </View>
        </View>

        <Text className="mt-[15px] text-[12px] font-semibold leading-[1.45] text-navy-muted">
          {t('savings.module_support')}
        </Text>
      </View>

      {hasAnythingSaved && (
        // El zócalo va ADENTRO de la card: son las acciones de este total, y
        // sueltas abajo se leían como acciones de la pantalla. El cambio de
        // fondo ya las separa, así que no lleva borde superior.
        <View className="flex-row bg-card">
          <BarAction icon={ArrowDown} label={t('savings.save')} onPress={onSave} />
          <BarAction icon={ArrowUp} label={t('savings.release')} divided onPress={onRelease} />
          <BarAction
            icon={Split}
            label={t('savings.purposes.allocate')}
            divided
            onPress={onAllocate}
          />
        </View>
      )}
    </View>
  )
}

/**
 * El estado vacío: sin nada guardado no hay desglose ni de dónde volver a usar.
 * Una sola acción y la frase que evita el malentendido.
 */
export const SavingsEmpty = ({ onSave }: { onSave: () => void }) => {
  const t = useT()

  return (
    <View className="rounded-3xl border border-border-soft bg-card p-5">
      <Text className="text-center text-[19px] font-extrabold text-text">
        {t('savings.empty_title')}
      </Text>
      <Text className="mt-2 text-center text-[13.5px] font-semibold leading-snug text-text-muted">
        {t('savings.empty_body')}
      </Text>
      <View className="mt-5">
        <Button onPress={onSave}>{t('savings.empty_cta')}</Button>
      </View>
    </View>
  )
}

/**
 * Un monto del total. El símbolo va más chico y en menor contraste: es lo único
 * que distingue las dos columnas, y al mismo cuerpo que la cifra hacía que
 * «US$ 900» compitiera con «$ 1.150.000».
 *
 * Con saldo en cero baja el contraste en vez de esconderse: el par de monedas es
 * FIJO acá —a diferencia de los propósitos, donde un «US$ 0» sería ruido— porque
 * dos columnas que aparecen y desaparecen cambian la estructura de la card según
 * el día.
 */
const DarkAmount = ({ value, currency }: { value: number; currency: Currency }) => {
  const { symbol, digits } = moneyParts(value, currency)
  const empty = value === 0

  return (
    // `grow` sin base fija: cada mitad pide lo que mide su número, crecen iguales
    // mientras entren, y la fila se parte cuando no.
    <View className="grow basis-auto border-l border-t border-navy-border px-2 py-0.5">
      <Text
        className={`text-center text-[27px] font-extrabold ${
          empty ? 'text-white/40' : 'text-white'
        }`}
        numberOfLines={1}
      >
        <Text className={`text-[21px] font-bold ${empty ? 'text-white/30' : 'text-white/50'}`}>
          {symbol}
        </Text>{' '}
        {digits}
      </Text>
    </View>
  )
}

/**
 * Una acción del zócalo. Alto real 44 y no un pseudo-elemento: en nativo no hay
 * `::after`, y bajar de 44 rompería el mínimo táctil del repo.
 */
const BarAction = ({
  icon: Icon,
  label,
  divided = false,
  onPress,
}: {
  icon: typeof ArrowDown
  label: string
  /** Lleva el borde de la izquierda: todos menos el primero. */
  divided?: boolean
  onPress: () => void
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 px-2 ${
      divided ? 'border-l border-border-soft' : ''
    }`}
  >
    <Icon size={16} strokeWidth={2.5} color="#0B1A2B" />
    <Text className="text-[12px] font-extrabold text-text" numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
)
