'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Plus, Tag } from 'lucide-react'
import {
  moduleGroupCurrency,
  moduleGroups,
  moduleRest,
  moduleVisibleAmounts,
} from '@grana/savings'
import type { ModuleAmount, ModuleGroup, Purpose, PurposeSums } from '@grana/savings'
import { purposeGlyph, purposeTint } from '@/lib/savings/purpose-emblem'
import { cn } from '@/lib/utils'
import { useSavingsOverlay } from './savings-overlay-context'
import { money } from './money'

/**
 * Las PARTES del total: primero el resto sin destino, después los propósitos.
 *
 * El orden del DOM es la jerarquía y no cambia entre tamaños: arriba está el
 * total (la card oscura, que dibuja la otra sección), y todo esto es su
 * desglose. Nada de acá puede ponerse al lado del total ni tomar su escala —
 * los montos de un propósito miden 16.5px contra los 27–34 del total, y esa
 * diferencia de ~3× es lo que hace que la pantalla se lea como «tengo tanto, y
 * está repartido así» en vez de como una pila de cards del mismo rango.
 */
export const SavingsBreakdown = ({
  purposeSums,
  purposes,
}: {
  purposeSums: PurposeSums[]
  /** Los que existen, incluidos los que todavía no tienen plata. */
  purposes: Purpose[]
}) => {
  const t = useTranslations('savings')
  const overlay = useSavingsOverlay()
  const [showEmpty, setShowEmpty] = useState(false)

  const groups = moduleGroups(purposeSums, purposes)
  // Los que tienen plata y los que no. Un propósito en cero es válido —se creó y
  // todavía no se le destinó nada— pero al lado de los activos compite por
  // atención sin tener nada que mostrar: una card entera para decir «$ 0».
  //
  // Solo se esconden si hay CON QUÉ compararlos. Si todos están en cero, la
  // lista son ellos, y esconderlos dejaría la sección vacía con un enlace.
  const active = groups.filter((g) => g.amounts.some((a) => a.reserved !== 0))
  const empty = groups.filter((g) => g.amounts.every((a) => a.reserved === 0))
  const hidesEmpty = active.length > 0 && empty.length > 0 && !showEmpty
  const visibleGroups = hidesEmpty ? active : groups
  const rest = moduleRest(purposeSums)
  const restHasMoney = rest.some((a) => a.reserved > 0)
  // La moneda de la operación sale del dato, no de un default: un resto de solo
  // dólares abriría en pesos, con tope cero, sobre una pantalla que no explica
  // por qué.
  const restCurrency = moduleGroupCurrency(rest)

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-2.5">
        {/* El título cubre TODO el desglose, y «Sin destino» es parte de él: es
            la parte que todavía no tiene nombre. Antes iba arriba del título y
            quedaba colgado entre el total y la sección, sin pertenecer a
            ninguno de los dos.

            Adentro del título pero FUERA de la grilla: sigue sin ser un
            propósito —no navega, no tiene ícono propio, no se ordena por monto
            entre ellos— y por eso conserva su forma aparte. */}
        <div className="flex items-center justify-between gap-3 px-[3px]">
          <h2 className="min-w-0 text-[14.5px] font-extrabold tracking-[-0.02em] text-text sm:text-[17px]">
            {t('purposes.breakdown_title')}
          </h2>
          {/* La puerta para crear, a la altura del título y a la derecha. Al pie
              de la grilla quedaba lejos: con seis propósitos hay que recorrer la
              lista entera para encontrarla, y lo que se busca al querer crear
              uno no está abajo de todos los que ya existen.

              Solo cuando YA hay propósitos: sin ninguno, la puerta es la card
              punteada de abajo, que además hace de estado vacío. Dos accesos a
              la vez serían dos formas de hacer lo mismo en la misma pantalla. */}
          {groups.length > 0 && (
            <button
              type="button"
              onClick={overlay.openNewPurpose}
              className="relative flex shrink-0 items-center gap-1.5 text-[12.5px] font-extrabold text-emerald-deep transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-text"
            >
              <Plus className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
              {t('purposes.new')}
            </button>
          )}
        </div>

        {restHasMoney && (
          <UnassignedBlock
            amounts={rest}
            onAllocate={() => overlay.openRestAllocate(restCurrency)}
            onRelease={() => overlay.openRestRelease(restCurrency)}
          />
        )}

        {/* Grilla y no lista: el ancho decide cuántas columnas entran, así el
            nombre no se parte en dos líneas en desktop. Es el MISMO componente
            en los tres tamaños — nunca se convierte en fila de tabla.

            El mínimo es 290px y no 330. Con 330, en el ancho útil de una
            notebook (960px: el shell topea en 1024 y se come 64 de padding)
            entraban DOS columnas de 474px — una card de 474px para un nombre y
            un monto, con un vacío enorme en el medio, y nueve propósitos en
            cinco filas que obligaban a scrollear. Con 290 entran tres de 313px,
            que es ancho de sobra para el contenido, y las mismas nueve caben en
            tres filas. En tablet siguen siendo dos y en teléfono una. */}
        <ul className="grid grid-cols-1 gap-[9px] sm:grid-cols-[repeat(auto-fill,minmax(290px,1fr))] sm:gap-[11px]">
          {visibleGroups.map((g) => (
            <li key={g.purposeId}>
              <PurposeCard
                group={g}
                onOpen={() =>
                  overlay.openPurpose(
                    { id: g.purposeId, name: g.name, icon: g.icon },
                    moduleGroupCurrency(g.amounts),
                  )
                }
              />
            </li>
          ))}
          {/* Sin ningún propósito, la card punteada ES el estado vacío: evita
              que la sección sea un título sobre una lista vacía, y de paso es la
              puerta para crear el primero. Con propósitos desaparece — ahí la
              puerta está arriba, junto al título. */}
          {groups.length === 0 && (
            <li>
              <button
                type="button"
                onClick={overlay.openNewPurpose}
                className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3.5 py-[13px] text-[13.5px] font-bold text-text-muted transition-colors hover:border-text-soft hover:bg-card hover:text-text"
              >
                <Plus className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                {t('purposes.new')}
              </button>
            </li>
          )}
        </ul>

        {/* Los que no tienen saldo, detrás de un control al pie. No es un
            «ver todos» que navega ni un plegado con chevron: es una línea que
            dice cuántos hay y los trae acá mismo. Una vez abiertos no se
            vuelven a esconder — quien los pidió es porque los está buscando. */}
        {hidesEmpty && (
          <button
            type="button"
            onClick={() => setShowEmpty(true)}
            className="relative mt-1 self-start px-[3px] text-[12.5px] font-bold text-text-muted transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-text"
          >
            {t('purposes.show_empty', { count: empty.length })}
          </button>
        )}

        {/* Con el resto en cero NO baja ninguna explicación al pie.

            La había: el handoff pedía que la frase de «Sin destino» pasara acá
            cuando el bloque no se dibuja. Funcionaba con el copy largo, que
            explicaba qué era el resto en general. Con el copy corto —«Sigue
            guardado: falta decir para qué»— quedaba explicando algo que no está
            en pantalla, y el usuario que repartió TODO no necesita que le
            expliquen un sobrante que no tiene. Cuando vuelva a haberlo, vuelve
            con su bloque y su frase. */}
      </section>
    </div>
  )
}

