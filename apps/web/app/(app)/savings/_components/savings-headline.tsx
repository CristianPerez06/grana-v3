'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Split } from 'lucide-react'
import { moduleHasSavings, moduleRowFor } from '@grana/savings'
import type { AvailableSums } from '@grana/savings'
import type { BalanceCurrency } from '@grana/money-logic'
import { Button } from '@/components/ui/button'
import { SavingsDrawer } from '@/lib/savings/components/savings-drawer'
import type { SavingsDrawerInitialView } from '@/lib/savings/components/savings-drawer'
import { cn } from '@/lib/utils'
import { SavingsOverlayProvider, type SavingsOverlay } from './savings-overlay-context'
import { moneyParts } from './money'

/** `null` mientras el overlay nunca se abrió. Un solo dueño del estado, y es este. */
type DrawerState = SavingsDrawerInitialView | null

/**
 * Los tres botones globales entran sin propósito elegido: el destino se decide
 * adentro, con los chips, y no antes de saber el monto.
 *
 * `release` preselecciona «Sin destino» (`purposeId: null`), y si resulta que no
 * tiene saldo, el formulario se corre solo al primer grupo que sí lo tenga —
 * esta pantalla no puede saberlo, porque el reparto vive en la otra sección.
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
 * El total guardado, y las tres acciones que lo mueven.
 *
 * Es UNA card oscura a todo el ancho, con la botonera de zócalo adentro. El
 * oscuro no es decoración: es lo que ancla el total por tratamiento y no solo
 * por tamaño, y es el mismo `--navy` de la card de saldo del dashboard — que
 * las dos superficies oscuras de la app sean la MISMA es lo que las hace leer
 * como un sistema y no como dos pantallas parecidas.
 *
 * La jerarquía que esta card sostiene: acá está el TOTAL, y todo lo que viene
 * abajo —«Sin destino», los propósitos— son partes de él. Nada de lo de abajo
 * puede subir a este nivel ni ponerse al lado.
 */
