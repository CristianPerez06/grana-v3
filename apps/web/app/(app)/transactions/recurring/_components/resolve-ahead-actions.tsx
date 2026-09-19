'use client'

import { useMemo, useState, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { parseMoneyInput } from '@grana/validation'
import type { LinkCandidate } from '@grana/recurrences'
import type { MovementFormAccount } from '@grana/movement-form'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { createClient } from '@/lib/supabase/client'
import { getAccounts } from '@/lib/accounts/queries'
import { toFormAccounts } from '@/lib/accounts/form-accounts'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { Popover } from '@/components/ui/popover'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { DatePicker } from '@/components/ui/date-picker'
import {
  getRecurrenceLinkCandidates,
  registerRecurrenceAhead,
} from '@/app/_actions/recurrences'
import { LinkCandidatesDrawer } from './link-candidates-drawer'
import { useRecurrenceNotice } from './recurrence-notice'

type RuleProps = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  movementType: 'expense' | 'income' | 'transfer'
  ruleAccountId: string | null
  transferDestinationAccountId: string | null
}

type Props = RuleProps & {
  shared: boolean
}

/**
 * «YA LO PAGUÉ» ES EL MISMO FORMULARIO DE REGISTRO DE SIEMPRE, con la fecha en
 * hoy y editable, y el importe y la cuenta también editables. No dispara con los
 * valores por defecto: registrar un pago real —con el importe que efectivamente
 * salió, desde la cuenta que efectivamente se usó— es la función, y una versión
 * anterior la omitía. Mismos primitivos y misma advertencia de saldo negativo
 * que el bloque de vencimientos por revisar.
 *
 * ES UN COMPONENTE APARTE, Y SE MONTA SÓLO AL ABRIR. La lectura de cuentas vive
 * acá adentro: en la fila cerrada no hay consulta alguna, así que el hub no arma
 * una query por cada vencimiento listado, y una superficie que renderiza las
 * filas sin `QueryClientProvider` —como los tests del hub— no rompe. Montarlo de
 * nuevo en cada apertura es también lo que deja el formulario limpio sin un
 * «reset» a mano.
 */
