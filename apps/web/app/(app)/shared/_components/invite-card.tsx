'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Share2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
        <Button type="button" onClick={generate} loading={busy} className="w-auto self-start px-4">
          {t('invite.generate_action')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-[var(--radius-md)] border border-border bg-border-soft px-3 py-2.5 text-center font-mono text-base tracking-widest text-text">
          {code}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copy}
          className="w-auto shrink-0 px-3"
        >
          <Copy className="size-4" aria-hidden />
          {copied ? t('invite.copied') : t('invite.copy_action')}
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() =>
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
          }
          className="w-auto px-4 bg-[#25D366] text-white hover:bg-[#1fb855] active:bg-[#1fb855]"
        >
          {t('invite.whatsapp_action')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={share}
          className="w-auto px-4"
        >
          <Share2 className="size-4" aria-hidden />
          {t('invite.share_action')}
        </Button>
      </div>
      <p className="text-xs text-text-muted">{t('invite.hint')}</p>
    </div>
  )
}
