'use client'

import type { ReactNode } from 'react'
import { useShowCents } from '@/lib/preferences-context'
import { fmtAmountParts, type Tone } from '@/lib/transactions/components/tone'

// Hero del detalle (handoff): tarjeta con banda tintada por tono, ícono de
// categoría, monto grande en `var(--tone)` con símbolo opaco + decimales en
// superscript, eyebrow opcional (transfer), título, línea de contexto y la
// fila de chips. Valores portados de panel.css (.hero / .hero-band / etc.).

type Props = {
  /** Editorial tone — drives the sign (+/−/none) via fmtAmountParts. */
  tone: Tone
  /** Element inside the tinted icon box (emoji string or lucide icon). */
  icon: ReactNode
  amount: number
  currency: 'ARS' | 'USD'
  /** Optional uppercase eyebrow above the title (e.g. "Transferencia interna"). */
  eyebrow?: ReactNode
  title: ReactNode
  /** Context line below the amount (e.g. "Gasto · pago único en efectivo"). */
  flow?: ReactNode
  /** Chip row (built by the caller with <Chip>). */
  chips?: ReactNode
}

export const DetailHero = ({ tone, icon, amount, currency, eyebrow, title, flow, chips }: Props) => {
  const showCents = useShowCents()
  const parts = fmtAmountParts(amount, currency, tone, showCents)

  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card sm:rounded-[24px]">
      <div
        className="px-[22px] pb-6 pt-7 text-center sm:px-9 sm:pb-[30px] sm:pt-10"
        style={{
          background:
            'radial-gradient(120% 150% at 50% -35%, var(--tone-soft) 0%, var(--card) 70%)',
        }}
      >
        <div
          className="mx-auto mb-3.5 grid size-[72px] place-items-center rounded-[22px] text-[34px] leading-none shadow-[0_10px_24px_-10px_rgba(11,26,43,0.28)] sm:mb-[18px] sm:size-[88px] sm:rounded-[26px] sm:text-[42px]"
          style={{ background: 'var(--tone-soft)', color: 'var(--tone)' }}
        >
          {icon}
        </div>

        {eyebrow != null && (
          <div className="mb-[11px] inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.13em] text-[var(--tone-deep)]">
            {eyebrow}
          </div>
        )}

        <div className="text-[24px] font-extrabold leading-[1.05] tracking-[-0.03em] text-text sm:text-[29px]">
          {title}
        </div>

        <div
          className="mt-3 flex min-w-0 items-baseline justify-center text-[clamp(2rem,11vw,46px)] font-extrabold leading-none tracking-[-0.045em] tabular-nums sm:mt-[15px] sm:text-[60px]"
          style={{ color: 'var(--tone)' }}
        >
          {parts.sign && <span className="mr-0.5">{parts.sign}</span>}
          <span className="mr-[3px] align-top text-[24px] font-bold opacity-60 sm:text-[30px]">
            {parts.symbol}
          </span>
          {parts.int}
          {parts.dec && <span className="text-[0.5em] opacity-80">,{parts.dec}</span>}
        </div>

        {flow != null && (
          <div className="mt-1 text-[13.5px] font-semibold text-text-muted sm:text-[14.5px]">
            {flow}
          </div>
        )}
      </div>

      {chips != null && (
        <div className="flex flex-wrap justify-center gap-1.5 border-t border-border px-[18px] pb-5 pt-4 sm:gap-2 sm:px-9 sm:pb-[26px] sm:pt-5">
          {chips}
        </div>
      )}
    </section>
  )
}