const PayAheadForm = ({
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  movementType,
  ruleAccountId,
  transferDestinationAccountId,
  onDone,
  onCancel,
}: RuleProps & { onDone: () => void; onCancel: () => void }) => {
  const t = useTranslations('recurrences.link')
  const tRec = useTranslations('recurrences')
  const tTx = useTranslations('transactions')
  const notify = useRecurrenceNotice()
  const currency = ruleCurrency as 'ARS' | 'USD'

  const [amount, setAmount] = useState(String(ruleAmount))
  // La FECHA DE PAGO, hoy por defecto. El vencimiento no se toca.
  const [date, setDate] = useState(() => formatDateISO(getTodayAR()))
  const [accountId, setAccountId] = useState(ruleAccountId ?? '')
  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Ya está en cache por el header y el drawer (5 min de staleTime), así que en
  // la práctica no cuesta un fetch.
  const accountsQ = useQuery({
    queryKey: QUERY_KEYS.accountsList,
    queryFn: () => getAccounts(createClient()),
  })
  const accounts = useMemo(
    () => (accountsQ.data ? toFormAccounts(accountsQ.data) : undefined),
    [accountsQ.data],
  )
  const availableByAccount = useMemo(() => {
    if (!accountsQ.data) return undefined
    const map: Record<string, Record<'ARS' | 'USD', number>> = {}
    for (const account of [...accountsQ.data.cash, ...accountsQ.data.bank]) {
      map[account.id] = account.balances
    }
    return map
  }, [accountsQ.data])

  // Mismo criterio que el bloque de pendientes, que es lo que el servidor
  // revalida: la moneda la fija la regla (bimoneda, nunca se mezcla); un ingreso
  // o el origen de una transferencia no pueden ser una tarjeta; y una
  // transferencia no puede salir de su propio destino.
  const eligibleAccounts: MovementFormAccount[] = useMemo(() => {
    if (!accounts) return []
    return accounts.filter((account) => {
      if (!account.activeCurrencies.includes(currency)) return false
      if (movementType !== 'expense' && account.type === 'credit') return false
      if (movementType === 'transfer' && account.id === transferDestinationAccountId) return false
      return true
    })
  }, [accounts, currency, movementType, transferDestinationAccountId])

  const selectedAccount = eligibleAccounts.find((a) => a.id === accountId) ?? null

  // NO SE PUEDE CONFIRMAR HASTA TENER EL SALDO. La advertencia de saldo negativo
  // se calcula sobre `availableByAccount`, que no existe mientras la lectura de
  // cuentas está en vuelo: confirmar en ese hueco registra el pago sin la
  // advertencia que el spec exige. Y si la lectura falló, no hay cuentas que
  // elegir ni saldo con que avisar — se dice, en vez de dejar un botón que
  // registra a ciegas.
  const accountsReady = accountsQ.isSuccess

  // Advertencia blanda, no bloqueante: el pago dejaría la cuenta en negativo.
  // Los consumos de tarjeta —fuera del ledger— y los ingresos nunca avisan.
  const warning = (() => {
    if (!availableByAccount || !accountId) return null
    if (movementType !== 'expense' && movementType !== 'transfer') return null
    if (movementType === 'expense' && selectedAccount?.type === 'credit') return null
    const parsed = parseMoneyInput(amount)
    const value = parsed !== null && parsed > 0 ? parsed : ruleAmount
    const check = checkNegativeBalance(availableByAccount[accountId]?.[currency] ?? 0, value)
    return check.negative ? { projected: check.projected, currency } : null
  })()

  const submit = () => {
    setFormError(null)
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) {
      setFormError(tRec('errors.amount_invalid'))
      return
    }
    if (!accountId) {
      setFormError(tRec('pending.account_required'))
      return
    }
    startTransition(async () => {
      const result = await registerRecurrenceAhead({
        recurrenceId,
        dueDate,
        date,
        amount: parsed,
        accountId,
      })
      if (!result.ok) {
        setFormError(result.formError ?? null)
        return
      }
      // El acuse lo da la pantalla: esta fila está por desaparecer, así que el
      // mensaje sube al bloque que se queda.
      notify(tRec('link.recorded_success'))
      onDone()
    })
  }

  const creditBadge = (
    <span
      className="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta"
      style={{ backgroundColor: 'var(--terracotta-soft)' }}
    >
      {tTx('drawer.credit_badge')}
    </span>
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-page/40 p-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`ahead-amount-${recurrenceId}-${dueDate}`}
          className="text-xs text-muted-foreground"
        >
          {tRec('labels.amount')}
        </label>
        <div className="relative flex items-center">
          <MoneyAmountInput
            id={`ahead-amount-${recurrenceId}-${dueDate}`}
            value={amount}
            onChange={setAmount}
            className="w-full rounded-md border border-input bg-background px-2 py-1 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <MoneyCalculatorPopover
            seed={amount}
            onResult={setAmount}
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{tRec('pending.amount_changes_rule')}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{tRec('labels.account')}</span>
        <Popover
          open={accountPickerOpen}
          onOpenChange={setAccountPickerOpen}
          trigger={
            <button
              type="button"
              aria-label={tRec('labels.account')}
              className="flex w-full items-center gap-2.5 rounded-md border border-input bg-background px-2 py-1.5 text-left text-sm transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {selectedAccount ? (
                <>
                  {selectedAccount.avatar && <AccountAvatar {...selectedAccount.avatar} size="sm" />}
                  <span className="min-w-0 flex-1 truncate font-semibold text-text">
                    {selectedAccount.name}
                  </span>
                  {selectedAccount.type === 'credit' && creditBadge}
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate text-text-muted">
                  {tRec('pending.account_placeholder')}
                </span>
              )}
              <ChevronDown className="size-4 shrink-0 text-text-soft" aria-hidden />
            </button>
          }
        >
          {accountsQ.isPending ? (
            <p className="px-2.5 py-2 text-sm text-text-muted">{t('accounts_loading')}</p>
          ) : accountsQ.isError ? (
            <p className="px-2.5 py-2 text-sm text-terracotta">{t('accounts_unavailable')}</p>
          ) : eligibleAccounts.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-text-muted">
              {tRec('pending.account_none_eligible')}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {eligibleAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setAccountId(account.id)
                    setAccountPickerOpen(false)
                  }}
                  className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
                >
                  {account.avatar && <AccountAvatar {...account.avatar} size="sm" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
                      {account.name}
                      {account.type === 'credit' && creditBadge}
                    </span>
                    {account.institutionName && (
                      <span className="truncate text-xs text-text-muted">
                        {account.institutionName}
                      </span>
                    )}
                  </span>
                  {accountId === account.id && (
                    <Check className="size-4 shrink-0 text-emerald" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          )}
        </Popover>
        <p className="text-[11px] text-muted-foreground">{tRec('pending.account_instance_only')}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`ahead-date-${recurrenceId}-${dueDate}`}
          className="text-xs text-muted-foreground"
        >
          {tRec('labels_extra.date')}
        </label>
        <DatePicker
          id={`ahead-date-${recurrenceId}-${dueDate}`}
          value={date}
          onChange={setDate}
          label={tRec('labels_extra.date')}
        />
      </div>

      {warning && <NegativeBalanceNotice projected={warning.projected} currency={warning.currency} />}
      {accountsQ.isError && <Alert variant="error">{t('accounts_unavailable')}</Alert>}
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onPress={submit} disabled={pending || !accountsReady}>
          {pending ? tRec('pending.confirming') : tRec('pending.confirm')}
        </Button>
        <Button variant="ghost" onPress={onCancel} disabled={pending}>
          {t('convert_cancel')}
        </Button>
      </div>
    </div>
  )
}

