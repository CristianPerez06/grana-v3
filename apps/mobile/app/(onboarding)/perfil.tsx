import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { perfilSchema, ValidationError } from '@grana/validation'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { TextInput } from '../../components/ui/TextInput'
import { SelectableCard } from '../../components/ui/SelectableCard'
import { InstitutionPickerModal } from '../../components/ui/InstitutionPickerModal'
import { supabase } from '../../lib/supabase'
import { translateValidationMessage } from '../../lib/yup-locale'
import { t } from '../../lib/i18n'

type Mode = 'novato' | 'experto'

type Institution = { id: string; name: string }

type FieldErrors = Partial<
  Record<'mode' | 'has_bank_account' | 'institution_id' | 'bank_account_name', string>
>

export default function PerfilScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [hasBankAccount, setHasBankAccount] = useState(false)
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [institutionName, setInstitutionName] = useState<string | null>(null)
  const [bankAccountName, setBankAccountName] = useState('')
  const [pickerVisible, setPickerVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name')
        .order('name', { ascending: true })
      if (cancelled || error) return
      setInstitutions((data ?? []) as Institution[])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleModeChange = (next: Mode) => {
    setMode(next)
    if (next === 'novato') {
      setHasBankAccount(false)
      setInstitutionId(null)
      setInstitutionName(null)
      setBankAccountName('')
    }
  }

  const handleBankYes = () => setHasBankAccount(true)
  const handleBankNo = () => {
    setHasBankAccount(false)
    setInstitutionId(null)
    setInstitutionName(null)
    setBankAccountName('')
  }

  const handleSelectInstitution = (institution: Institution) => {
    setInstitutionId(institution.id)
    setInstitutionName(institution.name)
  }

  async function handleSubmit() {
    setFieldErrors({})
    setFormError(null)

    const values = {
      mode: mode ?? undefined,
      has_bank_account: mode === 'experto' ? hasBankAccount : false,
      institution_id: mode === 'experto' && hasBankAccount ? institutionId : null,
      bank_account_name:
        mode === 'experto' && hasBankAccount ? bankAccountName.trim() : undefined,
    }

    try {
      await perfilSchema.validate(values, { abortEarly: false })
    } catch (err) {
      if (err instanceof ValidationError) {
        const errs: FieldErrors = {}
        for (const issue of err.inner) {
          if (issue.path && !errs[issue.path as keyof FieldErrors]) {
            errs[issue.path as keyof FieldErrors] =
              translateValidationMessage(issue.message) ??
              t('onboarding.errors.generic')
          }
        }
        setFieldErrors(errs)
      } else {
        setFormError(t('onboarding.errors.generic'))
      }
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setFormError(t('onboarding.errors.generic'))
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ mode: values.mode })
        .eq('id', user.id)

      if (profileError) {
        setFormError(t('onboarding.errors.generic'))
        return
      }

      if (
        values.mode === 'experto' &&
        values.has_bank_account &&
        values.institution_id &&
        values.bank_account_name
      ) {
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            name: values.bank_account_name,
            type: 'bank',
            institution_id: values.institution_id,
          })
          .select('id')
          .single()

        if (accountError || !account) {
          setFormError(t('onboarding.errors.generic'))
          return
        }

        const { error: currenciesError } = await supabase
          .from('account_currencies')
          .insert([
            { account_id: account.id, currency_code: 'ARS', initial_balance: 0 },
            { account_id: account.id, currency_code: 'USD', initial_balance: 0 },
          ])

        if (currenciesError) {
          await supabase.from('accounts').delete().eq('id', account.id)
          setFormError(t('onboarding.errors.generic'))
          return
        }
      }

      router.replace('/(onboarding)/saldo-actual')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-page"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-md gap-8">
          <Text className="text-center text-2xl font-bold tracking-tight text-text">
            {t('onboarding.perfil.title')}
          </Text>

          <View className="gap-3">
            <Text className="text-sm font-medium text-text">
              {t('onboarding.perfil.mode_question')}
            </Text>
            <View className="gap-3">
              <SelectableCard
                title={t('onboarding.perfil.mode_simple_title')}
                description={t('onboarding.perfil.mode_simple_description')}
                selected={mode === 'novato'}
                onPress={() => handleModeChange('novato')}
              />
              <SelectableCard
                title={t('onboarding.perfil.mode_detailed_title')}
                description={t('onboarding.perfil.mode_detailed_description')}
                selected={mode === 'experto'}
                onPress={() => handleModeChange('experto')}
              />
            </View>
            {fieldErrors.mode ? (
              <Text className="text-xs text-error">
                {t('onboarding.errors.mode_required')}
              </Text>
            ) : null}
          </View>

          {mode === 'experto' ? (
            <View className="gap-3">
              <Text className="text-sm font-medium text-text">
                {t('onboarding.perfil.bank_question')}
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    title={t('onboarding.perfil.bank_yes')}
                    variant={hasBankAccount ? 'primary' : 'secondary'}
                    onPress={handleBankYes}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title={t('onboarding.perfil.bank_no')}
                    variant={!hasBankAccount ? 'primary' : 'secondary'}
                    onPress={handleBankNo}
                  />
                </View>
              </View>

              {hasBankAccount ? (
                <View className="gap-3 pt-2">
                  <View>
                    <Text className="mb-1 text-sm font-medium text-text">
                      {t('onboarding.perfil.institution_label')}
                    </Text>
                    <Pressable
                      onPress={() => setPickerVisible(true)}
                      accessibilityRole="button"
                      className="h-11 flex-row items-center rounded-lg border border-border bg-card px-3"
                    >
                      <Text
                        className={`text-sm ${
                          institutionName ? 'text-text' : 'text-text-soft'
                        }`}
                      >
                        {institutionName ??
                          t('onboarding.perfil.institution_placeholder')}
                      </Text>
                    </Pressable>
                    {fieldErrors.institution_id ? (
                      <Text className="mt-1 text-xs text-error">
                        {t('onboarding.errors.institution_required')}
                      </Text>
                    ) : null}
                  </View>

                  <TextInput
                    label={t('onboarding.perfil.account_name_label')}
                    value={bankAccountName}
                    onChangeText={setBankAccountName}
                    placeholder={t('onboarding.perfil.account_name_placeholder')}
                    error={
                      fieldErrors.bank_account_name
                        ? fieldErrors.bank_account_name ??
                          t('onboarding.errors.account_name_required')
                        : undefined
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <FormError message={formError} />

          <Button
            title={t('onboarding.perfil.continue')}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </ScrollView>

      <InstitutionPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        institutions={institutions}
        onSelect={handleSelectInstitution}
        selectedId={institutionId}
        title={t('onboarding.perfil.institution_label')}
        searchPlaceholder={t('onboarding.perfil.institution_placeholder')}
      />
    </KeyboardAvoidingView>
  )
}
