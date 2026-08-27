'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAvailableSums,
  getPurposeSums,
  getAllocationHistory,
  listPurposes,
  moduleGroupCurrency,
  MODULE_CURRENCIES,
  PURPOSE_SEEDS,
  RESERVE_HISTORY_LIMIT,
  type AvailableSums,
  type Purpose,
  type PurposeSums,
} from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { Calendar, Pencil, Plus, Trash2 } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { purposeGlyph, purposeTint } from '@/lib/savings/purpose-emblem'
import { shortDate } from '@/lib/savings/short-date'
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
      /**
       * Se llegó desde un grupo: el propósito se hereda y no se ofrece cambiarlo.
       * Falso cuando se entró por el botón global, donde el origen todavía no se
       * eligió y se elige con los chips, en esta misma pantalla.
       */
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
  | {
      kind: 'allocate'
      currency: Currency
      /** Nulo: se llegó desde el resto y el propósito se elige en la misma pantalla. */
      purpose: Purpose | null
      direction: 'allocate' | 'unallocate'
    }

/**
 * Por dónde puede ABRIR el overlay: cualquier vista de la pila menos el detalle.
 *
 * Exportado para que quien lo abre no vuelva a escribir estas formas: el módulo
 * arma tres de ellas, y una copia suya podría decir algo que la pila no acepta.
 */
/**
 * Por dónde abre el overlay. Es CUALQUIER vista, porque ya no hay una vista raíz
 * de la que colgar las demás: el overlay dejó de tener lectura propia el día que
 * el módulo se la llevó, y lo que queda son actos — un formulario, un grupo, un
 * reparto. Todos empiezan por algo que el usuario tocó.
 */
export type SavingsDrawerInitialView = View

/**
 * Los pasos de los atajos de monto, por moneda.
 *
 * No es un número escalado por cotización: son las cifras redondas con las que
 * la gente piensa en cada moneda. Diez mil pesos y diez dólares no son el mismo
 * monto, pero sí el mismo GESTO — «un poco»— y eso es lo que un atajo tiene que
 * ofrecer.
 */
