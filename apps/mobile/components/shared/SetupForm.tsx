import { useState } from 'react'
import { View, Text } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Segmented } from '../ui/Segmented'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { Alert } from '../ui/Alert'
import { useT } from '../../lib/locale-context'
import { createHousehold, joinHousehold } from '../../lib/shared/mutators'

// Mobile mirror of web's setup-form: create a household or join one with a code.
// On success the mutator invalidates the `['shared']` queries, so the home
// screen re-renders into the waiting/active state — no navigation needed here.
export function SetupForm() {
  const t = useT()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const value = mode === 'create' ? name : code
  const canSubmit = value.trim().length > 0 && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const res =
        mode === 'create'
          ? await createHousehold(queryClient, { name: name.trim() })
          : await joinHousehold(queryClient, { code: code.trim() })
      if (!res.ok) {
        const fieldError = res.fieldErrors ? Object.values(res.fieldErrors)[0] : undefined
        setError(res.formError ?? fieldError ?? 'No se pudo completar la acción.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-col gap-4 rounded-2xl border border-border bg-card shadow-sm p-5">
      <View className="flex-col gap-1">
        <Text className="text-lg font-semibold text-text">{t('shared.setup.title')}</Text>
        <Text className="text-sm text-text-muted">{t('shared.setup.description')}</Text>
      </View>

      <Segmented
        ariaLabel={t('shared.setup.title')}
        value={mode}
        onValueChange={(v) => {
          setMode(v as 'create' | 'join')
          setError(null)
        }}
        options={[
          { value: 'create', label: t('shared.setup.create_action') },
          { value: 'join', label: t('shared.setup.join_action') },
        ]}
      />

      {mode === 'create' ? (
        <FormField
          label={t('shared.setup.name_label')}
          placeholder={t('shared.setup.name_placeholder')}
          value={name}
          onChangeText={setName}
          maxLength={50}
          autoFocus
        />
      ) : (
        <FormField
          label={t('shared.setup.code_label')}
          placeholder={t('shared.setup.code_placeholder')}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      )}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Button variant="primary" onPress={submit} loading={submitting} disabled={!canSubmit}>
        {mode === 'create' ? t('shared.setup.create_action') : t('shared.setup.join_action')}
      </Button>
    </View>
  )
}