/**
 * «Sin destino»: el resto de lo guardado que todavía no tiene para qué.
 *
 * Va ENTRE el total y los propósitos, y se distingue de ellos por forma Y por
 * color. Primero se probó solo con la forma —punteado sobre gris— para no
 * agregar tokens: no alcanzó. Un bloque gris con borde punteado tiene un
 * significado que ya existe en toda interfaz, y es «deshabilitado». Decía lo
 * contrario de lo que es: acá hay plata, y hay algo para decidir.
 *
 * El cálido es lo que lo vuelve «pendiente de decidir» en vez de «apagado», y
 * son tokens propios (`--savings-unassigned-*`) y no `--warning`, porque esto
 * NO es una alerta: no hay nada mal, es un estado normal que puede durar meses.
 *
 * Un propósito es una cosa; esto es un sobrante, y por eso no tiene ícono propio
 * ni navega — no hay detalle que abrir. Sus dos acciones resuelven en el lugar.
 *
 * Y pesa lo MISMO que un propósito, no más: su monto usa el cuerpo de las cards
 * de abajo y su botón dejó de ser el control más grande de la sección. Estaba al
 * revés —el resto gritaba más que «Emergencia», que tenía más plata— y eso
 * invertía la lectura: lo que falta decidir parecía el protagonista del
 * desglose. Lo que lo distingue es la FORMA y el color, no el tamaño.
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
  const t = useTranslations('savings')
  const visible = moduleVisibleAmounts(amounts)

  return (
    <section className="rounded-3xl border border-dashed border-savings-unassigned-border bg-savings-unassigned-bg px-[15px] py-3 sm:px-5 sm:py-[14px]">
      <div className="flex items-center gap-3">
        {/* Una etiqueta, no un «+». El «+» ya es el glifo de CREAR en esta misma
            pantalla —la card punteada del final de la grilla— y dos círculos
            punteados con el mismo signo, a dos bloques de distancia, se leen
            como la misma acción. Acá lo que falta no es sumar plata: es ponerle
            nombre a la que ya está. */}
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-savings-unassigned-deep/50 text-savings-unassigned-deep"
        >
          <Tag className="size-4" strokeWidth={2.1} />
        </span>

        {/* El rótulo y el monto en UNA línea, sobre la misma baseline: el
            rótulo es la etiqueta de ese número, no el título de una sección, y
            apilados cobraban una fila entera por decir lo mismo. Con las dos
            monedas, la segunda sigue en la misma línea, más chica. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          {/* Versalitas y no nombre propio: «Sin destino» no es un nombre que
              alguien eligió, es la etiqueta de lo que quedó. */}
          <p className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-savings-unassigned-deep">
            {t('purposes.none')}
          </p>
          {visible.map((a, i) => (
            <span
              key={a.currency}
              className={cn(
                'whitespace-nowrap font-extrabold tracking-[-0.045em] tabular-nums text-savings-unassigned-text',
                i === 0 ? 'text-[16.5px]' : 'text-[11.5px] opacity-80',
              )}
            >
              {money(a.reserved, a.currency)}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onAllocate}
          className="relative shrink-0 rounded-lg bg-savings-unassigned-deep px-3.5 py-2 text-[12px] font-extrabold text-savings-unassigned-on-deep transition-opacity after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:opacity-90"
        >
          {t('purposes.allocate')}
        </button>
      </div>

      {/* La explicación y su acción en UNA fila, no apiladas: debajo del párrafo
          el enlace arrancaba una tercera zona en un bloque que ya tiene dos, y
          quedaba flotando contra el margen izquierdo sin nada que lo anclara. A
          la derecha de su propio texto cae bajo el botón «Destinar» de arriba, y
          las dos acciones del bloque comparten una sola columna.

          Alineados ARRIBA: el párrafo ocupa varias líneas y el enlace una, así
          que alineados abajo el enlace se hundía al pie de un párrafo que
          arrancaba mucho más arriba — dejaba de leerse como su acción y parecía
          otra cosa suelta.

          Y el enlace no infla la fila: 44 px de área táctil por un
          pseudo-elemento centrado, no por alto propio. Con `min-h-11` medía 44
          px de verdad, casi tres veces su texto, y ese sobrante era el hueco. */}
      <div className="mt-2.5 flex items-start justify-between gap-3 border-t border-dashed border-savings-unassigned-border pt-2.5">
        <p className="flex-1 text-[11.5px] font-semibold leading-[1.45] text-savings-unassigned-text/85">
          {t('purposes.none_explainer')}
        </p>
        {/* Enlace y no un segundo botón: es la acción que SÍ mueve el
            disponible, y dos botones gemelos acá invitaban a confundirla con
            destinar, que no lo mueve. */}
        <button
          type="button"
          onClick={onRelease}
          className="relative shrink-0 text-[12.5px] font-extrabold leading-[1.45] text-savings-unassigned-deep underline decoration-savings-unassigned-deep/35 underline-offset-[5px] transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:decoration-savings-unassigned-deep"
        >
          {t('release_from_unassigned')}
        </button>
      </div>
    </section>
  )
}

