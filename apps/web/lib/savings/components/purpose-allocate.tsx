'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PURPOSE_SEEDS, fitChipCount, type Purpose } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { allocateToPurpose, unallocateFromPurpose } from '@/app/_actions/savings'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-is-mobile'
import { DrawerBackHeader } from './drawer-back-header'
import { DESKTOP_CHIP_ROW_WIDTH, MOBILE_CHIP_ROW_WIDTH } from '@/lib/savings/chip-row-width'

type Currency = 'ARS' | 'USD'

/**
 * Repartir lo guardado: **apartar** para un propósito, o **soltar** de vuelta al
 * resto.
 *
 * Pide un MONTO, y ahí está la corrección de fondo: antes esta pantalla pedía
 * tocar un movimiento del historial, y eso ataba el propósito a una fila
 * puntual. La plata guardada es fungible —igual que no está en una cuenta
 * puntual— así que no existen "los $300.000 del 15/7": existe "hay $190.000
 * guardados". Etiquetar aquella fila, cuando parte ya se había vuelto a usar,
 * dejaba al resto en negativo con el total cerrando.
 *
 * No mueve plata y, a diferencia de guardar, **tampoco cambia el disponible ni
 * el total guardado**: lo que entra en un grupo sale del otro.
 */
export function PurposeAllocate({
  purpose: fixedPurpose,
  purposes,
  currency: initialCurrency,
  currencies,
  direction,
  justCreated = false,
  availableFor,
  allocatedIn,
  onCreateSeed,
  onCreateCustom,
  onDone,
  onBack,
}: {
  /** Fijo cuando se llegó desde un propósito. Null: se elige acá mismo. */
  purpose: Purpose | null
  /** Los propósitos del usuario, para elegir sin cambiar de pantalla. */
  purposes: Purpose[]
  currency: Currency
  /** Las monedas que el usuario tiene en juego. */
  currencies: Currency[]
  /** `allocate` saca del resto hacia el propósito; `unallocate` lo devuelve. */
  direction: 'allocate' | 'unallocate'
  /**
   * Se llegó recién de CREAR este propósito.
   *
   * Cambia la cabecera por un acuse. Sin él, crear no confirmaba nada: la
   * pantalla pasaba a «Destinar a Prueba» dando por sabido que Prueba existía, y
   * quien cerraba acá —un clic afuera del overlay alcanza— se quedaba sin saber
   * si había quedado creado. Al reintentar chocaba contra «ya tenés un propósito
   * llamado Prueba», que es una respuesta correcta a una pregunta que nunca
   * debió hacerse.
   *
   * El acuse va en la pantalla siguiente y no en un toast: la regla del repo es
   * que el cambio de pantalla ES el acuse, y una pantalla que no dice qué pasó
   * no lo cumple.
   */
  justCreated?: boolean
  /**
   * El piso de CADA moneda: el resto al destinar, lo destinado al quitar.
   *
   * Una función y no un número porque la moneda se elige acá: el detalle dejó de
   * estar partido por moneda, así que la elección bajó al formulario — que es
   * donde la moneda es un dato de la operación y no un eje de lectura.
   */
  availableFor: (currency: Currency) => number
  /**
   * Lo destinado a un propósito en esta moneda. Solo para ORDENAR los chips:
   * los que ya tienen plata primero, que son los que se buscan. Sin esto la
   * lista queda alfabética y lo que se pliega son los últimos del abecedario.
   */
  allocatedIn: (currency: Currency, purposeId: string) => number
  /** Crea la sugerencia y devuelve el propósito, para dejarlo seleccionado. */
  onCreateSeed: (seedKey: string) => Promise<Purpose | null>
  onCreateCustom: () => void
  onDone: () => void | Promise<void>
  onBack: () => void
}) {
  const t = useTranslations('savings')
  const [currency, setCurrency] = useState<Currency>(initialCurrency)
  const [chosen, setChosen] = useState<Purpose | null>(fixedPurpose)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showAllPurposes, setShowAllPurposes] = useState(false)
  // Mismo gate que el formulario de guardar: en el teléfono el alto es el
  // recurso escaso y varias medidas se toman distinto.
  const isMobile = useIsMobile()
  const [pending, startTransition] = useTransition()

  // Las sugerencias que el usuario todavía no tiene: ofrecerle crear algo que ya
  // existe lo empuja contra el nombre único con el atajo que existe para
  // ahorrarle trabajo.
  // Por saldo descendente y, a igualdad, por nombre: lo que se pliega son los
  // que menos tienen, no los últimos del abecedario.
  const sortedPurposes = [...purposes].sort(
    (a, b) =>
      allocatedIn(currency, b.id) - allocatedIn(currency, a.id) || a.name.localeCompare(b.name),
  )
  // Dos filas de chips en el teléfono y tres en el drawer de escritorio, igual
  // que el formulario de guardar: lo que se topea es el ALTO, no la cantidad.
  const chipFit = fitChipCount(
    sortedPurposes.map((p) => p.name),
    isMobile ? MOBILE_CHIP_ROW_WIDTH : DESKTOP_CHIP_ROW_WIDTH,
    isMobile ? 2 : 3,
  )
  const shownPurposes = showAllPurposes
    ? sortedPurposes
    : (() => {
        const head = sortedPurposes.slice(0, chipFit)
        if (chosen == null || head.some((p) => p.id === chosen.id)) return head
        return [...head.slice(0, Math.max(1, chipFit - 1)), chosen]
      })()
  const hiddenPurposes = sortedPurposes.length - shownPurposes.length

  const taken = new Set(purposes.map((p) => p.name.trim().toLowerCase()))
  const suggestions = PURPOSE_SEEDS.filter(
    (seed) => !taken.has(t(`purposes.seeds.${seed.key}`).trim().toLowerCase()),
  )

  const money = (value: number) => (currency === 'USD' ? formatUSD(value) : formatARS(value, true))

  const purpose = chosen
  const available = availableFor(currency)
  const value = parseMoneyInput(amount) ?? 0
  const remainder = available - value
  const overLimit = value > available
  const allocating = direction === 'allocate'

  // El mismo mensaje que devolvería el servidor, con el mismo número: un botón
  // deshabilitado sin explicación no deja avanzar y tampoco dice por qué.
  const limitError = overLimit
    ? allocating
      ? t('purposes.errors.exceeds_unassigned', { limit: money(available) })
      : t('purposes.errors.exceeds_allocated', { limit: money(available) })
    : null

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const action = allocating ? allocateToPurpose : unallocateFromPurpose
      if (purpose == null) return
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(),
        purpose_id: purpose.id,
      })
      if (!result.ok) {
        setError(result.formError ?? t('purposes.errors.generic'))
        return
      }
      await onDone()
    })
  }

  return (
    <div className="flex flex-col">
      <DrawerBackHeader
        title={
          justCreated && purpose != null
            ? t('purposes.created_title', { purpose: purpose.name })
            : purpose != null
              ? t(allocating ? 'purposes.allocate_title' : 'purposes.unallocate_title', {
                  purpose: purpose.name,
                })
              : t('purposes.allocate')
        }
        onBack={onBack}
      />

      {/* Lo que el propósito recién creado TODAVÍA no tiene, y la pregunta que
          sigue. Es lo que convierte esta pantalla en la confirmación de la
          anterior en vez de un paso que aparece de la nada. */}
      {justCreated && (
        <p className="mt-3 text-[13px] leading-snug text-text-muted">
          {t('purposes.created_body')}
        </p>
      )}

      {/* Mismo héroe de monto que el resto de las superficies que piden plata:
          mismo radio, mismo padding y misma escala que «Registrar movimiento» y
          que el formulario de guardar. */}
      <div className="mt-3 rounded-[16px] border border-border bg-card px-4 py-3 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)] sm:mt-4 sm:px-5 sm:py-[18px]">
        <div className="flex items-start justify-between">
          <label
            htmlFor="allocation-amount"
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft"
          >
            {t('amount_label')}
          </label>
          {/* EL chip de moneda de la app, el mismo del alta de movimientos y el
              mismo que el formulario de guardar. Siempre visible, deshabilitado
              cuando hay una sola.

              Cambiar la moneda cambia el piso: lo que hay sin destino en pesos
              no es lo que hay sin destino en dólares. */}
          <button
            type="button"
            onClick={() =>
              setCurrency(
                currencies[(currencies.indexOf(currency) + 1) % currencies.length] ?? currency,
              )
            }
            disabled={currencies.length < 2}
            aria-label={t('currency_label')}
            className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-[#FAFBFC] px-2.5 py-1 text-xs font-bold text-text disabled:opacity-100"
          >
            {currency}
            {currencies.length > 1 && <ChevronDown className="size-3" aria-hidden />}
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold leading-none text-text opacity-50 sm:text-[22px]">
            {currency === 'USD' ? 'U$D' : '$'}
          </span>
          <MoneyAmountInput
            id="allocation-amount"
            value={amount}
            onChange={setAmount}
            autoFocus
            className="w-full min-w-0 border-none bg-transparent p-0 text-[27px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-text outline-none placeholder:text-text-soft/40 sm:text-[30px]"
          />
          <MoneyCalculatorPopover seed={amount} onResult={setAmount} />
        </div>
      </div>

      {/* Elegir para qué, EN LA MISMA PANTALLA. Antes era un paso aparte: se
          tocaba el resto, se abría una lista, se elegía, y recién ahí aparecía
          el monto. Tres pantallas para una decisión que son dos datos —cuánto y
          para qué— y que entran juntos. Los propósitos son pocos por
          naturaleza, así que caben como chips. */}
      {fixedPurpose == null && (
        <div className="mt-4">
          {/* La puerta para crear va a la DERECHA del rótulo, igual que en el
              formulario de guardar y que en la página: al final de los chips
              caía sola en su fila cuando la última estaba llena. */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
              {t('purposes.pick_inline')}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              {/* El control de overflow, en la fila del RÓTULO y nunca entre los
                  chips: al final de la fila caía solo en su renglón cuando la
                  última estaba llena, y ahí no se lee como acción sino como algo
                  cortado. */}
              {hiddenPurposes > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllPurposes(true)}
                  className="relative shrink-0 text-[12px] font-extrabold text-text-muted transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-text"
                >
                  {t('purposes.show_more', { count: hiddenPurposes })}
                </button>
              )}
              {showAllPurposes && sortedPurposes.length > chipFit && (
                <button
                  type="button"
                  onClick={() => setShowAllPurposes(false)}
                  className="relative shrink-0 text-[12px] font-extrabold text-text-muted transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-text"
                >
                  {t('purposes.show_less')}
                </button>
              )}
              <button
                type="button"
                onClick={onCreateCustom}
                className="relative flex shrink-0 items-center gap-1 text-[12px] font-extrabold text-emerald-deep transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-text"
              >
                <Plus className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                {t('purposes.new')}
              </button>
            </div>
          </div>
          {/* Mismos chips compactos y mismo techo que en guardar: con diez
              propósitos, la lista completa empujaba el resumen y el CTA fuera de
              la pantalla. El elegido entra siempre entre los visibles. */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {shownPurposes.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setChosen(option)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
                  chosen?.id === option.id
                    ? 'border-emerald-deep bg-emerald-deep/5 text-text'
                    : 'border-border-soft bg-card text-text hover:bg-surface-sunken',
                )}
              >
                <span aria-hidden>{option.icon ?? '🫙'}</span>
                {option.name}
              </button>
            ))}
            {/* Las sugerencias solo cuando NO hay propósitos plegados: son un
                atajo para quien todavía no armó los suyos, y ofrecerlas al lado
                de un «+3» sería empujar a crear mientras se esconde lo que ya
                existe. */}
            {hiddenPurposes === 0 &&
              suggestions.map((seed) => (
                <button
                  key={seed.key}
                  type="button"
                  disabled={creating}
                  onClick={async () => {
                    setCreating(true)
                    const created = await onCreateSeed(seed.key)
                    if (created) setChosen(created)
                    setCreating(false)
                  }}
                  className="relative flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-2 text-[13px] font-semibold text-text-muted transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:bg-surface-sunken disabled:opacity-50"
                >
                  <span aria-hidden>{seed.icon}</span>
                  {t(`purposes.seeds.${seed.key}`)}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border-soft bg-card px-4 py-3 text-[13.5px]">
        <p className="flex justify-between py-0.5 text-text-muted">
          <span>
            {allocating
              ? t('purposes.unassigned_available')
              : t('purposes.allocated_in', { purpose: purpose?.name ?? '' })}
          </span>
          <span className="font-semibold tabular-nums text-text">{money(available)}</span>
        </p>
        <p className="flex justify-between py-0.5 text-text-muted">
          <span>{t(allocating ? 'purposes.will_allocate' : 'purposes.will_unallocate')}</span>
          <span className="font-semibold tabular-nums text-emerald-deep">
            {value > 0 ? '−' : ''}
            {money(value)}
          </span>
        </p>
        <p className="mt-1.5 flex justify-between border-t border-border-soft pt-2 text-text-muted">
          <span>{t(allocating ? 'purposes.left_unassigned' : 'purposes.stays_allocated')}</span>
          <span
            className={`text-[16px] font-extrabold tabular-nums ${
              overLimit ? 'text-negative' : 'text-text'
            }`}
          >
            {remainder < 0 ? '−' : ''}
            {money(Math.abs(remainder))}
          </span>
        </p>
      </div>

      {/* Lo que hace falta decir en voz alta: esta operación no toca ningún
          total. Sin la frase, alguien que ve dos números moverse en la pantalla
          anterior supone que algo se gastó. */}
      <p className="mt-3.5 px-1 text-[12.5px] leading-snug text-text-soft">
        {t('purposes.allocate_note')}
      </p>

      {/* El CTA no se scrollea: queda PEGADO al pie del panel, y el mensaje de
          tope viaja con él. Misma razón que en el formulario de guardar — cuánto
          mide esta pantalla lo decide cuántos propósitos tiene el usuario, así
          que no hay presupuesto de píxeles que aguante. */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-4 bg-page px-5 pb-4 pt-3 sm:pb-6">
        {(limitError ?? error) && (
          <p className="mb-2 text-[13px] font-semibold text-negative">{limitError ?? error}</p>
        )}
        <Button
          className="h-11"
          onClick={submit}
          disabled={pending || value <= 0 || overLimit || purpose == null}
        >
          {t(allocating ? 'purposes.allocate' : 'purposes.unallocate')}
        </Button>

        {/* La salida explícita, solo recién creado. La flecha de arriba cierra
            igual, pero bajo un título que dice «Listo, creaste…» se lee como
            «volver a crear», no como «terminé». Destinar es OPCIONAL: un
            propósito en cero es un estado válido, y hay que poder llegar a él
            diciéndolo. */}
        {justCreated && (
          <button
            type="button"
            onClick={onBack}
            className="relative mx-auto mt-3 block text-[13px] font-bold text-text-muted transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-text"
          >
            {t('purposes.created_skip')}
          </button>
        )}
      </div>
    </div>
  )
}
