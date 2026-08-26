'use client'

import { useTranslations } from 'next-intl'
import { ChevronRight, Plus } from 'lucide-react'
import {
  moduleGroupCurrency,
  moduleGroups,
  moduleRest,
  moduleVisibleAmounts,
} from '@grana/savings'
import type { ModuleAmount, ModuleGroup, PurposeSums } from '@grana/savings'
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
export const SavingsBreakdown = ({ purposeSums }: { purposeSums: PurposeSums[] }) => {
  const t = useTranslations('savings')
  const overlay = useSavingsOverlay()

  const groups = moduleGroups(purposeSums)
  const rest = moduleRest(purposeSums)
  const restHasMoney = rest.some((a) => a.reserved > 0)
  // La moneda de la operación sale del dato, no de un default: un resto de solo
  // dólares abriría en pesos, con tope cero, sobre una pantalla que no explica
  // por qué.
  const restCurrency = moduleGroupCurrency(rest)

  return (
    <div className="flex flex-col gap-3 sm:gap-[18px]">
      {restHasMoney && (
        <UnassignedBlock
          amounts={rest}
          onAllocate={() => overlay.openRestAllocate(restCurrency)}
          onRelease={() => overlay.openRestRelease(restCurrency)}
        />
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 px-[3px]">
          <div className="min-w-0">
            <h2 className="text-[14.5px] font-extrabold tracking-[-0.02em] text-text sm:text-[17px]">
              {t('purposes.breakdown_title')}
            </h2>
          </div>
        </div>

        {/* Grilla y no lista: el ancho decide cuántas columnas entran, así el
            nombre no se parte en dos líneas en desktop. Es el MISMO componente
            en los tres tamaños — nunca se convierte en fila de tabla. */}
        <ul className="grid grid-cols-1 gap-[9px] sm:grid-cols-[repeat(auto-fill,minmax(330px,1fr))] sm:gap-[11px]">
          {groups.map((g) => (
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
        </ul>

        {/* Con el resto en cero su explicación no desaparece: baja acá, en gris,
            porque sigue siendo lo que evita entender «guardado» como una cuenta
            aparte. */}
        {!restHasMoney && (
          <p className="px-[3px] pt-1 text-[11.5px] font-semibold leading-[1.45] text-text-soft">
            {t('purposes.none_explainer')}
          </p>
        )}
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
    <section className="rounded-[20px] border border-dashed border-savings-unassigned-border bg-savings-unassigned-bg p-[15px] sm:px-5 sm:py-[18px]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-savings-unassigned-deep/50 text-savings-unassigned-deep"
        >
          <Plus className="size-[19px]" strokeWidth={2.1} />
        </span>

        <div className="min-w-0 flex-1">
          {/* Versalitas y no nombre propio: «Sin destino» no es un nombre que
              alguien eligió, es la etiqueta de lo que quedó. */}
          <p className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-savings-unassigned-deep">
            {t('purposes.none')}
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3">
            {visible.map((a, i) => (
              <span
                key={a.currency}
                className={cn(
                  'whitespace-nowrap font-extrabold tracking-[-0.045em] tabular-nums text-savings-unassigned-text',
                  i === 0 ? 'text-[22px]' : 'text-[14px] opacity-80',
                )}
              >
                {money(a.reserved, a.currency)}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onAllocate}
          className="min-h-11 shrink-0 rounded-[13px] bg-savings-unassigned-deep px-4 text-[12.5px] font-extrabold text-savings-unassigned-on-deep transition-opacity hover:opacity-90"
        >
          {t('purposes.allocate')}
        </button>
      </div>

      <div className="mt-[11px] border-t border-dashed border-savings-unassigned-border pt-[11px]">
        <p className="text-[11.5px] font-semibold leading-[1.45] text-savings-unassigned-text/85">
          {t('purposes.none_explainer')}
        </p>
        {/* «Volver a usar» va como enlace y no como segundo botón: es la acción
            que SÍ mueve el disponible, y dos botones gemelos acá invitaban a
            confundirla con destinar, que no lo mueve. */}
        <button
          type="button"
          onClick={onRelease}
          className="mt-1 inline-flex min-h-11 items-center text-[12.5px] font-extrabold text-savings-unassigned-deep underline decoration-savings-unassigned-deep/35 underline-offset-[5px] transition-colors hover:decoration-savings-unassigned-deep"
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
      className="flex min-h-[72px] w-full items-center gap-[13px] rounded-[18px] border border-border-soft bg-card px-3.5 py-[13px] text-left transition-all hover:border-border hover:shadow-[0_8px_20px_-14px_rgba(11,26,43,0.4)]"
    >
      {/* Caja fija para el emoji: suelto al lado del texto, los nombres
          arrancaban en distinta `x` según el ancho del glifo y la grilla dejaba
          de leerse como grilla. El tinte cicla por posición — es identidad
          visual, no significado, así que no hace falta un color por propósito. */}
      <span
        aria-hidden
        className={cn(
          'grid size-[42px] shrink-0 place-items-center rounded-[15px] text-[20px]',
          TINTS[hashTint(group.purposeId)],
        )}
      >
        {group.icon ?? '🫙'}
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

/**
 * Los cinco tintes del emblema, del set de la app y no de una paleta nueva.
 *
 * Ciclan por el id del propósito y no por su posición en la lista: ordenada por
 * monto, la lista se reordena sola cuando cambian los números, y un propósito
 * que cambia de color porque otro creció es un propósito que cuesta reencontrar.
 */
const TINTS = [
  'bg-slate-soft text-slate-deep',
  'bg-emerald-bg text-emerald-deep',
  'bg-plum-soft text-plum-deep',
  'bg-terracotta-soft text-terracotta-deep',
  'bg-surface-sunken text-text-muted',
] as const

const hashTint = (id: string): number => {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % TINTS.length
}
