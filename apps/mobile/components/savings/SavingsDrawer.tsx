import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown, Plus } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { formatForDisplay, parseMoneyInput } from '@grana/validation'
import {
  MODULE_CURRENCIES,
  moduleGroupCurrency,
  PURPOSE_SEEDS,
  type AvailableSums,
  type Purpose,
} from '@grana/savings'
import { useT } from '../../lib/locale-context'
import { useSavingsOperationData } from '../../lib/savings/queries'
import {
  reserveAvailability,
  releaseAvailability,
  createPurpose,
} from '../../lib/savings/mutations'
import { BottomSheet, useSheetBodyMaxHeight } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { DateField } from '../ui/DateField'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { MoneyCalculator } from '../ui/MoneyCalculator'
import { FormSheetBody } from '../layout/FormSheetBody'
import { SheetBackHeader } from './SheetBackHeader'
import { PurposePicker } from './PurposePicker'
import { PurposeForm } from './PurposeForm'
import { PurposeDelete } from './PurposeDelete'
import { PurposeGroup } from './PurposeGroup'
import { PurposeAllocate } from './PurposeAllocate'
import { colors } from '../../lib/colors'

type Currency = 'ARS' | 'USD'
type Mode = 'save' | 'release'

/**
 * Las vistas que el sheet apila, igual que en web y por la misma razón: con seis
 * vistas y varias alcanzables desde más de un lado, un estado plano obligaría a
 * cada una a recordar a dónde volver — una pila escrita a mano, peor.
 *
 * `SheetView` y no `View` como en web: acá `View` es el componente de React
 * Native y el tipo lo taparía.
 */
type SheetView =
  | { kind: 'detail' }
  | {
      kind: 'group'
      currency: Currency
      /**
       * Siempre un propósito con nombre. «Sin destino» NO tiene vista propia: es
       * el resto, y lo único que se hace con él —darle destino— es la fila misma.
       */
      purpose: Purpose
    }
  /**
   * `locked`: se llegó desde un grupo y el propósito se hereda. Falso cuando se
   * entró por el botón global, donde el origen se elige con los chips.
   */
  | { kind: 'form'; mode: Mode; currency: Currency; purposeId: string | null; locked: boolean }
  | { kind: 'picker'; currency: Currency; intent: 'form' | 'allocate' }
  | { kind: 'purposeForm'; purpose: Purpose | null; name?: string; icon?: string }
  | { kind: 'purposeDelete'; purpose: Purpose }
  | {
      kind: 'allocate'
      currency: Currency
      /** Nulo: se llegó desde el resto y el propósito se elige en la misma pantalla. */
      purpose: Purpose | null
      direction: 'allocate' | 'unallocate'
      /**
       * Se llegó acá creando el propósito. La pantalla lo ACUSA: sin eso, crear
       * desde el módulo terminaba en un formulario de destinar que no decía en
       * ningún lado que el propósito se había creado.
       */
      justCreated?: boolean
    }

/**
 * A qué abre el overlay cuando lo abre el MÓDULO: directo a lo que se tocó.
 *
 * Excluye `detail` a propósito. La lectura ya vive en la pantalla, así que
 * abrirla otra vez adentro sería la misma información dos veces, con dos
 * consultas de más — y la flecha del fondo revelaría una lista duplicada en vez
 * de cerrar.
 */
export type SavingsDrawerInitialView = Exclude<SheetView, { kind: 'detail' }>

/** Lo tipeado en el formulario, que sobrevive a los desvíos de la pila. */
type Draft = {
  amount: string
  date: string
  /** `null` hasta que el usuario la cambia: antes vale la de la vista. */
  currency: Currency | null
}

const emptyDraft = (): Draft => ({
  amount: '',
  date: formatDateISO(getTodayAR()),
  currency: null,
})

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

const CURRENCY_SYMBOL: Record<Currency, string> = { ARS: '$', USD: 'U$D' }

/**
 * Los pasos de los atajos de monto, POR MONEDA y no un número fijo: +$10.000
 * tiene sentido en pesos y sería absurdo en dólares, donde el mismo gesto es
 * +US$ 10.
 */
const AMOUNT_STEPS: Record<Currency, readonly number[]> = {
  ARS: [10_000, 50_000],
  USD: [10, 50],
}

/** Ayer, en fecha financiera AR. */
const yesterdayISO = (): string => {
  const d = getTodayAR()
  d.setDate(d.getDate() - 1)
  return formatDateISO(d)
}

/**
 * Native mirror of the web `SavingsDrawer` — same export name per the mirror
 * convention, and a BOTTOM SHEET underneath, which is the idiomatic overlay on a
 * phone. Only the implementation differs; the contract does not.
 *
 * It is a sheet, not a route.
 *
 * The reasoning is the same on both platforms: you tap the number, read, and
 * close, and the number you tapped is still there. Nothing navigates, so there
 * is no address a menu could point at — which is why "Guardado" not entering the
 * navigation is a consequence of the shape, not a product stance.
 *
 * The view switches in place between the detail and the form instead of opening
 * a second sheet: the form is a step of the same conversation.
 */
