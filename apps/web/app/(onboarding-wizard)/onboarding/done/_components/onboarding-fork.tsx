'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Landmark, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Choice = 'wallet' | 'accounts'

type Accent = {
  /** soft card background tint */
  bg: string
  /** resting border */
  border: string
  /** solid icon-chip fill (white icon on top) */
  solid: string
  /** tag + chevron color (deep shade) */
  deep: string
}

const ACCENTS: Record<Choice, Accent> = {
  wallet: {
    bg: 'var(--emerald-bg)',
    border: 'rgba(16,185,129,0.30)',
    solid: 'var(--emerald)',
    deep: 'var(--emerald-deep)',
  },
  accounts: {
    bg: 'rgba(138,110,152,0.10)',
    border: 'rgba(138,110,152,0.34)',
    solid: 'var(--plum)',
    deep: 'var(--plum-deep)',
  },
}

const formatARS = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatUSD = (n: number) =>
  `US$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Props = {
  totalArs: number
  totalUsd: number
}

/**
 * Cierre del onboarding. Es dueño de toda la pantalla `done` (header de éxito +
 * resumen de saldo + la bifurcación "Tu Grana, tu decisión") para que el estado
 * de confirmación pueda tapar todo y quedar enfocado en un solo mensaje.
 *
 * El usuario elige cómo llevar su plata y, antes de rutear, ve una confirmación
 * cálida con un botón "Vamos" (D7). La elección es solo de ruteo, no persiste
 * ningún modo (D9):
 *   - billetera  → /dashboard?nuevo=1 (abre el drawer de movimiento + tour)
 *   - cuentas    → /accounts/new
 * No hay escape: el usuario debe elegir A o B (decisión de producto).
 */
export const OnboardingFork = ({ totalArs, totalUsd }: Props) => {
  const t = useTranslations('onboarding.done')
  const tf = useTranslations('onboarding.done.fork')
  const router = useRouter()
  const [choice, setChoice] = useState<Choice | null>(null)

  // Estado de confirmación: limpio, enfocado — solo el mensaje del camino elegido.
  if (choice) {
    const isWallet = choice === 'wallet'
    const accent = ACCENTS[choice]
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <span
          className="flex size-16 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(11,26,43,0.35)]"
          style={{ backgroundColor: accent.solid }}
        >
          {isWallet ? <Wallet className="size-7" aria-hidden /> : <Landmark className="size-7" aria-hidden />}
        </span>
        <p className="text-xl font-semibold leading-snug text-text">
          {isWallet ? tf('confirm_wallet') : tf('confirm_accounts')}
        </p>
        <Button
          className="w-full"
          onClick={() => router.push(isWallet ? '/dashboard?nuevo=1' : '/accounts?nuevaCuenta=1')}
        >
          {tf('go')}
        </Button>
        <button
          type="button"
          onClick={() => setChoice(null)}
          className="mx-auto flex items-center gap-1 text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {tf('back')}
        </button>
      </div>
    )
  }

  // Estado inicial: éxito + saldo + las dos cards de elección.
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('wink')}</p>
      </header>

      <div className="bg-hero-navy relative overflow-hidden rounded-3xl border border-navy-border p-6 text-center text-white shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">
          {t('balance_label')}
        </p>
        <p className="mt-1.5 text-4xl font-bold tabular-nums">{formatARS(totalArs)}</p>
        {totalUsd > 0 && (
          <p className="mt-1 text-sm font-medium text-white/60 tabular-nums">{formatUSD(totalUsd)}</p>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1 text-center">
          <h2 className="text-xl font-bold tracking-tight text-text">{tf('title')}</h2>
          <p className="text-sm text-text-muted">{tf('subtitle')}</p>
        </header>

        <div className="flex flex-col gap-3">
          <ChoiceCard
            accent={ACCENTS.wallet}
            icon={<Wallet className="size-5" aria-hidden />}
            tag={tf('wallet_tag')}
            title={tf('wallet_title')}
            body={tf('wallet_body')}
            onClick={() => setChoice('wallet')}
          />
          <ChoiceCard
            accent={ACCENTS.accounts}
            icon={<Landmark className="size-5" aria-hidden />}
            tag={tf('accounts_tag')}
            title={tf('accounts_title')}
            body={tf('accounts_body')}
            onClick={() => setChoice('accounts')}
          />
        </div>
      </div>
    </div>
  )
}

type ChoiceCardProps = {
  accent: Accent
  icon: React.ReactNode
  tag: string
  title: string
  body: string
  onClick: () => void
}

const ChoiceCard = ({ accent, icon, tag, title, body, onClick }: ChoiceCardProps) => (
  <button
    type="button"
    onClick={onClick}
    style={{ backgroundColor: accent.bg, borderColor: accent.border } as React.CSSProperties}
    className="group flex w-full items-start gap-4 rounded-[18px] border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-16px_rgba(11,26,43,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-[14px] text-white shadow-[0_8px_18px_-6px_rgba(11,26,43,0.35)] transition-transform group-hover:scale-105"
      style={{ backgroundColor: accent.solid }}
    >
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span
        className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
        style={{ color: accent.deep }}
      >
        {tag}
      </span>
      <span className="text-[15.5px] font-bold leading-tight text-text">{title}</span>
      <span className="text-[13px] leading-relaxed text-text-muted">{body}</span>
    </span>
    <ChevronRight
      className="mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
      style={{ color: accent.deep }}
      aria-hidden
    />
  </button>
)
