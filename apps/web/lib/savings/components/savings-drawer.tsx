'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAvailableSums,
  getPurposeSums,
  getReserveFlowSums,
  getAllocationHistory,
  getReserveHistory,
  listPurposes,
  PURPOSE_SEEDS,
  RESERVE_HISTORY_LIMIT,
  type AvailableSums,
  type Purpose,
  type PurposeSums,
  type ReserveEntry,
} from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { createClient } from '@/lib/supabase/client'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { cn } from '@/lib/utils'
import {
  reserveAvailability,
  releaseAvailability,
  createPurpose,
} from '@/app/_actions/savings'
import { DrawerBackHeader } from './drawer-back-header'
import { PurposePicker } from './purpose-picker'
import { PurposeForm } from './purpose-form'
import { PurposeDelete } from './purpose-delete'
import { PurposeAllocate } from './purpose-allocate'

type Currency = 'ARS' | 'USD'
type Mode = 'save' | 'release'

/**
 * Las vistas que el drawer apila, como una PILA y no como un `view` suelto.
 *
 * La fase 1 tenía dos estados y alcanzaba con un booleano. Con propósitos hay
 * seis, y varios se pueden alcanzar desde más de un lado: al selector se llega
 * desde el formulario, y al alta se llega desde el selector. Con un estado plano
 * cada vista tendría que recordar a dónde volver — que es una pila escrita a
 * mano, peor. Con una pila, "volver" es siempre lo mismo.
 */
type View =
  | { kind: 'detail' }
  | {
      kind: 'group'
      currency: Currency
      /**
       * Siempre un propósito con nombre. «Sin destino» NO tiene vista propia: es
       * el resto, y lo único que se hace con él —darle destino— es la fila
       * misma. Una vista para mostrar un número que ya estaba en la fila que se
       * tocó no es una vista, es un peaje.
       */
      purpose: Purpose
    }
  | {
      kind: 'form'
      mode: Mode
      currency: Currency
      purposeId: string | null
      /** Se llegó desde un grupo: el propósito se hereda y no se ofrece cambiarlo. */
      locked: boolean
    }
  | {
      kind: 'picker'
      currency: Currency
      /**
       * Qué hacer con lo elegido. `form` vuelve al formulario que lo pidió;
       * `allocate` sigue a apartar. Sin esto, el selector no sabría a dónde ir y
       * cada llamador tendría que acordarse — que es la pila escrita a mano que
       * la pila vino a evitar.
       */
      intent: 'form' | 'allocate'
    }
  | { kind: 'purposeForm'; purpose: Purpose | null; name?: string; icon?: string }
  | { kind: 'purposeDelete'; purpose: Purpose }
  | { kind: 'pickSource'; currency: Currency }
  | {
      kind: 'allocate'
      currency: Currency
      /** Nulo: se llegó desde el resto y el propósito se elige en la misma pantalla. */
      purpose: Purpose | null
      direction: 'allocate' | 'unallocate'
    }

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/** "25 de ago" — el historial mostraba el ISO crudo, que nadie lee como fecha. */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}

/**
 * "Guardado" — the single surface for the act and for auditing it. Mirrored on
 * native as `SavingsDrawer` (a `BottomSheet` there, a `Drawer` here).
 *
 * It is an OVERLAY over the dashboard, not a page, and it has no route: you tap
 * the number, read, and close, and the number you tapped is still there. That is
 * also why "it does not enter the navigation" is not a stance — there is no
 * address to put in a menu. Same mechanism as editing an account from the list.
 *
 * The view switches in place between the detail and the form instead of stacking
 * a second drawer: the form is a step of the same conversation, not a new one.
 */
