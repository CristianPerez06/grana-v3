import { Card } from '@/components/ui/card'

const EXTRACTO_ROWS = 6

// Mirrors CurrentAccountView: two saldo cards (ARS 1.5fr + USD 1fr), the
// equation card with four boxes, and the extracto list — same shape the page
// renders so the chrome doesn't shift on load.
const SaldoCardSkeleton = ({ big = false }: { big?: boolean }) => (
  <Card className="flex flex-col gap-3 p-6">
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    <span className={`${big ? 'h-10 w-44' : 'h-8 w-32'} rounded bg-muted animate-pulse`} />
    <span className="h-3.5 w-40 rounded bg-muted/70 animate-pulse" />
  </Card>
)

const ExtractoRowSkeleton = () => (
  <li className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3 last:border-b-0">
    <span className="h-3 w-12 shrink-0 rounded bg-muted/70 animate-pulse" />
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
      <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-16 shrink-0 rounded bg-muted animate-pulse" />
  </li>
)

const CuentaCorrienteLoading = () => (
  <div className="flex flex-col gap-4" aria-busy="true">
    <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
      <SaldoCardSkeleton big />
      <SaldoCardSkeleton />
    </div>

    <Card className="flex flex-col gap-4 p-5">
      <span className="h-4 w-48 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="h-16 rounded-xl bg-muted/70 animate-pulse" />
        ))}
      </div>
    </Card>

    <Card asChild>
      <ul className="flex flex-col">
        {Array.from({ length: EXTRACTO_ROWS }).map((_, i) => (
          <ExtractoRowSkeleton key={i} />
        ))}
      </ul>
    </Card>
  </div>
)

export default CuentaCorrienteLoading