/**
 * LAS DOS SALIDAS QUE ANTES NO EXISTÍAN, en la fila del vencimiento que todavía
 * no llegó.
 *
 * Hasta ahora esta tarjeta decía «Solo informativo» y no ofrecía nada: quien
 * pagaba el alquiler el 3 tenía que esperar al 23 o cargar el gasto a mano — y
 * cargarlo a mano es peor, porque el 23 la app se lo vuelve a proponer.
 *
 * Registrar el pago acá NO adelanta el calendario: el próximo vencimiento sigue
 * siendo el que la regla ya preveía.
 */
export const ResolveAheadActions = ({ shared, ...rule }: Props) => {
  const t = useTranslations('recurrences.link')
  const notify = useRecurrenceNotice()
  const [formOpen, setFormOpen] = useState(false)

  // ── «Ya lo tengo cargado» ──────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [widened, setWidened] = useState(false)

  // La lectura vive acá, disparada por el click, y no en un efecto del drawer:
  // un efecto que setea estado al abrirse es exactamente el patrón que el lint
  // del repo prohíbe, y además deja la carga atada al montaje en vez de a la
  // intención del usuario.
  const load = (widen: boolean) => {
    setCandidates(null)
    setLoadError(false)
    getRecurrenceLinkCandidates(rule.recurrenceId, rule.dueDate, widen)
      .then(setCandidates)
      .catch(() => {
        // «No hay» y «no sabemos» no son lo mismo: confundirlos manda al usuario
        // a cargar el gasto de nuevo, que es el duplicado que queremos evitar.
        setCandidates([])
        setLoadError(true)
      })
  }

  const openDrawer = () => {
    setWidened(false)
    setDrawerOpen(true)
    load(false)
  }

  const widen = () => {
    setWidened(true)
    load(true)
  }

  return (
    <>
      {formOpen ? (
        <PayAheadForm
          {...rule}
          onDone={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      ) : (
        // LAS DOS SALIDAS, UNA AL LADO DE LA OTRA Y CON EL MISMO PESO. El
        // primitivo `Button` es `w-full` por diseño, así que dos botones sueltos
        // se apilan y cada uno ocupa el ancho entero: quedaban dos bloques
        // enormes bajo cada fila. Cada uno va en su mitad.
        //
        // Las dos con `secondary`: con una llena y la otra fantasma, la primera
        // parecía la opción elegida y la segunda un texto suelto. No son eso —
        // son dos caminos equivalentes, y ninguno es el recomendado.
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <Button variant="secondary" size="xs" onPress={() => setFormOpen(true)}>
              {t('already_paid')}
            </Button>
          </div>
          <div className="flex-1">
            <Button variant="secondary" size="xs" onPress={openDrawer}>
              {t('already_loaded')}
            </Button>
          </div>
        </div>
      )}

      <LinkCandidatesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        recurrenceId={rule.recurrenceId}
        dueDate={rule.dueDate}
        ruleAmount={rule.ruleAmount}
        ruleCurrency={rule.ruleCurrency}
        shared={shared}
        candidates={candidates}
        loadError={loadError}
        widened={widened}
        onWiden={widen}
        onLinked={() => notify(t('linked_success'))}
      />
    </>
  )
}