/**
 * Un propósito. Toda la card abre su detalle — una sola cosa, prometida por el
 * chevron. Sin acciones contextuales: guardar cambia el total y su tope no está
 * acá, y destinar por card no ahorra ningún tap sobre el bloque de arriba.
 *
 * Sin subtítulo: un propósito no tiene fecha hasta que exista Metas, y «Sin
 * fecha» para todos es un renglón que no dice nada.
 */
const PurposeCard = ({ group, onOpen }: { group: ModuleGroup; onOpen: () => void }) => {
  const visible = moduleVisibleAmounts(group.amounts)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[72px] w-full items-center gap-[13px] rounded-2xl border border-border-soft bg-card px-3.5 py-[13px] text-left transition-all hover:border-border hover:shadow-[0_8px_20px_-14px_rgba(11,26,43,0.4)]"
    >
      {/* Caja fija para el emoji: suelto al lado del texto, los nombres
          arrancaban en distinta `x` según el ancho del glifo y la grilla dejaba
          de leerse como grilla. El tinte cicla por posición — es identidad
          visual, no significado, así que no hace falta un color por propósito. */}
      <span
        aria-hidden
        className={cn(
          'grid size-[42px] shrink-0 place-items-center rounded-xl text-[20px]',
          purposeTint(group.purposeId),
        )}
      >
        {purposeGlyph(group.icon)}
      </span>

      <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold tracking-[-0.015em] text-text">
        {group.name}
      </span>

      {/* Los montos no se achican ni se parten: el que cede es el nombre. */}
      <span className="flex shrink-0 flex-col items-end">
        {visible.map((a, i) => (
          <span
            key={a.currency}
            className={cn(
              'whitespace-nowrap tabular-nums',
              i === 0
                ? 'text-[16.5px] font-extrabold tracking-[-0.02em] text-text'
                : 'text-[11.5px] font-bold text-text-muted',
            )}
          >
            {money(a.reserved, a.currency)}
          </span>
        ))}
      </span>

      <ChevronRight className="size-[18px] shrink-0 text-text-soft" aria-hidden />
    </button>
  )
}
