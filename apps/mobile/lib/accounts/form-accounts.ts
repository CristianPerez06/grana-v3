import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { MovementFormAccount } from '@grana/movement-form'
import type { getAccounts } from '@grana/accounts'

type GroupedAccounts = Awaited<ReturnType<typeof getAccounts>>
type AccountCurrency = { currency_code: string; is_active: boolean }

const activeCodes = (currencies: AccountCurrency[]): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

/**
 * Las cuentas agrupadas, proyectadas a la forma que consumen los formularios.
 *
 * Vive acá y no adentro de cada pantalla porque ESTABA COPIADO: el alta de
 * movimiento, la edición y el alta de recurrencia llevaban las tres el mismo
 * `useMemo`, con el mismo comentario, y el cuarto consumidor —la hoja de
 * registrar por anticipado— iba a ser la cuarta copia. Es exactamente el patrón
 * «mirror … keep in sync» que las convenciones del repo prohíben: el día que
 * cambie la forma de una cuenta, hay que acertarle a todas.
 *
 * El saldo de una tarjeta es {0,0} A PROPÓSITO: los consumos de crédito están
 * fuera del ledger, así que no hay disponible que mostrar ni contra el que
 * advertir.
 */
export function toMovementFormAccounts(grouped: GroupedAccounts | undefined): MovementFormAccount[] {
  if (!grouped) return []
  return [
    ...[...grouped.cash, ...grouped.bank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'cash' | 'bank',
      activeCurrencies: activeCodes(a.currencies),
      balances: a.balances,
      institutionId: a.institution_id ?? null,
      institutionName: a.institution?.name ?? null,
      avatar: a.avatar,
    })),
    ...grouped.credit.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'credit' as const,
      activeCurrencies: activeCodes(c.currencies),
      balances: { ARS: 0, USD: 0 },
      institutionId: c.institution_id ?? null,
      institutionName: c.institution?.name ?? null,
      // La tarjeta resuelve su avatar como las demás, para heredar el color de
      // marca de su institución en vez del fallback.
      avatar: resolveAccountAvatar(
        { id: c.id, name: c.name, type: 'credit', color_key: c.color_key, icon_key: c.icon_key },
        c.institution,
      ),
    })),
  ]
}
