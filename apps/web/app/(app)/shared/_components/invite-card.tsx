'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Share2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { createInvite } from '@/app/_actions/shared'

export function InviteCard() {
  const t = useTranslations('shared')
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const message = code ? t('invite.share_message', { code }) : ''

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await createInvite()
      if (!r.ok) setError(r.formError ?? 'Error')
      else setCode(r.code ?? null)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  // Native share sheet when available (mobile), else WhatsApp via wa.me.
  const share = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: message })
        return
      } catch {
        /* user cancelled — fall through to WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (!code) {
    return (
      <div className="flex flex-col gap-2">
        {error && <Alert variant="error">{error}</Alert>}
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {t('invite.generate_action')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-center font-mono text-base tracking-widest">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Copy className="size-4" aria-hidden />
          {copied ? t('invite.copied') : t('invite.copy_action')}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-4 py-2 text-sm font-medium text-white"
        >
          {t('invite.whatsapp_action')}
        </button>
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Share2 className="size-4" aria-hidden />
          {t('invite.share_action')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t('invite.hint')}</p>
    </div>
  )
}
