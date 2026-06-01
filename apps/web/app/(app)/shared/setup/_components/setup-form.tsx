'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
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
      <div className="flex rounded-md border border-input overflow-hidden">
        {(['create', 'join'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-2 text-sm font-medium ${
              mode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
            }`}
          >
            {m === 'create' ? t('setup.create_action') : t('setup.join_action')}
          </button>
        ))}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {mode === 'create' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('setup.name_label')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('setup.name_placeholder')}
            maxLength={50}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('setup.code_label')}</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('setup.code_placeholder')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || (mode === 'create' ? !name.trim() : !code.trim())}
        className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {mode === 'create' ? t('setup.create_action') : t('setup.join_action')}
      </button>
    </form>
  )
}
