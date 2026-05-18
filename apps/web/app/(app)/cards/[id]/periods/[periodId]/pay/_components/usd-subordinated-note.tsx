const formatUSD = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)

type Props = {
  usdAmount: number
}

export const USDSubordinatedNote = ({ usdAmount }: Props) => (
  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
    <p className="font-medium">Consumos en dólares: {formatUSD(usdAmount)}</p>
    <p className="text-xs text-blue-700 mt-0.5">
      Los consumos en USD se muestran informativamente. El monto a pagar en ARS ya incluye la
      conversión al TC utilizado en cada compra.
    </p>
  </div>
)
