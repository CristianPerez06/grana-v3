type Props = {
  onReactivate?: () => void
  isPending?: boolean
}

export const InactiveCardBanner = ({ onReactivate, isPending }: Props) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-medium text-amber-800">Tarjeta archivada</p>
      <p className="text-xs text-amber-700 mt-0.5">
        Los movimientos históricos están preservados pero no podés registrar nuevos consumos.
      </p>
    </div>
    {onReactivate && (
      <button
        onClick={onReactivate}
        disabled={isPending}
        className="shrink-0 text-xs font-medium text-amber-800 underline hover:no-underline disabled:opacity-50"
      >
        Reactivar
      </button>
    )}
  </div>
)
