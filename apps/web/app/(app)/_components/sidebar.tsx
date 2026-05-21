'use client'

import Link from 'next/link'
import { createContext, useContext, useState } from 'react'
import { LogOut, Menu, Settings } from 'lucide-react'
import { logoutAction } from '@/app/_actions/logout'

type SidebarState = {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarState>({
  collapsed: true,
  toggle: () => {},
})

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export const SidebarToggle = () => {
  const { toggle, collapsed } = useContext(SidebarContext)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      aria-expanded={!collapsed}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-text-soft transition-colors hover:bg-page hover:text-text"
    >
      <Menu size={20} strokeWidth={1.9} />
    </button>
  )
}

export const Sidebar = ({ logoutLabel }: { logoutLabel: string }) => {
  const { collapsed } = useContext(SidebarContext)

  return (
    <aside
      aria-label="Menú lateral"
      className={`shrink-0 border-r border-border-soft bg-card transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <nav className="flex flex-col gap-[2px] px-2 py-4">
        <SidebarLink
          href="/settings"
          icon={Settings}
          label="Configuración"
          collapsed={collapsed}
        />

        <div className="my-2 border-t border-border-soft" />

        <form action={logoutAction}>
          <button
            type="submit"
            aria-label={logoutLabel}
            title={collapsed ? logoutLabel : undefined}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-xl)] py-[13px] text-left text-error transition-colors hover:bg-page ${
              collapsed ? 'justify-center px-0' : 'px-4'
            }`}
          >
            <LogOut size={20} strokeWidth={1.9} />
            {!collapsed && (
              <span className="text-[14px] font-semibold">{logoutLabel}</span>
            )}
          </button>
        </form>
      </nav>
    </aside>
  )
}

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>

const SidebarLink = ({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string
  icon: IconType
  label: string
  collapsed: boolean
}) => (
  <Link
    href={href}
    aria-label={label}
    title={collapsed ? label : undefined}
    className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-xl)] py-[13px] text-text transition-colors hover:bg-page ${
      collapsed ? 'justify-center px-0' : 'px-4'
    }`}
  >
    <Icon size={20} strokeWidth={1.9} />
    {!collapsed && <span className="text-[14px] font-semibold">{label}</span>}
  </Link>
)
