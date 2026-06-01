'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Segmented } from '@/components/ui/segmented'
import { createHousehold, joinHousehold } from '@/app/_actions/shared'

type Mode = 'create' | 'join'

export function SetupForm() {
  const t = useTranslations('shared')
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result =
        mode === 'create'
          ? await createHousehold({ name: name.trim() })
          : await joinHousehold({ code: code.trim() })
      if (!result.ok) {
        const fieldError =
          'fieldErrors' in result
            ? Object.values(result.fieldErrors ?? {})[0]
            : undefined
        setError(result.formError ?? fieldError ?? 'Error')
        return
      }
      router.push('/shared')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Segmented
        value={mode}
        onValueChange={(m) => setMode(m as Mode)}
        ariaLabel={t('setup.title')}
        options={[
          { value: 'create', label: t('setup.create_action') },
          { value: 'join', label: t('setup.join_action') },
        ]}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {mode === 'create' ? (
        <FormField
          label={t('setup.name_label')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('setup.name_placeholder')}
          maxLength={50}
        />
      ) : (
        <FormField
          label={t('setup.code_label')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('setup.code_placeholder')}
          className="font-mono tracking-widest"
        />
      )}

      <Button
        type="submit"
        loading={submitting}
        disabled={mode === 'create' ? !name.trim() : !code.trim()}
      >
        {mode === 'create' ? t('setup.create_action') : t('setup.join_action')}
      </Button>
    </form>
  )
}
