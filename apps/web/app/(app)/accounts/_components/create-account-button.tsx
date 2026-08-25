'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Fab } from '@/components/ui/fab'
import { CreateAccountForm } from '../new/_components/create-account-form'
import type { Institution } from '@/lib/accounts/types'

/**
 * Header action on the accounts list: opens the "Crear cuenta" drawer (the twin
 * of the edit drawer). Trigger and Drawer are colocated, so this owns the open
 * state directly — no context needed. The `/accounts/new` page stays as the
 * no-JS fallback. The form remounts on each open (`key`) to reset to clean state.
 */
type Props = {
  institutions: Institution[]
  disabled?: boolean
}

export function CreateAccountButton({ institutions, disabled = false }: Props) {
  const t = useTranslations('accounts')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  // Bridge: open the create drawer when arriving with `?nuevaCuenta=1` (e.g. the
  // onboarding "Mis cuentas" path), so account creation always shows in the
  // drawer — consistent with the rest of the app. We wait until institutions
  // are loaded (`disabled` flips false) so the form has its data, then clean the
  // param so a refresh or back-nav doesn't reopen it.
  const bridgedRef = useRef(false)
  useEffect(() => {
    if (bridgedRef.current || disabled) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevaCuenta') !== '1') return
    bridgedRef.current = true
    // Intentional: bridge the URL param to drawer state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormInstance((n) => n + 1)
    setOpen(true)
    params.delete('nuevaCuenta')
    const qs = params.toString()
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [disabled, router])

  const openCreate = () => {
    setFormInstance((n) => n + 1)
    setOpen(true)
  }

  return (
    <>
      <Button
        className="hidden w-auto md:inline-flex"
        disabled={disabled}
        onClick={openCreate}
      >
        <Plus className="size-4" aria-hidden />
        {t('actions.create')}
      </Button>
      <Fab label={t('actions.create')} disabled={disabled} onClick={openCreate} />
      <Drawer open={open} onClose={() => setOpen(false)} widthPx={540} ariaLabel={t('actions.create')}>
        <CreateAccountForm
          key={formInstance}
          institutions={institutions}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </>
  )
}
