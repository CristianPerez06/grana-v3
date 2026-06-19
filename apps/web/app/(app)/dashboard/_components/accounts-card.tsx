import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { computeConcentration, type DashboardHero } from '@grana/dashboard'
import { MaskedAmount } from './masked-amount'

type Props = {
  data: DashboardHero
}

// "Dónde está" — concentration view (web). Instead of a long list, it shows how
// concentrated the available balance is: a big "%" callout for the dominant
// account, a proportional concentration bar (one segment per account, widths
// derived from the data), and a compact 2-col grid for the rest + the USD
// holding. Rows come from getDashboardHero (sorted by ARS desc). Capped so the
// top row keeps a sane height; the full list lives in /accounts.
const MAX_ACCOUNTS = 6

// Account identity color for the bar segment / grid swatch — same source as the
// AccountAvatar (palette key token, else institution override, else slate).
const avatarColor = (avatar: ResolvedAccountAvatar): string =>
  avatar.colorKey ? `var(--account-${avatar.colorKey})` : (avatar.colorOverride ?? 'var(--account-slate)')

export const AccountsCard = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.accounts')
  const accounts = data.accounts.slice(0, MAX_ACCOUNTS)
  const concentration = computeConcentration(accounts)
  const pctById = new Map(concentration.segments.map((s) => [s.id, s.pct]))

  const dominant = concentration.dominantId
    ? accounts.find((a) => a.id === concentration.dominantId)
    : undefined
  // The rest of the accounts go in the grid (the dominant one lives in the callout).
  const rest = accounts.filter((a) => a.id !== dominant?.id)

  return (
    <Card className="flex min-h-[13rem] flex-col">
      <CardHeader className="gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-text">{t('title')}</h2>
        <Link
          href="/accounts"
          className="rounded text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('view_all')}
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Concentration callout — only when there is a positive ARS balance. */}
        {dominant && concentration.dominantPct !== null && (
          <div className="flex items-baseline gap-3">
            <span
              className="text-[clamp(2.25rem,4.4vw,3rem)] font-extrabold leading-none tracking-tight"
              style={{ color: avatarColor(dominant.avatar) }}
            >
              {concentration.dominantPct}%
            </span>
            <p className="min-w-0 text-[13px] font-semibold leading-snug text-text-muted">
              {t('concentration_lead')}
              <br />
              <span className="font-bold text-text">{dominant.name}</span>{' '}
              <span className="font-extrabold tabular-nums text-text">
                <MaskedAmount amount={dominant.ars} currency="ARS" />
              </span>
            </p>
          </div>
        )}

        {/* Concentration bar — one segment per account, width ∝ ARS share. */}
        {concentration.segments.length > 0 && (
          <div className="flex h-4 gap-[2px] overflow-hidden rounded-[7px]" aria-hidden>
            {accounts
              .filter((a) => (pctById.get(a.id) ?? 0) > 0)
              .map((a) => (
                <span
                  key={a.id}
                  className="h-full first:rounded-l-[7px] last:rounded-r-[7px]"
                  style={{
                    flex: pctById.get(a.id) ?? 0,
                    minWidth: '0.375rem',
                    backgroundColor: avatarColor(a.avatar),
                  }}
                />
              ))}
          </div>
        )}

        {/* Compact grid — the remaining accounts + the USD holding. */}
        <div className="mt-auto grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
          {rest.map((account) => (
            <div key={account.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[3px]"
                style={{ backgroundColor: avatarColor(account.avatar) }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text">
                {account.name}
              </span>
              <span
                className={cn(
                  'shrink-0 text-[13px] font-extrabold tabular-nums',
                  account.ars === 0 ? 'text-text-soft' : 'text-text',
                )}
              >
                <MaskedAmount amount={account.ars} currency="ARS" />
              </span>
            </div>
          ))}

          {/* USD holding — the bimoneda closing cell, emerald like the handoff. */}
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-[3px] bg-emerald" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-emerald-deep">
              {t('usd_row')}
            </span>
            <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-emerald-deep">
              <MaskedAmount amount={data.usd} currency="USD" showCentsOverride />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