const AMOUNT_STEPS: Record<Currency, readonly number[]> = {
  ARS: [10_000, 50_000],
  USD: [10, 50],
}

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/** "25 de ago" — el historial mostraba el ISO crudo, que nadie lee como fecha. */
/** Ayer, en fecha financiera AR. */
const yesterdayISO = (): string => {
  const d = getTodayAR()
  d.setDate(d.getDate() - 1)
  return formatDateISO(d)
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
  initialView,
}: {
  open: boolean
  onClose: () => void
  /**
   * Dónde abre el overlay, cuando no es el detalle.
   *
   * Es CUALQUIER vista de la pila menos el detalle, y no una lista corta aparte:
   * el módulo entra a cuatro de ellas y una unión paralela habría que ampliarla
   * cada vez, con la de acá y la de allá pudiendo decir cosas distintas.
   *
   * El detalle queda igual debajo en la pila, así que la flecha siempre vuelve a
   * algo. Cuando el módulo es la lectura, esa vista intermedia no se dibuja
   * nunca — la lista de la página ya la reemplazó.
   */
  initialView: SavingsDrawerInitialView
}) {
  const t = useTranslations('savings')
  const [stack, setStack] = useState<View[]>([initialView])
  const view = stack[stack.length - 1]
  const push = (next: View) => setStack((s) => [...s, next])
  // En el fondo de la pila la flecha CIERRA. Antes caía en la vista de detalle,
  // que era la misma lista que la página de atrás: entrabas desde la lista del
  // módulo, volvías, y aparecía otra lista.
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : (onClose(), s)))
  const queryClient = useQueryClient()

  // Las lecturas corren SOLO con el overlay abierto: son los topes de las
  // operaciones, y un overlay cerrado no está por operar. `staleTime: 0` porque
  // son los números que el usuario acaba de cambiar.
  //
  // Quedaron tres. El historial y el flujo del mes se fueron con la vista de
  // detalle: eran lectura, y la lectura vive en la página. Cada apertura del
  // overlay hace dos consultas menos.
  const [sumsQuery, purposeSumsQuery, purposesQuery] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'sums'],
        queryFn: () => getAvailableSums(createClient()),
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
  const purposeSums: PurposeSums[] = purposeSumsQuery.data ?? []

  const purposes: Purpose[] = purposesQuery.data ?? []

  const purposeById = (id: string | null): Purpose | null =>
    id == null ? null : (purposes.find((p) => p.id === id) ?? null)


  const groupAmount = (currency: Currency, purposeId: string | null): number =>
    purposeSums.find((s) => s.currencyCode === currency && s.purposeId === purposeId)?.reserved ?? 0

  /**
   * La moneda en la que hay resto para destinar, si hay alguna.
   *
   * `null` cuando «Sin destino» está en cero en las dos: no es un default, es la
   * ausencia de una respuesta, y quien la consume tiene que decidir qué hacer
   * con eso en vez de recibir «pesos» y abrir un formulario con tope cero.
   */
  const restCurrency: Currency | null = MODULE_CURRENCIES.some((c) => groupAmount(c, null) > 0)
    ? moduleGroupCurrency(
        MODULE_CURRENCIES.map((c) => ({ currency: c, reserved: groupAmount(c, null) })),
      )
    : null

  // Reset the view when the drawer opens, adjusting state DURING RENDER rather
  // than in an effect: the reset is derived from a prop changing, not a
  // synchronization with an external system, and doing it in an effect costs a
  // second render with the previous view still on screen.
  //
  // `initialView` is read once per opening on purpose — reacting to it would
  // yank the user back after they navigated.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      // El detalle queda SIEMPRE debajo en la pila: es a donde vuelve la flecha.
      setStack([initialView])
    }
  }

  const currencies: Currency[] = (['ARS', 'USD'] as const).filter((c) => {
    const row = sums?.find((s) => s.currencyCode === c)
    // ARS is always shown: it is the primary currency and the drawer would look
    // broken empty. USD only appears when there is something to say about it —
    // the same bimoneda rule the rest of the app follows.
    return c === 'ARS' || (row != null && (row.reserved !== 0 || row.available !== 0))
  })

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
            groupAmount={groupAmount}
            lockedPurpose={view.locked}
            purposes={purposes}
            onSetPurpose={(purposeId) =>
              setStack((prev) => {
                const at = prev.length - 1
                const target = prev[at] as Extract<View, { kind: 'form' }>
                return [...prev.slice(0, at), { ...target, purposeId }]
              })
            }
            onPickPurpose={() => push({ kind: 'purposeForm', purpose: null })}
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
                // Creado desde la página, donde no hay operación en curso a la
                // que volver. Un propósito recién creado está en cero y no sirve
                // para nada hasta que se le destine algo, así que en vez de
                // cerrar y dejar una fila vacía en la lista, sigue al acto que
                // le da sentido, con el destino ya elegido.
                //
                // Salvo que no haya nada sin destino: ahí destinar tiene tope
                // cero y sería mandar a una pantalla que no puede hacer nada.
                // El propósito queda creado y vacío, que es lo que se pidió.
                if (restCurrency == null) onClose()
                else
                  setStack([
                    {
                      kind: 'allocate',
                      currency: restCurrency,
                      purpose: created,
                      direction: 'allocate',
                    },
                  ])
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
            onDone={() => {
              // Se cierra: el grupo que se estaba mirando ya no existe, y no hay
              // vista de atrás a la que volver — la lista vive en la página, que
              // es justo la que se va a refrescar.
              onClose()
              void refresh()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'allocate' && (
          <PurposeAllocate
            purpose={view.purpose}
            purposes={purposes}
            currency={view.currency}
            currencies={currencies}
            direction={view.direction}
            availableFor={(c: Currency) =>
              view.direction === 'allocate'
                ? groupAmount(c, null)
                : groupAmount(c, view.purpose?.id ?? null)
            }
            onCreateSeed={createFromSeed}
            onCreateCustom={() => push({ kind: 'purposeForm', purpose: null })}
            onDone={() => {
              // Navegar PRIMERO. Refrescar antes dejaba la pantalla un instante
              // con los datos nuevos y el monto todavía escrito: el tope pasaba
              // a estar cruzado y se pintaba el error en rojo, sobre una
              // operación que había salido bien. Un destello que acusa un
              // problema inexistente.
              back()
              void refresh()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'group' && (
          <GroupBlock
            currency={view.currency}
            purpose={view.purpose}
            reserved={groupAmount(view.currency, view.purpose.id)}
            amounts={(['ARS', 'USD'] as const).map((c) => ({
              currency: c,
              reserved: groupAmount(c, view.purpose.id),
            }))}
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

      </div>
    </Drawer>
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
  amounts,
  onRelease,
  onAllocate,
  onUnallocate,
  onEdit,
  onDelete,
  onBack,
}: {
  currency: Currency
  purpose: Purpose
  /** Lo de ESTA moneda: es el piso de las acciones, que son por moneda. */
  reserved: number
  /** Lo de todas las monedas, para responder "cuánto tengo para esto". */
  amounts: { currency: Currency; reserved: number }[]
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
      {/* El emblema acompaña al nombre, con el MISMO tinte que en la grilla: es
          lo que confirma que esta pantalla es la card que se tocó. Sin él, el
          detalle abría con un título de texto y había que releer el nombre para
          saber si se había entrado a donde se quería. */}
      <DrawerBackHeader
        title={purpose.name}
        icon={
          <span
            aria-hidden
            className={cn(
              'grid size-[38px] shrink-0 place-items-center rounded-lg text-[19px]',
              purposeTint(purpose.id),
            )}
          >
            {purposeGlyph(purpose.icon)}
          </span>
        }
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
          {t('purposes.totals')}
        </p>
        {/* Las dos monedas, una debajo de la otra y SIN un total que las sume.
            "Tengo tanto para Japón" en un solo número exigiría convertir, y
            Grana no convierte: son dos plata distintas. La que está en grande es
            la de la moneda en la que se está operando; la otra acompaña, para
            que la pregunta "¿cuánto tengo para esto?" no obligue a cambiar de
            pantalla y recordar el número. */}
        <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.04em] text-text">
          {money(reserved, currency)}
        </p>
        {amounts
          .filter((a) => a.currency !== currency && a.reserved !== 0)
          .map((a) => (
            <p key={a.currency} className="mt-1.5 text-[15px] font-bold text-text-muted">
              {money(a.reserved, a.currency)}
            </p>
          ))}

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

        {/* Los BOTONES son lo que se le hace a ESTE propósito: sumarle y
            sacarle. Los dos mueven su reparto y ninguno mueve el total guardado.

            «Guardar» no está, y es separación de niveles: cambia el TOTAL, así
            que vive un nivel arriba, donde el total está a la vista (D18).
            «Volver a usar» tampoco está acá abajo por la misma razón — también
            cambia el total— y bajó a enlace. Tenerlo como botón hacía que esta
            pantalla se contradijera: excluía a Guardar por cambiar el total e
            incluía, con el mismo peso, otra que también lo cambia. */}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onAllocate}>
            {t('purposes.allocate_more')}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onUnallocate}
            disabled={reserved <= 0}
          >
            {t('purposes.unallocate')}
          </Button>
        </div>

        {/* «Volver a usar», como enlace y no como botón.

            Es la única salida de acá que vuelve la plata GASTABLE, y por eso no
            comparte peso con las dos de arriba, que no tocan el total. Pero
            tampoco se va de la pantalla: parado en Viaje, querer usar esos pesos
            es un caso real, y mandarlo a Ahorro le cobraría dos taps y
            re-elegir un propósito que ya tenía delante.

            Separado por un divisor y no pegado a los botones: lo que lo
            distingue no es la forma, es que hace otra cosa. */}
        <div className="mt-4 border-t border-border-soft pt-3">
          <p className="text-[12.5px] leading-[1.45] text-text-muted">
            {t('purposes.unallocate_note')}
          </p>
          <button
            type="button"
            onClick={onRelease}
            disabled={reserved <= 0}
            className="mt-1 inline-flex min-h-[44px] items-center text-[13px] font-bold text-emerald-deep underline decoration-emerald-deep/35 underline-offset-[5px] transition-colors hover:decoration-emerald-deep disabled:opacity-40 disabled:no-underline"
          >
            {t('release')}
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
  groupAmount,
  lockedPurpose,
  purposes,
  onSetPurpose,
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
  /**
   * Lo guardado en un grupo y una moneda: es el piso cuando se vuelve a usar.
   *
   * Llega como FUNCIÓN y no como número porque acá adentro cambian las dos
   * variables: la moneda con el chip del monto y el propósito con los chips de
   * origen. Congelado en la moneda con la que se entró, alguien podía pasar a
   * dólares y quedarse con el tope de los pesos — un formulario que deja
   * confirmar lo que el trigger va a rechazar.
   */
  groupAmount: (currency: Currency, purposeId: string | null) => number
  /** Se llegó desde un grupo: el propósito se hereda y no se ofrece cambiarlo. */
  lockedPurpose: boolean
  /** Los propósitos del usuario, como chips: elegir no debería costar pantalla. */
  purposes: Purpose[]
  /** Elegir uno de los chips, sin navegar. */
  onSetPurpose: (purposeId: string | null) => void
  /** Crear uno nuevo, que sí necesita su pantalla. */
  onPickPurpose: () => void
  onCancel: () => void
  onDone: () => Promise<void>
}) => {
  const t = useTranslations('savings')
  // Hoy / Ayer salen del catálogo de movimientos: es el mismo control y el
  // mismo texto, y duplicarlo en `savings` sería una traducción que puede
  // divergir de la otra sin que nadie lo note.
  const tx = useTranslations('transactions')
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
  /**
   * «Sin destino» es un GRUPO, no el total.
   *
   * El formulario decía «Tenés guardado $ 55.000» cuando había $ 180.000
   * guardados: el rótulo hablaba del total y el número era el del resto. Los
   * dos coinciden solo cuando no hay ningún propósito — y ahí «Sin destino»
   * sería jerga para alguien que nunca usó la función.
   */
  const unassignedIsTotal = purposes.length === 0

  /** Los orígenes posibles: al volver a usar, solo los que tienen plata ACÁ. */
  const purposeOptions: (Purpose | null)[] =
    mode === 'save'
      ? [null, ...purposes]
      : [null, ...purposes].filter((o) => groupAmount(currency, o?.id ?? null) > 0)

  /**
   * ¿Hay otro origen que el usuario pueda elegir, acá y ahora?
   *
   * Es la MISMA condición que dibuja los chips, y tiene que serlo: el mensaje
   * de tope ofrece esa salida, y ofrecer una salida que la pantalla no tiene
   * es peor que no ofrecer ninguna. Con el chip bloqueado —se entró desde la
   * fila del resto— hay propósitos con plata pero este formulario no los toca.
   */
  const canPickOrigin = !lockedPurpose && purposeOptions.length > 1


  /**
   * El origen preseleccionado nunca se queda sobre un grupo vacío.
   *
   * Pasa por tres caminos distintos: se entró desde el módulo, que preselecciona
   * «Sin destino» sin saber todavía si tiene saldo —su lectura vive en otra
   * sección de la página—; se cambió de moneda y el grupo elegido no tiene plata
   * en la nueva; o la consulta terminó de cargar después de que el formulario se
   * dibujó. Los tres terminan igual: el tope en cero sobre una elección que no
   * existe, y un CTA que no se puede tocar sin que nada lo explique.
   *
   * No pelea con el usuario: los chips que puede elegir son, por construcción,
   * los que tienen plata, así que esto solo corrige lo que él no eligió.
   */
  const selectedAmount = groupAmount(currency, purposeId)

  useEffect(() => {
    if (mode !== 'release' || lockedPurpose) return
    if (selectedAmount > 0) return
    const fallback = [null, ...purposes].find((o) => groupAmount(currency, o?.id ?? null) > 0)
    if (fallback !== undefined) onSetPurpose(fallback?.id ?? null)
    // `purposes` y `groupAmount` se rehacen en cada render del drawer, así que
    // no sirven de dependencia. Las reales son dos: cuánto tiene el grupo
    // elegido, y cuántos orígenes hay para elegir —que es lo que cambia cuando
    // la consulta termina de cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lockedPurpose, currency, purposeId, selectedAmount, purposeOptions.length])

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
  const limit = mode === 'save' ? row.available : groupAmount(currency, purposeId)
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
        : unassignedIsTotal
          ? t('errors.exceeds_reserved', { limit: money(limit, currency) })
          : // Con otro origen a mano, el mensaje NO se queda en negar: dice el
            // tope y nombra la salida. Negar y callar deja al usuario probando
            // números contra una pared.
            canPickOrigin
            ? t('errors.exceeds_unassigned_reserved_pick', { limit: money(limit, currency) })
            : t('errors.exceeds_unassigned_reserved', { limit: money(limit, currency) })
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
          agregar nada. La moneda ya la dice el chip del monto.

          La vuelta atrás va ACÁ, como en el resto de la app y como en las demás
          vistas de este mismo drawer. En el pie competía con el CTA: dos
          controles juntos, uno que avanza y otro que retrocede, y el que
          retrocede no es una alternativa a confirmar. */}
      {/* El título dice el ORIGEN cuando viene heredado. Antes había una fila
          "Para qué → Viaje" debajo del monto: no dejaba decidir nada, no
          cambiaba nada, y repetía lo que el bloque de abajo ya dice ("Tenés
          guardado en Viaje"). Una sección que no decide es una sección de más. */}
      <DrawerBackHeader
        title={
          mode === 'save'
            ? t('save')
            : purpose != null && lockedPurpose
              ? t('release_from', { purpose: purpose.name })
              : t('release')
        }
        onBack={onCancel}
      />

      {/* Same amount hero as "Registrar movimiento" — same radius, same type
          scale, same currency chip, same calculator. Two surfaces that ask for
          an amount should not look like two different apps, and the chip is what
          gives this one its currency selector. */}
      <div className="mt-4 rounded-2xl border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <label
            htmlFor="savings-amount"
            className="pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft"
          >
            {t('amount_label')}
          </label>
          {/* Segmentado y no un desplegable de 22px: la moneda es la decisión
              que MÁS cambia el significado de lo que se escribe, y estaba en el
              control más chico de la pantalla, por debajo del mínimo de 44 px.
              Las dos opciones a la vista también dicen que hay dos — el chip
              obligaba a tocarlo para enterarse.

              Aparece solo con dos monedas que ofrecer: quien tiene únicamente
              pesos no debería confirmar que tiene pesos. */}
          {currencyOptions.length > 1 && (
            <div className="flex shrink-0 rounded-xl border border-border bg-surface-sunken p-0.5">
              {currencyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCurrency(option)}
                  aria-pressed={currency === option}
                  className={cn(
                    'min-h-11 rounded-[9px] px-3 text-[12.5px] font-bold transition-colors',
                    currency === option
                      ? 'bg-card text-text shadow-sm'
                      : 'text-text-muted hover:text-text',
                  )}
                >
                  {option === 'USD' ? t('currency_usd') : t('currency_ars')}
                </button>
              ))}
            </div>
          )}
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

      {/* Atajos de monto: suman al valor actual, y «Todo» lleva al tope.
          Guardar suele ser una cifra redonda, y escribir 50.000 en un teclado de
          teléfono son cinco toques que un chip resuelve en uno.

          Los pasos son POR MONEDA y no un número fijo: +$10.000 tiene sentido en
          pesos y sería absurdo en dólares, donde el mismo gesto es +US$ 10.

          Un atajo que deja el monto por encima del tope no se ofrece: sería un
          botón que solo sirve para romper el formulario. «Todo» hace lo mismo
          que el resto —lleva al máximo— pero se muestra siempre que haya algo,
          porque es el atajo que más se usa y su número no es adivinable. */}
      {limit > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {AMOUNT_STEPS[currency]
            .filter((step) => value + step <= limit)
            .map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setAmount(String(value + step))}
                className="min-h-11 rounded-full border border-border-soft bg-card px-3.5 text-[13px] font-bold text-text transition-colors hover:bg-surface-sunken"
              >
                +{money(step, currency)}
              </button>
            ))}
          <button
            type="button"
            onClick={() => setAmount(String(limit))}
            className="min-h-11 rounded-full border border-border-soft bg-card px-3.5 text-[13px] font-bold text-text transition-colors hover:bg-surface-sunken"
          >
            {t('shortcut_all')}
          </button>
        </div>
      )}

      {/* La fecha, compacta y con atajos: el mismo patrón que el alta de
          movimientos en ancho de teléfono. Como card entera pesaba igual que el
          monto, y acá la fecha es casi siempre hoy — el foco es cuánto y para
          qué. */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border-soft bg-card px-3 py-2.5">
        <DatePicker
          value={date}
          onChange={setDate}
          label={t('date_label')}
          max={formatDateISO(getTodayAR())}
          trigger={
            <button type="button" className="flex min-w-0 items-center gap-2.5 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FAFBFC] text-text-muted">
                <Calendar className="size-[18px]" aria-hidden />
              </span>
              <span className="truncate text-[13px] font-semibold text-text">
                {shortDate(date)}
              </span>
            </button>
          }
        />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {(
            [
              { label: tx('form.date_today'), value: formatDateISO(getTodayAR()) },
              { label: tx('form.date_yesterday'), value: yesterdayISO() },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDate(option.value)}
              className={cn(
                'rounded-[8px] px-2.5 py-1.5 text-xs font-bold transition-colors',
                date === option.value
                  ? 'bg-navy text-white'
                  : 'border border-border text-text-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Para qué, COMO CHIPS y no como una fila que abre otra pantalla.
          Decir "guardo $10.000 para Casa" no debería costar tres pantallas, y
          los propósitos son pocos por naturaleza: entran. El selector aparte
          queda para crear uno nuevo.

          Al volver a usar valen los mismos chips, con la pregunta dada vuelta:
          ahí no se elige el destino sino el ORIGEN, y solo entre los grupos que
          tienen plata. Lo que no se ofrece nunca es cambiar el propósito cuando
          viene heredado del grupo desde el que se entró: eso ya se contestó con
          el dedo. */}
      {/* Al volver a usar, un chip solo no es una elección: es un control que no
          puede cambiar nada — la misma regla que ya aplica el chip de moneda.
          Al guardar la fila se muestra igual aunque no haya ni un propósito:
          ahí vive el «+», que es de dónde sale el primero. */}
      {(mode === 'save' ? !lockedPurpose : canPickOrigin) && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
            {mode === 'save' ? t('purposes.label') : t('purposes.source_label')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {purposeOptions.map((option) => {
              const id = option?.id ?? null
              return (
                <button
                  key={id ?? 'none'}
                  type="button"
                  onClick={() => onSetPurpose(id)}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors',
                    purposeId === id
                      ? 'border-emerald-deep bg-emerald-deep/5 text-text'
                      : 'border-border-soft bg-card text-text hover:bg-surface-sunken',
                  )}
                >
                  <span aria-hidden>{option?.icon ?? '🫙'}</span>
                  {option?.name ?? t('purposes.none')}
                </button>
              )
            })}
            {/* Crear uno nuevo solo tiene sentido al guardar. Un propósito
                recién creado no tiene plata, así que como ORIGEN no serviría
                para nada. */}
            {mode === 'save' && (
              <button
                type="button"
                onClick={onPickPurpose}
                aria-label={t('purposes.new')}
                className="flex size-11 items-center justify-center rounded-full border border-dashed border-border text-emerald-deep transition-colors hover:bg-surface-sunken"
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-border-soft bg-card p-4 text-[14px]">
        <p className="flex justify-between py-1 text-text-muted">
          <span>
            {mode === 'save'
              ? t('available_now')
              : purpose != null
                ? t('saved_in', { purpose: purpose.name })
                : unassignedIsTotal
                  ? t('saved_total')
                  : t('purposes.unassigned_available')}
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
                : unassignedIsTotal
                  ? t('stays_saved')
                  : t('purposes.left_unassigned')}
          </span>
          <span
            className={cn(
              'text-[16px] font-extrabold tabular-nums',
              overLimit ? 'text-negative' : 'text-text',
            )}
          >
            {remainder < 0 ? '−' : ''}
            {money(Math.abs(remainder), currency)}
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

      {/* El CTA dice el MONTO, no solo el verbo. Es lo último que se lee antes
          de confirmar, y es donde un error de tipeo —un cero de más— todavía se
          puede cachar. Sin monto escrito, el botón dice lo mismo con $5.000 que
          con $500.000. Vuelve al verbo solo mientras no hay monto: «Guardar $ 0»
          sería un botón que anuncia una operación que no existe. */}
      <Button className="mt-5 h-12" onClick={submit} disabled={pending || value <= 0 || overLimit}>
        {value > 0
          ? t(mode === 'save' ? 'save_amount' : 'release_amount', {
              amount: money(value, currency),
            })
          : t(mode === 'save' ? 'save' : 'release')}
      </Button>
    </div>
  )
}
