import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight, Plus, Tag } from 'lucide-react-native'
import {
  moduleGroupCurrency,
  moduleGroups,
  moduleRest,
  moduleVisibleAmounts,
  purposeGlyph,
  purposeTint,
} from '@grana/savings'
import type { ModuleAmount, ModuleGroup, Purpose, PurposeSums } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { TAP_SLOP } from './tap-slop'

type Currency = 'ARS' | 'USD'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/**
 * Las PARTES del total: primero el resto sin destino, después los propósitos.
 * Espejo nativo de `savings-breakdown.tsx`.
 *
 * El orden es la jerarquía: arriba está el total (la card oscura) y todo esto es
 * su desglose. Los montos de un propósito miden 16.5px contra los 27 del total,
 * y esa diferencia de ~1.6× es lo que hace que la pantalla se lea como «tengo
 * tanto, y está repartido así» en vez de como una pila de bloques del mismo
 * rango.
 *
 * En nativo NO hay grilla: una columna en cualquier ancho de teléfono. La grilla
 * de la web existe porque en desktop sobra ancho; acá nunca sobra.
 */
export const SavingsBreakdown = ({
  purposeSums,
  purposes,
  onOpenPurpose,
  onNewPurpose,
  onRestAllocate,
  onRestRelease,
}: {
  purposeSums: PurposeSums[]
  /** Los que existen, incluidos los que todavía no tienen plata. */
  purposes: Purpose[]
  onOpenPurpose: (purpose: Purpose, currency: Currency) => void
  onNewPurpose: () => void
  onRestAllocate: (currency: Currency) => void
  onRestRelease: (currency: Currency) => void
}) => {
  const t = useT()
  const [showEmpty, setShowEmpty] = useState(false)

  const groups = moduleGroups(purposeSums, purposes)
  // Un propósito en cero es válido —se creó y todavía no se le destinó nada—
  // pero al lado de los activos compite por atención sin tener nada que mostrar.
  // Solo se esconden si hay CON QUÉ compararlos: si todos están en cero, la
  // lista son ellos.
  const active = groups.filter((g) => g.amounts.some((a) => a.reserved !== 0))
  const empty = groups.filter((g) => g.amounts.every((a) => a.reserved === 0))
  const hidesEmpty = active.length > 0 && empty.length > 0 && !showEmpty
  const visibleGroups = hidesEmpty ? active : groups
  const rest = moduleRest(purposeSums)
  const restHasMoney = rest.some((a) => a.reserved > 0)
  // La moneda de la operación sale del dato y no de un default: un resto de solo
  // dólares abriría en pesos, con tope cero, sobre una pantalla que no explica
  // por qué.
  const restCurrency = moduleGroupCurrency(rest)

  return (
    <View className="gap-2.5">
      {/* El título cubre TODO el desglose, y «Sin destino» es parte de él: es la
          parte que todavía no tiene nombre. */}
      <View className="flex-row items-center justify-between gap-3 px-[3px]">
        <Text className="shrink text-[14.5px] font-extrabold text-text" numberOfLines={1}>
          {t('savings.purposes.breakdown_title')}
        </Text>
        {/* La puerta para crear, a la altura del título. Al pie de la lista
            quedaba lejos: con seis propósitos hay que recorrerla entera, y lo
            que se busca al querer crear uno no está abajo de todos los que ya
            existen. Solo cuando YA hay propósitos: sin ninguno la puerta es la
            card punteada, que además hace de estado vacío. */}
        {groups.length > 0 && (
          <Pressable
            onPress={onNewPurpose}
            accessibilityRole="button"
            className="min-h-[44px] shrink-0 flex-row items-center gap-1.5 pl-3"
          >
            <Plus size={16} strokeWidth={2.5} color="#059669" />
            <Text className="text-[12.5px] font-extrabold text-emerald-deep">
              {t('savings.purposes.new')}
            </Text>
          </Pressable>
        )}
      </View>

      {restHasMoney && (
        <UnassignedBlock
          amounts={rest}
          onAllocate={() => onRestAllocate(restCurrency)}
          onRelease={() => onRestRelease(restCurrency)}
        />
      )}

      <View className="gap-[9px]">
        {visibleGroups.map((g) => (
          <PurposeCard
            key={g.purposeId}
            group={g}
            onOpen={() =>
              onOpenPurpose(
                { id: g.purposeId, name: g.name, icon: g.icon },
                moduleGroupCurrency(g.amounts),
              )
            }
          />
        ))}

        {/* Sin ningún propósito, la card punteada ES el estado vacío: evita que
            la sección sea un título sobre una lista vacía. */}
        {groups.length === 0 && (
          <Pressable
            onPress={onNewPurpose}
            accessibilityRole="button"
            className="min-h-[72px] flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3.5 py-[13px]"
          >
            <Plus size={16} strokeWidth={2.5} color="#5B6B7B" />
            <Text className="text-[13.5px] font-bold text-text-muted">
              {t('savings.purposes.new')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Los que no tienen saldo, detrás de un control al pie. Y CON VUELTA:
          mostrarlos sin poder volver a esconderlos deja la lista más larga para
          siempre por una mirada de un segundo. */}
      {active.length > 0 && empty.length > 0 && (
        <Pressable
          onPress={() => setShowEmpty((v) => !v)}
          accessibilityRole="button"
          className="min-h-[44px] justify-center self-start px-[3px]"
        >
          <Text className="text-[12.5px] font-bold text-text-muted">
            {showEmpty
              ? t('savings.purposes.hide_empty')
              : t('savings.purposes.show_empty', { count: String(empty.length) })}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

/**
 * «Sin destino»: el resto de lo guardado que todavía no tiene para qué.
 *
 * Se distingue de un propósito por FORMA y por COLOR, no por tamaño. Primero se
 * probó solo con la forma —punteado sobre gris— y no alcanzó: un bloque gris con
 * borde punteado ya significa «deshabilitado» en toda interfaz, y decía lo
 * contrario de lo que es — acá hay plata, y hay algo para decidir.
 *
 * El cálido usa tokens propios (`savings-unassigned-*`) y no `warning`, porque
 * esto NO es una alerta: no hay nada mal, es un estado normal que puede durar
 * meses.
 */
const UnassignedBlock = ({
  amounts,
  onAllocate,
  onRelease,
}: {
  amounts: ModuleAmount[]
  onAllocate: () => void
  onRelease: () => void
}) => {
  const t = useT()
  const visible = moduleVisibleAmounts(amounts)

  return (
    <View className="rounded-3xl border border-dashed border-savings-unassigned-border bg-savings-unassigned-bg px-[15px] py-2.5">
      <View className="flex-row flex-wrap items-center gap-3">
        {/* Una etiqueta, no un «+». El «+» ya es el glifo de CREAR en esta misma
            pantalla, y dos círculos punteados con el mismo signo se leen como la
            misma acción. Acá lo que falta no es sumar plata: es ponerle nombre a
            la que ya está. */}
        <View className="size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-savings-unassigned-deep/50">
          <Tag size={16} strokeWidth={2.1} color="#8A5A16" />
        </View>

        {/* El rótulo y el monto sobre la misma baseline: el rótulo es la etiqueta
            de ese número, no el título de una sección. La SEGUNDA moneda va
            debajo de la primera y no a su lado — en una línea, «$ 41.635,00
            US$ 1.000,00» se lee como un solo importe partido. */}
        <View className="flex-1 flex-row flex-wrap items-baseline gap-x-2.5">
          <Text className="text-[12px] font-extrabold uppercase tracking-wider text-savings-unassigned-deep">
            {t('savings.purposes.none')}
          </Text>
          <View className="items-start">
            {visible.map((a, i) => (
              <Text
                key={a.currency}
                className={`font-extrabold text-savings-unassigned-text ${
                  i === 0 ? 'text-[16.5px]' : 'text-[11.5px] opacity-80'
                }`}
                numberOfLines={1}
              >
                {money(a.reserved, a.currency)}
              </Text>
            ))}
          </View>
        </View>

        <Pressable
          onPress={onAllocate}
          accessibilityRole="button"
          hitSlop={TAP_SLOP}
          className="shrink-0 justify-center rounded-lg bg-savings-unassigned-deep px-3.5 py-2"
        >
          <Text className="text-[12px] font-extrabold text-savings-unassigned-on-deep">
            {t('savings.purposes.allocate')}
          </Text>
        </Pressable>
      </View>

      {/* La explicación y su acción en una fila. Alineadas ARRIBA: el párrafo
          ocupa varias líneas y el enlace una, así que alineado abajo el enlace se
          hundía al pie de un párrafo que arrancaba mucho más arriba. */}
      <View className="mt-2 flex-row items-start justify-between gap-3 border-t border-dashed border-savings-unassigned-border pt-2">
        <Text className="flex-1 text-[11.5px] font-semibold leading-[1.45] text-savings-unassigned-text">
          {t('savings.purposes.none_explainer')}
        </Text>
        {/* Enlace y no un segundo botón: es la acción que SÍ mueve el disponible,
            y dos botones gemelos acá invitaban a confundirla con destinar, que no
            lo mueve. */}
        {/* Los 44 táctiles por `hitSlop` y no por alto propio. Con `min-h-[44px]`
            y el texto arriba, el enlace medía 44px reales para una línea de 17:
            los 27 sobrantes colgaban abajo y eran el aire muerto al pie de la
            card. Web ya lo resolvía con un pseudo-elemento, que tampoco ocupa
            lugar; acá había quedado como alto de verdad. */}
        <Pressable
          onPress={onRelease}
          accessibilityRole="button"
          hitSlop={TAP_SLOP}
          className="shrink-0"
        >
          <Text className="text-[12.5px] font-extrabold leading-[1.45] text-savings-unassigned-deep underline">
            {t('savings.release_from_unassigned')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

/**
 * Un propósito. Toda la card abre su detalle — una sola cosa, prometida por el
 * chevron. Sin acciones contextuales: guardar cambia el total y su tope no está
 * acá, y destinar por card no ahorra ningún tap sobre el bloque de arriba.
 */
const PurposeCard = ({ group, onOpen }: { group: ModuleGroup; onOpen: () => void }) => {
  const visible = moduleVisibleAmounts(group.amounts)

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      className="min-h-[72px] flex-row items-center gap-[13px] rounded-2xl border border-border-soft bg-card px-3.5 py-[13px]"
    >
      {/* Caja fija para el emoji: suelto al lado del texto, los nombres arrancan
          en distinta `x` según el ancho del glifo y la lista deja de leerse como
          lista. El tinte sale del id, así que el color de un propósito no cambia
          cuando otro crece. */}
      <View
        className={`size-[42px] shrink-0 items-center justify-center rounded-xl ${purposeTint(
          group.purposeId,
        )}`}
      >
        <Text className="text-[20px]">{purposeGlyph(group.icon)}</Text>
      </View>

      {/* El que cede es el nombre, nunca el monto (D24). La fila NO se parte en
          dos líneas: probado en web y descartado — con montos normales unas
          cards se partían y otras no, y una lista con altos distintos deja de
          leerse como lista. */}
      <Text className="min-w-0 flex-1 text-[14.5px] font-extrabold text-text" numberOfLines={1}>
        {group.name}
      </Text>

      <View className="shrink-0 items-end">
        {visible.map((a, i) => (
          <Text
            key={a.currency}
            className={
              i === 0
                ? 'text-[16.5px] font-extrabold text-text'
                : 'text-[11.5px] font-bold text-text-muted'
            }
            numberOfLines={1}
          >
            {money(a.reserved, a.currency)}
          </Text>
        ))}
      </View>

      <ChevronRight size={18} color="#8A97A6" />
    </Pressable>
  )
}
