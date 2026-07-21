import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { BalanceCurrency } from '@grana/money-logic'

// Bimoneda money formatting for the Hogar module. ARS and USD are never merged;
// each amount carries its own currency. Mirrors the web `fmtMoney` helper and
// the rest of mobile (Wallet, CardsMonthHero) which format via @grana/i18n-messages.
export function fmtMoney(amount: number, currency: BalanceCurrency): string {
  return currency === 'USD' ? formatUSD(amount) : formatARS(amount)
}
