'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm, type Control } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import {
  initialBalanceSchema,
  type InitialBalanceInput,
  parseMoneyInput,
} from '@grana/validation'
import { saveInitialBalanceAction } from '@/app/_actions/onboarding'

type Account = { id: string; name: string; type: string }

type Props = {
  primaryAccount: Account
}

type FormShape = {
  primary_ars_str: string
  primary_usd_str: string
}

export const InitialBalanceForm = ({ primaryAccount }: Props) => {
  const t = useTranslations('onboarding.initialBalance')
  const tErr = useTranslations('onboarding.errors')
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormShape>({
    defaultValues: {
      primary_ars_str: '',
      primary_usd_str: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const parsed = parseAmountsOrFail(values)
    if (!parsed.ok) {
      setFormError(tErr(parsed.errorKey))
      return
    }

    // Primary ARS is mandatory (no skip allowed); the form requires the
    // user to declare at least their main ARS amount (zero is valid).
    if (parsed.data.primary_ars === undefined) {
      setFormError(tErr('primary_ars_required'))
      return
    }

    const input: InitialBalanceInput = {
      primary_account_id: primaryAccount.id,
      primary_ars: parsed.data.primary_ars,
      primary_usd: parsed.data.primary_usd,
    }

    // Manually run the schema as a safety net (the action also validates).
    try {
      await initialBalanceSchema.validate(input)
    } catch {
      setFormError(tErr('amount_invalid'))
      return
    }

    const result = await saveInitialBalanceAction(input)
    if (result.ok) {
      router.push('/onboarding/done')
      return
    }
    if (result.formError) setFormError(result.formError)
    else setFormError(tErr('generic'))
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('description')}</p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium">{t('group_total')}</p>
        <MoneyField
          name="primary_ars_str"
          control={control}
          label={t('ars_label')}
          placeholder={t('amount_placeholder')}
        />
        <MoneyField
          name="primary_usd_str"
          control={control}
          label={t('usd_label')}
          placeholder={t('amount_placeholder')}
        />
      </section>

      {formError && <Alert variant="error">{formError}</Alert>}

      <SubmitButton pending={isSubmitting}>{t('continue')}</SubmitButton>
    </form>
  )
}

const moneyInputClass = cn(
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text transition-colors duration-[var(--duration-fast)]',
  'placeholder:text-text-soft',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)

const MoneyField = ({
  name,
  control,
  label,
  placeholder,
}: {
  name: keyof FormShape
  control: Control<FormShape>
  label: string
  placeholder: string
}) => {
  const id = `onboarding-${name}`
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <MoneyAmountInput
            id={id}
            placeholder={placeholder}
            className={moneyInputClass}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        )}
      />
    </div>
  )
}

type ParsedAmounts = {
  primary_ars: number | undefined
  primary_usd: number | undefined
}

const parseAmountsOrFail = (
  values: FormShape,
): { ok: true; data: ParsedAmounts } | { ok: false; errorKey: 'amount_invalid' | 'amount_negative' } => {
  const fields: Array<[keyof FormShape, keyof ParsedAmounts]> = [
    ['primary_ars_str', 'primary_ars'],
    ['primary_usd_str', 'primary_usd'],
  ]
  const data: Partial<ParsedAmounts> = {}
  for (const [src, dest] of fields) {
    const raw = values[src]?.trim() ?? ''
    if (raw === '') {
      data[dest] = undefined
      continue
    }
    const n = parseMoneyInput(raw)
    if (n === null) return { ok: false, errorKey: 'amount_invalid' }
    if (n < 0) return { ok: false, errorKey: 'amount_negative' }
    data[dest] = n
  }
  return { ok: true, data: data as ParsedAmounts }
}
