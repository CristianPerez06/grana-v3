'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
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
    register,
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
        <FormField
          label={t('ars_label')}
          placeholder={t('amount_placeholder')}
          inputMode="decimal"
          {...register('primary_ars_str')}
        />
        <FormField
          label={t('usd_label')}
          placeholder={t('amount_placeholder')}
          inputMode="decimal"
          {...register('primary_usd_str')}
        />
      </section>

      {formError && <Alert variant="error">{formError}</Alert>}

      <SubmitButton pending={isSubmitting}>{t('continue')}</SubmitButton>
    </form>
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