export function SavingsDrawer({
  open,
  onClose,
  initialMode,
}: {
  open: boolean
  onClose: () => void
  /** The dashboard row opens straight into the form when nothing is saved yet. */
  initialMode?: { mode: Mode; currency: Currency }
}) {
  const t = useTranslations('savings')
  const [stack, setStack] = useState<View[]>([{ kind: 'detail' }])
  const view = stack[stack.length - 1]
  const push = (next: View) => setStack((s) => [...s, next])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const queryClient = useQueryClient()

  const today = getTodayAR()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthRange = { from: formatDateISO(monthStart), to: formatDateISO(today) }

  // The reads only run while the drawer is open: they are the detail's data, and
  // a closed drawer has no detail. `staleTime: 0` because the numbers here are
  // the ones the user just changed — a cached stock right after saving would show
  // the previous total on the screen that exists to audit it.
  const [sumsQuery, arsQuery, usdQuery, flowQuery, purposeSumsQuery, purposesQuery] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'sums'],
        queryFn: () => getAvailableSums(createClient()),
        enabled: open,
        staleTime: 0,
      },
      {
        queryKey: ['savings', 'history', 'ARS'],
        queryFn: () => getReserveHistory(createClient(), 'ARS'),
        enabled: open,
        staleTime: 0,
      },
      {
        queryKey: ['savings', 'history', 'USD'],
        queryFn: () => getReserveHistory(createClient(), 'USD'),
        enabled: open,
        staleTime: 0,
      },
      {
        // "Este mes" sale de la MISMA lectura normativa que la fila del
        // dashboard. Sumarlo acá a mano —filtrar el historial por prefijo de mes
        // y acumular— era una segunda implementación del mismo número: con
        // floats crudos en vez de `Money`, y sin el corte temporal, así que una
        // reserva fechada mañana la contaba esta pantalla y no la contaba la
        // fila. Dos números distintos para lo mismo, uno al lado del otro.
        queryKey: ['savings', 'flow', monthRange.from, monthRange.to],
        queryFn: () => getReserveFlowSums(createClient(), monthStart, today),
        enabled: open,
        staleTime: 0,
      },
      {
        // El corte por propósito, de la misma tabla y de la misma lectura
        // normativa que usa el piso del write path. La suma de estos grupos ES
        // el `reserved` de arriba: si alguna vez no coinciden, es una
        // divergencia real y no un redondeo.
        queryKey: ['savings', 'purpose-sums'],
        queryFn: () => getPurposeSums(createClient()),
        enabled: open,
        staleTime: 0,
      },
      {
        // La lista de propósitos es una lectura aparte y NO de plata: incluye
        // los que todavía no tienen nada guardado, que no aparecen en el corte.
        queryKey: ['savings', 'purposes'],
        queryFn: () => listPurposes(createClient()),
        enabled: open,
        staleTime: 0,
      },
    ],
  })

  const sums: AvailableSums[] | null = sumsQuery.data ?? null
  const EMPTY = { entries: [] as ReserveEntry[], hasMore: false }
  const history: Record<Currency, { entries: ReserveEntry[]; hasMore: boolean }> = {
    ARS: arsQuery.data ?? EMPTY,
    USD: usdQuery.data ?? EMPTY,
  }
  const monthNet = (currency: Currency): number =>
    flowQuery.data?.find((f) => f.currencyCode === currency)?.reservedNet ?? 0

  const purposeSums: PurposeSums[] = purposeSumsQuery.data ?? []
  const purposes: Purpose[] = purposesQuery.data ?? []

  const purposeById = (id: string | null): Purpose | null =>
    id == null ? null : (purposes.find((p) => p.id === id) ?? null)

  /**
   * Los grupos de una moneda, con «Sin destino» SIEMPRE al final.
   *
   * Ordenados por monto descendente y no alfabéticamente: la pregunta que trae
   * al usuario acá es "¿dónde está mi plata?", y la respuesta que más le sirve
   * está arriba. «Sin destino» queda fijo abajo aunque sea el más grande —
   * es el resto, y el resto va al final de una lista aunque pese.
   */
  const groupsOf = (currency: Currency): PurposeSums[] => {
    const rows = purposeSums.filter((s) => s.currencyCode === currency)
    const named = rows
      .filter((r) => r.purposeId != null)
      .sort((a, b) => b.reserved - a.reserved)
    const rest = rows.filter((r) => r.purposeId == null)
    return [...named, ...rest]
  }

  const groupAmount = (currency: Currency, purposeId: string | null): number =>
    purposeSums.find((s) => s.currencyCode === currency && s.purposeId === purposeId)?.reserved ?? 0

  // Reset the view when the drawer opens, adjusting state DURING RENDER rather
  // than in an effect: the reset is derived from a prop changing, not a
  // synchronization with an external system, and doing it in an effect costs a
  // second render with the previous view still on screen.
  //
  // `initialMode` is read once per opening on purpose — reacting to it would
  // yank the user back to the form after they navigated to the detail.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStack(
        initialMode
          ? [
              { kind: 'detail' },
              { ...initialMode, kind: 'form', purposeId: null, locked: false },
            ]
          : [{ kind: 'detail' }],
      )
    }
  }

  // Cuál se muestra. Arranca en pesos y el usuario cambia con el selector; no
  // se recuerda entre aperturas porque el caso normal es mirar pesos.
  const [shown, setShown] = useState<Currency>('ARS')

  const currencies: Currency[] = (['ARS', 'USD'] as const).filter((c) => {
    const row = sums?.find((s) => s.currencyCode === c)
    // ARS is always shown: it is the primary currency and the drawer would look
    // broken empty. USD only appears when there is something to say about it —
    // the same bimoneda rule the rest of the app follows.
    return c === 'ARS' || (row != null && (row.reserved !== 0 || row.available !== 0))
  })

  const shownCurrency: Currency = currencies.includes(shown) ? shown : (currencies[0] ?? 'ARS')

  const rowFor = (currency: Currency): AvailableSums =>
    sums?.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }

  // Al terminar la operación el drawer SE CIERRA, como el resto de los drawers
  // del repo. La confirmación es que el número del que venías cambió: quedarse
  // en el detalle deja al usuario preguntándose si pasó algo, y ese es el peor
  // final posible para una acción sobre plata.
  const onDone = async () => {
    setStack([{ kind: 'detail' }])
    onClose()
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['savings'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  /** Refresca sin cerrar: crear, renombrar o borrar un propósito no termina nada. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['savings'] })

  /**
   * Elegir un propósito vuelve AL FORMULARIO que lo pidió, con el propósito ya
   * puesto — no al detalle. Se llega al selector desde el medio de una operación
   * y perder el monto tipeado para elegir una etiqueta sería cobrarle al usuario
   * haber querido ser prolijo.
   */
  const pickPurpose = (purposeId: string | null, known?: Purpose) =>
    setStack((prev) => {
      const picker = [...prev].reverse().find((v) => v.kind === 'picker') as
        | Extract<View, { kind: 'picker' }>
        | undefined

      if (picker?.intent === 'allocate') {
        // `known` viene de quien ACABA de crear el propósito, y es necesario: la
        // lista de acá es la del render anterior, así que un propósito recién
        // creado todavía no está en ella. Buscarlo y no encontrarlo devolvía al
        // detalle sin decir nada — la operación se perdía en silencio.
        const target = known ?? purposes.find((p) => p.id === purposeId)
        if (!target) return prev.slice(0, 1)
        // Reemplaza al selector en vez de apilarse encima: volver desde apartar
        // tiene que llevar al grupo, no a la lista que ya cumplió su función.
        const at = prev.indexOf(picker)
        return [
          ...prev.slice(0, at),
          { kind: 'allocate', currency: picker.currency, purpose: target, direction: 'allocate' },
        ]
      }

      const at = prev.map((v) => v.kind).lastIndexOf('form')
      if (at < 0) return prev.slice(0, 1)
      const target = prev[at] as Extract<View, { kind: 'form' }>
      return [...prev.slice(0, at), { ...target, purposeId }]
    })

  /**
   * Tocar una sugerencia CREA el propósito y sigue. No abre el formulario:
   * el nombre y el ícono ya son los que el usuario eligió al tocar, así que la
   * pantalla intermedia no decide nada y cobra dos toques por confirmarse a sí
   * misma. Quien quiera otro nombre tiene «Nuevo propósito» al lado.
   *
   * Si el alta falla —por ejemplo, un nombre que ya existe con otra caja— se
   * cae al formulario con el nombre puesto, que es donde el error se puede leer
   * y corregir.
   */
  /**
   * Crea una sugerencia y devuelve el propósito ARMADO.
   *
   * Armado y no buscado: la lista de este render es la de antes de crearlo, así
   * que buscarlo ahí devuelve nada — y eso ya rompió la navegación una vez, en
   * silencio.
   */
  const createFromSeed = async (seedKey: string): Promise<Purpose | null> => {
    const seed = PURPOSE_SEEDS.find((x) => x.key === seedKey)
    const name = t(`purposes.seeds.${seedKey}`)
    const result = await createPurpose({ name, icon: seed?.icon ?? null })

    if (!result.ok || result.id == null) return null

    void refresh()
    return { id: result.id, name, icon: seed?.icon ?? null }
  }

  /** Desde el selector: crea y sigue al paso que lo pidió. */
  const createFromSeedAndPick = async (seedKey: string) => {
    const created = await createFromSeed(seedKey)
    if (created) pickPurpose(created.id, created)
    else push({ kind: 'purposeForm', purpose: null })
  }

  const openRelease = (currency: Currency) => {
    const withMoney = groupsOf(currency).filter((g) => g.reserved > 0)
    // Preguntar de cuál sale solo tiene sentido si hay más de uno. Con uno solo,
    // la pregunta tiene una única respuesta posible y es puro paso de más.
    if (withMoney.length > 1) return push({ kind: 'pickSource', currency })
    push({
      kind: 'form',
      mode: 'release',
      currency,
      purposeId: withMoney[0]?.purposeId ?? null,
      locked: true,
    })
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={t('title')} widthPx={480}>
      <div className="flex h-full flex-col overflow-y-auto bg-page px-5 pb-6 pt-5">
        {view.kind === 'form' && (
          <SavingsForm
            mode={view.mode}
            initialCurrency={view.currency}
            rowFor={rowFor}
            purpose={purposeById(view.purposeId)}
            purposeId={view.purposeId}
            purposeAmount={groupAmount(view.currency, view.purposeId)}
            lockedPurpose={view.locked}
            onPickPurpose={() => push({ kind: 'picker', currency: view.currency, intent: 'form' })}
            onCancel={back}
            onDone={onDone}
          />
        )}

        {view.kind === 'picker' && (
          <PurposePicker
            purposes={purposes}
            sums={purposeSums}
            currency={view.currency}
            allowNone={view.intent === 'form'}
            selectedId={
              (stack.find((v) => v.kind === 'form') as Extract<View, { kind: 'form' }>)
                ?.purposeId ?? null
            }
            onPick={pickPurpose}
            onCreate={(seedKey) =>
              seedKey != null
                ? createFromSeedAndPick(seedKey)
                : push({ kind: 'purposeForm', purpose: null })
            }
            onBack={back}
          />
        )}

        {view.kind === 'purposeForm' && (
          <PurposeForm
            purpose={view.purpose}
            initialName={view.name}
            initialIcon={view.icon}
            onDone={async (created) => {
              // Editar solo vuelve. Crear elige lo recién creado: obligar a
              // buscarlo de nuevo en la lista sería un paso que no decide nada.
              if (view.purpose != null) {
                back()
              } else if (stack.some((v) => v.kind === 'form' || v.kind === 'picker')) {
                pickPurpose(created.id, created)
              } else {
                back()
              }
              void refresh()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'purposeDelete' && (
          <PurposeDelete
            purpose={view.purpose}
            sums={purposeSums}
            onDone={async () => {
              await refresh()
              // Vuelve al detalle, no al grupo: el grupo ya no existe.
              setStack([{ kind: 'detail' }])
            }}
            onBack={back}
          />
        )}

        {view.kind === 'allocate' && (
          <PurposeAllocate
            purpose={view.purpose}
            purposes={purposes}
            currency={view.currency}
            direction={view.direction}
            available={
              view.direction === 'allocate'
                ? groupAmount(view.currency, null)
                : groupAmount(view.currency, view.purpose?.id ?? null)
            }
            onCreateSeed={createFromSeed}
            onCreateCustom={() => push({ kind: 'purposeForm', purpose: null })}
            onDone={async () => {
              await refresh()
              back()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'pickSource' && (
          <>
            <DrawerBackHeader title={t('purposes.choose')} onBack={back} />
            <ul className="mt-4 flex flex-col gap-2">
              {groupsOf(view.currency)
                .filter((g) => g.reserved > 0)
                .map((group) => (
                  <li key={group.purposeId ?? 'none'}>
                    <button
                      type="button"
                      onClick={() =>
                        push({
                          kind: 'form',
                          mode: 'release',
                          currency: view.currency,
                          purposeId: group.purposeId,
                          locked: true,
                        })
                      }
                      className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-border-soft bg-card px-3 py-2 text-left transition-colors hover:bg-surface-sunken"
                    >
                      <span aria-hidden className="text-[18px]">
                        {group.purposeIcon ?? '🫙'}
                      </span>
                      <span className="flex-1 text-[14px] font-semibold text-text">
                        {group.purposeName ?? t('purposes.none')}
                      </span>
                      <span className="text-[13px] font-extrabold tabular-nums text-text-muted">
                        {money(group.reserved, view.currency)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            {/* No hay una opción "repartir": elegir de dónde sale es una
                decisión del usuario, y repartirlo automáticamente sería
                inventar una imputación — lo mismo que el modelo se niega a
                hacer con los retiros de una cuenta. */}
          </>
        )}

        {view.kind === 'group' && (
          <GroupBlock
            currency={view.currency}
            purpose={view.purpose}
            reserved={groupAmount(view.currency, view.purpose.id)}
            onSave={() =>
              push({
                kind: 'form',
                mode: 'save',
                currency: view.currency,
                purposeId: view.purpose.id,
                locked: true,
              })
            }
            onRelease={() =>
              push({
                kind: 'form',
                mode: 'release',
                currency: view.currency,
                purposeId: view.purpose.id,
                locked: true,
              })
            }
            onAllocate={() =>
              push({
                kind: 'allocate',
                currency: view.currency,
                purpose: view.purpose,
                direction: 'allocate',
              })
            }
            onUnallocate={() =>
              push({
                kind: 'allocate',
                currency: view.currency,
                purpose: view.purpose,
                direction: 'unallocate',
              })
            }
            onEdit={() => push({ kind: 'purposeForm', purpose: view.purpose })}
            onDelete={() => push({ kind: 'purposeDelete', purpose: view.purpose })}
            onBack={back}
          />
        )}

        {view.kind === 'detail' && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[21px] font-extrabold tracking-[-0.025em] text-text">
                {t('title')}
              </h2>
              {/* Selector, no dos bloques apilados. Con las dos monedas una
                  debajo de la otra el drawer duplicaba total, puente, desglose e
                  historial —y la segunda quedaba a un scroll largo, donde nadie
                  la ve—. Mismo control que el chip de moneda del alta de
                  movimientos, que es donde el usuario ya lo aprendió. */}
              {currencies.length > 1 && (
                <div className="flex rounded-[10px] border border-border bg-[#FAFBFC] p-0.5">
                  {currencies.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setShown(code)}
                      className={cn(
                        'min-h-[32px] rounded-[8px] px-3 text-xs font-bold transition-colors',
                        shownCurrency === code
                          ? 'bg-card text-text shadow-[0_1px_2px_rgba(11,26,43,0.08)]'
                          : 'text-text-soft hover:text-text',
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-5">
              {[shownCurrency].map((currency) => (
                <CurrencyBlock
                  key={currency}
                  currency={currency}
                  sums={rowFor(currency)}
                  history={history[currency]}
                  monthNet={monthNet(currency)}
                  groups={groupsOf(currency)}
                  // «Sin destino» va DERECHO a destinar, con el propósito por
                  // elegir en la misma pantalla: cuánto y para qué son dos datos
                  // de una sola decisión, y separarlos en dos pasos cobraba
                  // navegación por no decidir nada. Los propósitos sí abren su
                  // grupo: tienen historial y acciones propias.
                  onOpenGroup={(purposeId) =>
                    purposeId == null
                      ? push({ kind: 'allocate', currency, purpose: null, direction: 'allocate' })
                      : push({ kind: 'group', currency, purpose: purposeById(purposeId)! })
                  }
                  onSave={() =>
                    push({ kind: 'form', mode: 'save', currency, purposeId: null, locked: false })
                  }
                  onRelease={() => openRelease(currency)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}

/**
 * One currency's block: the STOCK, this month's FLOW, and the history.
 *
 * The two numbers are kept apart on purpose — they are the pair users conflate.
 * The total is what is set aside right now; "este mes" is what moved in this
 * period, and it can be negative while the total is large.
 */
const CurrencyBlock = ({
  currency,
  sums,
  history,
  monthNet,
  groups,
  onOpenGroup,
  onSave,
  onRelease,
}: {
  currency: Currency
  sums: AvailableSums
  history: { entries: ReserveEntry[]; hasMore: boolean }
  /** Neto del mes, de `get_reserve_flow_sums`. Nunca recompuesto acá. */
  monthNet: number
  /** El corte por propósito de esta moneda, «Sin destino» al final. */
  groups: PurposeSums[]
  onOpenGroup: (purposeId: string | null) => void
  onSave: () => void
  onRelease: () => void
}) => {
  const t = useTranslations('savings')

  return (
    <section className="rounded-2xl border border-border-soft bg-card p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('total_label', { currency })}
      </p>
      <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.04em] text-text">
        {money(sums.reserved, currency)}
      </p>
      {/* Acá el verbo SÍ gira con el signo, y es el lugar donde corresponde: es un
          dato suelto, no un término de ninguna resta. En la card competía con la
          identidad —el número tenía que sumar y a la vez decir una dirección— y
          por eso necesitaba signo, color y verbo coordinados. Acá el verbo solo
          tiene que hacerlo legible. */}
      <p className="mt-3 flex items-baseline justify-between border-t border-border-soft pt-3 text-[13px] text-text-muted">
        <span>{t(monthNet < 0 ? 'this_month_released' : 'this_month_saved')}</span>
        {/* Mismo criterio que el historial de esta misma pantalla: el emerald
            marca lo que se guardó. Un mes en que se volvió a usar más de lo que
            se guardó no es una mejora, así que va en neutro — y el terracota
            está reservado para por pagar y vencido. */}
        <span
          className={cn(
            'font-extrabold tabular-nums',
            monthNet >= 0 ? 'text-emerald-deep' : 'text-text-muted',
          )}
        >
          {monthNet < 0 ? '−' : '+'}
          {money(Math.abs(monthNet), currency)}
        </span>
      </p>

      {/* El puente entre los dos números que el usuario ve en dos lugares
          distintos: el de su banco y el de Grana. Sin esto, alguien que abre su
          cuenta y ve $5.085.748 y después abre Grana y ve $4.495.748 no tiene
          dónde entender la diferencia — y le va a creer al banco, porque es "el
          de verdad". Acá los dos aparecen juntos y lo que los separa tiene
          nombre. No hace falta ningún consejo: alcanza con mostrar la resta. */}
      <div className="mt-3 rounded-xl bg-surface-sunken px-3 py-2.5 text-[13px]">
        <p className="flex justify-between py-0.5 text-text-muted">
          <span>{t('accounts_total', { currency })}</span>
          <span className="font-semibold tabular-nums text-text">
            {money(sums.accountsNet, currency)}
          </span>
        </p>
        <p className="flex justify-between py-0.5 text-text-muted">
          <span>{t('title')}</span>
          <span className="font-semibold tabular-nums text-emerald-deep">
            −{money(sums.reserved, currency)}
          </span>
        </p>
        <p className="mt-1 flex justify-between border-t border-border pt-1.5 text-text-muted">
          <span>{t('to_spend')}</span>
          <span className="font-extrabold tabular-nums text-text">
            {money(sums.available, currency)}
          </span>
        </p>
      </div>

      {/* La frase que nombra la confusión antes de que ocurra. Describe — "Grana
          no mueve tu plata" — en vez de aconsejar: decirle a alguien que mueva
          los pesos a otra cuenta sería recomendarle una movida cuyo costo Grana
          no conoce (puede estar perdiendo el rendimiento de una remunerada), y
          además el caso normal es que esa plata se quede meses donde está. */}
      <p className="mt-2 px-1 text-[12.5px] leading-snug text-text-soft">{t('gap_note')}</p>

      {/* El desglose por propósito. Va DESPUÉS del puente y antes del
          historial, que es el orden en que se contesta lo que el usuario vino a
          preguntar: cuánto hay, por qué no coincide con el banco, en qué está
          repartido, y recién después el detalle movimiento por movimiento.

          Con un solo grupo no hay desglose que mostrar —repetiría el total con
          más tinta— pero SÍ tiene que haber puerta: sin ella, el usuario que
          todavía no destinó nada no tiene por dónde empezar, y ese es el estado
          de TODOS el primer día. Mismo patrón que la fila del dashboard, que
          con cero guardado ofrece "Guardar algo" en vez de un cero. */}
      {groups.length <= 1 && sums.reserved > 0 && (
        <button
          type="button"
          onClick={() => onOpenGroup(null)}
          className="mt-4 flex min-h-[44px] w-full items-center justify-between rounded-xl border border-dashed border-border px-3 py-2 text-left transition-colors hover:bg-surface-sunken"
        >
          <span className="text-[13.5px] font-semibold text-text-muted">
            {t('purposes.empty_cta')}
          </span>
          <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
        </button>
      )}

      {groups.length > 1 && (
        <>
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
            {t('purposes.label')}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {groups.map((group) => (
              <li key={group.purposeId ?? 'none'}>
                <button
                  type="button"
                  onClick={() => onOpenGroup(group.purposeId)}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken"
                >
                  <span aria-hidden className="text-[16px]">
                    {group.purposeIcon ?? '🫙'}
                  </span>
                  <span className="flex-1 truncate text-[14px] font-semibold text-text">
                    {group.purposeName ?? t('purposes.none')}
                  </span>
                  <span className="text-[14px] font-extrabold tabular-nums text-text">
                    {money(group.reserved, currency)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Plegado por omisión. La lista está acotada en 25, pero 25 filas debajo
          del desglose empujan las acciones fuera de la pantalla — y el
          historial es para auditar, no para leer cada vez que se abre. El
          número en el rótulo evita tener que abrirlo para saber si hay algo. */}
      <details className="group mt-4">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
          <ChevronRight
            className="size-3.5 transition-transform group-open:rotate-90"
            aria-hidden
          />
          {t('history_count', { count: history.entries.length })}
        </summary>
        {history.entries.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-soft">{t('empty_history')}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border-soft">
            {history.entries.map((entry) => (
              <li key={entry.id}>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[14px] font-semibold text-text">
                    {entry.amount >= 0 ? t('entry_saved') : t('entry_released')}
                    <span className="ml-2 text-[12px] font-medium text-text-soft">
                      {shortDate(entry.date)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-[14px] font-extrabold tabular-nums',
                      entry.amount >= 0 ? 'text-emerald-deep' : 'text-text-muted',
                    )}
                  >
                    {entry.amount >= 0 ? '+' : '−'}
                    {money(Math.abs(entry.amount), currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {history.hasMore && (
          <p className="mt-2 text-[12px] text-text-soft">
            {t('history_truncated', { count: RESERVE_HISTORY_LIMIT })}
          </p>
        )}
      </details>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onSave}>
          {t('save')}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onRelease}
          disabled={sums.reserved <= 0}
        >
          {t('release')}
        </Button>
      </div>
    </section>
  )
}

/**
 * Un grupo: el mismo bloque que una moneda, un nivel más abajo.
 *
 * Un propósito tiene CUATRO acciones porque hay dos pares de verbos en juego, y
 * son distintos: **guardar / volver a usar** mueven el disponible, **apartar /
 * soltar** solo reparten lo que ya está guardado. Las dos primeras van como
 * botones porque son las que tocan plata; las otras dos como enlaces, más abajo.
 *
 * «Sin destino» es el RESTO, no una fila: no se edita, no se borra y no tiene
 * historial propio —no hay actos suyos que listar—, y su acción específica es
 * apartar parte hacia un propósito.
 */
const GroupBlock = ({
  currency,
  purpose,
  reserved,
  onSave,
  onRelease,
  onAllocate,
  onUnallocate,
  onEdit,
  onDelete,
  onBack,
}: {
  currency: Currency
  purpose: Purpose
  reserved: number
  onSave: () => void
  onRelease: () => void
  /** Desde «Sin destino»: elegir a qué propósito apartar. Desde uno: apartarle más. */
  onAllocate: () => void
  onUnallocate: () => void
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
}) => {
  const t = useTranslations('savings')

  // El historial de un propósito son sus REPARTOS, no reservas: "Apartaste
  // $150.000" y "Soltaste $20.000". Las reservas ya no saben para qué son, y
  // mezclar las dos listas obligaría a distinguir a ojo dos actos que no se
  // parecen — uno mueve el disponible y el otro no.
  const historyQuery = useQuery({
    queryKey: ['savings', 'allocations', currency, purpose.id],
    queryFn: () => getAllocationHistory(createClient(), currency, purpose.id),
    staleTime: 0,
  })
  const history = historyQuery.data ?? { entries: [], hasMore: false }

  return (
    <div className="flex flex-col">
      <DrawerBackHeader
        title={purpose.name}
        onBack={onBack}
        action={
          <div className="flex gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label={t('purposes.edit')}
                className="flex size-11 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-border-soft hover:text-text"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={t('purposes.delete')}
                className="flex size-11 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
          </div>
        }
      />

      <section className="mt-4 rounded-2xl border border-border-soft bg-card p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
          {t('purposes.allocated_in', { purpose: purpose.name })}
        </p>
        <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.04em] text-text">
          {money(reserved, currency)}
        </p>

        <>
            <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
              {t('history')}
            </p>
            {history.entries.length === 0 ? (
              <p className="mt-2 text-[13px] text-text-soft">{t('purposes.empty_allocations')}</p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-border-soft">
                {history.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[14px] font-semibold text-text">
                      {entry.amount >= 0
                        ? t('purposes.entry_allocated')
                        : t('purposes.entry_unallocated')}
                      <span className="ml-2 text-[12px] font-medium text-text-soft">
                        {shortDate(entry.date)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'text-[14px] font-extrabold tabular-nums',
                        entry.amount >= 0 ? 'text-emerald-deep' : 'text-text-muted',
                      )}
                    >
                      {entry.amount >= 0 ? '+' : '−'}
                      {money(Math.abs(entry.amount), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {history.hasMore && (
              <p className="mt-2 text-[12px] text-text-soft">
                {t('history_truncated', { count: RESERVE_HISTORY_LIMIT })}
              </p>
            )}
        </>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onSave}>
            {t('save')}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onRelease}
            disabled={reserved <= 0}
          >
            {t('release')}
          </Button>
        </div>

        {/* El segundo par de verbos, como enlaces: reparten lo que ya está
            guardado y no tocan ningún total, así que no compiten en peso con los
            dos que sí lo hacen. */}
        <div className="mt-3 flex justify-center gap-5 text-[13px] font-bold text-emerald-deep">
          <button type="button" onClick={onAllocate} className="min-h-[44px]">
            {t('purposes.allocate')}
          </button>
          <button
            type="button"
            onClick={onUnallocate}
            disabled={reserved <= 0}
            className="min-h-[44px] disabled:opacity-40"
          >
            {t('purposes.unallocate')}
          </button>
        </div>
      </section>
    </div>
  )
}

/**
 * The act itself.
 *
 * The amount field takes a POSITIVE number in both modes: the direction comes
 * from the verb the user tapped, never from a sign typed into the field. The
 * write path is what persists it signed.
 *
 * The maths shown is the maths OF THIS MOMENT — the disponible right now, the
 * amount, what is left — and never a calculation against the income the drawer
 * may have come from: that framing would say the reserve belongs to that
 * movement, and a reserve is fungible and belongs to no movement.
 */
const SavingsForm = ({
  mode,
  initialCurrency,
  rowFor,
  purpose,
  purposeId,
  purposeAmount,
  lockedPurpose,
  onPickPurpose,
  onCancel,
  onDone,
}: {
  mode: Mode
  initialCurrency: Currency
  rowFor: (currency: Currency) => AvailableSums
  /** El propósito elegido, ya resuelto. `null` es «Sin destino». */
  purpose: Purpose | null
  purposeId: string | null
  /** Lo guardado en ese grupo y esa moneda: es el piso cuando se vuelve a usar. */
  purposeAmount: number
  /** Se llegó desde un grupo: el propósito se hereda y no se ofrece cambiarlo. */
  lockedPurpose: boolean
  onPickPurpose: () => void
  onCancel: () => void
  onDone: () => Promise<void>
}) => {
  const t = useTranslations('savings')
  const [currency, setCurrency] = useState<Currency>(initialCurrency)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateISO(getTodayAR()))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The currency is offered ONLY when there is more than one to offer. Coming
  // from an income it is inherited and never asked; opened loose, a user who
  // only holds pesos should not have to confirm that they hold pesos.
  const currencyOptions = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === initialCurrency || row.available !== 0 || row.reserved !== 0
  })
  const cycleCurrency = () => {
    if (currencyOptions.length < 2) return
    const next = currencyOptions[(currencyOptions.indexOf(currency) + 1) % currencyOptions.length]
    setCurrency(next)
  }

  const row = rowFor(currency)
  // Opened loose there is no income to take a percentage of, so the field starts
  // EMPTY. A pre-filled number with no anchor would read as an amount Grana is
  // recommending, and Grana does not recommend amounts.
  const value = parseMoneyInput(amount) ?? 0
  // El tope de guardar es el disponible de la MONEDA; el piso de volver a usar
  // es el de ESTE GRUPO. La asimetría es la misma que aplica el write path: un
  // propósito no tiene objetivo, así que guardar no tiene contra qué toparse,
  // pero volver a usar no puede dejar un grupo en negativo aunque el total
  // guardado —que está a la vista en la pantalla anterior— lo cubra.
  const limit = mode === 'save' ? row.available : purposeAmount
  const remainder = limit - value
  const overLimit = value > limit
  // El mismo mensaje que devolvería el servidor, con el mismo número. Un botón
  // deshabilitado sin explicación es lo peor de los dos mundos: no podés avanzar
  // y no sabés por qué. Y decirlo acá no reemplaza la validación del write path
  // — la repite en el momento en que sirve.
  const limitError = overLimit
    ? mode === 'save'
      ? t('errors.exceeds_available', { limit: money(limit, currency) })
      : purpose != null
        ? t('errors.exceeds_purpose_reserved', {
            limit: money(limit, currency),
            purpose: purpose.name,
          })
        : t('errors.exceeds_reserved', { limit: money(limit, currency) })
    : null

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const action = mode === 'save' ? reserveAvailability : releaseAvailability
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(`${date}T00:00:00`),
        purpose_id: purposeId,
      })
      if (!result.ok) {
        setError(result.formError ?? t('errors.generic'))
        return
      }
      await onDone()
    })
  }

  return (
    <div className="flex flex-col">
      {/* Un solo título: el verbo. La eyebrow decía "Guardar" y el título
          "Guardado" — dos formas de la misma palabra, una arriba de la otra, sin
          agregar nada. La moneda ya la dice el chip del monto. */}
      <h2 className="text-[21px] font-extrabold tracking-[-0.025em] text-text">
        {mode === 'save' ? t('save') : t('release')}
      </h2>

      {/* Same amount hero as "Registrar movimiento" — same radius, same type
          scale, same currency chip, same calculator. Two surfaces that ask for
          an amount should not look like two different apps, and the chip is what
          gives this one its currency selector. */}
      <div className="mt-4 rounded-[18px] border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]">
        <div className="flex items-start justify-between">
          <label
            htmlFor="savings-amount"
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft"
          >
            {t('amount_label')}
          </label>
          <button
            type="button"
            onClick={cycleCurrency}
            disabled={currencyOptions.length < 2}
            className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-[#FAFBFC] px-2.5 py-1 text-xs font-bold text-text disabled:opacity-100"
          >
            {currency}
            {currencyOptions.length > 1 && <ChevronDown className="size-3" aria-hidden />}
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[27px] font-semibold leading-none text-text opacity-50">
            {currency === 'USD' ? 'U$D' : '$'}
          </span>
          <MoneyAmountInput
            id="savings-amount"
            value={amount}
            onChange={setAmount}
            placeholder="0"
            autoFocus
            className="w-full min-w-0 bg-transparent text-[46px] font-bold leading-none tracking-[-0.045em] tabular-nums text-text outline-none placeholder:text-text-soft/40"
          />
          <MoneyCalculatorPopover
            seed={amount}
            onResult={setAmount}
            className="shrink-0 self-center"
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border-soft bg-card p-4">
        <DatePicker
          value={date}
          onChange={setDate}
          label={t('date_label')}
          max={formatDateISO(getTodayAR())}
        />
      </div>

      {/* Para qué. Una fila, no un selector inline: el propósito es opcional y
          casi siempre va a quedar como está, así que ocupar altura con una lista
          desplegada le cobraría a todos por lo que decide una minoría.

          Bloqueada cuando se llegó desde un grupo: ahí el propósito se hereda de
          dónde se tocó, igual que la moneda se hereda del ingreso. */}
      <button
        type="button"
        onClick={onPickPurpose}
        disabled={lockedPurpose}
        className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-border-soft bg-card px-4 py-2 text-left transition-colors enabled:hover:bg-surface-sunken disabled:opacity-100"
      >
        <span className="text-[13px] text-text-muted">{t('purposes.label')}</span>
        <span aria-hidden className="ml-auto text-[16px]">
          {purpose?.icon ?? '🫙'}
        </span>
        <span className="text-[14px] font-semibold text-text">
          {purpose?.name ?? t('purposes.none')}
        </span>
        {!lockedPurpose && <ChevronRight className="size-4 text-text-soft" aria-hidden />}
      </button>

      <div className="mt-3 rounded-2xl border border-border-soft bg-card p-4 text-[14px]">
        <p className="flex justify-between py-1 text-text-muted">
          <span>
            {mode === 'save'
              ? t('available_now')
              : purpose != null
                ? t('saved_in', { purpose: purpose.name })
                : t('saved_total')}
          </span>
          <span className="font-semibold tabular-nums text-text">{money(limit, currency)}</span>
        </p>
        <p className="flex justify-between py-1 text-text-muted">
          <span>{mode === 'save' ? t('you_will_save') : t('you_will_release')}</span>
          <span className="font-semibold tabular-nums text-emerald-deep">
            {value > 0 ? '−' : ''}
            {money(value, currency)}
          </span>
        </p>
        <p className="mt-1.5 flex justify-between border-t border-border-soft pt-2.5 text-text-muted">
          <span>
            {mode === 'save'
              ? t('left_to_spend')
              : purpose != null
                ? t('stays_in', { purpose: purpose.name })
                : t('stays_saved')}
          </span>
          <span
            className={cn(
              'text-[16px] font-extrabold tabular-nums',
              overLimit ? 'text-negative' : 'text-text',
            )}
          >
            {money(remainder, currency)}
          </span>
        </p>
      </div>

      {/* The copy never suggests a transfer happened. Grana does not invent a
          financial fact to represent an intention. */}
      <p className="mt-3 px-1 text-[13px] leading-snug text-text-muted">
        {mode === 'save' ? t('save_note') : t('release_note')}
      </p>

      {(limitError ?? error) && (
        <p role="alert" className="mt-3 px-1 text-[13px] font-semibold text-negative">
          {limitError ?? error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        {/* Volver al detalle. Era un botón fantasma con un "‹" tipográfico
            suelto: no se veía, y el área táctil quedaba por debajo de los 44px
            que pide el repo para un control. */}
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          aria-label={t('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-text-muted transition-colors hover:bg-border-soft hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <Button className="h-11 flex-1" onClick={submit} disabled={pending || value <= 0 || overLimit}>
          {mode === 'save' ? t('save') : t('release')}
        </Button>
      </div>
    </div>
  )
}