export const SavingsHeadline = ({
  sums,
  children,
}: {
  sums: AvailableSums[]
  children: React.ReactNode
}) => {
  const t = useTranslations('savings')
  // Dos estados y no uno: el overlay ya no tiene vista raíz, así que necesita
  // saber a qué abre — y si al cerrar se borrara esa vista, se desmontaría de
  // golpe y perdería la animación de salida. `view` se queda con la última;
  // `open` es lo que la muestra.
  const [view, setView] = useState<DrawerState>(null)
  const [open, setOpen] = useState(false)
  const setDrawer = (next: SavingsDrawerInitialView) => {
    setView(next)
    setOpen(true)
  }

  const hasAnythingSaved = moduleHasSavings(sums)

  // Estable entre renders: es el valor de un contexto, y uno nuevo por render
  // volvería a dibujar la lista entera cada vez que se abre o cierra el overlay.
  const overlay = useMemo<SavingsOverlay>(
    () => ({
      openPurpose: (purpose, currency) => setDrawer({ kind: 'group', currency, purpose }),
      openRestAllocate: (currency) =>
        setDrawer({ kind: 'allocate', currency, purpose: null, direction: 'allocate' }),
      // `locked` porque el origen ya está elegido: se tocó la fila del resto.
      openRestRelease: (currency) =>
        setDrawer({ kind: 'form', mode: 'release', currency, purposeId: null, locked: true }),
      openNewPurpose: () => setDrawer({ kind: 'purposeForm', purpose: null }),
    }),
    [],
  )

  return (
    <div className="flex flex-col gap-3 sm:gap-[18px]">
      <section className="overflow-hidden rounded-3xl shadow-sm">
        <div className="bg-surface-dark px-[18px] pb-4 pt-[18px] sm:px-7 sm:pb-[22px] sm:pt-6">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-navy-muted">
            {t('total_saved')}
          </p>

          {/* Las dos monedas en columnas iguales, con un divisor de 1px en el
              medio. Iguales a propósito: no hay una moneda principal, y la
              cuenta de dólares no es un apéndice de la de pesos. NUNCA se
              suman, y el divisor es lo que lo dice sin escribirlo. */}
          <div className="mt-[15px] grid grid-cols-[1fr_1px_1fr] items-start gap-4">
            <DarkAmount value={moduleRowFor(sums, 'ARS').reserved} currency="ARS" />
            <div aria-hidden className="h-full w-px self-stretch bg-navy-border" />
            <DarkAmount value={moduleRowFor(sums, 'USD').reserved} currency="USD" />
          </div>

          <p className="mt-[15px] max-w-[620px] text-[12px] font-semibold leading-[1.45] text-navy-muted">
            {t('module_support')}
          </p>
        </div>

        {hasAnythingSaved ? (
          // El zócalo va ADENTRO de la card: son las acciones de este total, y
          // sueltas abajo se leían como acciones de la pantalla. El cambio de
          // fondo ya las separa, así que no lleva borde superior.
          <div className="grid grid-cols-3 bg-card">
            <BarAction icon={ArrowDown} label={t('save')} onClick={() => setDrawer(SAVE_ARS)} />
            <BarAction
              icon={ArrowUp}
              label={t('release')}
              divided
              onClick={() => setDrawer(RELEASE_ARS)}
            />
            <BarAction
              icon={Split}
              label={t('purposes.allocate')}
              divided
              onClick={() => setDrawer(ALLOCATE_ARS)}
            />
          </div>
        ) : null}
      </section>

      {hasAnythingSaved ? (
        <SavingsOverlayProvider value={overlay}>{children}</SavingsOverlayProvider>
      ) : (
        // Sin nada guardado no hay desglose ni de dónde volver a usar: una sola
        // acción y la frase que evita el malentendido.
        <div className="rounded-3xl border border-border-soft bg-card p-5 text-center sm:p-7">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-text sm:text-[23px]">
            {t('empty_title')}
          </h2>
          <p className="mx-auto mt-2 max-w-[520px] text-[13.5px] font-semibold leading-snug text-text-muted">
            {t('empty_body')}
          </p>
          <Button
            size="lg"
            className="mt-5 h-12 w-full font-semibold sm:w-[300px]"
            onClick={() => setDrawer(SAVE_ARS)}
          >
            {t('empty_cta')}
          </Button>
        </div>
      )}

      {/* El overlay abre DIRECTO a lo que se pidió. Ya no tiene lectura propia:
          se la llevó esta página, y lo que queda son actos. No se monta hasta el
          primer uso — quien solo viene a mirar cuánto tiene no paga su carga. */}
      {view != null && (
        <SavingsDrawer open={open} onClose={() => setOpen(false)} initialView={view} />
      )}
    </div>
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
const DarkAmount = ({ value, currency }: { value: number; currency: BalanceCurrency }) => {
  const { symbol, digits } = moneyParts(value, currency)
  const empty = value === 0

  return (
    <p
      className={cn(
        'whitespace-nowrap text-[27px] font-extrabold leading-none tracking-[-0.045em] tabular-nums sm:text-[34px]',
        empty ? 'text-white/[0.42]' : 'text-white',
      )}
    >
      <span className={cn('text-[0.8em] font-bold', empty ? 'text-white/[0.32]' : 'text-white/50')}>
        {symbol}
      </span>{' '}
      {digits}
    </p>
  )
}

/**
 * 48px de alto en teléfono y 60 en desktop, sobre el mínimo de 44 del repo.
 *
 * El divisor va por prop y no por un selector de hermano adyacente: `[&+&]`
 * depende de que las dos clases sean idénticas carácter por carácter, así que
 * envolver un botón —o cambiarle una clase a uno solo— borra los divisores sin
 * error. Acá quién lleva borde es una decisión del que arma la barra.
 */
const BarAction = ({
  icon: Icon,
  label,
  divided = false,
  onClick,
}: {
  icon: typeof ArrowDown
  label: string
  /** Lleva el borde de la izquierda: todos menos el primero. */
  divided?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex min-h-12 items-center justify-center gap-2 px-2 text-[12px] font-extrabold tracking-[-0.01em] text-text transition-colors hover:bg-surface-sunken sm:min-h-[60px] sm:text-[13px]',
      divided && 'border-l border-border-soft',
    )}
  >
    <Icon className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
    {label}
  </button>
)