export const SavingsDrawer = ({
  visible,
  onClose,
  initialView,
}: {
  visible: boolean
  onClose: () => void
  /**
   * La vista con la que arranca la pila. Obligatoria: el overlay ya no tiene
   * vista raíz — se la llevó el módulo (`/savings`), y lo que queda son actos.
   */
  initialView: SavingsDrawerInitialView
}) => {
  const t = useT()
  const queryClient = useQueryClient()
  // El cuerpo se topea con lo que queda de pantalla, no con un número fijo: con
  // 560px el CTA de «Guardar», «Volver a usar» y «Destinar» quedaba abajo del
  // pliegue en teléfonos altos y directamente recortado en los chicos.
  const bodyMaxHeight = useSheetBodyMaxHeight()
  const [stack, setStack] = useState<SheetView[]>([initialView])
  /**
   * El borrador del formulario: monto, fecha y moneda.
   *
   * Vive ACÁ y no adentro de `SavingsForm` porque el formulario se DESMONTA
   * cuando la pila muestra otra vista. Ir a crear un propósito en el medio de
   * guardar —que es lo que el «+» ofrece— borraba el monto tipeado y devolvía al
   * formulario en cero, con el CTA deshabilitado y sin nada que explicara por
   * qué. Perder el monto es cobrarle al usuario haber querido ser prolijo.
   *
   * Se resetea al ABRIR el sheet, no al cambiar de vista: dentro de una misma
   * apertura el borrador es uno solo y sobrevive a los desvíos.
   */
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const view = stack[stack.length - 1]
  const push = (next: SheetView) => setStack((s) => [...s, next])
  // En el fondo de la pila la flecha CIERRA. Antes revelaba el detalle; ahora ese
  // detalle es la pantalla de la que se vino, y volver a dibujarlo adentro sería
  // mostrar la misma lectura dos veces. La decisión se toma AFUERA del updater:
  // llamar a `onClose()` adentro sería un setState durante el render de otro
  // componente.
  const back = () => {
    if (stack.length > 1) setStack((s) => s.slice(0, -1))
    else onClose()
  }
  // Solo lo que los ACTOS necesitan. El historial y el flujo del mes eran del
  // detalle, que ya no está: se mudaron a la pantalla del módulo, y con ellos
  // dos de las cinco consultas que este overlay disparaba en cada apertura.
  const { sums, purposeSums, purposes } = useSavingsOperationData(visible)

  // Reset the view when the sheet opens, derived DURING RENDER from the prop
  // rather than in an effect: it is not a synchronization with anything external
  // and an effect would cost a frame with the previous view still up.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setStack([initialView])
      setDraft(emptyDraft())
    }
  }

  const rowFor = (currency: Currency): AvailableSums =>
    sums?.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }

  // ARS always renders — it is the primary currency and an empty sheet reads as
  // broken. USD only when it has something to say, per the bimoneda rule.
  const currencies = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === 'ARS' || row.reserved !== 0 || row.available !== 0
  })

  // Al terminar, el sheet SE CIERRA. La confirmación es que el número del que
  // venías cambió; quedarse en el detalle deja al usuario preguntándose si pasó
  // algo, que es el peor final para una acción sobre plata.
  const onDone = async () => {
    setStack([initialView])
    onClose()
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['savings'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  const purposeById = (id: string | null): Purpose | null =>
    id == null ? null : (purposes.find((p) => p.id === id) ?? null)


  // `groupsUnified` y `currencyWithMoney` se fueron con el detalle: la lista de
  // grupos la arma ahora la pantalla del módulo con `moduleGroups`, que es la
  // MISMA derivación que usa la web — un solo lugar donde se decide el orden y
  // qué monedas se muestran, en vez de una copia por plataforma.

  const groupAmount = (currency: Currency, purposeId: string | null): number =>
    purposeSums.find((s) => s.currencyCode === currency && s.purposeId === purposeId)?.reserved ?? 0

  /** La moneda del resto sin destino, o `null` si no hay nada sin repartir. */
  const restCurrency: Currency | null = MODULE_CURRENCIES.some((c) => groupAmount(c, null) > 0)
    ? moduleGroupCurrency(
        MODULE_CURRENCIES.map((c) => ({ currency: c, reserved: groupAmount(c, null) })),
      )
    : null

  /** Refresca sin cerrar: tocar una etiqueta no termina ninguna operación. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['savings'] })

  /**
   * Elegir un propósito vuelve AL FORMULARIO que lo pidió, con el propósito ya
   * puesto — no al detalle. Perder el monto tipeado por haber ido a elegir una
   * etiqueta sería cobrarle al usuario haber querido ser prolijo.
   */
  const pickPurpose = (purposeId: string | null, known?: Purpose) =>
    setStack((prev) => {
      const picker = [...prev].reverse().find((v) => v.kind === 'picker') as
        | Extract<SheetView, { kind: 'picker' }>
        | undefined

      if (picker?.intent === 'allocate') {
        // `known` viene de quien ACABA de crear el propósito: la lista de acá es
        // la del render anterior y todavía no lo tiene. Buscarlo y no
        // encontrarlo devolvía al detalle sin decir nada.
        const target = known ?? purposes.find((p) => p.id === purposeId)
        if (!target) return prev.slice(0, 1)
        // Reemplaza al selector en vez de apilarse encima: volver desde apartar
        // lleva al grupo, no a la lista que ya cumplió su función.
        const at = prev.indexOf(picker)
        return [
          ...prev.slice(0, at),
          { kind: 'allocate', currency: picker.currency, purpose: target, direction: 'allocate' },
        ]
      }

      const at = prev.map((v) => v.kind).lastIndexOf('form')
      if (at < 0) return prev.slice(0, 1)
      const target = prev[at] as Extract<SheetView, { kind: 'form' }>
      return [...prev.slice(0, at), { ...target, purposeId }]
    })

  /**
   * Tocar una sugerencia CREA el propósito y sigue: el nombre y el ícono ya son
   * los que el usuario eligió al tocar, así que el formulario intermedio no
   * decide nada y cobra dos toques por confirmarse a sí mismo. Quien quiera otro
   * nombre tiene «Nuevo propósito» al lado.
   */
  /**
   * Crea una sugerencia y devuelve el propósito ARMADO: la lista de este render
   * es la de antes de crearlo, y buscarlo ahí ya rompió la navegación una vez.
   */
  const createFromSeed = async (seedKey: string): Promise<Purpose | null> => {
    const seed = PURPOSE_SEEDS.find((x) => x.key === seedKey)
    const name = t(`savings.purposes.seeds.${seedKey}`)
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
    <BottomSheet visible={visible} onClose={onClose} ariaLabel={t('savings.title')}>
      {/* FormSheetBody because the form has a text input: an RN Modal renders in
          its own native window, so the keyboard context has to be mounted here. */}
      <FormSheetBody contentClassName="px-4 pb-2 pt-1" maxHeight={bodyMaxHeight}>
        {view.kind === 'form' && (
          <SavingsForm
            mode={view.mode}
            initialCurrency={view.currency}
            rowFor={rowFor}
            purpose={purposeById(view.purposeId)}
            purposeId={view.purposeId}
            groupAmount={groupAmount}
            draft={draft}
            onDraftChange={setDraft}
            lockedPurpose={view.locked}
            purposes={purposes}
            onSetPurpose={(purposeId: string | null) =>
              setStack((prev) => {
                const at = prev.length - 1
                const target = prev[at] as Extract<SheetView, { kind: 'form' }>
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
              (stack.find((v) => v.kind === 'form') as Extract<SheetView, { kind: 'form' }>)
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
                // Creado desde la PANTALLA, donde no hay operación en curso a la
                // que volver. Un propósito recién creado está en cero y no sirve
                // para nada hasta que se le destine algo, así que en vez de
                // cerrar —y dejar una fila vacía en una lista que el usuario ni
                // llega a ver— sigue al acto que le da sentido, con el destino ya
                // elegido.
                //
                // Salvo que no haya nada sin destino: ahí destinar tiene tope
                // cero y sería mandar a una pantalla que no puede hacer nada. El
                // propósito queda creado y vacío, que es lo que se pidió.
                if (restCurrency == null) onClose()
                else
                  setStack([
                    {
                      kind: 'allocate',
                      currency: restCurrency,
                      purpose: created,
                      direction: 'allocate',
                      justCreated: true,
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
              setStack([initialView])
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
            currencies={currencies as Currency[]}
            direction={view.direction}
            availableFor={(c: Currency) =>
              view.direction === 'allocate'
                ? groupAmount(c, null)
                : groupAmount(c, view.purpose?.id ?? null)
            }
            onCreateSeed={createFromSeed}
            onCreateCustom={() => push({ kind: 'purposeForm', purpose: null })}
            justCreated={view.justCreated}
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
          <PurposeGroup
            currency={view.currency}
            purpose={view.purpose}
            reserved={groupAmount(view.currency, view.purpose.id)}
            amounts={(['ARS', 'USD'] as const).map((c) => ({
              currency: c,
              reserved: groupAmount(c, view.purpose.id),
            }))}
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
            onRelease={() =>
              push({
                kind: 'form',
                mode: 'release',
                currency: view.currency,
                purposeId: view.purpose.id,
                locked: true,
              })
            }
            onEdit={() => push({ kind: 'purposeForm', purpose: view.purpose })}
            onDelete={() => push({ kind: 'purposeDelete', purpose: view.purpose })}
            onBack={back}
          />
        )}

        {/* La vista de DETALLE se podó: la lectura vive en `/savings`, que es la
            pantalla de la que se vino. Con ella se fueron el encabezado, el
            puente bancario y el historial —que se mudaron al módulo, no se
            borraron— y dos de las cinco consultas por apertura, que eran lectura
            y ahora las hace la pantalla. */}
      </FormSheetBody>
    </BottomSheet>
  )
}




/**
 * The act. The amount field takes a POSITIVE number in both modes: the direction
 * comes from the verb the user tapped, never from a sign typed into the field.
 *
 * The maths shown is the maths OF THIS MOMENT — never a calculation against the
 * income the sheet may have come from, which would say the reserve belongs to
 * that movement. A reserve is fungible and belongs to no movement.
 */
const SavingsForm = ({
  mode,
  initialCurrency,
  rowFor,
  purpose,
  purposeId,
  groupAmount,
  draft,
  onDraftChange,
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
   * Lo guardado en un grupo y una moneda: el piso al volver a usar.
   *
   * FUNCIÓN y no número: acá adentro cambian la moneda (chip del monto) y el
   * propósito (chips de origen). Congelado en la moneda inicial, alguien podía
   * pasar a dólares con el tope de los pesos.
   */
  groupAmount: (currency: Currency, purposeId: string | null) => number
  /** Lo tipeado, que vive en el drawer para sobrevivir a los desvíos. */
  draft: Draft
  onDraftChange: (next: Draft) => void
  /** Se llegó desde un grupo: el propósito se hereda y no se ofrece cambiarlo. */
  lockedPurpose: boolean
  /** Los propósitos del usuario, como chips: elegir no debería costar pantalla. */
  purposes: Purpose[]
  onSetPurpose: (purposeId: string | null) => void
  /** Crear uno nuevo, que sí necesita su pantalla. */
  onPickPurpose: () => void
  onCancel: () => void
  onDone: () => Promise<void>
}) => {
  const t = useT()
  const [showAllPurposes, setShowAllPurposes] = useState(false)

  // Nada de estado local acá: lo tipeado vive en el drawer, que no se desmonta
  // al ir a crear un propósito.
  const currency = draft.currency ?? initialCurrency
  const amount = draft.amount
  const date = draft.date
  const setCurrency = (next: Currency) => onDraftChange({ ...draft, currency: next })
  const setAmount = (next: string) => onDraftChange({ ...draft, amount: next })
  const setDate = (next: string) => onDraftChange({ ...draft, date: next })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The currency is offered ONLY when there is more than one to offer: coming
  // from an income it is inherited, and a user who only holds pesos should not
  // have to confirm that they hold pesos.
  const currencyOptions = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === initialCurrency || row.available !== 0 || row.reserved !== 0
  })
  /**
   * «Sin destino» es un GRUPO, no el total: el formulario decía «Tenés guardado
   * $ 55.000» cuando había $ 180.000 guardados. Coinciden solo cuando no hay
   * ningún propósito, y ahí «Sin destino» sería jerga.
   */
  const unassignedIsTotal = purposes.length === 0

  /**
   * Cuántos propósitos se muestran antes de plegar el resto.
   *
   * SEIS. Se probó con ocho y el efecto fue que con diez propósitos no se
   * plegaba ninguno: el control desaparecía, y con él la única señal de que la
   * lista sigue. Un techo tan alto que nunca se alcanza no es un techo.
   *
   * Uno de tolerancia: esconder un solo chip detrás de un control que ocupa casi
   * lo mismo no es esconder nada.
   */
  const PURPOSE_CHIP_LIMIT = 6
  const PURPOSE_CHIP_SLACK = 1

  /**
   * Los orígenes posibles, ORDENADOS POR SALDO.
   *
   * Al volver a usar, solo los que tienen plata acá.
   *
   * El orden importa porque decide qué se pliega: la lista venía alfabética
   * —`listPurposes` ordena por nombre— así que lo escondido eran los últimos del
   * abecedario. «Viaje» con $45.000 se plegaba antes que «Prueba» con $0, que es
   * exactamente al revés de lo que alguien busca.
   *
   * Por saldo descendente, y a igualdad por nombre para que el orden sea
   * estable. «Sin destino» queda siempre primero, fuera del criterio: no compite
   * con los propósitos, es el default.
   */
  const purposeOptions: (Purpose | null)[] = (() => {
    const named = [...purposes].sort(
      (a, b) =>
        groupAmount(currency, b.id) - groupAmount(currency, a.id) || a.name.localeCompare(b.name),
    )
    return mode === 'save'
      ? [null, ...named]
      : [null, ...named].filter((o) => groupAmount(currency, o?.id ?? null) > 0)
  })()

  /**
   * Los chips que se dibujan, y cuántos quedan plegados.
   *
   * El techo cuenta PROPÓSITOS, y «Sin destino» no es uno: va siempre visible y
   * fuera del conteo. Contándolo, este formulario mostraba cinco propósitos y el
   * de destinar seis —que no lo ofrece— con el mismo techo y la misma lista.
   *
   * El elegido entra SIEMPRE, aunque caiga fuera del corte: un chip seleccionado
   * que se esconde al plegar deja la pantalla diciendo que se va a guardar «sin
   * destino» cuando en realidad va a otro lado.
   */
  const hasRestOption = purposeOptions.some((o) => o == null)
  const namedOptions = purposeOptions.filter((o): o is Purpose => o != null)
  const shownNamed =
    showAllPurposes || namedOptions.length <= PURPOSE_CHIP_LIMIT + PURPOSE_CHIP_SLACK
      ? namedOptions
      : (() => {
          const head = namedOptions.slice(0, PURPOSE_CHIP_LIMIT)
          if (purposeId == null || head.some((o) => o.id === purposeId)) return head
          const chosen = namedOptions.find((o) => o.id === purposeId)
          return chosen == null ? head : [...head.slice(0, PURPOSE_CHIP_LIMIT - 1), chosen]
        })()
  const shownOptions: (Purpose | null)[] = hasRestOption ? [null, ...shownNamed] : shownNamed
  const hiddenCount = namedOptions.length - shownNamed.length

  /**
   * ¿Hay otro origen que el usuario pueda elegir, acá y ahora?
   *
   * Es la MISMA condición que dibuja los chips, y tiene que serlo: el mensaje de
   * tope ofrece esa salida, y ofrecer una salida que la pantalla no tiene es
   * peor que no ofrecer ninguna.
   */
  const canPickOrigin = !lockedPurpose && purposeOptions.length > 1

  const cycleCurrency = () => {
    if (currencyOptions.length < 2) return
    setCurrency(currencyOptions[(currencyOptions.indexOf(currency) + 1) % currencyOptions.length])
  }

  /**
   * El origen preseleccionado nunca se queda sobre un grupo vacío.
   *
   * Pasa por tres caminos distintos: se entró desde el MÓDULO, que preselecciona
   * «Sin destino» sin saber todavía si tiene saldo —su lectura vive en otra
   * sección de la pantalla—; se cambió de moneda y el grupo elegido no tiene
   * plata en la nueva; o la consulta terminó de cargar después de que el
   * formulario se dibujó. Los tres terminan igual: el tope en cero sobre una
   * elección que no existe, y un CTA que no se puede tocar sin que nada lo
   * explique.
   *
   * No pelea con el usuario: los chips que puede elegir son, por construcción,
   * los que tienen plata, así que esto solo corrige lo que él no eligió.
   *
   * Antes vivía adentro de `cycleCurrency` y cubría UN camino de los tres — el
   * único que existía cuando el overlay se abría siempre en el detalle.
   */
  const selectedAmount = groupAmount(currency, purposeId)

  useEffect(() => {
    if (mode !== 'release' || lockedPurpose) return
    if (selectedAmount > 0) return
    const fallback = [null, ...purposes].find((o) => groupAmount(currency, o?.id ?? null) > 0)
    if (fallback !== undefined) onSetPurpose(fallback?.id ?? null)
    // `purposes` y `groupAmount` se rehacen en cada render del drawer, así que no
    // sirven de dependencia. Las reales son dos: cuánto tiene el grupo elegido, y
    // cuántos orígenes hay para elegir —que es lo que cambia cuando la consulta
    // termina de cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lockedPurpose, currency, purposeId, selectedAmount, purposeOptions.length])

  const sums = rowFor(currency)
  // Opened loose there is no income to take a percentage of, so the field starts
  // EMPTY: a pre-filled number with no anchor would read as an amount Grana is
  // recommending, and Grana does not recommend amounts.
  const value = parseMoneyInput(amount) ?? 0
  // El tope de guardar es el disponible de la MONEDA; el piso de volver a usar
  // es el de ESTE GRUPO. La misma asimetría que aplica el write path: un
  // propósito no tiene objetivo, así que guardar no tiene contra qué toparse,
  // pero volver a usar no puede dejar un grupo en negativo aunque el total
  // guardado —visible en la pantalla anterior— lo cubra.
  const limit = mode === 'save' ? sums.available : groupAmount(currency, purposeId)
  const remainder = limit - value
  const overLimit = value > limit
  // El mismo mensaje que devolvería el servidor, con el mismo número: un botón
  // deshabilitado sin explicación no deja avanzar y tampoco dice por qué.
  //
  // VERBO + TOPE, y nada más: en un teléfono angosto la versión larga —«más de lo
  // que tenés guardado en Vacaciones»— eran dos y hasta tres renglones de rojo
  // debajo del formulario. Qué bolsillo es lo dice la pantalla: el chip elegido y
  // la fila del resumen, justo arriba. Y el nombre del propósito ya no se
  // interpola: por el camino del servidor llega solo `limit`, así que el mensaje
  // largo mostraba «{purpose}» tal cual, en pantalla.
  const limitError = overLimit
    ? mode === 'save'
      ? t('savings.errors.exceeds_available', { limit: money(limit, currency) })
      : purpose != null
        ? t('savings.errors.exceeds_purpose_reserved', { limit: money(limit, currency) })
        : unassignedIsTotal
          ? t('savings.errors.exceeds_reserved', { limit: money(limit, currency) })
          : // Con otro origen a mano, el mensaje NO se queda en negar: dice el
            // tope y nombra la salida. Negar y callar deja al usuario probando
            // números contra una pared — con $60.000 sin destino y $70.000
            // pedidos, la plata podía salir de un propósito que la pantalla ni
            // mencionaba.
            canPickOrigin
            ? t('savings.errors.exceeds_unassigned_reserved_pick', {
                limit: money(limit, currency),
              })
            : t('savings.errors.exceeds_unassigned_reserved', { limit: money(limit, currency) })
    : null
  const amountInputWidth = Math.max(1, formatForDisplay(amount).length) * 20 + 2

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const action = mode === 'save' ? reserveAvailability : releaseAvailability
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(`${date}T00:00:00`),
        purpose_id: purposeId,
      })
      if (!result.ok) {
        const limitText = money(result.limit ?? 0, currency)
        setError(
          result.messageKey
            ? t(result.messageKey, { limit: limitText })
            : t('savings.errors.generic'),
        )
        return
      }
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View>
      {/* Un solo título: el verbo. La eyebrow decía "Guardar" y el título
          "Guardado" — dos formas de la misma palabra sin agregar nada. */}
      {/* La vuelta atrás va ACÁ, como en el resto de la app y como en las demás
          vistas de este mismo sheet. En el pie competía con el CTA: dos
          controles juntos, uno que avanza y otro que retrocede, y el que
          retrocede no es una alternativa a confirmar. */}
      {/* El título dice el ORIGEN cuando viene heredado: la fila "Para qué →
          Viaje" no dejaba decidir nada y repetía lo que el bloque de abajo ya
          dice. Una sección que no decide es una sección de más. */}
      <SheetBackHeader
        title={
          mode === 'save'
            ? t('savings.save')
            : purpose != null && lockedPurpose
              ? t('savings.release_from', { purpose: purpose.name })
              : t('savings.release')
        }
        onBack={onCancel}
      />

      {/* Same amount hero as the native "Registrar movimiento": eyebrow top-left,
          currency chip and calculator pinned top-right (both absolute, so they
          don't drag the number down), and the big number centered inside a
          min-height. Two surfaces that ask for an amount should not look like two
          different apps — and the chip is what gives this one its currency
          selector. */}
      <View className="mt-3 rounded-2xl border border-border bg-card px-4 pb-4 pt-3.5">
        <View className="relative">
          <Text className="absolute left-0 top-0 text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('savings.amount_label')}
          </Text>
          <View className="absolute right-0 top-0 items-end gap-1.5">
            <Pressable
              onPress={cycleCurrency}
              disabled={currencyOptions.length < 2}
              accessibilityRole="button"
              accessibilityLabel={t('savings.currency_label')}
              className="flex-row items-center gap-1 rounded-lg border border-border bg-border-soft px-2.5 py-1"
            >
              <Text className="text-xs font-bold text-text">{currency}</Text>
              {currencyOptions.length > 1 && <ChevronDown size={12} color={colors.text} />}
            </Pressable>
            <MoneyCalculator seed={amount} onResult={setAmount} />
          </View>
          <View className="min-h-[72px] flex-row items-center justify-center">
            <Text className="pl-1 text-[34px] font-bold text-text">
              {CURRENCY_SYMBOL[currency]}
            </Text>
            <MoneyAmountInput
              bare
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              autoFocus
              style={{ width: amountInputWidth, paddingVertical: 0 }}
              className="ml-1 text-[34px] font-bold text-text"
            />
          </View>
        </View>
      </View>

      {/* La fecha, compacta y con atajos: el mismo patrón que el alta de
          movimientos. Como card entera pesaba igual que el monto, y acá la fecha
          es casi siempre hoy — el foco es cuánto y para qué. */}
      {/* Atajos de monto: suman al valor actual, y «Todo» lleva al tope. Guardar
          suele ser una cifra redonda, y escribir 50.000 en el teclado de un
          teléfono son cinco toques que un chip resuelve en uno.

          Un atajo que deja el monto por encima del tope no se ofrece: sería un
          botón que solo sirve para romper el formulario. «Todo» se muestra
          siempre que haya algo, porque es el que más se usa y su número no es
          adivinable. */}
      {limit > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {AMOUNT_STEPS[currency]
            .filter((step) => value + step <= limit)
            .map((step) => (
              <Pressable
                key={step}
                accessibilityRole="button"
                onPress={() => setAmount(String(value + step))}
                className="min-h-[44px] justify-center rounded-full border border-border-soft bg-card px-3.5"
              >
                <Text className="text-[13px] font-bold text-text">
                  +{money(step, currency)}
                </Text>
              </Pressable>
            ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAmount(String(limit))}
            className="min-h-[44px] justify-center rounded-full border border-border-soft bg-card px-3.5"
          >
            <Text className="text-[13px] font-bold text-text">{t('savings.shortcut_all')}</Text>
          </Pressable>
        </View>
      )}

      {/* La fecha, SIN recuadro propio — el mismo cambio que ya tenía web y que
          acá había quedado sin espejar. Con borde y fondo era una card más, del
          mismo peso que el monto y el resumen, pero de una sola línea: se leía
          como una card a medio hacer. Y su alto es lo que empujaba el CTA fuera
          de la pantalla.

          El disparador va `bare` por lo mismo: la pastilla adentro de la card
          era un doble marco, y dejaba la fecha en un cuerpo que no es el de
          ninguna otra pantalla. Pedir una fecha dos veces en la app no puede
          verse de dos formas. */}
      <View className="mt-3 flex-row items-center gap-3 px-1">
        <DateField bare value={date} onChange={setDate} />
        <View className="ml-auto flex-row items-center gap-1.5">
          {[
            { label: t('transactions.form.date_today'), value: formatDateISO(getTodayAR()) },
            { label: t('transactions.form.date_yesterday'), value: yesterdayISO() },
          ].map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: date === option.value }}
              onPress={() => setDate(option.value)}
              /* Seleccionado en emerald suave y no en navy sólido, igual que
                 web: el navy es la superficie del total y el color del CTA, y
                 acá pintaba de negro el control MENOS importante del
                 formulario — el ojo caía en «Hoy» antes que en el monto. */
              className={`rounded-lg border px-2.5 py-1.5 ${
                date === option.value ? 'border-emerald-deep bg-emerald-deep/5' : 'border-border'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  date === option.value ? 'text-text' : 'text-text-muted'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Para qué, COMO CHIPS y no como una fila que abre otra pantalla: decir
          "guardo $10.000 para Casa" no debería costar tres pantallas, y los
          propósitos son pocos por naturaleza. El selector aparte queda para
          crear uno nuevo.

          Al volver a usar valen los mismos chips con la pregunta dada vuelta:
          ahí se elige el ORIGEN, y solo entre los grupos que tienen plata. Lo
          que no se ofrece nunca es cambiarlo cuando viene heredado del grupo
          desde el que se entró. */}
      {/* Al volver a usar, un chip solo no es una elección. Al guardar la fila
          va igual aunque no haya ningún propósito: ahí vive el «+». */}
      {(mode === 'save' ? !lockedPurpose : canPickOrigin) && (
        <View className="mt-3">
          {/* El control de overflow vive en la fila del RÓTULO, no entre los
              chips: al final de una fila que envuelve, queda huérfano en su
              propio renglón cuando la última fila está llena, y ahí no se lee
              como acción sino como algo cortado. */}
          <View className="flex-row items-center justify-between gap-3">
            {/* El MISMO rótulo que el del monto —11px, `font-bold`,
                `tracking-wider`— y no uno propio: dos eyebrows de distinto
                cuerpo en el mismo formulario se leen como dos jerarquías, y acá
                son la misma. Es además el que usa web. */}
            <Text className="shrink text-[11px] font-bold uppercase tracking-wider text-text-soft">
              {mode === 'save' ? t('savings.purposes.label') : t('savings.purposes.source_label')}
            </Text>
            <View className="shrink-0 flex-row items-center gap-3">
            {hiddenCount > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllPurposes(true)}
                className="min-h-[44px] shrink-0 justify-center"
              >
                <Text className="text-[12px] font-extrabold text-text-muted">
                  {t('savings.purposes.show_more', { count: String(hiddenCount) })}
                </Text>
              </Pressable>
            )}
            {/* La vuelta atrás. Desplegar sin poder volver a plegar deja la
                pantalla más alta para siempre por una mirada de un segundo. */}
            {showAllPurposes && namedOptions.length > PURPOSE_CHIP_LIMIT + PURPOSE_CHIP_SLACK && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllPurposes(false)}
                className="min-h-[44px] shrink-0 justify-center"
              >
                <Text className="text-[12px] font-extrabold text-text-muted">
                  {t('savings.purposes.show_less')}
                </Text>
              </Pressable>
            )}
            {/* Crear uno nuevo solo tiene sentido al guardar: uno recién creado
                no tiene plata, así que como ORIGEN no serviría para nada.

                Va ACÁ y no entre los chips, por la misma razón que el control de
                overflow: al final de una fila que envuelve queda huérfano en su
                propio renglón cuando la última fila está llena, y ahí no se lee
                como acción. Con texto y no como un «+» pelado, igual que web:
                un ícono solo obliga a adivinar qué crea. */}
            {mode === 'save' && (
              <Pressable
                accessibilityRole="button"
                onPress={onPickPurpose}
                className="min-h-[44px] shrink-0 flex-row items-center gap-1"
              >
                <Plus size={13} color={colors.emeraldDeep} strokeWidth={2.5} />
                <Text className="text-[12px] font-extrabold text-positive">
                  {t('savings.purposes.new')}
                </Text>
              </Pressable>
            )}
            </View>
          </View>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {shownOptions.map((option) => {
              const id = option?.id ?? null
              return (
                <Pressable
                  key={id ?? 'none'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: purposeId === id }}
                  onPress={() => onSetPurpose(id)}
                  /* Elegido en emerald, como en web y como los chips de fecha de
                     arriba. El relleno gris de antes no decía «este», decía
                     «deshabilitado»: es el mismo tono con el que la app pinta lo
                     que no se puede tocar.

                     Los 44px son de alto REAL y no de pseudo-elemento —en nativo
                     no hay `::after`—, y es la única diferencia con web acá. */
                  className={`min-h-[44px] flex-row items-center gap-1.5 rounded-full border px-3 ${
                    purposeId === id
                      ? 'border-emerald-deep bg-emerald-deep/5'
                      : 'border-border-soft bg-card'
                  }`}
                >
                  <Text className="text-[15px]">{option?.icon ?? '🫙'}</Text>
                  <Text className="text-[13px] font-semibold text-text">
                    {option?.name ?? t('savings.purposes.none')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {/* El resumen, con las mismas medidas que web: `border-soft`, radio 12,
          `px-4 py-3` y cuerpo 13.5. Con `p-4`, radio 16 y 14px pesaba como el
          héroe del monto, que es el bloque que sí manda acá. */}
      <View className="mt-2.5 rounded-xl border border-border-soft bg-card px-4 py-3">
        <View className="flex-row justify-between py-0.5">
          <Text className="text-[13.5px] text-text-muted">
            {mode === 'save'
              ? t('savings.available_now')
              : purpose != null
                ? t('savings.saved_in', { purpose: purpose.name })
                : unassignedIsTotal
                  ? t('savings.saved_total')
                  : t('savings.purposes.unassigned_available')}
          </Text>
          <Text className="text-[13.5px] font-semibold text-text">{money(limit, currency)}</Text>
        </View>
        <View className="flex-row justify-between py-0.5">
          <Text className="text-[13.5px] text-text-muted">
            {mode === 'save' ? t('savings.you_will_save') : t('savings.you_will_release')}
          </Text>
          <Text className="text-[13.5px] font-semibold text-positive">
            {`${value > 0 ? '−' : ''}${money(value, currency)}`}
          </Text>
        </View>
        <View className="mt-1.5 flex-row justify-between border-t border-border-soft pt-2">
          <Text className="text-[13.5px] text-text-muted">
            {mode === 'save'
              ? t('savings.left_to_spend')
              : purpose != null
                ? t('savings.stays_in', { purpose: purpose.name })
                : unassignedIsTotal
                  ? t('savings.stays_saved')
                  : t('savings.purposes.left_unassigned')}
          </Text>
          <Text
            className={`text-[16px] font-extrabold ${overLimit ? 'text-negative' : 'text-text'}`}
          >
            {`${remainder < 0 ? '−' : ''}${money(Math.abs(remainder), currency)}`}
          </Text>
        </View>
      </View>

      {/* The copy never suggests a transfer happened. */}
      <Text className="mt-2.5 px-1 text-[12.5px] leading-snug text-text-muted">
        {mode === 'save' ? t('savings.save_note') : t('savings.release_note')}
      </Text>

      {(limitError ?? error) != null && (
        <Text className="mt-3 px-1 text-[13px] font-semibold text-negative">
          {limitError ?? error}
        </Text>
      )}

      {/* El CTA dice el MONTO, no solo el verbo — como en web. Es lo último que
          se lee antes de confirmar, y es donde un cero de más todavía se puede
          cachar. Vuelve al verbo mientras no hay monto: «Guardar $ 0» sería un
          botón que anuncia una operación que no existe. */}
      <View className="mt-4">
        <Button
          title={
            value > 0
              ? t(mode === 'save' ? 'savings.save_amount' : 'savings.release_amount', {
                  amount: money(value, currency),
                })
              : mode === 'save'
                ? t('savings.save')
                : t('savings.release')
          }
          onPress={submit}
          loading={busy}
          disabled={busy || value <= 0 || overLimit}
        />
      </View>
    </View>
  )
}
