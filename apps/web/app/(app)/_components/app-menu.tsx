'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { CreditCard, LogOut, PiggyBank, Settings, Wallet, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { logoutAction } from '@/app/_actions/logout'
import { ProfileBlock } from './profile-block'

/**
 * The menu behind the tab bar's `⋯` button: a bottom sheet holding the
 * destinations that do not get a tab, plus logout. Mirrors
 * `apps/mobile/components/layout/AppMenu.tsx`.
 *
 * Built on `<dialog>` + `showModal()`, like the full-screen drawer it replaces,
 * so focus trapping, Esc-to-close and focus restoration come from the platform
 * rather than from us.
 */
export const AppMenu = ({
  open,
  onClose,
  userName,
  userEmail,
}: {
  open: boolean
  onClose: () => void
  userName: string | null
  userEmail: string | null
}) => {
  const tNav = useTranslations('nav')
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-label={tNav('more_options')}
      className={[
        // Bottom-anchored and full width: a `<dialog>` centers itself by
        // default, so both margins and insets are overridden here.
        'fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-[90dvh]',
        'rounded-t-[20px] bg-card p-0 text-text md:hidden',
        'translate-y-full open:translate-y-0',
        'starting:open:translate-y-full',
        'transition-[transform,display,overlay] duration-200 ease-out transition-discrete',
        'motion-reduce:transition-none',
        'backdrop:bg-black/30 backdrop:opacity-0 open:backdrop:opacity-100',
        'starting:open:backdrop:opacity-0',
        'backdrop:transition-[opacity,display,overlay] backdrop:duration-200 backdrop:transition-discrete',
        'motion-reduce:backdrop:transition-none',
      ].join(' ')}
    >
      <div className="flex flex-col pb-[max(8px,var(--safe-bottom))]">
        <div className="flex justify-center pt-3 pb-1">
          <span aria-hidden className="h-1 w-10 rounded-full bg-border-soft" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <span className="text-[14px] font-bold text-text">{tNav('more_options')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={tNav('close_menu')}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-page text-text-soft transition-colors hover:text-text"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <div className="pb-2">
          <ProfileBlock name={userName} email={userEmail} />
        </div>

        <div className="flex flex-col gap-[2px] px-4">
          <SheetLink href="/accounts" icon={Wallet} label={tNav('accounts')} onNavigate={onClose} />
          <SheetLink href="/savings" icon={PiggyBank} label={tNav('savings')} onNavigate={onClose} />
          <SheetLink href="/cards" icon={CreditCard} label={tNav('cards')} onNavigate={onClose} />
          <SheetLink
            href="/settings"
            icon={Settings}
            label={tNav('settings')}
            onNavigate={onClose}
          />

          <div className="my-2 border-t border-border-soft" />

          {/* Still a form posting to the server action, not an onClick. Native
              can call `supabase.auth.signOut()` directly; web's logout clears
              the session cookie server-side, so moving the menu from sidebar to
              sheet must not turn this into a button. */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-[13px] text-left text-[14px] font-semibold text-error transition-colors hover:bg-error/8"
            >
              <LogOut size={20} strokeWidth={1.9} />
              <span className="flex-1">{tNav('logout')}</span>
            </button>
          </form>
        </div>
      </div>
    </dialog>
  )
}

const SheetLink = ({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  onNavigate: () => void
}) => (
  <Link
    href={href}
    onClick={onNavigate}
    className="flex items-center gap-3 rounded-2xl px-4 py-[13px] text-[14px] font-semibold text-text transition-colors hover:bg-page"
  >
    <Icon size={20} strokeWidth={1.9} />
    <span className="flex-1">{label}</span>
  </Link>
)
