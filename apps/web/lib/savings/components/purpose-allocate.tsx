'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PURPOSE_SEEDS, type Purpose } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { allocateToPurpose, unallocateFromPurpose } from '@/app/_actions/savings'
import { DrawerBackHeader } from './drawer-back-header'

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
  const [pending, startTransition] = useTransition()

  // Las sugerencias que el usuario todavía no tiene: ofrecerle crear algo que ya
  // existe lo empuja contra el nombre único con el atajo que existe para
  // ahorrarle trabajo.
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
      : t('purposes.errors.exceeds_allocated', {
          limit: money(available),
          purpose: purpose?.name ?? '',
        })
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

      {/* Mismo héroe de monto que el resto de las superficies que piden plata. */}
      <div className="mt-4 rounded-[18px] border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]">
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
            className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-[#FAFBFC] px-2.5 py-1 text-xs font-bold text-text disabled:opacity-100"
          >
            {currency}
            {currencies.length > 1 && <ChevronDown className="size-3" aria-hidden />}
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[27px] font-semibold leading-none text-text opacity-50">
            {currency === 'USD' ? 'U$D' : '$'}
          </span>
          <MoneyAmountInput
            id="allocation-amount"
            value={amount}
            onChange={setAmount}
            autoFocus
            className="w-full border-none bg-transparent p-0 text-[27px] font-semibold leading-none text-text outline-none"
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
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
            {t('purposes.pick_inline')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {purposes.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setChosen(option)}
                className={`flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${
                  chosen?.id === option.id
                    ? 'border-emerald-deep bg-emerald-deep/5 text-text'
                    : 'border-border-soft bg-card text-text hover:bg-surface-sunken'
                }`}
              >
                <span aria-hidden>{option.icon ?? '🫙'}</span>
                {option.name}
              </button>
            ))}
            {suggestions.map((seed) => (
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
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-dashed border-border px-3.5 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-surface-sunken disabled:opacity-50"
              >
                <span aria-hidden>{seed.icon}</span>
                {t(`purposes.seeds.${seed.key}`)}
              </button>
            ))}
            <button
              type="button"
              onClick={onCreateCustom}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-[13.5px] font-bold text-emerald-deep transition-colors hover:bg-surface-sunken"
            >
              <Plus size={15} strokeWidth={2.5} />
              {t('purposes.create_inline')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-border-soft bg-card p-4 text-[14px]">
        <p className="flex justify-between py-1 text-text-muted">
          <span>
            {allocating
              ? t('purposes.unassigned_available')
              : t('purposes.allocated_in', { purpose: purpose?.name ?? '' })}
          </span>
          <span className="font-semibold tabular-nums text-text">{money(available)}</span>
        </p>
        <p className="flex justify-between py-1 text-text-muted">
          <span>{t(allocating ? 'purposes.will_allocate' : 'purposes.will_unallocate')}</span>
          <span className="font-semibold tabular-nums text-emerald-deep">
            {value > 0 ? '−' : ''}
            {money(value)}
          </span>
        </p>
        <p className="mt-1.5 flex justify-between border-t border-border-soft pt-2.5 text-text-muted">
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
      <p className="mt-3 px-1 text-[12.5px] leading-snug text-text-soft">
        {t('purposes.allocate_note')}
      </p>

      {(limitError ?? error) && (
        <p className="mt-3 text-[13px] font-semibold text-negative">{limitError ?? error}</p>
      )}

      <Button
        className="mt-4 h-11"
        onClick={submit}
        disabled={pending || value <= 0 || overLimit || purpose == null}
      >
        {t(allocating ? 'purposes.allocate' : 'purposes.unallocate')}
      </Button>

      {/* La salida explícita, solo recién creado. La flecha de arriba cierra
          igual, pero bajo un título que dice «Listo, creaste…» se lee como
          «volver a crear», no como «terminé». Destinar es OPCIONAL: un propósito
          en cero es un estado válido, y hay que poder llegar a él diciéndolo. */}
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
  )
}
