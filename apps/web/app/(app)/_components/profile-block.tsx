/**
 * "Logged in as" identity: initial avatar, name, email. Rendered above the
 * settings/logout block in the desktop sidebar, and at the top of the mobile
 * menu sheet.
 *
 * The native `AppMenu` has no counterpart today. Keeping it on web is
 * deliberate: in an installed PWA the session is invisible and the browser may
 * hold several, so which account you are in is worth stating. See decision 4 of
 * `openspec/changes/mirror-native-chrome-on-web-mobile/design.md`.
 */
export const ProfileBlock = ({
  name,
  email,
  collapsed = false,
}: {
  name: string | null
  email: string | null
  collapsed?: boolean
}) => {
  const primary = name || email
  if (!primary) return null
  const initial = primary.charAt(0).toUpperCase()
  const secondary = name ? email : null
  const tooltip = secondary ? `${primary} · ${secondary}` : primary

  return (
    <div
      className={`flex shrink-0 items-center gap-3 pb-1 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
    >
      <span
        aria-hidden
        title={collapsed ? tooltip : undefined}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-positive/10 text-[13px] font-bold text-positive"
      >
        {initial}
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight text-text">{primary}</p>
          {secondary && (
            <p className="truncate text-[11px] leading-tight text-text-soft">{secondary}</p>
          )}
        </div>
      )}
    </div>
  )
}
